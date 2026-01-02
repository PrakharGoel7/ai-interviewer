import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { RUBRIC_KEYS, RUBRIC_LABELS } from '../constants/rubrics';
export default function ReportPage() {
    const location = useLocation();
    const { user, getAccessToken } = useAuth();
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [saveMessage, setSaveMessage] = useState(null);
    const savingRef = useRef(false);
    const [selectedKey, setSelectedKey] = useState(null);
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const mode = (searchParams.get('mode') || '').toLowerCase();
    const isIBMode = mode === 'ib';
    useEffect(() => {
        document.title = 'Minerva | Performance Report';
    }, []);
    useEffect(() => {
        let cancelled = false;
        let attempts = 0;
        setReport(null);
        setError(null);
        const load = async () => {
            if (cancelled)
                return;
            attempts += 1;
            try {
                const resp = await fetch(isIBMode ? '/api/ib/report' : '/api/report');
                if (!resp.ok)
                    throw new Error('Report not ready');
                const data = await resp.json();
                if (!cancelled) {
                    setReport(data);
                    setError(null);
                }
            }
            catch (err) {
                console.error(err);
                if (cancelled)
                    return;
                if (isIBMode && attempts < 5) {
                    setError('Report is still being prepared. Retrying…');
                    setTimeout(load, 1500);
                }
                else {
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
            if (!report || savingRef.current)
                return;
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
                if (!resp.ok)
                    throw new Error(await resp.text());
                //setSaveMessage('Saved to your progress.');
            }
            catch (err) {
                console.error(err);
                //setSaveMessage('Could not save this report.');
            }
        };
        saveReport();
    }, [report, user, getAccessToken]);
    const rubricsInOrder = useMemo(() => {
        if (!report)
            return [];
        if (isIBMode) {
            return report.rubrics ?? [];
        }
        const byKey = new Map(report.rubrics.map((rubric) => [rubric.key, rubric]));
        return RUBRIC_KEYS.map((key) => byKey.get(key)).filter(Boolean);
    }, [report, isIBMode]);
    const weakestRubric = useMemo(() => {
        if (!rubricsInOrder.length)
            return null;
        return rubricsInOrder.reduce((curr, item) => (curr && curr.score <= item.score ? curr : item));
    }, [rubricsInOrder]);
    useEffect(() => {
        if (!rubricsInOrder.length)
            return;
        setSelectedKey((prev) => prev ?? weakestRubric?.key ?? rubricsInOrder[0].key);
    }, [rubricsInOrder, weakestRubric]);
    const selectedRubric = useMemo(() => rubricsInOrder.find((rubric) => rubric.key === selectedKey) ?? rubricsInOrder[0], [rubricsInOrder, selectedKey]);
    const overallRating = useMemo(() => {
        if (!rubricsInOrder.length)
            return null;
        const total = rubricsInOrder.reduce((sum, rubric) => sum + (rubric.score ?? 0), 0);
        return (total / rubricsInOrder.length).toFixed(1);
    }, [rubricsInOrder]);
    const ratingNumber = overallRating ? parseFloat(overallRating) : null;
    const ratingProgress = ratingNumber != null ? Math.min(Math.max(ratingNumber / 5, 0), 1) : null;
    const ringSize = 120;
    const strokeWidth = 6;
    const ringRadius = (ringSize - strokeWidth) / 2;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ratingProgress != null ? ringCircumference * (1 - ratingProgress) : ringCircumference;
    const benchmarkKey = ratingNumber != null && ratingNumber >= 4
        ? 'ready'
        : ratingNumber != null && ratingNumber >= 3.2
            ? 'nearly'
            : ratingNumber != null && ratingNumber >= 2.5
                ? 'developing'
                : 'early';
    const verdictLine = (rubric) => {
        const source = rubric.improvements[0]?.text ?? rubric.strengths[0]?.text ?? 'No notable insight captured.';
        const trimmed = source.trim();
        const firstSentence = trimmed.split(/(?<=\.)\s+/)[0];
        return firstSentence || trimmed;
    };
    const heroSummary = useMemo(() => {
        const text = report?.overall.executiveSummary ?? '';
        if (!isIBMode)
            return text;
        const sentences = text.split(/(?<=\.)\s+/).filter(Boolean);
        const combined = sentences.slice(0, 2).join(' ') || text;
        return combined.length > 220 ? `${combined.slice(0, 217)}…` : combined;
    }, [report, isIBMode]);
    const tagList = useMemo(() => {
        if (!report)
            return [];
        const tags = [];
        if (report.case.productGroup && report.case.productGroup !== report.case.type) {
            tags.push(report.case.productGroup);
        }
        if (report.case.type)
            tags.push(report.case.type);
        if (report.case.industry)
            tags.push(report.case.industry);
        return tags;
    }, [report]);
    if (error) {
        return _jsx("div", { className: "page-shell", children: error });
    }
    if (!report) {
        return _jsx("div", { className: "page-shell", children: "Loading report\u2026" });
    }
    return (_jsxs("div", { className: "report-shell premium", children: [_jsxs("section", { className: "hero-card card", children: [_jsxs("div", { className: "hero-left", children: [_jsx("p", { className: "kicker", children: isIBMode ? 'IB Interview Performance Report' : 'Case Performance Report' }), _jsx("h1", { className: "hero-headline", children: report.case.title }), _jsx("div", { className: "summary-tags", children: tagList.map((tag) => (_jsx("span", { className: "tag", children: tag }, tag))) }), _jsxs("p", { className: "hero-meta", children: ["Completed ", report.case.completedAt, " \u00B7", ' ', Math.max(1, Math.round(report.case.durationSec / 60)), " min"] }), _jsx("p", { className: "hero-subhead", children: heroSummary }), saveMessage && _jsx("p", { className: "muted save-note", children: saveMessage })] }), _jsxs("div", { className: "hero-rating", "aria-label": ratingNumber != null
                            ? `Overall rating ${overallRating} out of 5. Interview-ready is 4.0 or higher.`
                            : 'Overall rating unavailable', children: [_jsx("p", { className: "kicker", children: "Overall rating" }), _jsxs("div", { className: "rating-inner", children: [_jsxs("div", { className: "rating-ring", children: [_jsxs("svg", { width: ringSize, height: ringSize, viewBox: `0 0 ${ringSize} ${ringSize}`, role: "img", "aria-hidden": "true", children: [_jsx("circle", { className: "ring-track", cx: ringSize / 2, cy: ringSize / 2, r: ringRadius, strokeWidth: strokeWidth }), _jsx("circle", { className: "ring-progress", cx: ringSize / 2, cy: ringSize / 2, r: ringRadius, strokeWidth: strokeWidth, strokeDasharray: ringCircumference, strokeDashoffset: ringOffset, transform: `rotate(-90 ${ringSize / 2} ${ringSize / 2})`, strokeLinecap: "round" })] }), _jsxs("div", { className: "ring-label", children: [_jsx("span", { children: overallRating ?? '—' }), _jsx("small", { children: "/ 5" })] })] }), _jsxs("div", { className: "rating-benchmarks", children: [_jsxs("div", { className: `bench-row ${benchmarkKey === 'ready' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Interview-ready" }), _jsx("span", { className: "value", children: "\u2265 4.0" })] }), _jsxs("div", { className: `bench-row ${benchmarkKey === 'nearly' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Nearly there" }), _jsx("span", { className: "value", children: "3.2 \u2013 3.9" })] }), _jsxs("div", { className: `bench-row ${benchmarkKey === 'developing' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Developing" }), _jsx("span", { className: "value", children: "2.5 \u2013 3.1" })] }), _jsxs("div", { className: `bench-row ${benchmarkKey === 'early' ? 'active' : ''}`, children: [_jsx("span", { className: "label", children: "Need more practice" }), _jsx("span", { className: "value", children: "< 2.5" })] })] })] })] })] }), _jsxs("section", { className: "scorecard card", children: [_jsxs("div", { className: "scorecard-header", children: [_jsxs("div", { children: [_jsx("p", { className: "kicker", children: "Scorecard" }), _jsx("h2", { children: "Performance by dimension" })] }), _jsx("p", { className: "muted", children: isIBMode
                                    ? 'Each stage captures the adapted question and feedback.'
                                    : 'Select a tile to view details below.' })] }), _jsx("div", { className: `scorecard-grid ${isIBMode ? 'ib-grid' : ''}`, children: rubricsInOrder.map((rubric) => {
                            const label = RUBRIC_LABELS[rubric.key] ?? rubric.title;
                            const selected = rubric.key === selectedRubric?.key;
                            return (_jsxs("button", { type: "button", className: `scorecard-tile ${selected ? 'selected' : ''}`, onClick: () => setSelectedKey(rubric.key), "aria-pressed": selected, children: [_jsx("p", { className: "tile-title", children: label }), _jsxs("div", { className: "tile-score", children: [_jsx("span", { children: rubric.score }), _jsx("small", { children: "/ 5" })] }), _jsx("p", { className: "tile-summary", children: verdictLine(rubric) })] }, rubric.key));
                        }) }), selectedRubric && (_jsxs("div", { className: "scorecard-details", "aria-live": "polite", children: [_jsx("h3", { children: selectedRubric.title }), _jsxs("div", { className: "details-grid", children: [_jsx(EvidenceSection, { title: "Strengths", items: selectedRubric.strengths }), _jsx(EvidenceSection, { title: "Areas for improvement", items: selectedRubric.improvements })] })] }))] })] }));
}
function EvidenceSection({ title, items }) {
    return (_jsxs("div", { className: "evidence-section", children: [_jsx("h4", { children: title }), _jsx("ul", { children: items.length ? (items.map((item, idx) => _jsx("li", { children: item.text }, idx))) : (_jsx("li", { children: "No insights captured." })) })] }));
}
