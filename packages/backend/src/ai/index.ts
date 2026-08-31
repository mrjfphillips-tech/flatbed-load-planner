// ─── AI Engine Module Barrel Export ───────────────────────────────────────────

export { FrameworkClassifierService } from './frameworkClassifier';
export type {
  FrameworkClassifierServiceOptions,
  TranscriptAnalyzer,
  TranscriptAnalysisResult,
} from './frameworkClassifier';

export {
  QuestionIntentScorerImpl,
  buildIntentScoringPrompt,
  parseIntentResponse,
  filterCustomerSegments,
} from './questionIntentScorer';
export type {
  LLMClient,
  ScoreUpdateCallback,
  PartialScoreUpdate,
  QuestionIntentScorerOptions,
} from './questionIntentScorer';

export { CoverageAnalyzerImpl } from './coverageAnalyzer';
export type { CoverageAnalyzerConfig } from './coverageAnalyzer';
