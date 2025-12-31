import { RUBRIC_KEYS } from '../constants/rubrics';
export const formatDateLabel = (isoString) => {
    const formatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
    return formatter.format(new Date(isoString));
};
export const sortCasesByDate = (cases) => [...cases].sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
export const getRubricScore = (summary, key) => {
    const match = summary.rubrics.find((item) => item.key === key);
    return typeof match?.score === 'number' ? match.score : null;
};
export const buildRubricSeries = (cases, key) => {
    return sortCasesByDate(cases)
        .map((summary) => {
        const score = getRubricScore(summary, key);
        if (score === null)
            return null;
        return {
            date: summary.completed_at,
            score,
        };
    })
        .filter(Boolean);
};
export const average = (values) => values.length ? values.reduce((acc, val) => acc + val, 0) / values.length : null;
export const stdDeviation = (values) => {
    if (values.length < 2)
        return null;
    const avg = average(values);
    if (avg === null)
        return null;
    const variance = values.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
};
export const rollingAverage = (values, count) => {
    if (!values.length)
        return null;
    const slice = values.slice(-count);
    if (!slice.length)
        return null;
    return average(slice);
};
export const windowAverage = (values, start, end) => {
    const slice = values.slice(start, end);
    if (!slice.length)
        return null;
    return average(slice);
};
export const computeOverallSeries = (cases) => sortCasesByDate(cases).map((summary) => ({
    date: summary.completed_at,
    overall: summary.overall_score,
}));
export const RUBRIC_SERIES_KEYS = RUBRIC_KEYS;
