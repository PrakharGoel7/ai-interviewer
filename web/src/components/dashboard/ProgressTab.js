import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, } from 'recharts';
import { RUBRIC_KEYS, RUBRIC_LABELS } from '../../constants/rubrics';
import { average, buildRubricSeries, sortCasesByDate, stdDeviation, } from '../../utils/caseAnalytics';
const ROLLING_WINDOW = 3;
const CASE_TYPE_WINDOW = 20;
const RING_SIZE = 120;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
export default function ProgressTab({ cases, onViewHistory }) {
    const [selectedChartKey, setSelectedChartKey] = useState('overall');
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
    const chartSeries = useMemo(() => buildChartSeries(sortedCases, selectedChartKey), [sortedCases, selectedChartKey]);
    const caseTypeStats = useMemo(() => computeCaseTypeStats(sortedCases).slice(0, 6), [sortedCases]);
    const patternCards = useMemo(() => detectPatterns(sortedCases).slice(0, 3), [sortedCases]);
    if (!cases.length) {
        return (_jsxs("div", { className: "card empty-state", children: [_jsx("h3", { children: "No saved cases yet" }), _jsx("p", { children: "Complete a mock interview to start building your progress trends." }), _jsxs("div", { className: "empty-actions", children: [_jsx("a", { className: "btn btn-primary", href: "/interview.html", children: "Start consulting case" }), _jsx("a", { className: "btn btn-secondary", href: "/ib_interview.html", children: "Start IB case" })] })] }));
    }
    return (_jsxs("div", { className: "progress-tab redesigned", children: [_jsxs("section", { className: "card hero-card", children: [_jsxs("div", { className: "hero-copy", children: [_jsx("p", { className: "kicker", children: "Minerva dashboard" }), _jsx("h1", { children: "Your interview readiness." }), _jsx("p", { className: "hero-subhead", children: heroCopy }), _jsxs("p", { className: "hero-meta", children: [lastUpdated
                                        ? `Last updated ${lastUpdated.toLocaleDateString()}`
                                        : 'Awaiting first saved case', ` · Last ${ROLLING_WINDOW} cases`] })] }), _jsxs("div", { className: "hero-summary-card rating", "aria-label": overallStat?.avg != null
                            ? `Overall rating ${overallStat.avg.toFixed(1)} out of 5`
                            : 'Overall rating unavailable', children: [_jsx("p", { className: "kicker", children: "Readiness summary" }), _jsxs("div", { className: "rating-inner horizontal", children: [_jsxs("div", { className: "rating-ring", children: [_jsxs("svg", { width: RING_SIZE, height: RING_SIZE, viewBox: `0 0 ${RING_SIZE} ${RING_SIZE}`, role: "img", "aria-hidden": "true", children: [_jsx("circle", { className: "ring-track", cx: RING_SIZE / 2, cy: RING_SIZE / 2, r: RING_RADIUS, strokeWidth: RING_STROKE }), _jsx("circle", { className: "ring-progress", cx: RING_SIZE / 2, cy: RING_SIZE / 2, r: RING_RADIUS, strokeWidth: RING_STROKE, strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: ringOffset(overallStat?.avg), transform: `rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`, strokeLinecap: "round" })] }), _jsxs("div", { className: "ring-label", children: [_jsx("span", { children: overallStat?.avg !== null && overallStat?.avg !== undefined
                                                            ? overallStat.avg?.toFixed(1)
                                                            : '—' }), _jsx("small", { children: "/ 5" })] })] }), _jsx("div", { className: "rating-right", children: _jsxs("div", { className: "rating-benchmarks", children: [_jsxs("div", { className: `bench-row ${overallTier(overallStat?.avg) === 'ready' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Interview-ready" }), _jsx("span", { className: "value", children: "\u2265 4.0" })] }), _jsxs("div", { className: `bench-row ${overallTier(overallStat?.avg) === 'nearly' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Nearly there" }), _jsx("span", { className: "value", children: "3.2 \u2013 3.9" })] }), _jsxs("div", { className: `bench-row ${overallTier(overallStat?.avg) === 'developing' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Developing" }), _jsx("span", { className: "value", children: "2.5 \u2013 3.1" })] }), _jsxs("div", { className: `bench-row ${overallTier(overallStat?.avg) === 'early' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Early prep" }), _jsx("span", { className: "value", children: "< 2.5" })] })] }) })] })] })] }), _jsxs("section", { className: "card snapshot-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Performance snapshot" }), _jsx("h2", { children: "Performance Snapshot" }), _jsx("p", { className: "snapshot-subtitle", children: "Your last three cases, averaged and compared with the three before them." })] }) }), _jsx("div", { className: "snapshot-grid modern three-cols", children: RUBRIC_KEYS.map((key) => {
                            const stat = rollingStats[key];
                            return (_jsxs("article", { className: "snapshot-row", children: [_jsxs("div", { children: [_jsx("p", { className: "snapshot-label", children: RUBRIC_LABELS[key] }), _jsxs("p", { className: "snapshot-score", children: [stat?.avg !== null && stat?.avg !== undefined ? stat.avg?.toFixed(1) : '—', _jsx("span", { children: "/5" })] })] }), _jsx(SnapshotDelta, { stat: stat })] }, key));
                        }) })] }), _jsxs("section", { className: "card chart-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Progress over time" }), _jsx("h2", { children: selectedChartKey === 'overall' ? 'Overall score' : RUBRIC_LABELS[selectedChartKey] })] }), _jsxs("select", { value: selectedChartKey, onChange: (evt) => setSelectedChartKey(evt.target.value), children: [_jsx("option", { value: "overall", children: "Overall" }), RUBRIC_KEYS.map((key) => (_jsx("option", { value: key, children: RUBRIC_LABELS[key] }, key)))] })] }), _jsx("div", { className: "chart-shell", children: chartSeries.length ? (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(LineChart, { data: chartSeries, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "label", tick: false, axisLine: false }), _jsx(YAxis, { domain: [0, 5] }), _jsx(Tooltip, { formatter: (val) => {
                                            if (Array.isArray(val))
                                                return val;
                                            if (typeof val === 'number')
                                                return val.toFixed(2);
                                            return val ?? '—';
                                        } }), _jsx(Line, { type: "monotone", dataKey: "score", stroke: "#0F766E", strokeWidth: 2, dot: false, connectNulls: false })] }) })) : (_jsx("p", { className: "muted", children: "Not enough data yet." })) })] }), caseTypeStats.length >= 2 && (_jsxs("section", { className: "card case-type-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Performance by case type" }), _jsx("h2", { children: "Average overall score" })] }) }), _jsx("div", { className: "case-type-list", children: caseTypeStats.map((row) => (_jsxs("div", { className: "case-type-row", children: [_jsxs("div", { className: "case-type-meta", children: [_jsx("p", { className: "case-type-label", children: row.type }), _jsxs("p", { className: "muted micro", children: [row.count, " case", row.count === 1 ? '' : 's'] })] }), _jsx("div", { className: "case-type-bar", children: _jsx("div", { className: "case-type-fill", style: { width: `${Math.min(100, (row.avg / 5) * 100)}%` } }) }), _jsxs("p", { className: "case-type-score", children: [row.avg.toFixed(1), " / 5"] })] }, row.type))) })] })), _jsxs("section", { className: "card signals-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Signals" }), _jsx("h2", { children: "Signals from your recent cases" })] }) }), patternCards.length ? (_jsx("div", { className: "signals-grid", children: patternCards.map((pattern) => (_jsxs("article", { className: "pattern-card", children: [_jsx("p", { className: "pattern-title", children: pattern.title }), _jsx("p", { className: "muted", children: pattern.description }), _jsx("button", { className: "btn btn-ghost", onClick: () => onViewHistory(pattern.key), type: "button", children: "View related cases" })] }, pattern.id))) })) : (_jsx("p", { className: "muted", children: "No standout patterns detected yet." }))] })] }));
}
function detectPatterns(cases) {
    const patterns = [];
    RUBRIC_KEYS.forEach((key) => {
        const scores = buildRubricSeries(cases, key).map((p) => p.score);
        if (!scores.length)
            return;
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
function computeRollingStats(cases) {
    const stats = {};
    const overallScores = cases.map((c) => c.overall_score);
    stats.overall = buildRollingStat('overall', 'Overall', overallScores);
    RUBRIC_KEYS.forEach((key) => {
        const series = buildRubricSeries(cases, key).map((p) => p.score);
        stats[key] = buildRollingStat(key, RUBRIC_LABELS[key], series);
    });
    return stats;
}
function buildRollingStat(key, label, scores) {
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
function findExtremaStat(stats, mode) {
    let best = null;
    RUBRIC_KEYS.forEach((key) => {
        const stat = stats[key];
        if (!stat || stat.avg === null)
            return;
        if (!best) {
            best = stat;
            return;
        }
        if (mode === 'max' && (stat.avg ?? 0) > (best.avg ?? 0))
            best = stat;
        if (mode === 'min' && (stat.avg ?? 0) < (best.avg ?? 0))
            best = stat;
    });
    return best;
}
function buildChartSeries(cases, key) {
    return cases.map((caseSummary, index) => {
        const score = key === 'overall'
            ? caseSummary.overall_score
            : caseSummary.rubrics.find((r) => r.key === key)?.score ?? null;
        return {
            label: `Case ${index + 1}`,
            score,
        };
    });
}
function computeCaseTypeStats(cases) {
    const recent = cases.slice(-CASE_TYPE_WINDOW);
    const bucket = new Map();
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
function formatSigned(value) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}`;
}
function DeltaPill({ stat }) {
    if (!stat || stat.delta === null) {
        return _jsx("span", { className: "delta-pill neutral", children: "Stable" });
    }
    if (stat.delta > 0)
        return _jsx("span", { className: "delta-pill positive", children: "Improving" });
    if (stat.delta < 0)
        return _jsx("span", { className: "delta-pill negative", children: "Declining" });
    return _jsx("span", { className: "delta-pill neutral", children: "Stable" });
}
function ringOffset(avg) {
    if (avg == null)
        return RING_CIRCUMFERENCE;
    const progress = Math.min(Math.max(avg / 5, 0), 1);
    return RING_CIRCUMFERENCE * (1 - progress);
}
function overallTier(avg) {
    if (avg == null)
        return 'unknown';
    if (avg >= 4)
        return 'ready';
    if (avg >= 3.2)
        return 'nearly';
    if (avg >= 2.5)
        return 'developing';
    return 'early';
}
function SnapshotDelta({ stat }) {
    const hasFullWindow = !!stat && stat.sample >= ROLLING_WINDOW && stat.prevSample >= ROLLING_WINDOW && stat.delta !== null;
    let chipClass = 'delta-chip neutral';
    let chipText = '— 0.0';
    let aria = 'No change compared to previous cases';
    if (!hasFullWindow) {
        chipText = '—';
        aria = 'Need more cases to compare performance';
    }
    else if (stat.delta > 0.05) {
        chipClass = 'delta-chip positive';
        chipText = `▲ +${stat.delta.toFixed(1)}`;
        aria = `Improving by ${stat.delta.toFixed(1)} versus previous ${ROLLING_WINDOW} cases`;
    }
    else if (stat.delta < -0.05) {
        chipClass = 'delta-chip negative';
        chipText = `▼ ${stat.delta.toFixed(1)}`;
        aria = `Declining by ${Math.abs(stat.delta).toFixed(1)} versus previous ${ROLLING_WINDOW} cases`;
    }
    else {
        chipClass = 'delta-chip neutral';
        chipText = '— 0.0';
        aria = `No change compared to previous ${ROLLING_WINDOW} cases`;
    }
    return (_jsxs("div", { className: "snapshot-delta-block", children: [_jsx("div", { className: chipClass, "aria-label": aria, children: chipText }), _jsx("p", { className: "muted micro", children: hasFullWindow ? '' : `Need ${ROLLING_WINDOW * 2} cases` })] }));
}
