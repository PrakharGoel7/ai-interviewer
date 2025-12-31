import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthProvider';
async function fetchCase(caseId, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const resp = await fetch(`/api/cases/${caseId}`, { headers });
    if (!resp.ok)
        return null;
    return resp.json();
}
export default function CaseReport({ caseId }) {
    const { getAccessToken } = useAuth();
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        const load = async () => {
            const token = await getAccessToken();
            const data = await fetchCase(caseId, token);
            if (!data) {
                setError('Unable to load report');
                return;
            }
            setReport(data.report);
        };
        load();
    }, [caseId, getAccessToken]);
    if (error)
        return _jsx("p", { children: error });
    if (!report)
        return _jsx("p", { children: "Loading\u2026" });
    return (_jsxs("div", { children: [_jsx("h2", { children: report.case.title }), _jsx("p", { children: report.overall.executiveSummary }), _jsx("ul", { children: report.rubrics.map((rubric) => (_jsxs("li", { children: [rubric.title, ": ", rubric.score, " / 5"] }, rubric.key))) })] }));
}
