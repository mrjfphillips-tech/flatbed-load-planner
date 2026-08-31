// ─── Manual Load Adjustment Module ───────────────────────────────────────────
// Drag-and-drop interface for repositioning, rotating, swapping, and removing
// freight items with real-time weight recalculation and rule re-evaluation.

export { ManualAdjustmentView } from './ManualAdjustmentView';
export { useAdjustmentStore } from './adjustment-store';
export { useMultiLoadStore } from './multi-load-store';
export { AdjustmentToolbar } from './components/AdjustmentToolbar';
export { ItemContextMenu } from './components/ItemContextMenu';
export { MultiLoadReassignment } from './components/MultiLoadReassignment';
export { SupervisorOverrideDialog } from './components/SupervisorOverrideDialog';
export { UnassignedItemsList } from './components/UnassignedItemsList';
export { WarningsSummary } from './components/WarningsSummary';
export { useDragAndDrop } from './hooks/useDragAndDrop';
export type {
  AdjustmentAction,
  AdjustmentState,
  DragState,
  InteractionMode,
  SupervisorOverride,
  ManualAdjustmentViewProps,
} from './types';
export type { MultiLoadStoreState, MultiLoadStoreActions, MultiLoadStore } from './multi-load-store';
