import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { formatDateLabel, sortCasesByDate } from '../../utils/caseAnalytics';
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
];
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
export default function IBProgressTab({ cases }) {
    const [selectedStage, setSelectedStage] = useState('overall');
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
    const heroCopy = stageRanking.length >= 2
        ? `Strength in ${stageRanking[0].label}. Keep refining ${stageRanking[stageRanking.length - 1].label}.`
        : 'Track how each IB stage is trending across interviews.';
    const productCoverage = useMemo(() => aggregateCoverage(sortedCases, 'product', 'type', PRODUCT_GROUP_OPTIONS), [sortedCases]);
    const industryCoverage = useMemo(() => aggregateCoverage(sortedCases, 'sector', 'industry', INDUSTRY_GROUP_OPTIONS), [sortedCases]);
    const patternCards = useMemo(() => detectIBPatterns(sortedCases, productCoverage, industryCoverage), [sortedCases, productCoverage, industryCoverage]);
    const chartSeries = useMemo(() => {
        if (selectedStage === 'overall') {
            return sortedCases
                .map((caseItem) => ({
                label: formatDateLabel(caseItem.completed_at),
                score: typeof caseItem.overall_score === 'number' ? caseItem.overall_score : null,
            }))
                .filter((point) => point.score !== null);
        }
        return buildStageSeries(sortedCases, selectedStage);
    }, [sortedCases, selectedStage]);
    if (!cases.length) {
        return (_jsxs("div", { className: "card empty-state", children: [_jsx("h3", { children: "No IB interviews yet" }), _jsx("p", { children: "Complete an IB mock interview to start building your progress trends." }), _jsxs("div", { className: "empty-actions", children: [_jsx("a", { className: "btn btn-primary", href: "/ib_interview.html", children: "Start IB case" }), _jsx("a", { className: "btn btn-secondary", href: "/interview.html", children: "Start consulting case" })] })] }));
    }
    return (_jsxs("div", { className: "ib-progress progress-tab redesigned", children: [_jsxs("section", { className: "card hero-card ib-hero", children: [_jsxs("div", { className: "hero-copy", children: [_jsx("p", { className: "kicker", children: "IB dashboard" }), _jsx("h1", { children: "Your investment banking readiness." }), _jsx("p", { className: "hero-subhead", children: heroCopy }), _jsxs("p", { className: "hero-meta", children: [lastUpdated
                                        ? `Last updated ${lastUpdated.toLocaleDateString()}`
                                        : 'Awaiting first saved IB case', ` · Last ${ROLLING_WINDOW} cases`] })] }), _jsxs("div", { className: "hero-summary-card rating", "aria-label": avgScore != null
                            ? `Overall rating ${avgScore.toFixed(1)} out of 5`
                            : 'Overall rating unavailable', children: [_jsx("p", { className: "kicker", children: "Readiness summary" }), _jsxs("div", { className: "rating-inner horizontal", children: [_jsxs("div", { className: "rating-ring", children: [_jsxs("svg", { width: RING_SIZE, height: RING_SIZE, viewBox: `0 0 ${RING_SIZE} ${RING_SIZE}`, role: "img", "aria-hidden": "true", children: [_jsx("circle", { className: "ring-track", cx: RING_SIZE / 2, cy: RING_SIZE / 2, r: RING_RADIUS, strokeWidth: RING_STROKE }), _jsx("circle", { className: "ring-progress", cx: RING_SIZE / 2, cy: RING_SIZE / 2, r: RING_RADIUS, strokeWidth: RING_STROKE, strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: ringOffset(avgScore), transform: `rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`, strokeLinecap: "round" })] }), _jsxs("div", { className: "ring-label", children: [_jsx("span", { children: avgScore != null ? avgScore.toFixed(1) : '—' }), _jsx("small", { children: "/ 5" })] })] }), _jsx("div", { className: "rating-right", children: _jsxs("div", { className: "rating-benchmarks", children: [_jsxs("div", { className: `bench-row ${overallTier(avgScore) === 'ready' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Interview-ready" }), _jsx("span", { className: "value", children: "\u2265 4.0" })] }), _jsxs("div", { className: `bench-row ${overallTier(avgScore) === 'nearly' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Nearly there" }), _jsx("span", { className: "value", children: "3.2 \u2013 3.9" })] }), _jsxs("div", { className: `bench-row ${overallTier(avgScore) === 'developing' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Developing" }), _jsx("span", { className: "value", children: "2.5 \u2013 3.1" })] }), _jsxs("div", { className: `bench-row ${overallTier(avgScore) === 'early' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Need more practice" }), _jsx("span", { className: "value", children: "< 2.5" })] })] }) })] })] })] }), _jsxs("section", { className: "card snapshot-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Stage performance" }), _jsx("h2", { children: "Average score by stage" }), _jsx("p", { className: "snapshot-subtitle", children: "Aggregated across every saved IB interview." })] }) }), _jsx("div", { className: "snapshot-grid two-cols", children: IB_DIMENSIONS.map((dim) => {
                            const stat = stageRollingStats[dim.key];
                            const avg = stat?.avg !== null && stat?.avg !== undefined ? stat.avg.toFixed(1) : '—';
                            return (_jsxs("article", { className: "snapshot-row", children: [_jsxs("div", { children: [_jsx("p", { className: "snapshot-label", children: dim.label }), _jsxs("p", { className: "snapshot-score", children: [avg, _jsx("span", { children: "/5" })] })] }), _jsx(SnapshotDelta, { stat: stat })] }, dim.key));
                        }) })] }), _jsxs("section", { className: "card chart-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Progress over time" }), _jsx("h2", { children: selectedStage === 'overall'
                                            ? 'Overall score'
                                            : IB_DIMENSIONS.find((dim) => dim.key === selectedStage)?.label })] }), _jsxs("select", { value: selectedStage, onChange: (evt) => setSelectedStage(evt.target.value), children: [_jsx("option", { value: "overall", children: "Overall" }), IB_DIMENSIONS.map((dim) => (_jsx("option", { value: dim.key, children: dim.label }, dim.key)))] })] }), _jsx("div", { className: "chart-shell", children: chartSeries.length ? (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(LineChart, { data: chartSeries, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "label", tick: false, axisLine: false }), _jsx(YAxis, { domain: [0, 5] }), _jsx(Tooltip, { formatter: (val) => {
                                            if (Array.isArray(val))
                                                return val;
                                            if (typeof val === 'number')
                                                return val.toFixed(2);
                                            return val ?? '—';
                                        } }), _jsx(Line, { type: "monotone", dataKey: "score", stroke: "#0F766E", strokeWidth: 2, dot: false, connectNulls: false })] }) })) : (_jsx("p", { className: "muted", children: "Not enough data yet." })) })] }), _jsxs("section", { className: "card ib-coverage-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Performance by context" }), _jsx("h2", { children: "Product-group and industry-specific average scores" }), _jsx("p", { className: "muted micro", children: "Product group specifics and industry nuances across saved IB interviews." })] }) }), _jsxs("div", { className: "ib-coverage-grid", children: [_jsxs("div", { className: "coverage-column", children: [_jsx("p", { className: "column-title", children: "Product groups" }), _jsx("div", { className: "coverage-list", children: productCoverage.length ? (productCoverage.map((row) => _jsx(CoverageRow, { row: row }, row.label))) : (_jsx("p", { className: "muted micro", children: "Need additional interviews to show product-level data." })) })] }), _jsxs("div", { className: "coverage-column", children: [_jsx("p", { className: "column-title", children: "Industries" }), _jsx("div", { className: "coverage-list", children: industryCoverage.length ? (industryCoverage.map((row) => _jsx(CoverageRow, { row: row }, row.label))) : (_jsx("p", { className: "muted micro", children: "Need additional interviews to show industry-level data." })) })] })] })] }), _jsxs("section", { className: "card signals-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Signals" }), _jsx("h2", { children: "Signals from your recent IB cases" })] }) }), patternCards.length ? (_jsx("div", { className: "signals-grid", children: patternCards.map((pattern) => (_jsxs("article", { className: "pattern-card", children: [_jsx("p", { className: "pattern-title", children: pattern.title }), _jsx("p", { className: "muted", children: pattern.description })] }, pattern.id))) })) : (_jsx("p", { className: "muted", children: "No standout patterns detected yet." }))] })] }));
}
function ringOffset(score) {
    if (score == null)
        return RING_CIRCUMFERENCE;
    const clamped = Math.min(Math.max(score / 5, 0), 1);
    return RING_CIRCUMFERENCE * (1 - clamped);
}
function overallTier(score) {
    if (score == null)
        return null;
    if (score >= 4)
        return 'ready';
    if (score >= 3.2)
        return 'nearly';
    if (score >= 2.5)
        return 'developing';
    return 'early';
}
function buildStageSeries(cases, key) {
    return sortCasesByDate(cases)
        .map((caseItem) => {
        const match = caseItem.rubrics.find((rubric) => rubric.key === key);
        if (typeof match?.score !== 'number')
            return null;
        return {
            label: formatDateLabel(caseItem.completed_at),
            score: match.score,
        };
    })
        .filter(Boolean);
}
function computeRollingStats(cases) {
    const overallScores = cases.map((caseItem) => caseItem.overall_score);
    const overall = buildRollingStat('overall', 'Overall', overallScores);
    const stageScores = {
        accounting: [],
        valuation: [],
        product: [],
        sector: [],
    };
    sortCasesByDate(cases).forEach((caseItem) => {
        caseItem.rubrics.forEach((rubric) => {
            const key = rubric.key;
            if (!stageScores[key] || typeof rubric.score !== 'number')
                return;
            stageScores[key].push(rubric.score);
        });
    });
    const stageStats = {};
    IB_DIMENSIONS.forEach((dim) => {
        stageStats[dim.key] = buildRollingStat(dim.key, dim.label, stageScores[dim.key]);
    });
    return { overall, stage: stageStats };
}
function buildRollingStat(key, label, scores) {
    const current = scores.slice(-ROLLING_WINDOW);
    const prev = scores.slice(-ROLLING_WINDOW * 2, -ROLLING_WINDOW);
    const avg = average(current);
    const prevAvg = average(prev);
    let delta = null;
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
function average(values) {
    if (!values.length)
        return null;
    const valid = values.filter((value) => typeof value === 'number');
    if (!valid.length)
        return null;
    return valid.reduce((acc, value) => acc + value, 0) / valid.length;
}
function stdDev(values) {
    if (values.length < 2)
        return null;
    const avg = average(values);
    if (avg === null)
        return null;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}
function aggregateCoverage(cases, stageKey, field, options) {
    const totals = new Map();
    cases.forEach((caseItem) => {
        const fieldValue = (field === 'type' ? caseItem.type : caseItem.industry) || '';
        if (!fieldValue.trim())
            return;
        const normalized = normalizeToken(fieldValue);
        const rubric = caseItem.rubrics.find((item) => item.key === stageKey);
        if (typeof rubric?.score !== 'number')
            return;
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
function CoverageRow({ row }) {
    const percent = row.avg != null ? Math.min(100, (row.avg / 5) * 100) : 0;
    const scoreLabel = row.avg != null ? row.avg.toFixed(1) : '—';
    const countLabel = row.count
        ? `${row.count} case${row.count === 1 ? '' : 's'}`
        : 'Need data';
    return (_jsxs("div", { className: "coverage-row", children: [_jsxs("div", { className: "coverage-meta", children: [_jsx("p", { className: "coverage-label", children: row.label }), _jsx("p", { className: "muted micro", children: countLabel })] }), _jsx("div", { className: "coverage-bar", children: _jsx("div", { className: "coverage-fill", style: { width: `${percent}%` } }) }), _jsxs("p", { className: "coverage-score", children: [scoreLabel, _jsx("span", { children: " /5" })] })] }));
}
function normalizeToken(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function detectIBPatterns(cases, productCoverage, industryCoverage) {
    const sorted = sortCasesByDate(cases);
    const patterns = [];
    const stageScoreMap = {
        accounting: [],
        valuation: [],
        product: [],
        sector: [],
    };
    sorted.forEach((caseItem) => {
        caseItem.rubrics.forEach((rubric) => {
            const key = rubric.key;
            if (!stageScoreMap[key] || typeof rubric.score !== 'number')
                return;
            stageScoreMap[key].push(rubric.score);
        });
    });
    Object.keys(stageScoreMap).forEach((key) => {
        const scores = stageScoreMap[key];
        if (!scores.length)
            return;
        const lastThree = scores.slice(-3);
        const prevThree = scores.slice(-6, -3);
        if (lastThree.length === 3) {
            const weakCount = lastThree.filter((score) => score <= 3).length;
            if (weakCount >= 2) {
                patterns.push({
                    id: `${key}-weak`,
                    title: `Recurring weak spot: ${getLabelForStage(key)}`,
                    description: 'Scored ≤3 in most of the last few IB interviews.',
                    priority: 1,
                });
            }
            const strongCount = lastThree.filter((score) => score >= 4).length;
            if (strongCount >= 2) {
                patterns.push({
                    id: `${key}-strength`,
                    title: `Consistent strength: ${getLabelForStage(key)}`,
                    description: 'Recent IB interviews show repeated high performance here.',
                    priority: 4,
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
                }
                else if (prevAvg - lastAvg >= 0.6) {
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
    const productOverall = productStageScores.length && average(productStageScores) !== null
        ? average(productStageScores)
        : null;
    if (productOverall !== null) {
        productCoverage.forEach((row) => {
            if (row.avg == null || row.count < 2)
                return;
            if (productOverall - row.avg >= 0.8) {
                patterns.push({
                    id: `product-gap-${row.label}`,
                    title: `Context gap: ${row.label}`,
                    description: `Average Product Group Specifics score (${row.avg.toFixed(1)}) trails overall product average.`,
                    priority: 5,
                });
            }
        });
    }
    const industryStageScores = stageScoreMap.sector;
    const industryOverall = industryStageScores.length && average(industryStageScores) !== null
        ? average(industryStageScores)
        : null;
    if (industryOverall !== null) {
        industryCoverage.forEach((row) => {
            if (row.avg == null || row.count < 2)
                return;
            if (industryOverall - row.avg >= 0.8) {
                patterns.push({
                    id: `industry-gap-${row.label}`,
                    title: `Industry nuance gap: ${row.label}`,
                    description: `Recent ${row.label} cases average ${row.avg.toFixed(1)}, notably below overall Industry Nuances.`,
                    priority: 6,
                });
            }
        });
    }
    if (!patterns.length && sorted.length >= 6) {
        const overallScores = sorted
            .map((caseItem) => caseItem.overall_score)
            .filter((score) => typeof score === 'number');
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
function getLabelForStage(key) {
    return IB_DIMENSIONS.find((dim) => dim.key === key)?.label ?? key;
}
function SnapshotDelta({ stat }) {
    const hasFullWindow = !!stat &&
        stat.sample >= ROLLING_WINDOW &&
        stat.prevSample >= ROLLING_WINDOW &&
        stat.delta !== null;
    let chipClass = 'delta-chip neutral';
    let chipText = '— 0.0';
    let aria = 'No change compared to previous cases';
    if (!hasFullWindow) {
        chipText = '—';
        aria = `Need ${ROLLING_WINDOW * 2} cases to compare performance`;
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
    return (_jsxs("div", { className: "snapshot-delta-block", children: [_jsx("div", { className: chipClass, "aria-label": aria, children: chipText }), !hasFullWindow && _jsxs("p", { className: "muted micro", children: ["Need ", ROLLING_WINDOW * 2, " cases"] })] }));
}
