import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from 'react-router-dom';
import CaseReport from '../components/CaseReport';
export default function CaseDetails() {
    const { id } = useParams();
    return (_jsxs("div", { className: "page-shell", children: [_jsx(Link, { to: "/dashboard", children: "\u2190 Back to dashboard" }), _jsx("h1", { children: "Case Details" }), id ? _jsx(CaseReport, { caseId: id }) : _jsx("p", { children: "Missing case id." })] }));
}
