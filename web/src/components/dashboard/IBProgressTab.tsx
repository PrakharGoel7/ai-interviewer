import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CaseSummary } from '../../api/cases';
import { formatDateLabel, sortCasesByDate } from '../../utils/caseAnalytics';

interface Props {
  cases: CaseSummary[];
}

const RING_SIZE = 120;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ROLLING_WINDOW = 3;

const IB_DIMENSIONS = [
  { key: 'accounting', label: 'Accounting Fundamentals' },
  { key: 'valuation', label: 'Valuation Basics' },
  { key: 'product', label: 'Product Group Specifics' },
  { key: 'sector', label: 'Industry Nuances' },
] as const;

const PRODUCT_GROUP_NAMES = [
  'M&A',
  'Equity Capital Markets',
  'Debt Capital Markets',
  'Leveraged Finance',
  'Sales & Trading',
  'Restructuring',
  'Hedge Fund Advisory',
];

const INDUSTRY_GROUP_NAMES = [
  'Consumer',
  'FIG',
  'Healthcare',
  'Industrials',
  'Oil & Gas',
  'Real Estate',
  'SaaS',
  'TMT',
];

const PRODUCT_GROUP_OPTIONS = PRODUCT_GROUP_NAMES.map((label) => ({
  label,
  key: normalizeToken(label),
}));

const INDUSTRY_GROUP_OPTIONS = INDUSTRY_GROUP_NAMES.map((label) => ({
  label,
  key: normalizeToken(label),
}));

type IBStageKey = (typeof IB_DIMENSIONS)[number]['key'];

