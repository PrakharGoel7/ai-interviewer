export interface RubricEvidence {
  text: string;
}

export interface RubricItem {
  key: string;
  title: string;
  score: number;
  strengths: RubricEvidence[];
  improvements: RubricEvidence[];
}

export interface CaseReportJson {
  case: {
    title: string;
    type: string;
    industry: string;
    completedAt: string;
    durationSec: number;
  };
  overall: {
    band: string;
    executiveSummary: string;
  };
  rubrics: RubricItem[];
}
