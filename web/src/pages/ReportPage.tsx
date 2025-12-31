import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { CaseReportJson } from '../types/report';
import { RUBRIC_KEYS, RUBRIC_LABELS, RubricKey } from '../constants/rubrics';

export default function ReportPage() {
  const location = useLocation();
  const { user, getAccessToken } = useAuth();
  const [report, setReport] = useState<CaseReportJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const savingRef = useRef(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const mode = (searchParams.get('mode') || '').toLowerCase();
  const isIBMode = mode === 'ib';

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    setReport(null);
    setError(null);

    const load = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const resp = await fetch(isIBMode ? '/api/ib/report' : '/api/report');
        if (!resp.ok) throw new Error('Report not ready');
        const data = await resp.json();
        if (!cancelled) {
          setReport(data);
          setError(null);
        }
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        if (isIBMode && attempts < 5) {
          setError('Report is still being prepared. Retrying…');
          setTimeout(load, 1500);
        } else {
          setError('Report not available yet.');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isIBMode]);

  useEffect(() => {
    const saveReport = async () => {
      if (!report || savingRef.current) return;
       if (isIBMode) return;
      if (!user) {
        setSaveMessage('Create an account to save this report.');
        return;
      }
      savingRef.current = true;
      try {
        const token = await getAccessToken();
        const resp = await fetch('/api/cases/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ report }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        //setSaveMessage('Saved to your progress.');
      } catch (err) {
        console.error(err);
        //setSaveMessage('Could not save this report.');
      }
    };
    saveReport();
  }, [report, user, getAccessToken, isIBMode]);

  const rubricsInOrder = useMemo(() => {
    if (!report) return [];
    if (isIBMode) {
      return report.rubrics ?? [];
    }
    const byKey = new Map(report.rubrics.map((rubric) => [rubric.key, rubric]));
    return RUBRIC_KEYS.map((key) => byKey.get(key)).filter(Boolean) as CaseReportJson['rubrics'];
  }, [report, isIBMode]);

  const weakestRubric = useMemo(() => {
    if (!rubricsInOrder.length) return null;
    return rubricsInOrder.reduce((curr, item) => (curr && curr.score <= item.score ? curr : item));
  }, [rubricsInOrder]);

  useEffect(() => {
    if (!rubricsInOrder.length) return;
    setSelectedKey((prev) => prev ?? weakestRubric?.key ?? rubricsInOrder[0].key);
  }, [rubricsInOrder, weakestRubric]);

  const selectedRubric = useMemo(
    () => rubricsInOrder.find((rubric) => rubric.key === selectedKey) ?? rubricsInOrder[0],
    [rubricsInOrder, selectedKey]
  );

  const overallRating = useMemo(() => {
    if (!rubricsInOrder.length) return null;
    const total = rubricsInOrder.reduce((sum, rubric) => sum + (rubric.score ?? 0), 0);
    return (total / rubricsInOrder.length).toFixed(1);
  }, [rubricsInOrder]);
  const ratingNumber = overallRating ? parseFloat(overallRating) : null;
  const ratingProgress = ratingNumber != null ? Math.min(Math.max(ratingNumber / 5, 0), 1) : null;
  const ringSize = 120;
  const strokeWidth = 6;
  const ringRadius = (ringSize - strokeWidth) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ratingProgress != null ? ringCircumference * (1 - ratingProgress) : ringCircumference;
  const benchmarkKey =
    ratingNumber != null && ratingNumber >= 4
      ? 'ready'
      : ratingNumber != null && ratingNumber >= 3.2
        ? 'nearly'
        : ratingNumber != null && ratingNumber >= 2.5
          ? 'developing'
          : 'early';

  const verdictLine = (rubric: CaseReportJson['rubrics'][number]) => {
    const source = rubric.improvements[0]?.text ?? rubric.strengths[0]?.text ?? 'No notable insight captured.';
    const trimmed = source.trim();
    const firstSentence = trimmed.split(/(?<=\.)\s+/)[0];
    return firstSentence || trimmed;
  };

  const heroSummary = useMemo(() => {
    if (!report) return '';
    const text = report.overall.executiveSummary || '';
    if (!isIBMode) return text;
    const firstSentence = text.split(/(?<=\.)\s+/)[0] || text;
    return firstSentence.length > 200 ? `${firstSentence.slice(0, 197)}…` : firstSentence;
  }, [report, isIBMode]);

  const formatEvidence = (items: { text: string }[], isImprovement: boolean) => {
    if (!isIBMode || !isImprovement) return items;
    return items.slice(0, 3).map((item) => {
      const trimmed = item.text.trim();
      const sentence = trimmed.split(/(?<=\.)\s+/)[0] || trimmed;
      const shortened = sentence.length > 160 ? `${sentence.slice(0, 157)}…` : sentence;
      return { text: shortened };
    });
  };

  if (error) {
    return <div className="page-shell">{error}</div>;
  }
  if (!report) {
    return <div className="page-shell">Loading report…</div>;
  }

  return (
    <div className="report-shell premium">
      <section className="hero-card card">
        <div className="hero-left">
          <p className="kicker">
            {isIBMode ? 'IB Interview Performance Report' : 'Case Performance Report'}
          </p>
          <h1 className="hero-headline">{report.case.title}</h1>
          <div className="summary-tags">
            <span className="tag">{report.case.type}</span>
            <span className="tag">{report.case.industry}</span>
          </div>
          <p className="hero-meta">
            Completed {report.case.completedAt} ·{' '}
            {Math.max(1, Math.round(report.case.durationSec / 60))} min
          </p>
          <p className="hero-subhead">{heroSummary}</p>
          {saveMessage && <p className="muted save-note">{saveMessage}</p>}
        </div>
        <div
          className="hero-rating"
          aria-label={
            ratingNumber != null
              ? `Overall rating ${overallRating} out of 5. Interview-ready is 4.0 or higher.`
              : 'Overall rating unavailable'
          }
        >
          <p className="kicker">Overall rating</p>
          <div className="rating-inner">
            <div className="rating-ring">
              <svg
                width={ringSize}
                height={ringSize}
                viewBox={`0 0 ${ringSize} ${ringSize}`}
                role="img"
                aria-hidden="true"
              >
                <circle
                  className="ring-track"
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  strokeWidth={strokeWidth}
                />
                <circle
                  className="ring-progress"
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  strokeWidth={strokeWidth}
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="ring-label">
                <span>{overallRating ?? '—'}</span>
                <small>/ 5</small>
              </div>
            </div>
            <div className="rating-benchmarks">
              <div className={`bench-row ${benchmarkKey === 'ready' ? 'active' : ''}`}>
                <span className="label">Interview-ready</span>
                <span className="value">≥ 4.0</span>
              </div>
              <div className={`bench-row ${benchmarkKey === 'nearly' ? 'active' : ''}`}>
                <span className="label">Nearly there</span>
                <span className="value">3.2 – 3.9</span>
              </div>
              <div className={`bench-row ${benchmarkKey === 'developing' ? 'active' : ''}`}>
                <span className="label">Developing</span>
                <span className="value">2.5 – 3.1</span>
              </div>
              <div className={`bench-row ${benchmarkKey === 'early' ? 'active' : ''}`}>
                <span className="label">Need more practice</span>
                <span className="value">&lt; 2.5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scorecard card">
        <div className="scorecard-header">
          <div>
            <p className="kicker">Scorecard</p>
            <h2>Performance by dimension</h2>
          </div>
          <p className="muted">
            {isIBMode
              ? 'Each stage captures the adapted question and feedback.'
              : 'Select a tile to view details below.'}
          </p>
        </div>
        <div className={`scorecard-grid ${isIBMode ? 'ib-grid' : ''}`}>
          {rubricsInOrder.map((rubric) => {
            const label = RUBRIC_LABELS[rubric.key as RubricKey] ?? rubric.title;
            const selected = rubric.key === selectedRubric?.key;
            return (
              <button
                key={rubric.key}
                type="button"
                className={`scorecard-tile ${selected ? 'selected' : ''}`}
                onClick={() => setSelectedKey(rubric.key)}
                aria-pressed={selected}
              >
                <p className="tile-title">{label}</p>
                <div className="tile-score">
                  <span>{rubric.score}</span>
                  <small>/ 5</small>
                </div>
                <p className="tile-summary">{verdictLine(rubric)}</p>
              </button>
            );
          })}
        </div>
        {selectedRubric && (
          <div className="scorecard-details" aria-live="polite">
            <h3>{selectedRubric.title}</h3>
            <div className="details-grid">
              <EvidenceSection
                title="Strengths"
                items={formatEvidence(selectedRubric.strengths, false)}
              />
              <EvidenceSection
                title="Areas for improvement"
                items={formatEvidence(selectedRubric.improvements, true)}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EvidenceSection({ title, items }: { title: string; items: { text: string }[] }) {
  return (
    <div className="evidence-section">
      <h4>{title}</h4>
      <ul>
        {items.length ? (
          items.map((item, idx) => <li key={idx}>{item.text}</li>)
        ) : (
          <li>No insights captured.</li>
        )}
      </ul>
    </div>
  );
}
