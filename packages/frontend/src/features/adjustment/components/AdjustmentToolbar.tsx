// ─── Adjustment Toolbar ──────────────────────────────────────────────────────
// Toolbar for switching interaction modes (drag, swap, select) and displaying
// the current mode state.

import { useAdjustmentStore } from '../adjustment-store';
import type { InteractionMode } from '../types';

const MODE_LABELS: Record<InteractionMode, { label: string; icon: string; description: string }> = {
  drag: { label: 'Move', icon: '↕', description: 'Drag items to reposition' },
  swap: { label: 'Swap', icon: '⇄', description: 'Click two items to swap positions' },
  select: { label: 'Select', icon: '☐', description: 'Click to select and view actions' },
};

export function AdjustmentToolbar() {
  const { mode, setMode, swapSource, cancelSwap, isRecalculating } = useAdjustmentStore();

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200"
      role="toolbar"
      aria-label="Adjustment tools"
      data-testid="adjustment-toolbar"
    >
      {(Object.keys(MODE_LABELS) as InteractionMode[]).map((m) => (
        <button
          key={m}
          className={`px-3 py-1.5 text-sm rounded border transition-colors ${
            mode === m
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
          }`}
          onClick={() => setMode(m)}
          title={MODE_LABELS[m].description}
          aria-pressed={mode === m}
          data-testid={`mode-btn-${m}`}
        >
          <span aria-hidden="true" className="mr-1">{MODE_LABELS[m].icon}</span>
          {MODE_LABELS[m].label}
        </button>
      ))}

      {/* Swap mode indicator */}
      {mode === 'swap' && swapSource && (
        <span className="ml-2 text-sm text-blue-700 flex items-center gap-1">
          Select second item to swap
          <button
            onClick={cancelSwap}
            className="text-xs text-red-500 underline ml-1"
            data-testid="cancel-swap-btn"
          >
            Cancel
          </button>
        </span>
      )}

      {/* Recalculating indicator */}
      {isRecalculating && (
        <span
          className="ml-auto text-xs text-amber-600 animate-pulse"
          data-testid="recalculating-indicator"
        >
          Recalculating…
        </span>
      )}
    </div>
  );
}
