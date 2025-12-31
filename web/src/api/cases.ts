import { CaseReportJson } from '../types/report';

export interface CaseSummary {
  id: string;
  title: string;
  type: string;
  industry: string;
  completed_at: string;
  duration_sec: number;
  overall_band: string;
  overall_score: number;
  focus_keys: string[];
  high_keys: string[];
  rubrics: {
    key: string;
    title: string;
    score: number;
  }[];
}

export async function fetchCases(token: string | null, page = 0, limit = 10) {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(`/api/cases?page=${page}&limit=${limit}`, { headers });
  if (!resp.ok) {
    throw new Error('Unable to load cases');
  }
  return resp.json() as Promise<{ cases: CaseSummary[]; hasMore: boolean }>;
}

export async function fetchCaseReport(token: string | null, caseId: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`/api/cases/${caseId}`, { headers });
  if (!resp.ok) throw new Error('Unable to fetch case');
  return (await resp.json()) as { report: CaseReportJson };
}
