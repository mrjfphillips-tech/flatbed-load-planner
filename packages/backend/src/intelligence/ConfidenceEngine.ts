/**
 * ConfidenceEngine
 *
 * Measures how well the salesperson truly understands the customer's
 * business — not methodology completion, but genuine comprehension.
 *
 * V1 tracks 5 categories. Each only increases when actual EVIDENCE
 * is captured (not just when a question is asked).
 *
 * Categories:
 *   1. company_operations   — Business model, operations flow, strategy
 *   2. fleet_network        — Vehicles, routes, geography, facilities
 *   3. technology_data      — Systems, integrations, data quality
 *   4. financial_drivers    — Costs, budgets, KPIs, spend
 *   5. buying_process       — Decision makers, timeline, criteria
 *
 * PDIF V1 Task 2.4
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceCategory =
  | 'company_operations'
  | 'fleet_network'
  | 'technology_data'
  | 'financial_drivers'
  | 'buying_process';

export const ALL_CATEGORIES: ConfidenceCategory[] = [
  'company_operations',
  'fleet_network',
  'technology_data',
  'financial_drivers',
  'buying_process',
];

export interface ConfidenceState {
  category: ConfidenceCategory;
  score: number;             // 0-100
  evidence: string[];        // What supports this score
  gaps: string[];            // What's still unknown
  topQuestion: string;       // Best question to increase this score
}

export interface ConfidenceUpdate {
  category: ConfidenceCategory;
  delta: number;
  reason: string;
}

// ─── Category Definitions ─────────────────────────────────────────────────────

const CATEGORY_DEFINITIONS: Record<ConfidenceCategory, {
  label: string;
  description: string;
  requiredNodeTypes: string[];
  gapQuestions: string[];
}> = {
  company_operations: {
    label: 'Company & Operations',
    description: 'How well we understand their business model, operations flow, and strategy',
    requiredNodeTypes: ['fact', 'process', 'objective'],
    gapQuestions: [
      'Walk me through how your transportation operation fits into your overall business.',
      'What does a typical day look like for your logistics team?',
      'What are the top strategic initiatives driving your business this year?',
    ],
  },
  fleet_network: {
    label: 'Fleet & Network',
    description: 'How well we understand their vehicles, routes, geography, and facilities',
    requiredNodeTypes: ['asset', 'fact'],
    gapQuestions: [
      'Tell me about your fleet — how many vehicles, what types, owned versus leased?',
      'How many delivery points do you serve, and what\'s your geographic footprint?',
      'What does your network look like — hub-and-spoke, point-to-point, or something else?',
    ],
  },
  technology_data: {
    label: 'Technology & Data',
    description: 'How well we understand their current systems, integrations, and data quality',
    requiredNodeTypes: ['system', 'vendor'],
    gapQuestions: [
      'What systems does your planning team use today?',
      'How do your systems talk to each other — real-time integrations or batch files?',
      'How confident are you in your data quality — addresses, vehicle specs, time windows?',
    ],
  },
  financial_drivers: {
    label: 'Financial Drivers',
    description: 'How well we understand their cost structure, budget, and financial objectives',
    requiredNodeTypes: ['metric', 'fact'],
    gapQuestions: [
      'Do you track your cost per mile or cost per delivery?',
      'What\'s your total annual transportation spend, roughly?',
      'What does success look like financially for this initiative?',
    ],
  },
  buying_process: {
    label: 'Buying Process',
    description: 'How well we understand who decides, how they decide, and by when',
    requiredNodeTypes: ['contact', 'fact'],
    gapQuestions: [
      'How does a decision like this typically get made in your organization?',
      'Who controls the budget for this type of investment?',
      'What does a realistic timeline look like from your perspective?',
    ],
  },
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class ConfidenceEngine {

  /**
   * Calculate the current confidence state for all 5 categories
   * based on what's in the Discovery Graph.
   */
  calculateConfidence(
    graphNodes: Array<{ nodeType: string; confidence: number; label: string }>
  ): ConfidenceState[] {
    return ALL_CATEGORIES.map(category => {
      const def = CATEGORY_DEFINITIONS[category];
      const relevantNodes = graphNodes.filter(n =>
        def.requiredNodeTypes.includes(n.nodeType) && n.confidence >= 0.4
      );

      // Score calculation:
      // Base: number of relevant nodes (each worth ~10-15 points, capped at 80)
      // Bonus: high-confidence nodes get extra credit
      const baseScore = Math.min(80, relevantNodes.length * 12);
      const highConfBonus = relevantNodes.filter(n => n.confidence >= 0.75).length * 5;
      const score = Math.min(100, baseScore + highConfBonus);

      // Evidence: what supports this score
      const evidence = relevantNodes
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .map(n => n.label);

      // Gaps: what's missing
      const gaps: string[] = [];
      if (relevantNodes.length === 0) {
        gaps.push(`No ${def.label.toLowerCase()} information captured yet`);
      } else if (relevantNodes.length < 3) {
        gaps.push(`Only surface-level ${def.label.toLowerCase()} understanding`);
      }
      if (!relevantNodes.some(n => n.confidence >= 0.75)) {
        gaps.push(`No high-confidence facts in this area`);
      }

      // Top question to improve this score
      const topQuestion = def.gapQuestions[
        Math.min(Math.floor(relevantNodes.length / 2), def.gapQuestions.length - 1)
      ];

      return {
        category,
        score,
        evidence,
        gaps,
        topQuestion,
      };
    });
  }

  /**
   * Apply confidence updates from entity extraction.
   * Called when new entities are extracted from transcript.
   */
  applyUpdates(
    currentScores: ConfidenceState[],
    updates: ConfidenceUpdate[]
  ): ConfidenceState[] {
    const updated = [...currentScores];

    for (const update of updates) {
      const stateIdx = updated.findIndex(s => s.category === update.category);
      if (stateIdx >= 0) {
        updated[stateIdx] = {
          ...updated[stateIdx],
          score: Math.min(100, updated[stateIdx].score + update.delta),
          evidence: [...updated[stateIdx].evidence, update.reason].slice(-10),
        };
      }
    }

    return updated;
  }

  /**
   * Get the overall discovery confidence (weighted average).
   */
  getOverallConfidence(states: ConfidenceState[]): number {
    if (states.length === 0) return 0;
    const total = states.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / states.length);
  }

  /**
   * Get the weakest category — this is where to focus next.
   */
  getWeakestCategory(states: ConfidenceState[]): ConfidenceState | null {
    if (states.length === 0) return null;
    return states.reduce((weakest, s) => s.score < weakest.score ? s : weakest);
  }

  /**
   * Get category label for display.
   */
  getCategoryLabel(category: ConfidenceCategory): string {
    return CATEGORY_DEFINITIONS[category]?.label || category;
  }

  /**
   * Get all category labels for display.
   */
  getAllCategoryLabels(): Record<ConfidenceCategory, string> {
    const labels: Record<string, string> = {};
    for (const cat of ALL_CATEGORIES) {
      labels[cat] = CATEGORY_DEFINITIONS[cat].label;
    }
    return labels as Record<ConfidenceCategory, string>;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _confidenceEngine: ConfidenceEngine | null = null;

export function getConfidenceEngine(): ConfidenceEngine {
  if (!_confidenceEngine) {
    _confidenceEngine = new ConfidenceEngine();
  }
  return _confidenceEngine;
}
