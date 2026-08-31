/**
 * PDIFPhaseEngine
 *
 * Tracks which of the 5 discovery phases a session is in and recommends
 * when to transition. Phases are LENSES, not gates — the rep can be in
 * any phase at any time. The engine shows PRIMARY focus but never blocks.
 *
 * Phases:
 *   1. DISCOVER  — Understand the business before discussing solutions
 *   2. DIAGNOSE  — Identify inefficiencies and quantify pain
 *   3. DESIGN    — Map challenges to measurable outcomes
 *   4. DEMONSTRATE — Prepare relevant demo and business case
 *   5. DELIVER   — Prepare for adoption and executive approval
 *
 * PDIF V1 Task 2.2
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PDIFPhase = 'discover' | 'diagnose' | 'design' | 'demonstrate' | 'deliver';

export interface PhaseState {
  currentPhase: PDIFPhase;
  phaseProgress: Record<PDIFPhase, number>; // 0-100 per phase
  recommendedTransition: PDIFPhase | null;
  transitionReason: string | null;
}

export interface PhaseTransitionRecommendation {
  suggestedPhase: PDIFPhase;
  reason: string;
  confidence: number;
  currentPhaseComplete: number; // % of current phase explored
}

// ─── Phase Requirements ───────────────────────────────────────────────────────
// What knowledge must exist before a phase is considered sufficiently explored

const PHASE_REQUIREMENTS: Record<PDIFPhase, {
  requiredNodeTypes: string[];
  minimumNodes: number;
  description: string;
}> = {
  discover: {
    requiredNodeTypes: ['fact', 'contact', 'asset'],
    minimumNodes: 5,
    description: 'Basic company, fleet, and stakeholder understanding established',
  },
  diagnose: {
    requiredNodeTypes: ['process', 'pain_point', 'metric'],
    minimumNodes: 4,
    description: 'Operational processes mapped and pain points identified',
  },
  design: {
    requiredNodeTypes: ['objective', 'constraint'],
    minimumNodes: 3,
    description: 'Desired outcomes and implementation constraints understood',
  },
  demonstrate: {
    requiredNodeTypes: ['pain_point', 'objective'],
    minimumNodes: 2,
    description: 'Validated pain with agreed desired outcome',
  },
  deliver: {
    requiredNodeTypes: ['contact'],
    minimumNodes: 2,
    description: 'Buying committee and decision process mapped',
  },
};

// ─── Phase Order ──────────────────────────────────────────────────────────────

const PHASE_ORDER: PDIFPhase[] = ['discover', 'diagnose', 'design', 'demonstrate', 'deliver'];

// ─── Service ──────────────────────────────────────────────────────────────────

export class PDIFPhaseEngine {

  /**
   * Determine the current phase state based on what's been learned.
   * Uses the Discovery Graph nodes to assess progress.
   */
  assessPhaseState(
    currentPhase: PDIFPhase,
    graphNodes: Array<{ nodeType: string; confidence: number }>
  ): PhaseState {
    const progress = this.calculatePhaseProgress(graphNodes);
    const transition = this.checkTransitionReadiness(currentPhase, progress, graphNodes);

    return {
      currentPhase,
      phaseProgress: progress,
      recommendedTransition: transition?.suggestedPhase || null,
      transitionReason: transition?.reason || null,
    };
  }

  /**
   * Calculate progress for each phase (0-100%).
   * Based on how many required node types have been captured.
   */
  calculatePhaseProgress(
    graphNodes: Array<{ nodeType: string; confidence: number }>
  ): Record<PDIFPhase, number> {
    const progress: Record<PDIFPhase, number> = {
      discover: 0,
      diagnose: 0,
      design: 0,
      demonstrate: 0,
      deliver: 0,
    };

    for (const phase of PHASE_ORDER) {
      const req = PHASE_REQUIREMENTS[phase];
      const relevantNodes = graphNodes.filter(n =>
        req.requiredNodeTypes.includes(n.nodeType) && n.confidence >= 0.4
      );

      // Progress = percentage of minimum required nodes captured
      const rawProgress = Math.min(100, (relevantNodes.length / req.minimumNodes) * 100);

      // Boost progress if high-confidence nodes exist
      const highConfidenceCount = relevantNodes.filter(n => n.confidence >= 0.7).length;
      const confidenceBoost = Math.min(20, highConfidenceCount * 5);

      progress[phase] = Math.min(100, Math.round(rawProgress + confidenceBoost));
    }

    return progress;
  }

  /**
   * Check if the system should recommend transitioning to the next phase.
   * Only recommends when current phase is well-explored (>60% progress).
   */
  checkTransitionReadiness(
    currentPhase: PDIFPhase,
    progress: Record<PDIFPhase, number>,
    _graphNodes: Array<{ nodeType: string; confidence: number }>
  ): PhaseTransitionRecommendation | null {
    const currentProgress = progress[currentPhase];

    // Don't suggest transition until current phase is reasonably explored
    if (currentProgress < 60) return null;

    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    const nextPhase = PHASE_ORDER[currentIndex + 1];

    // If we're at the last phase, no transition to suggest
    if (!nextPhase) return null;

    // If current phase is highly explored, suggest moving on
    if (currentProgress >= 75) {
      return {
        suggestedPhase: nextPhase,
        reason: this.getTransitionReason(currentPhase, nextPhase, currentProgress),
        confidence: Math.min(0.9, currentProgress / 100),
        currentPhaseComplete: currentProgress,
      };
    }

    return null;
  }

  /**
   * Get the best phase to focus on given the current knowledge state.
   * This is used when the rep wants guidance on what to explore next.
   */
  getRecommendedFocus(
    progress: Record<PDIFPhase, number>,
    sessionNumber: number
  ): PDIFPhase {
    // First session: always start with DISCOVER
    if (sessionNumber <= 1 && progress.discover < 50) {
      return 'discover';
    }

    // Find the phase with most opportunity (lowest progress that's appropriate)
    for (const phase of PHASE_ORDER) {
      if (progress[phase] < 60) return phase;
    }

    // All phases reasonably explored — focus on DELIVER (closing)
    return 'deliver';
  }

  /**
   * Get phase-appropriate topics to explore.
   * Used by the Question Suggestion Engine to filter relevant questions.
   */
  getPhaseTopics(phase: PDIFPhase): string[] {
    const topicMap: Record<PDIFPhase, string[]> = {
      discover: [
        'business_model', 'operations_flow', 'network_scope',
        'fleet_composition', 'strategic_context', 'org_structure',
        'success_metrics', 'customer_mix', 'growth_objectives',
      ],
      diagnose: [
        'planning_process', 'planning_capacity', 'exception_handling',
        'constraint_management', 'fleet_utilization', 'route_balance',
        'empty_miles', 'technology_stack', 'technology_gaps',
        'cost_metrics', 'total_spend', 'driver_management',
        'dock_scheduling', 'visibility', 'compliance',
      ],
      design: [
        'desired_state', 'future_vision', 'decision_criteria',
        'technical_constraints', 'implementation_timeline',
        'change_management', 'competitive_landscape',
      ],
      demonstrate: [
        'demo_priorities', 'demo_audience', 'proof_of_value',
        'success_stories', 'roi_expectations',
      ],
      deliver: [
        'decision_process', 'economic_buyer', 'timeline',
        'success_criteria', 'implementation_readiness',
        'buying_committee', 'budget_approval',
      ],
    };

    return topicMap[phase] || [];
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private getTransitionReason(from: PDIFPhase, to: PDIFPhase, progress: number): string {
    const reasons: Record<string, string> = {
      'discover_diagnose': 'Good business understanding established. Time to explore operational details and quantify specific pain points.',
      'diagnose_design': 'Key operational challenges identified. Ready to map these to solution requirements and business outcomes.',
      'design_demonstrate': 'Solution requirements clear. Time to plan the most relevant demonstration.',
      'demonstrate_deliver': 'Solution fit validated. Ready to prepare the business case and buying process.',
    };

    return reasons[`${from}_${to}`] || `${from} phase is ${progress}% explored — consider moving to ${to}.`;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _phaseEngine: PDIFPhaseEngine | null = null;

export function getPhaseEngine(): PDIFPhaseEngine {
  if (!_phaseEngine) {
    _phaseEngine = new PDIFPhaseEngine();
  }
  return _phaseEngine;
}
