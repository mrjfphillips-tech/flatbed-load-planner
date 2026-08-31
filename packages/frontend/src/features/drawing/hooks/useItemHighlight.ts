// ─── useItemHighlight Hook ───────────────────────────────────────────────────
// Manages cross-view item highlighting state. When a user hovers over or selects
// an item in any view, this hook ensures the highlight is reflected simultaneously
// across all views.

import { useCallback, useState } from 'react';

export interface UseItemHighlightReturn {
  /** Currently highlighted item ID (hover) */
  highlightedItemId: string | null;
  /** Currently selected item ID (click) */
  selectedItemId: string | null;
  /** The effective highlighted item (selected takes precedence over hover) */
  effectiveHighlightId: string | null;
  /** Handle hover enter on an item */
  onItemHover: (itemId: string | null) => void;
  /** Handle click on an item (toggles selection) */
  onItemSelect: (itemId: string) => void;
  /** Clear all highlights */
  clearHighlight: () => void;
  /** Check if a specific item is highlighted */
  isItemHighlighted: (itemId: string) => boolean;
}

/**
 * Hook that manages cross-view item highlighting.
 * Provides consistent hover and selection state that can be consumed
 * by all drawing views to highlight items simultaneously.
 *
 * Selection takes precedence over hover: if an item is selected (clicked),
 * it remains highlighted even after the mouse moves away.
 *
 * @param onHighlightChange - Optional callback fired when the effective highlight changes
 * @param onSelectionChange - Optional callback fired when selection changes
 */
export function useItemHighlight(options?: {
  onHighlightChange?: (itemId: string | null) => void;
  onSelectionChange?: (itemId: string | null) => void;
}): UseItemHighlightReturn {
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const effectiveHighlightId = selectedItemId ?? highlightedItemId;

  const onItemHover = useCallback(
    (itemId: string | null) => {
      setHighlightedItemId(itemId);
      options?.onHighlightChange?.(itemId ?? selectedItemId ?? null);
    },
    [selectedItemId, options]
  );

  const onItemSelect = useCallback(
    (itemId: string) => {
      const newSelection = selectedItemId === itemId ? null : itemId;
      setSelectedItemId(newSelection);
      options?.onSelectionChange?.(newSelection);
      options?.onHighlightChange?.(newSelection);
    },
    [selectedItemId, options]
  );

  const clearHighlight = useCallback(() => {
    setHighlightedItemId(null);
    setSelectedItemId(null);
    options?.onHighlightChange?.(null);
    options?.onSelectionChange?.(null);
  }, [options]);

  const isItemHighlighted = useCallback(
    (itemId: string) => effectiveHighlightId === itemId,
    [effectiveHighlightId]
  );

  return {
    highlightedItemId,
    selectedItemId,
    effectiveHighlightId,
    onItemHover,
    onItemSelect,
    clearHighlight,
    isItemHighlighted,
  };
}
