export const RUBRIC_KEYS = [
  'framework_structuring',
  'graph_interpretation',
  'quantitative_analysis',
  'creative_problem_solving',
  'synthesis_recommendation',
  'communication',
] as const;

export type RubricKey = (typeof RUBRIC_KEYS)[number];

export const RUBRIC_LABELS: Record<RubricKey, string> = {
  framework_structuring: 'Framework Structuring',
  graph_interpretation: 'Graph Interpretation',
  quantitative_analysis: 'Quantitative Analysis',
  creative_problem_solving: 'Creative Problem Solving',
  synthesis_recommendation: 'Synthesis',
  communication: 'Communication',
};
