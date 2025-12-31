import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDateLabel } from '../../utils/caseAnalytics';
const dateOptions = [
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'All time', value: 'all' },
];
const sortOptions = [
    { label: 'Most recent', value: 'recent' },
    { label: 'Highest overall score', value: 'highest' },
    { label: 'Lowest overall score', value: 'lowest' },
];
export default function HistoryTab({ cases, filters, onChangeFilters, onLoadMore, hasMore, loading, }) {
    const optionSets = useMemo(() => buildFilterOptions(cases), [cases]);
    const filteredCases = useMemo(() => applyFilters(cases, filters), [cases, filters]);
    return (_jsxs("div", { className: "history-tab", children: [_jsxs("section", { className: "card filters-card compact", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Filters" }), _jsx("h2", { children: "Case history" })] }) }), _jsxs("div", { className: "filters-grid", children: [_jsx(FilterField, { label: "Date range", children: _jsx("select", { value: filters.dateRange, onChange: (evt) => onChangeFilters({ ...filters, dateRange: evt.target.value }), children: dateOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) }) }), _jsx(FilterField, { label: "Case type", children: _jsxs("select", { value: filters.type, onChange: (evt) => onChangeFilters({ ...filters, type: evt.target.value }), children: [_jsx("option", { value: "all", children: "All" }), optionSets.types.map((type) => (_jsx("option", { value: type, children: type }, type)))] }) }), _jsx(FilterField, { label: "Industry", children: _jsxs("select", { value: filters.industry, onChange: (evt) => onChangeFilters({ ...filters, industry: evt.target.value }), children: [_jsx("option", { value: "all", children: "All" }), optionSets.industries.map((ind) => (_jsx("option", { value: ind, children: ind }, ind)))] }) }), _jsx(FilterField, { label: "Average score", children: _jsx(DualRangeSlider, { min: 0, max: 5, step: 0.1, value: [filters.minScore, filters.maxScore], onChange: (nextMin, nextMax) => onChangeFilters({ ...filters, minScore: nextMin, maxScore: nextMax }), helper: `${filters.minScore.toFixed(1)} – ${filters.maxScore.toFixed(1)}` }) }), _jsx(FilterField, { label: "Sort by", children: _jsx("select", { value: filters.sort, onChange: (evt) => onChangeFilters({ ...filters, sort: evt.target.value }), children: sortOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) }) })] })] }), _jsxs("section", { className: "card history-list-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Results" }), _jsxs("h2", { children: [filteredCases.length, " cases", ' ', _jsxs("span", { className: "muted micro", children: ["\u2022 Sorted by ", sortLabel(filters.sort)] })] })] }) }), _jsx("div", { className: "history-list", children: filteredCases.length ? (filteredCases.map((caseItem) => _jsx(CaseRow, { summary: caseItem }, caseItem.id))) : (_jsx("p", { className: "muted", children: "No cases match your filters." })) }), hasMore && (_jsx("div", { className: "history-actions", children: _jsx("button", { className: "btn btn-secondary", type: "button", onClick: onLoadMore, disabled: loading, children: loading ? 'Loading…' : 'Load more' }) }))] })] }));
}
function CaseRow({ summary }) {
    const sortedRubrics = [...summary.rubrics].sort((a, b) => a.score - b.score);
    const weakest = sortedRubrics[0];
    const strongest = sortedRubrics[sortedRubrics.length - 1];
    return (_jsxs("article", { className: "history-row", children: [_jsxs("div", { className: "history-row-header single-line", children: [_jsxs("div", { className: "history-title-row", children: [_jsx("p", { className: "history-title", children: summary.title }), _jsxs("span", { className: "score-badge", children: [_jsx("span", { className: "score-value", children: typeof summary.overall_score === 'number' ? summary.overall_score.toFixed(1) : '—' }), _jsx("span", { className: "score-denom", children: "/5" })] })] }), _jsxs("p", { className: "muted micro history-meta-inline", children: [summary.type, " \u00B7 ", summary.industry, " \u2022 Completed ", formatDateLabel(summary.completed_at)] }), _jsx(Link, { className: "btn btn-ghost tertiary", to: `/cases/${summary.id}`, children: "Open report \u2192" })] }), _jsxs("div", { className: "history-row-scores grouped", children: [_jsxs("div", { children: [_jsx("p", { className: "muted micro", children: "Strongest" }), _jsxs("p", { className: "score-line", children: [strongest?.title ?? '—', " ", strongest ? `${strongest.score.toFixed(1)} / 5` : ''] })] }), _jsxs("div", { children: [_jsx("p", { className: "muted micro", children: "Weakest" }), _jsxs("p", { className: "score-line", children: [weakest?.title ?? '—', " ", weakest ? `${weakest.score.toFixed(1)} / 5` : ''] })] })] })] }));
}
function FilterField({ label, children }) {
    return (_jsxs("label", { className: "filter-field", children: [_jsx("span", { children: label }), children] }));
}
function buildFilterOptions(cases) {
    const types = Array.from(new Set(cases.map((c) => c.type))).filter(Boolean).sort();
    const industries = Array.from(new Set(cases.map((c) => c.industry))).filter(Boolean).sort();
    return { types, industries };
}
function applyFilters(cases, filters) {
    const now = Date.now();
    const thresholdMs = filters.dateRange === 'all' ? null : now - Number(filters.dateRange) * 24 * 60 * 60 * 1000;
    return [...cases]
        .filter((caseItem) => {
        if (thresholdMs) {
            const completed = new Date(caseItem.completed_at).getTime();
            if (completed < thresholdMs)
                return false;
        }
        if (filters.type !== 'all' && caseItem.type !== filters.type)
            return false;
        if (filters.industry !== 'all' && caseItem.industry !== filters.industry)
            return false;
        const score = caseItem.overall_score;
        if ((filters.minScore > 0 || filters.maxScore < 5) &&
            (typeof score !== 'number' ||
                score < filters.minScore ||
                score > filters.maxScore)) {
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
function DualRangeSlider({ min, max, step, value, onChange, helper, }) {
    const [minValue, maxValue] = value;
    const minPercent = ((minValue - min) / (max - min)) * 100;
    const maxPercent = ((maxValue - min) / (max - min)) * 100;
    return (_jsxs("div", { className: "dual-range", "aria-label": `Average score from ${minValue} to ${maxValue}`, children: [_jsx("div", { className: "dual-range-track" }), _jsx("div", { className: "dual-range-highlight", style: { left: `${minPercent}%`, right: `${100 - maxPercent}%` } }), _jsx("input", { type: "range", min: min, max: max, step: step, value: minValue, onChange: (evt) => {
                    const next = Math.min(Number(evt.target.value), maxValue);
                    onChange(parseFloat(next.toFixed(1)), maxValue);
                }, "aria-label": "Minimum average score", className: "dual-range-input" }), _jsx("input", { type: "range", min: min, max: max, step: step, value: maxValue, onChange: (evt) => {
                    const next = Math.max(Number(evt.target.value), minValue);
                    onChange(minValue, parseFloat(next.toFixed(1)));
                }, "aria-label": "Maximum average score", className: "dual-range-input" }), _jsx("p", { className: "dual-range-helper", children: helper })] }));
}
function sortLabel(sort) {
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
