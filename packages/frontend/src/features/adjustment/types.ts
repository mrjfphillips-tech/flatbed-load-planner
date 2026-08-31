// ─── Manual Load Adjustment — Type Definitions ──────────────────────────────
// Types for the drag-and-drop adjustment interface that wraps the TopView.

import type { PlacedFreight, RuleResult, WeightMetrics } from '@ptv-discovery-coach/shared';

/** Describes an adjustment operation performed by the planner */
export type AdjustmentAction =
  | { type: 'move'; itemId: string; newPosition: { x: number; y: number } }
  | { type: 'orient'; itemId: string; newOrientation: 'longitudinal' | 'transverse' }
  | { type: 'swap'; itemIdA: string; itemIdB: string }
  | { type: 'remove'; itemId: string };

/** State of a drag operation in progress */
export interface DragState {
  /** Order number of the item being dragged */
  itemId: string;
  /** Starting SVG position of the drag */
  startPosition: { x: number; y: number };
  /** Current SVG position of the drag */
  currentPosition: { x: number; y: number };
  /** Original item position before drag started */
  originalItemPosition: { x: number; y: number; z: number };
}

/** The interaction mode for the adjustment view */
export type InteractionMode = 'drag' | 'swap' | 'select';

/** Supervisor acknowledgment for a hard constraint override */
export interface SupervisorOverride {
  ruleId: string;
  acknowledgedBy: string;
  acknowledgedAt: Date;
  reason: string;
}

/** Complete state managed by the adjustment store */
export interface AdjustmentState {
  /** All placed freight items (mutable copy for adjustments) */
  placedFreight: PlacedFreight[];
  /** Items removed from the load (returned to unassigned) */
  unassignedItems: PlacedFreight[];
  /** Current interaction mode */
  mode: InteractionMode;
  /** Active drag operation (null if not dragging) */
  dragState: DragState | null;
  /** Item selected for swap (first selection) */
  swapSource: string | null;
  /** Currently selected item (for context menu actions) */
  selectedItemId: string | null;
  /** Latest weight metrics (recalculated after each adjustment) */
  weightMetrics: WeightMetrics | null;
  /** Latest rule evaluation results */
  ruleResults: RuleResult[];
  /** Whether the current configuration can be approved */
  canApprove: boolean;
  /** Hard constraint overrides acknowledged by a supervisor */
  overrides: SupervisorOverride[];
  /** Whether a recalculation is in progress */
  isRecalculating: boolean;
  /** Timestamp of the last recalculation completion */
  lastRecalculatedAt: number | null;
}

/** Props for the ManualAdjustmentView component */
export interface ManualAdjustmentViewProps {
  /** Called when placement changes are committed (e.g., for plan versioning) */
  onPlacementChange?: (placedFreight: PlacedFreight[], unassigned: PlacedFreight[]) => void;
  /** CSS class for root container */
  className?: string;
}
