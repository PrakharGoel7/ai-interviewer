import { ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CaseSummary } from '../../api/cases';
import { RUBRIC_KEYS, RUBRIC_LABELS, RubricKey } from '../../constants/rubrics';
import { formatDateLabel } from '../../utils/caseAnalytics';

export type DateRange = '7' | '30' | '90' | 'all';
export type SortOption = 'recent' | 'highest' | 'lowest';

export interface HistoryFilters {
  dateRange: DateRange;
  type: string;
  industry: string;
  minScore: number;
  maxScore: number;
  sort: SortOption;
  rubric?: RubricKey | string | null;
}

interface HistoryTabProps {
  cases: CaseSummary[];
  filters: HistoryFilters;
  onChangeFilters: (filters: HistoryFilters) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
}

const dateOptions: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' },
];

const sortOptions: { label: string; value: SortOption }[] = [
  { label: 'Most recent', value: 'recent' },
  { label: 'Highest overall score', value: 'highest' },
  { label: 'Lowest overall score', value: 'lowest' },
];

export default function HistoryTab({
  cases,
  filters,
  onChangeFilters,
  onLoadMore,
  hasMore,
  loading,
}: HistoryTabProps) {
  const optionSets = useMemo(() => buildFilterOptions(cases), [cases]);

  const filteredCases = useMemo(() => applyFilters(cases, filters), [cases, filters]);

  return (
    <div className="history-tab">
      <section className="card filters-card compact">
        <div className="card-header">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Case history</h2>
          </div>
        </div>
        <div className="filters-grid">
          <FilterField label="Date range">
            <select
              value={filters.dateRange}
              onChange={(evt) => onChangeFilters({ ...filters, dateRange: evt.target.value as DateRange })}
            >
              {dateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Case type">
            <select
              value={filters.type}
              onChange={(evt) => onChangeFilters({ ...filters, type: evt.target.value })}
            >
              <option value="all">All</option>
              {optionSets.types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Industry">
            <select
              value={filters.industry}
              onChange={(evt) => onChangeFilters({ ...filters, industry: evt.target.value })}
            >
              <option value="all">All</option>
              {optionSets.industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Average score">
            <DualRangeSlider
              min={0}
              max={5}
              step={0.1}
              value={[filters.minScore, filters.maxScore]}
              onChange={(nextMin, nextMax) =>
                onChangeFilters({ ...filters, minScore: nextMin, maxScore: nextMax })
              }
              helper={`${filters.minScore.toFixed(1)} – ${filters.maxScore.toFixed(1)}`}
            />
          </FilterField>
          <FilterField label="Sort by">
            <select
              value={filters.sort}
              onChange={(evt) => onChangeFilters({ ...filters, sort: evt.target.value as SortOption })}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
        </div>
      </section>

      <section className="card history-list-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Results</p>
            <h2>
              {filteredCases.length} cases{' '}
              <span className="muted micro">• Sorted by {sortLabel(filters.sort)}</span>
            </h2>
          </div>
        </div>
        <div className="history-list">
          {filteredCases.length ? (
            filteredCases.map((caseItem) => <CaseRow key={caseItem.id} summary={caseItem} />)
          ) : (
            <p className="muted">No cases match your filters.</p>
          )}
        </div>
        {hasMore && (
          <div className="history-actions">
            <button className="btn btn-secondary" type="button" onClick={onLoadMore} disabled={loading}>
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function CaseRow({ summary }: { summary: CaseSummary }) {
  const sortedRubrics = [...summary.rubrics].sort((a, b) => a.score - b.score);
  const weakest = sortedRubrics[0];
  const strongest = sortedRubrics[sortedRubrics.length - 1];

  return (
    <article className="history-row">
      <div className="history-row-header single-line">
        <div className="history-title-row">
          <p className="history-title">{summary.title}</p>
          <span className="score-badge">
            <span className="score-value">
              {typeof summary.overall_score === 'number' ? summary.overall_score.toFixed(1) : '—'}
            </span>
            <span className="score-denom">/5</span>
          </span>
        </div>
        <p className="muted micro history-meta-inline">
          {summary.type} · {summary.industry} • Completed {formatDateLabel(summary.completed_at)}
        </p>
        <Link className="btn btn-ghost tertiary" to={`/cases/${summary.id}`}>
          Open report →
        </Link>
      </div>
      <div className="history-row-scores grouped">
        <div>
          <p className="muted micro">Strongest</p>
          <p className="score-line">
            {strongest?.title ?? '—'} {strongest ? `${strongest.score.toFixed(1)} / 5` : ''}
          </p>
        </div>
        <div>
          <p className="muted micro">Weakest</p>
          <p className="score-line">
            {weakest?.title ?? '—'} {weakest ? `${weakest.score.toFixed(1)} / 5` : ''}
          </p>
        </div>
      </div>
    </article>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function buildFilterOptions(cases: CaseSummary[]) {
  const types = Array.from(new Set(cases.map((c) => c.type))).filter(Boolean).sort();
  const industries = Array.from(new Set(cases.map((c) => c.industry))).filter(Boolean).sort();
  return { types, industries };
}

function applyFilters(cases: CaseSummary[], filters: HistoryFilters) {
  const now = Date.now();
  const thresholdMs =
    filters.dateRange === 'all' ? null : now - Number(filters.dateRange) * 24 * 60 * 60 * 1000;

  return [...cases]
    .filter((caseItem) => {
      if (thresholdMs) {
        const completed = new Date(caseItem.completed_at).getTime();
        if (completed < thresholdMs) return false;
      }
      if (filters.type !== 'all' && caseItem.type !== filters.type) return false;
      if (filters.industry !== 'all' && caseItem.industry !== filters.industry) return false;
      const score = caseItem.overall_score;
      if (
        (filters.minScore > 0 || filters.maxScore < 5) &&
        (typeof score !== 'number' ||
          score < filters.minScore ||
          score > filters.maxScore)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === 'recent') {
        return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
      }
      if (filters.sort === 'highest') {
        return b.overall_score - a.overall_score;
      }
      return a.overall_score - b.overall_score;
    });
}

function DualRangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  helper,
}: {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (nextMin: number, nextMax: number) => void;
  helper: string;
}) {
  const [minValue, maxValue] = value;
  const minPercent = ((minValue - min) / (max - min)) * 100;
  const maxPercent = ((maxValue - min) / (max - min)) * 100;

  return (
    <div className="dual-range" aria-label={`Average score from ${minValue} to ${maxValue}`}>
      <div className="dual-range-track" />
      <div className="dual-range-highlight" style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={minValue}
        onChange={(evt) => {
          const next = Math.min(Number(evt.target.value), maxValue);
          onChange(parseFloat(next.toFixed(1)), maxValue);
        }}
        aria-label="Minimum average score"
        className="dual-range-input"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={maxValue}
        onChange={(evt) => {
          const next = Math.max(Number(evt.target.value), minValue);
          onChange(minValue, parseFloat(next.toFixed(1)));
        }}
        aria-label="Maximum average score"
        className="dual-range-input"
      />
      <p className="dual-range-helper">{helper}</p>
    </div>
  );
}

function sortLabel(sort: SortOption) {
  switch (sort) {
    case 'recent':
      return 'most recent';
    case 'highest':
      return 'highest score';
    case 'lowest':
      return 'lowest score';
    default:
      return 'most recent';
  }
}