export default function IBProgressTab({ cases }: Props) {
  const [selectedStage, setSelectedStage] = useState<'overall' | IBStageKey>('overall');
  const sortedCases = useMemo(() => sortCasesByDate(cases), [cases]);
  const lastUpdated = sortedCases.length
    ? new Date(sortedCases[sortedCases.length - 1].completed_at)
    : null;

  const rollingStats = useMemo(() => computeRollingStats(sortedCases), [sortedCases]);
  const overallStat = rollingStats.overall;
  const stageRollingStats = rollingStats.stage;
  const avgScore = overallStat?.avg ?? null;

  const stageRanking = useMemo(() => {
    return IB_DIMENSIONS.map((dim) => {
      const stat = stageRollingStats[dim.key];
      return { ...dim, avg: stat?.avg ?? null };
    })
      .filter((item) => item.avg !== null)
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }, [stageRollingStats]);

  const heroCopy =
    stageRanking.length >= 2
      ? `Strength in ${stageRanking[0].label}. Keep refining ${
          stageRanking[stageRanking.length - 1].label
        }.`
      : 'Track how each IB stage is trending across interviews.';

  const productCoverage = useMemo(
    () => aggregateCoverage(sortedCases, 'product', 'type', PRODUCT_GROUP_OPTIONS),
    [sortedCases]
  );
  const industryCoverage = useMemo(
    () => aggregateCoverage(sortedCases, 'sector', 'industry', INDUSTRY_GROUP_OPTIONS),
    [sortedCases]
  );
  const patternCards = useMemo(
    () => detectIBPatterns(sortedCases, productCoverage, industryCoverage),
    [sortedCases, productCoverage, industryCoverage]
  );

  const chartSeries = useMemo(() => {
    if (selectedStage === 'overall') {
      return sortedCases
        .map((caseItem) => ({
          label: formatDateLabel(caseItem.completed_at),
          score:
            typeof caseItem.overall_score === 'number' ? caseItem.overall_score : null,
        }))
        .filter((point) => point.score !== null) as { label: string; score: number }[];
    }
    return buildStageSeries(sortedCases, selectedStage);
  }, [sortedCases, selectedStage]);

  if (!cases.length) {
    return (
      <div className="card empty-state">
        <h3>No IB interviews yet</h3>
        <p>Complete an IB mock interview to start building your progress trends.</p>
        <div className="empty-actions">
          <a className="btn btn-primary" href="/ib_interview.html">
            Start IB case
          </a>
          <a className="btn btn-secondary" href="/interview.html">
            Start consulting case
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ib-progress progress-tab redesigned">
      <section className="card hero-card ib-hero">
        <div className="hero-copy">
          <p className="kicker">IB dashboard</p>
          <h1>Your investment banking readiness.</h1>
          <p className="hero-subhead">{heroCopy}</p>
          <p className="hero-meta">
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleDateString()}`
              : 'Awaiting first saved IB case'}
            {` · Last ${ROLLING_WINDOW} cases`}
          </p>
        </div>
        <div
          className="hero-summary-card rating"
          aria-label={
            avgScore != null
              ? `Overall rating ${avgScore.toFixed(1)} out of 5`
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
                  strokeDashoffset={ringOffset(avgScore)}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="ring-label">
                <span>{avgScore != null ? avgScore.toFixed(1) : '—'}</span>
                <small>/ 5</small>
              </div>
            </div>
            <div className="rating-right">
              <div className="rating-benchmarks">
                <div className={`bench-row ${overallTier(avgScore) === 'ready' ? 'active' : ''}`}>
                  <span className="label">Interview-ready</span>
                  <span className="value">≥ 4.0</span>
                </div>
                <div className={`bench-row ${overallTier(avgScore) === 'nearly' ? 'active' : ''}`}>
                  <span className="label">Nearly there</span>
                  <span className="value">3.2 – 3.9</span>
                </div>
                <div className={`bench-row ${overallTier(avgScore) === 'developing' ? 'active' : ''}`}>
                  <span className="label">Developing</span>
                  <span className="value">2.5 – 3.1</span>
                </div>
                <div className={`bench-row ${overallTier(avgScore) === 'early' ? 'active' : ''}`}>
                  <span className="label">Need more practice</span>
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
            <p className="kicker">Stage performance</p>
            <h2>Average score by stage</h2>
            <p className="snapshot-subtitle">
              Aggregated across every saved IB interview.
            </p>
          </div>
        </div>
        <div className="snapshot-grid two-cols">
          {IB_DIMENSIONS.map((dim) => {
            const stat = stageRollingStats[dim.key];
            const avg =
              stat?.avg !== null && stat?.avg !== undefined ? stat.avg.toFixed(1) : '—';
            return (
              <article key={dim.key} className="snapshot-row">
                <div>
                  <p className="snapshot-label">{dim.label}</p>
                  <p className="snapshot-score">
                    {avg}
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
            <h2>
              {selectedStage === 'overall'
                ? 'Overall score'
                : IB_DIMENSIONS.find((dim) => dim.key === selectedStage)?.label}
            </h2>
          </div>
          <select
            value={selectedStage}
            onChange={(evt) => setSelectedStage(evt.target.value as 'overall' | IBStageKey)}
          >
            <option value="overall">Overall</option>
            {IB_DIMENSIONS.map((dim) => (
              <option key={dim.key} value={dim.key}>
                {dim.label}
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

      <section className="card ib-coverage-card">
        <div className="card-header">
          <div>
            <p className="kicker">Performance by context</p>
            <h2>Product-group and industry-specific average scores</h2>
            <p className="muted micro">Product group specifics and industry nuances across saved IB interviews.</p>
          </div>
        </div>
        <div className="ib-coverage-grid">
          <div className="coverage-column">
            <p className="column-title">Product groups</p>
            <div className="coverage-list">
              {productCoverage.length ? (
                productCoverage.map((row) => <CoverageRow key={row.label} row={row} />)
              ) : (
                <p className="muted micro">Need additional interviews to show product-level data.</p>
              )}
            </div>
          </div>
          <div className="coverage-column">
            <p className="column-title">Industries</p>
            <div className="coverage-list">
              {industryCoverage.length ? (
                industryCoverage.map((row) => <CoverageRow key={row.label} row={row} />)
              ) : (
                <p className="muted micro">Need additional interviews to show industry-level data.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card signals-card">
        <div className="card-header">
          <div>
            <p className="kicker">Signals</p>
            <h2>Signals from your recent IB cases</h2>
          </div>
        </div>
        {patternCards.length ? (
          <div className="signals-grid">
            {patternCards.map((pattern) => (
              <article key={pattern.id} className="pattern-card">
                <p className="pattern-title">{pattern.title}</p>
                <p className="muted">{pattern.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No standout patterns detected yet.</p>
        )}
      </section>

      <section className="card recent-cases-card">
        <div className="card-header">
          <div>
            <p className="kicker">Recent interviews</p>
            <h2>Latest IB sessions</h2>
          </div>
        </div>
        <div className="recent-table">
          <div className="recent-header">
            <span>Interview</span>
            <span>Date</span>
            <span>Avg score</span>
            <span>Overall band</span>
          </div>
          {sortedCases.slice(0, 6).map((caseItem) => (
            <div key={caseItem.id} className="recent-row">
              <span>{caseItem.title}</span>
              <span>{new Date(caseItem.completed_at).toLocaleDateString()}</span>
              <span>{caseItem.overall_score?.toFixed(1) ?? '—'}</span>
              <span>{caseItem.overall_band}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ringOffset(score: number | null) {
  if (score == null) return RING_CIRCUMFERENCE;
  const clamped = Math.min(Math.max(score / 5, 0), 1);
  return RING_CIRCUMFERENCE * (1 - clamped);
}

function overallTier(score: number | null) {
  if (score == null) return null;
  if (score >= 4) return 'ready';
  if (score >= 3.2) return 'nearly';
  if (score >= 2.5) return 'developing';
  return 'early';
}

function buildStageSeries(cases: CaseSummary[], key: IBStageKey) {
  return sortCasesByDate(cases)
    .map((caseItem) => {
      const match = caseItem.rubrics.find((rubric) => rubric.key === key);
      if (typeof match?.score !== 'number') return null;
      return {
        label: formatDateLabel(caseItem.completed_at),
        score: match.score,
      };
    })
    .filter(Boolean) as { label: string; score: number }[];
}

type RollingStat = {
  key: 'overall' | IBStageKey;
  label: string;
  avg: number | null;
  prevAvg: number | null;
  delta: number | null;
  sample: number;
  prevSample: number;
};

function computeRollingStats(cases: CaseSummary[]) {
  const overallScores = cases.map((caseItem) => caseItem.overall_score);
  const overall = buildRollingStat('overall', 'Overall', overallScores);

  const stageScores: Record<IBStageKey, number[]> = {
    accounting: [],
    valuation: [],
    product: [],
    sector: [],
  };

  sortCasesByDate(cases).forEach((caseItem) => {
    caseItem.rubrics.forEach((rubric) => {
      const key = rubric.key as IBStageKey;
      if (!stageScores[key] || typeof rubric.score !== 'number') return;
      stageScores[key].push(rubric.score);
    });
  });

  const stageStats = {} as Record<IBStageKey, RollingStat>;
  IB_DIMENSIONS.forEach((dim) => {
    stageStats[dim.key] = buildRollingStat(dim.key, dim.label, stageScores[dim.key]);
  });

  return { overall, stage: stageStats };
}

function buildRollingStat(
  key: 'overall' | IBStageKey,
  label: string,
  scores: number[]
): RollingStat {
  const current = scores.slice(-ROLLING_WINDOW);
  const prev = scores.slice(-ROLLING_WINDOW * 2, -ROLLING_WINDOW);
  const avg = average(current);
  const prevAvg = average(prev);
  let delta: number | null = null;
  if (avg !== null && prevAvg !== null) {
    delta = avg - prevAvg;
  }
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

function average(values: number[]) {
  if (!values.length) return null;
  const valid = values.filter((value) => typeof value === 'number');
  if (!valid.length) return null;
  return valid.reduce((acc, value) => acc + value, 0) / valid.length;
}

function stdDev(values: number[]) {
  if (values.length < 2) return null;
  const avg = average(values);
  if (avg === null) return null;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

type CoverageOption = { label: string; key: string };
type CoverageStat = { label: string; avg: number | null; count: number };

function aggregateCoverage(
  cases: CaseSummary[],
  stageKey: Extract<IBStageKey, 'product' | 'sector'>,
  field: 'type' | 'industry',
  options: CoverageOption[]
): CoverageStat[] {
  const totals = new Map<string, { sum: number; count: number }>();
  cases.forEach((caseItem) => {
    const fieldValue = (field === 'type' ? caseItem.type : caseItem.industry) || '';
    if (!fieldValue.trim()) return;
    const normalized = normalizeToken(fieldValue);
    const rubric = caseItem.rubrics.find((item) => item.key === stageKey);
    if (typeof rubric?.score !== 'number') return;
    const entry = totals.get(normalized) ?? { sum: 0, count: 0 };
    entry.sum += rubric.score;
    entry.count += 1;
    totals.set(normalized, entry);
  });
  return options
    .map((option) => {
      const stat = totals.get(option.key);
      return {
        label: option.label,
        avg: stat && stat.count ? stat.sum / stat.count : null,
        count: stat?.count ?? 0,
      };
    })
    .filter((row) => row.count > 0 && row.avg !== null);
}

function CoverageRow({ row }: { row: CoverageStat }) {
  const percent = row.avg != null ? Math.min(100, (row.avg / 5) * 100) : 0;
  const scoreLabel = row.avg != null ? row.avg.toFixed(1) : '—';
  const countLabel = row.count
    ? `${row.count} case${row.count === 1 ? '' : 's'}`
    : 'Need data';
  return (
    <div className="coverage-row">
      <div className="coverage-meta">
        <p className="coverage-label">{row.label}</p>
        <p className="muted micro">{countLabel}</p>
      </div>
      <div className="coverage-bar">
        <div className="coverage-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="coverage-score">
        {scoreLabel}
        <span> /5</span>
      </p>
    </div>
  );
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

type PatternCard = {
  id: string;
  title: string;
  description: string;
  priority: number;
};

function detectIBPatterns(
  cases: CaseSummary[],
  productCoverage: CoverageStat[],
  industryCoverage: CoverageStat[]
): PatternCard[] {
  const sorted = sortCasesByDate(cases);
  const patterns: PatternCard[] = [];
  const stageScoreMap: Record<IBStageKey, number[]> = {
    accounting: [],
    valuation: [],
    product: [],
    sector: [],
  };
  sorted.forEach((caseItem) => {
    caseItem.rubrics.forEach((rubric) => {
      const key = rubric.key as IBStageKey;
      if (!stageScoreMap[key] || typeof rubric.score !== 'number') return;
      stageScoreMap[key].push(rubric.score);
    });
  });

  (Object.keys(stageScoreMap) as IBStageKey[]).forEach((key) => {
    const scores = stageScoreMap[key];
    if (!scores.length) return;
    const lastFive = scores.slice(-5);
    const prevThree = scores.slice(-6, -3);
    const lastThree = scores.slice(-3);
    if (lastFive.length === 5) {
      const weakCount = lastFive.filter((score) => score <= 3).length;
      if (weakCount >= 3) {
        patterns.push({
          id: `${key}-weak`,
          title: `Recurring weak spot: ${getLabelForStage(key)}`,
          description: 'Scored ≤3 in most of the last five IB interviews.',
          priority: 1,
        });
      }
    }
    if (lastThree.length === 3 && prevThree.length === 3) {
      const lastAvg = average(lastThree);
      const prevAvg = average(prevThree);
      if (lastAvg !== null && prevAvg !== null) {
        if (lastAvg - prevAvg >= 0.6) {
          patterns.push({
            id: `${key}-improving`,
            title: `Improving: ${getLabelForStage(key)}`,
            description: 'Latest three cases are up ≥0.6 vs. the prior three.',
            priority: 3,
          });
        } else if (prevAvg - lastAvg >= 0.6) {
          patterns.push({
            id: `${key}-regression`,
            title: `Regression detected: ${getLabelForStage(key)}`,
            description: 'Recent average dropped ≥0.6 compared with prior cases.',
            priority: 2,
          });
        }
      }
    }
    const lastSix = scores.slice(-6);
    if (lastSix.length === 6) {
      const volatility = stdDev(lastSix);
      if (volatility !== null && volatility >= 0.9) {
        patterns.push({
          id: `${key}-volatile`,
          title: `Volatile performance: ${getLabelForStage(key)}`,
          description: 'Scores swing widely across recent IB interviews.',
          priority: 4,
        });
      }
    }
  });

  const productStageScores = stageScoreMap.product;
  const productOverall =
    productStageScores.length && average(productStageScores) !== null
      ? average(productStageScores)!
      : null;
  if (productOverall !== null) {
    productCoverage.forEach((row) => {
      if (row.avg == null || row.count < 2) return;
      if (productOverall - row.avg >= 0.8) {
        patterns.push({
          id: `product-gap-${row.label}`,
          title: `Context gap: ${row.label}`,
          description: `Average Product Group Specifics score (${row.avg.toFixed(
            1
          )}) trails overall product average.`,
          priority: 5,
        });
      }
    });
  }

  const industryStageScores = stageScoreMap.sector;
  const industryOverall =
    industryStageScores.length && average(industryStageScores) !== null
      ? average(industryStageScores)!
      : null;
  if (industryOverall !== null) {
    industryCoverage.forEach((row) => {
      if (row.avg == null || row.count < 2) return;
      if (industryOverall - row.avg >= 0.8) {
        patterns.push({
          id: `industry-gap-${row.label}`,
          title: `Industry nuance gap: ${row.label}`,
          description: `Recent ${row.label} cases average ${row.avg.toFixed(
            1
          )}, notably below overall Industry Nuances.`,
          priority: 6,
        });
      }
    });
  }

  if (!patterns.length && sorted.length >= 6) {
    const overallScores = sorted
      .map((caseItem) => caseItem.overall_score)
      .filter((score): score is number => typeof score === 'number');
    const lastThree = overallScores.slice(-3);
    const prevThree = overallScores.slice(-6, -3);
    if (lastThree.length === 3 && prevThree.length === 3) {
      const lastAvg = average(lastThree);
      const prevAvg = average(prevThree);
      if (lastAvg !== null && prevAvg !== null && prevAvg - lastAvg >= 0.5) {
        patterns.push({
          id: 'overall-drop',
          title: 'Declining overall readiness',
          description: 'Overall average fell ≥0.5 compared with the previous window.',
          priority: 7,
        });
      }
    }
  }

  return patterns.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

function getLabelForStage(key: IBStageKey) {
  return IB_DIMENSIONS.find((dim) => dim.key === key)?.label ?? key;
}

function SnapshotDelta({ stat }: { stat?: RollingStat }) {
  const hasFullWindow =
    !!stat &&
    stat.sample >= ROLLING_WINDOW &&
    stat.prevSample >= ROLLING_WINDOW &&
    stat.delta !== null;
  let chipClass = 'delta-chip neutral';
  let chipText = '— 0.0';
  let aria = 'No change compared to previous cases';

  if (!hasFullWindow) {
    chipText = '—';
    aria = `Need ${ROLLING_WINDOW * 2} cases to compare performance`;
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
      {!hasFullWindow && <p className="muted micro">Need {ROLLING_WINDOW * 2} cases</p>}
    </div>
  );
}
