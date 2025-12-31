export async function fetchCases(token, page = 0, limit = 10) {
    const headers = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const resp = await fetch(`/api/cases?page=${page}&limit=${limit}`, { headers });
    if (!resp.ok) {
        throw new Error('Unable to load cases');
    }
    return resp.json();
}
export async function fetchCaseReport(token, caseId) {
    const headers = {};
    if (token)
        headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(`/api/cases/${caseId}`, { headers });
    if (!resp.ok)
        throw new Error('Unable to fetch case');
    return (await resp.json());
}
