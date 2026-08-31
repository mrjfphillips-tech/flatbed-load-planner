/**
 * Intelligence Layer — PDIF V1
 *
 * The AI brain of the platform. Four engines that collaborate
 * to deliver consultant-grade coaching during live sessions.
 */

export { CAUSAL_PATTERNS, BENCHMARKS, QUESTION_TEMPLATES, SOLUTION_MAPPINGS, getRelevantPatterns, getBenchmarksForIndustry, getQuestionsForPhase } from './TransportationKnowledgePack.js';
export { PDIFPhaseEngine, getPhaseEngine } from './PDIFPhaseEngine.js';
export { QuestionSuggestionEngine, getSuggestionEngine } from './QuestionSuggestionEngine.js';
export { ConfidenceEngine, getConfidenceEngine } from './ConfidenceEngine.js';

export type { PDIFPhase, PhaseState } from './PDIFPhaseEngine.js';
export type { SuggestedQuestion, SuggestionContext } from './QuestionSuggestionEngine.js';
export type { ConfidenceCategory, ConfidenceState, ConfidenceUpdate } from './ConfidenceEngine.js';
