import { Link, useParams } from 'react-router-dom';
import CaseReport from '../components/CaseReport';

export default function CaseDetails() {
  const { id } = useParams();
  return (
    <div className="page-shell">
      <Link to="/dashboard">← Back to dashboard</Link>
      <h1>Case Details</h1>
      {id ? <CaseReport caseId={id} /> : <p>Missing case id.</p>}
    </div>
  );
}
