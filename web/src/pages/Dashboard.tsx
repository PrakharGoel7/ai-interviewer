import { useEffect, useMemo, useState } from 'react';
import { CaseSummary, fetchCases } from '../api/cases';
import { useAuth } from '../context/AuthProvider';
import ProgressTab from '../components/dashboard/ProgressTab';
import HistoryTab, { HistoryFilters } from '../components/dashboard/HistoryTab';
import { RUBRIC_LABELS, RubricKey } from '../constants/rubrics';

const DEFAULT_FILTERS: HistoryFilters = {
  dateRange: '30',
  type: 'all',
  industry: 'all',
  minScore: 0,
  maxScore: 5,
  sort: 'recent',
};

export default function Dashboard() {
  const { user, getAccessToken } = useAuth();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'progress' | 'history'>('progress');
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);

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
    setFilters((prev) => ({ ...prev, rubric: key }));
    setActiveTab('history');
  };

  return (
    <div className="dashboard-shell">
      <div className="view-toggle-row">
        <div></div>
        <div className="dashboard-tabs compact">
          <button
            type="button"
            className={activeTab === 'progress' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('progress')}
          >
            Progress
          </button>
          <button
            type="button"
            className={activeTab === 'history' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('history')}
          >
            Case history
          </button>
        </div>
      </div>

      {error && <div className="banner error-banner">{error}</div>}

      {loading && !cases.length ? (
        <div className="card">
          <p>Loading your data…</p>
        </div>
      ) : activeTab === 'progress' ? (
        <ProgressTab cases={cases} onViewHistory={handleViewHistory} />
      ) : (
        <HistoryTab
          cases={cases}
          filters={filters}
          onChangeFilters={setFilters}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={loadingMore}
        />
      )}
    </div>
  );
}
