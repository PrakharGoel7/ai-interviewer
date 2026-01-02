import { useEffect, useMemo, useState } from 'react';
import { CaseSummary, fetchCases } from '../api/cases';
import { useAuth } from '../context/AuthProvider';
import ProgressTab from '../components/dashboard/ProgressTab';
import HistoryTab, { HistoryFilters } from '../components/dashboard/HistoryTab';
import IBProgressTab from '../components/dashboard/IBProgressTab';
import { RubricKey } from '../constants/rubrics';

const DEFAULT_FILTERS: HistoryFilters = {
  dateRange: '30',
  type: 'all',
  industry: 'all',
  minScore: 0,
  maxScore: 5,
  sort: 'recent',
  rubric: null,
};

const isIBCase = (caseItem: CaseSummary) =>
  caseItem.track === 'ib' ||
  ((caseItem.title || '').toLowerCase().includes('ib interview'));

export default function Dashboard() {
  const { user, getAccessToken } = useAuth();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'progress' | 'history'>('progress');
  const [consultingFilters, setConsultingFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [ibFilters, setIbFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [track, setTrack] = useState<'consulting' | 'ib'>('consulting');

  useEffect(() => {
    document.title = 'Minerva | Progress Dashboard';
  }, []);

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      try {
        const token = await getAccessToken();
        const data = await fetchCases(token, 0);
        setCases(data.cases);
        setHasMore(data.hasMore);
        setPage(0);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Unable to load your saved cases.');
      } finally {
        setLoading(false);
      }
    };
    loadInitial();
  }, [getAccessToken]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const token = await getAccessToken();
      const nextPage = page + 1;
      const data = await fetchCases(token, nextPage);
      setCases((prev) => [...prev, ...data.cases]);
      setHasMore(data.hasMore);
      setPage(nextPage);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Unable to load additional cases.');
    } finally {
      setLoadingMore(false);
    }
  };

  const welcomeLine = useMemo(() => {
    if (!user?.email) return 'Track your progress across interviews.';
    const [localPart] = user.email.split('@');
    return `Good to see you, ${localPart}. Track your progress across interviews.`;
  }, [user]);

  const recentCases = useMemo(() => cases.slice(0, 5), [cases]);
  const previousCases = useMemo(() => cases.slice(5, 10), [cases]);

  const averageScore = useMemo(() => {
    if (!recentCases.length) return null;
    const values = recentCases
      .map((item) => item.overall_score)
      .filter((value) => typeof value === 'number');
    if (!values.length) return null;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }, [recentCases]);

  const previousAverage = useMemo(() => {
    if (!previousCases.length) return null;
    const values = previousCases
      .map((item) => item.overall_score)
      .filter((value) => typeof value === 'number');
    if (!values.length) return null;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }, [previousCases]);

  const deltaScore = useMemo(() => {
    if (averageScore === null || previousAverage === null) return null;
    return averageScore - previousAverage;
  }, [averageScore, previousAverage]);

  const { strongest, weakest } = useMemo(() => {
    const totals: Record<string, { sum: number; count: number }> = {};
    recentCases.forEach((caseItem) => {
      caseItem.rubrics.forEach((rubric) => {
        if (typeof rubric.score !== 'number') return;
        if (!totals[rubric.key]) totals[rubric.key] = { sum: 0, count: 0 };
        totals[rubric.key].sum += rubric.score;
        totals[rubric.key].count += 1;
      });
    });
    let strongestKey: RubricKey | null = null;
    let weakestKey: RubricKey | null = null;
    let strongestScore = -Infinity;
    let weakestScore = Infinity;
    Object.entries(totals).forEach(([key, value]) => {
      if (!value.count) return;
      const avg = value.sum / value.count;
      if (avg > strongestScore) {
        strongestScore = avg;
        strongestKey = key as RubricKey;
      }
      if (avg < weakestScore) {
        weakestScore = avg;
        weakestKey = key as RubricKey;
      }
    });
    return { strongest: strongestKey, weakest: weakestKey };
  }, [recentCases]);

  const handleViewHistory = (key: RubricKey) => {
    setConsultingFilters((prev) => ({ ...prev, rubric: key }));
    setActiveTab('history');
  };

  const consultingCases = useMemo(
    () => cases.filter((caseItem) => !isIBCase(caseItem)),
    [cases]
  );
  const ibCases = useMemo(
    () => cases.filter((caseItem) => isIBCase(caseItem)),
    [cases]
  );

  const handleTrackChange = (value: 'consulting' | 'ib') => {
    setTrack(value);
    setActiveTab('progress');
  };

  return (
    <div className="dashboard-shell">
      <div className="view-toggle-row">
        <div className="control-group mode-selector">
          <p className="control-label">Mode</p>
          <div className="track-toggle" role="tablist" aria-label="Interview mode">
            <button
              type="button"
              className={track === 'consulting' ? 'active' : ''}
              onClick={() => handleTrackChange('consulting')}
              aria-pressed={track === 'consulting'}
            >
              Consulting
            </button>
            <button
              type="button"
              className={track === 'ib' ? 'active' : ''}
              onClick={() => handleTrackChange('ib')}
              aria-pressed={track === 'ib'}
            >
              Investment banking
            </button>
          </div>
        </div>
        <div className="control-group view-selector">
          <p className="control-label subtle">View</p>
          <div className="dashboard-tabs compact view-tabs" role="tablist" aria-label="Dashboard view">
            <button
              type="button"
              className={activeTab === 'progress' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('progress')}
              aria-pressed={activeTab === 'progress'}
            >
              Progress
            </button>
            <button
              type="button"
              className={activeTab === 'history' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('history')}
              aria-pressed={activeTab === 'history'}
            >
              Case history
            </button>
          </div>
        </div>
      </div>

      {error && <div className="banner error-banner">{error}</div>}

      {loading && !cases.length ? (
        <div className="card">
          <p>Loading your data…</p>
        </div>
      ) : track === 'consulting' ? (
        activeTab === 'progress' ? (
          <ProgressTab cases={consultingCases} onViewHistory={handleViewHistory} />
        ) : (
          <HistoryTab
            cases={consultingCases}
            filters={consultingFilters}
            onChangeFilters={setConsultingFilters}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loading={loadingMore}
          />
        )
      ) : activeTab === 'progress' ? (
        <IBProgressTab cases={ibCases} />
      ) : (
        <HistoryTab
          cases={ibCases}
          filters={ibFilters}
          onChangeFilters={setIbFilters}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={loadingMore}
        />
      )}
    </div>
  );
}
