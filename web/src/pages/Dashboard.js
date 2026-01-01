import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { fetchCases } from '../api/cases';
import { useAuth } from '../context/AuthProvider';
import ProgressTab from '../components/dashboard/ProgressTab';
import HistoryTab from '../components/dashboard/HistoryTab';
import IBProgressTab from '../components/dashboard/IBProgressTab';
const DEFAULT_FILTERS = {
    dateRange: '30',
    type: 'all',
    industry: 'all',
    minScore: 0,
    maxScore: 5,
    sort: 'recent',
    rubric: null,
};
const isIBCase = (caseItem) => caseItem.track === 'ib' ||
    ((caseItem.title || '').toLowerCase().includes('ib interview'));
export default function Dashboard() {
    const { user, getAccessToken } = useAuth();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('progress');
    const [consultingFilters, setConsultingFilters] = useState(DEFAULT_FILTERS);
    const [ibFilters, setIbFilters] = useState(DEFAULT_FILTERS);
    const [track, setTrack] = useState('consulting');
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
            }
            catch (err) {
                console.error(err);
                setError('Unable to load your saved cases.');
            }
            finally {
                setLoading(false);
            }
        };
        loadInitial();
    }, [getAccessToken]);
    const loadMore = async () => {
        if (!hasMore || loadingMore)
            return;
        setLoadingMore(true);
        try {
            const token = await getAccessToken();
            const nextPage = page + 1;
            const data = await fetchCases(token, nextPage);
            setCases((prev) => [...prev, ...data.cases]);
            setHasMore(data.hasMore);
            setPage(nextPage);
            setError(null);
        }
        catch (err) {
            console.error(err);
            setError('Unable to load additional cases.');
        }
        finally {
            setLoadingMore(false);
        }
    };
    const welcomeLine = useMemo(() => {
        if (!user?.email)
            return 'Track your progress across interviews.';
        const [localPart] = user.email.split('@');
        return `Good to see you, ${localPart}. Track your progress across interviews.`;
    }, [user]);
    const recentCases = useMemo(() => cases.slice(0, 5), [cases]);
    const previousCases = useMemo(() => cases.slice(5, 10), [cases]);
    const averageScore = useMemo(() => {
        if (!recentCases.length)
            return null;
        const values = recentCases
            .map((item) => item.overall_score)
            .filter((value) => typeof value === 'number');
        if (!values.length)
            return null;
        return values.reduce((acc, value) => acc + value, 0) / values.length;
    }, [recentCases]);
    const previousAverage = useMemo(() => {
        if (!previousCases.length)
            return null;
        const values = previousCases
            .map((item) => item.overall_score)
            .filter((value) => typeof value === 'number');
        if (!values.length)
            return null;
        return values.reduce((acc, value) => acc + value, 0) / values.length;
    }, [previousCases]);
    const deltaScore = useMemo(() => {
        if (averageScore === null || previousAverage === null)
            return null;
        return averageScore - previousAverage;
    }, [averageScore, previousAverage]);
    const { strongest, weakest } = useMemo(() => {
        const totals = {};
        recentCases.forEach((caseItem) => {
            caseItem.rubrics.forEach((rubric) => {
                if (typeof rubric.score !== 'number')
                    return;
                if (!totals[rubric.key])
                    totals[rubric.key] = { sum: 0, count: 0 };
                totals[rubric.key].sum += rubric.score;
                totals[rubric.key].count += 1;
            });
        });
        let strongestKey = null;
        let weakestKey = null;
        let strongestScore = -Infinity;
        let weakestScore = Infinity;
        Object.entries(totals).forEach(([key, value]) => {
            if (!value.count)
                return;
            const avg = value.sum / value.count;
            if (avg > strongestScore) {
                strongestScore = avg;
                strongestKey = key;
            }
            if (avg < weakestScore) {
                weakestScore = avg;
                weakestKey = key;
            }
        });
        return { strongest: strongestKey, weakest: weakestKey };
    }, [recentCases]);
    const handleViewHistory = (key) => {
        setConsultingFilters((prev) => ({ ...prev, rubric: key }));
        setActiveTab('history');
    };
    const consultingCases = useMemo(() => cases.filter((caseItem) => !isIBCase(caseItem)), [cases]);
    const ibCases = useMemo(() => cases.filter((caseItem) => isIBCase(caseItem)), [cases]);
    const handleTrackChange = (value) => {
        setTrack(value);
        setActiveTab('progress');
    };
    return (_jsxs("div", { className: "dashboard-shell", children: [_jsxs("div", { className: "view-toggle-row", children: [_jsxs("div", { className: "track-toggle", children: [_jsx("button", { type: "button", className: track === 'consulting' ? 'active' : '', onClick: () => handleTrackChange('consulting'), children: "Consulting" }), _jsx("button", { type: "button", className: track === 'ib' ? 'active' : '', onClick: () => handleTrackChange('ib'), children: "Investment banking" })] }), _jsxs("div", { className: "dashboard-tabs compact", children: [_jsx("button", { type: "button", className: activeTab === 'progress' ? 'tab active' : 'tab', onClick: () => setActiveTab('progress'), children: "Progress" }), _jsx("button", { type: "button", className: activeTab === 'history' ? 'tab active' : 'tab', onClick: () => setActiveTab('history'), children: "Case history" })] })] }), error && _jsx("div", { className: "banner error-banner", children: error }), loading && !cases.length ? (_jsx("div", { className: "card", children: _jsx("p", { children: "Loading your data\u2026" }) })) : track === 'consulting' ? (activeTab === 'progress' ? (_jsx(ProgressTab, { cases: consultingCases, onViewHistory: handleViewHistory })) : (_jsx(HistoryTab, { cases: consultingCases, filters: consultingFilters, onChangeFilters: setConsultingFilters, onLoadMore: loadMore, hasMore: hasMore, loading: loadingMore }))) : activeTab === 'progress' ? (_jsx(IBProgressTab, { cases: ibCases })) : (_jsx(HistoryTab, { cases: ibCases, filters: ibFilters, onChangeFilters: setIbFilters, onLoadMore: loadMore, hasMore: hasMore, loading: loadingMore }))] }));
}
