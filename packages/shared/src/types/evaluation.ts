// ─── Evaluation Types ─────────────────────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

import type { Framework } from './framework';
import type { Citation } from './retrieval';

/**
 * An AI-generated output to be evaluated.
 */
export interface AIOutput {
  id: string;
  sessionId: string;
  content: string;
  citations: Citation[];
  framework: Framework;
  generatedAt: Date;
}

/**
 * Result of evaluating an AI-generated response.
 */
export interface EvaluationResult {
  factuality: number;
  groundedness: number;
  citationQuality: number;
  latencyMs: number;
  tokenCost: number;
  passesThreshold: boolean;
  issues: EvaluationIssue[];
}

/**
 * An issue found during evaluation.
 */
export interface EvaluationIssue {
  type: 'factuality' | 'groundedness' | 'citation' | 'safety';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Result of safety checking content.
 */
export interface SafetyResult {
  safe: boolean;
  flaggedCategories: string[];
  confidence: number;
}
