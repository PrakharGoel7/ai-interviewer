import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { CaseReportJson } from '../types/report';

async function fetchCase(caseId: string, token: string | null): Promise<{ report: CaseReportJson } | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch(`/api/cases/${caseId}`, { headers });
  if (!resp.ok) return null;
  return resp.json();
}

export default function CaseReport({ caseId }: { caseId: string }) {
  const { getAccessToken } = useAuth();
  const [report, setReport] = useState<CaseReportJson | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <p>{error}</p>;
  if (!report) return <p>Loading…</p>;

  return (
    <div>
      <h2>{report.case.title}</h2>
      <p>{report.overall.executiveSummary}</p>
      <ul>
        {report.rubrics.map((rubric) => (
          <li key={rubric.key}>
            {rubric.title}: {rubric.score} / 5
          </li>
        ))}
      </ul>
    </div>
  );
}
