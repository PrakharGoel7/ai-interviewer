import { useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { CaseSummary } from '../../api/cases';
import { RUBRIC_KEYS, RUBRIC_LABELS, RubricKey } from '../../constants/rubrics';
import {
  average,
  buildRubricSeries,
  computeOverallSeries,
  sortCasesByDate,
  stdDeviation,
} from '../../utils/caseAnalytics';

interface ProgressTabProps {
  cases: CaseSummary[];
  onViewHistory: (key: RubricKey) => void;
}

interface PatternCard {
  id: string;
  title: string;
  description: string;
  key: RubricKey;
  priority: number;
}

const ROLLING_WINDOW = 3;
const CASE_TYPE_WINDOW = 20;
const RING_SIZE = 120;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function ProgressTab({ cases, onViewHistory }: ProgressTabProps) {
  const [selectedChartKey, setSelectedChartKey] = useState<'overall' | RubricKey>('overall');

  const sortedCases = useMemo(() => sortCasesByDate(cases), [cases]);

  const rollingStats = useMemo(() => computeRollingStats(sortedCases), [sortedCases]);
  const overallStat = rollingStats.overall;
  const strongest = useMemo(() => findExtremaStat(rollingStats, 'max'), [rollingStats]);
  const weakest = useMemo(() => findExtremaStat(rollingStats, 'min'), [rollingStats]);
  const heroCopy = strongest && weakest
    ? `Strength in ${strongest.label}. Biggest opportunity in ${weakest.label}.`
    : 'Track how your structure, math, and synthesis are trending across interviews.';
  const lastUpdated = sortedCases.length
    ? new Date(sortedCases[sortedCases.length - 1].completed_at)
    : null;

  const chartSeries = useMemo(
    () => buildChartSeries(sortedCases, selectedChartKey),
    [sortedCases, selectedChartKey]
  );

  const caseTypeStats = useMemo(
    () => computeCaseTypeStats(sortedCases).slice(0, 6),
    [sortedCases]
  );

  const patternCards = useMemo(() => detectPatterns(sortedCases).slice(0, 3), [sortedCases]);

  if (!cases.length) {
    return (
      <div className="card empty-state">
        <h3>No saved cases yet</h3>
        <p>Complete a mock interview to start building your progress trends.</p>
        <div className="empty-actions">
          <a className="btn btn-primary" href="/interview.html">
            Start consulting case
          </a>
          <a className="btn btn-secondary" href="/ib_interview.html">
            Start IB case
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-tab redesigned">
      <section className="card hero-card">
        <div className="hero-copy">
          <p className="kicker">Minerva dashboard</p>
          <h1>Your interview readiness.</h1>
          <p className="hero-subhead">{heroCopy}</p>
          <p className="hero-meta">
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleDateString()}`
              : 'Awaiting first saved case'}
            {` · Last ${ROLLING_WINDOW} cases`}
          </p>
        </div>
        <div
          className="hero-summary-card rating"
          aria-label={
            overallStat?.avg != null
              ? `Overall rating ${overallStat.avg.toFixed(1)} out of 5`
              : 'Overall rating unavailable'
          }
        >
          <p className="kicker">Readiness summary</p>
          <div className="rating-inner horizontal">
            <div className="rating-ring">
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                role="img"
                aria-hidden="true"
              >
                <circle
                  className="ring-track"
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  strokeWidth={RING_STROKE}
                />
                <circle
                  className="ring-progress"
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  strokeWidth={RING_STROKE}
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset(overallStat?.avg)}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="ring-label">
                <span>
                  {overallStat?.avg !== null && overallStat?.avg !== undefined
                    ? overallStat.avg?.toFixed(1)
                    : '—'}
                </span>
                <small>/ 5</small>
              </div>
            </div>
            <div className="rating-right">
              <div className="rating-benchmarks">
                <div className={`bench-row ${overallTier(overallStat?.avg) === 'ready' ? 'active' : ''}`}>
                  <span className="label">Interview-ready</span>
                  <span className="value">≥ 4.0</span>
                </div>
                <div className={`bench-row ${overallTier(overallStat?.avg) === 'nearly' ? 'active' : ''}`}>
                  <span className="label">Nearly there</span>
                  <span className="value">3.2 – 3.9</span>
                </div>
                <div
                  className={`bench-row ${overallTier(overallStat?.avg) === 'developing' ? 'active' : ''}`}
                >
                  <span className="label">Developing</span>
                  <span className="value">2.5 – 3.1</span>
                </div>
                <div className={`bench-row ${overallTier(overallStat?.avg) === 'early' ? 'active' : ''}`}>
                  <span className="label">Early prep</span>
                  <span className="value">&lt; 2.5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card snapshot-card">
        <div className="card-header">
          <div>
            <p className="kicker">Performance snapshot</p>
            <h2>Performance Snapshot</h2>
            <p className="snapshot-subtitle">
              Your last three cases, averaged and compared with the three before them.
            </p>
         </div>
       </div>
        <div className="snapshot-grid modern three-cols">
          {RUBRIC_KEYS.map((key) => {
            const stat = rollingStats[key];
            return (
              <article key={key} className="snapshot-row">
                <div>
                  <p className="snapshot-label">{RUBRIC_LABELS[key]}</p>
                  <p className="snapshot-score">
                    {stat?.avg !== null && stat?.avg !== undefined ? stat.avg?.toFixed(1) : '—'}
                    <span>/5</span>
                  </p>
                </div>
                <SnapshotDelta stat={stat} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="card chart-card">
        <div className="card-header">
          <div>
            <p className="kicker">Progress over time</p>
            <h2>{selectedChartKey === 'overall' ? 'Overall score' : RUBRIC_LABELS[selectedChartKey]}</h2>
          </div>
          <select
            value={selectedChartKey}
            onChange={(evt) => setSelectedChartKey(evt.target.value as 'overall' | RubricKey)}
          >
            <option value="overall">Overall</option>
            {RUBRIC_KEYS.map((key) => (
              <option key={key} value={key}>
                {RUBRIC_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="chart-shell">
          {chartSeries.length ? (
            <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={false} axisLine={false} />
                  <YAxis domain={[0, 5]} />
                  <Tooltip
                    formatter={(val: number | string | Array<number | string>) => {
                    if (Array.isArray(val)) return val;
                    if (typeof val === 'number') return val.toFixed(2);
                    return val ?? '—';
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#0F766E"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">Not enough data yet.</p>
          )}
        </div>
      </section>

      {caseTypeStats.length >= 2 && (
        <section className="card case-type-card">
          <div className="card-header">
            <div>
              <p className="kicker">Performance by case type</p>
              <h2>Average overall score</h2>
            </div>
          </div>
          <div className="case-type-list">
            {caseTypeStats.map((row) => (
              <div key={row.type} className="case-type-row">
                <div className="case-type-meta">
                  <p className="case-type-label">{row.type}</p>
                  <p className="muted micro">{row.count} case{row.count === 1 ? '' : 's'}</p>
                </div>
                <div className="case-type-bar">
                  <div
                    className="case-type-fill"
                    style={{ width: `${Math.min(100, (row.avg / 5) * 100)}%` }}
                  />
                </div>
                <p className="case-type-score">{row.avg.toFixed(1)} / 5</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card signals-card">
        <div className="card-header">
          <div>
            <p className="kicker">Signals</p>
            <h2>Signals from your recent cases</h2>
          </div>
        </div>
        {patternCards.length ? (
          <div className="signals-grid">
            {patternCards.map((pattern) => (
              <article key={pattern.id} className="pattern-card">
                <p className="pattern-title">{pattern.title}</p>
                <p className="muted">{pattern.description}</p>
                <button
                  className="btn btn-ghost"
                  onClick={() => onViewHistory(pattern.key)}
                  type="button"
                >
                  View related cases
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No standout patterns detected yet.</p>
        )}
      </section>
    </div>
  );
}

type RollingStat = {
  key: 'overall' | RubricKey;
  label: string;
  avg: number | null;
  prevAvg: number | null;
  delta: number | null;
  sample: number;
  prevSample: number;
};

function detectPatterns(cases: CaseSummary[]): PatternCard[] {
  const patterns: PatternCard[] = [];
  RUBRIC_KEYS.forEach((key) => {
    const scores = buildRubricSeries(cases, key).map((p) => p.score);
    if (!scores.length) return;
    const lastFive = scores.slice(-5);
    const prevFive = scores.slice(-10, -5);
    const lastEight = scores.slice(-8);

    if (lastFive.length >= 5) {
      const weakCount = lastFive.filter((score) => score <= 3).length;
      if (weakCount >= 3) {
        patterns.push({
          id: `${key}-weak`,
          key,
          title: `Recurring weak spot: ${RUBRIC_LABELS[key]}`,
          description: 'Scored ≤3 in most of the last five cases. Revisit your toolkit here.',
          priority: 1,
        });
      }

      const strongCount = lastFive.filter((score) => score >= 4).length;
      if (strongCount >= 4) {
        patterns.push({
          id: `${key}-strength`,
          key,
          title: `Consistent strength: ${RUBRIC_LABELS[key]}`,
          description: 'Scores ≥4 in recent cases. Keep this standard while you focus elsewhere.',
          priority: 4,
        });
      }
    }

    if (lastFive.length >= 5 && prevFive.length >= 5) {
      const lastAvg = average(lastFive);
      const prevAvg = average(prevFive);
      if (lastAvg !== null && prevAvg !== null && lastAvg - prevAvg <= -0.6) {
        patterns.push({
          id: `${key}-regression`,
          key,
          title: `Regression detected: ${RUBRIC_LABELS[key]}`,
          description: 'Rolling average dropped ≥0.6 vs. the previous window.',
          priority: 2,
        });
      }
    }

    if (lastEight.length >= 8) {
      const volatility = stdDeviation(lastEight);
      if (volatility !== null && volatility >= 0.9) {
        patterns.push({
          id: `${key}-volatile`,
          key,
          title: `Volatile performance: ${RUBRIC_LABELS[key]}`,
          description: 'Scores have high variance. Build a more repeatable approach.',
          priority: 3,
        });
      }
    }
  });
  return patterns.sort((a, b) => a.priority - b.priority);
}

function computeRollingStats(cases: CaseSummary[]) {
  const stats: Record<string, RollingStat> = {};
  const overallScores = cases.map((c) => c.overall_score);
  stats.overall = buildRollingStat('overall', 'Overall', overallScores);
  RUBRIC_KEYS.forEach((key) => {
    const series = buildRubricSeries(cases, key).map((p) => p.score);
    stats[key] = buildRollingStat(key, RUBRIC_LABELS[key], series);
  });
  return stats;
}

function buildRollingStat(
  key: 'overall' | RubricKey,
  label: string,
  scores: number[]
): RollingStat {
  const current = scores.slice(-ROLLING_WINDOW);
  const prev = scores.slice(-ROLLING_WINDOW * 2, -ROLLING_WINDOW);
  const avg = average(current);
  const prevAvg = average(prev);
  const delta = avg !== null && prevAvg !== null ? avg - prevAvg : null;
  return {
    key,
    label,
    avg,
    prevAvg,
    delta,
    sample: current.length,
    prevSample: prev.length,
  };
}

function findExtremaStat(
  stats: Record<string, RollingStat>,
  mode: 'max' | 'min'
): RollingStat | null {
  let best: RollingStat | null = null;
  RUBRIC_KEYS.forEach((key) => {
    const stat = stats[key];
    if (!stat || stat.avg === null) return;
    if (!best) {
      best = stat;
      return;
    }
    if (mode === 'max' && (stat.avg ?? 0) > (best.avg ?? 0)) best = stat;
    if (mode === 'min' && (stat.avg ?? 0) < (best.avg ?? 0)) best = stat;
  });
  return best;
}

function buildChartSeries(cases: CaseSummary[], key: 'overall' | RubricKey) {
  return cases.map((caseSummary, index) => {
    const score =
      key === 'overall'
        ? caseSummary.overall_score
        : caseSummary.rubrics.find((r) => r.key === key)?.score ?? null;
    return {
      label: `Case ${index + 1}`,
      score,
    };
  });
}

function computeCaseTypeStats(cases: CaseSummary[]) {
  const recent = cases.slice(-CASE_TYPE_WINDOW);
  const bucket = new Map<string, { total: number; count: number }>();
  recent.forEach((c) => {
    const type = c.type || 'Unknown';
    const entry = bucket.get(type) ?? { total: 0, count: 0 };
    entry.total += c.overall_score;
    entry.count += 1;
    bucket.set(type, entry);
  });
  return Array.from(bucket.entries())
    .map(([type, { total, count }]) => ({ type, avg: total / count, count }))
    .sort((a, b) => b.avg - a.avg);
}

function formatSigned(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

function DeltaPill({ stat }: { stat?: RollingStat }) {
  if (!stat || stat.delta === null) {
    return <span className="delta-pill neutral">Stable</span>;
  }
  if (stat.delta > 0) return <span className="delta-pill positive">Improving</span>;
  if (stat.delta < 0) return <span className="delta-pill negative">Declining</span>;
  return <span className="delta-pill neutral">Stable</span>;
}

function ringOffset(avg?: number | null) {
  if (avg == null) return RING_CIRCUMFERENCE;
  const progress = Math.min(Math.max(avg / 5, 0), 1);
  return RING_CIRCUMFERENCE * (1 - progress);
}

function overallTier(avg?: number | null) {
  if (avg == null) return 'unknown';
  if (avg >= 4) return 'ready';
  if (avg >= 3.2) return 'nearly';
  if (avg >= 2.5) return 'developing';
  return 'early';
}

function SnapshotDelta({ stat }: { stat?: RollingStat }) {
  const hasFullWindow =
    !!stat && stat.sample >= ROLLING_WINDOW && stat.prevSample >= ROLLING_WINDOW && stat.delta !== null;
  let chipClass = 'delta-chip neutral';
  let chipText = '— 0.0';
  let aria = 'No change compared to previous cases';

  if (!hasFullWindow) {
    chipText = '—';
    aria = 'Need more cases to compare performance';
  } else if (stat!.delta! > 0.05) {
    chipClass = 'delta-chip positive';
    chipText = `▲ +${stat!.delta!.toFixed(1)}`;
    aria = `Improving by ${stat!.delta!.toFixed(1)} versus previous ${ROLLING_WINDOW} cases`;
  } else if (stat!.delta! < -0.05) {
    chipClass = 'delta-chip negative';
    chipText = `▼ ${stat!.delta!.toFixed(1)}`;
    aria = `Declining by ${Math.abs(stat!.delta!).toFixed(1)} versus previous ${ROLLING_WINDOW} cases`;
  } else {
    chipClass = 'delta-chip neutral';
    chipText = '— 0.0';
    aria = `No change compared to previous ${ROLLING_WINDOW} cases`;
  }

  return (
    <div className="snapshot-delta-block">
      <div className={chipClass} aria-label={aria}>
        {chipText}
      </div>
      <p className="muted micro">
        {hasFullWindow ? '' : `Need ${ROLLING_WINDOW * 2} cases`}
      </p>
    </div>
  );
}
