// ─── useDragAndDrop Hook ─────────────────────────────────────────────────────
// Manages SVG coordinate translation for drag operations in the top-down view.
// Converts mouse/pointer events to SVG-space positions and feeds them to the
// adjustment store.

import { useCallback, useRef } from 'react';
import { useAdjustmentStore } from '../adjustment-store';

interface UseDragAndDropOptions {
  /** Whether dragging is enabled (e.g., mode === 'drag') */
  enabled: boolean;
}

/**
 * Translates DOM pointer events to SVG coordinate space and manages
 * the drag lifecycle (start → update → end/cancel).
 */
export function useDragAndDrop({ enabled }: UseDragAndDropOptions) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { startDrag, updateDrag, endDrag, cancelDrag, dragState } = useAdjustmentStore();

  /**
   * Convert a mouse/pointer event position to SVG coordinate space.
   * Uses the SVG CTM (current transformation matrix) inverse.
   */
  const clientToSVG = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;

      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;

      const ctm = svg.getScreenCTM();
      if (!ctm) return null;

      const svgPoint = point.matrixTransform(ctm.inverse());
      return { x: svgPoint.x, y: svgPoint.y };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, itemId: string) => {
      if (!enabled) return;
      // Only left button
      if (e.button !== 0) return;

      e.stopPropagation();
      e.preventDefault();

      const pos = clientToSVG(e.clientX, e.clientY);
      if (!pos) return;

      // Capture pointer for reliable tracking
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      startDrag(itemId, pos);
    },
    [enabled, clientToSVG, startDrag]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      const pos = clientToSVG(e.clientX, e.clientY);
      if (!pos) return;

      updateDrag(pos);
    },
    [dragState, clientToSVG, updateDrag]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      const pos = clientToSVG(e.clientX, e.clientY);
      if (!pos) {
        cancelDrag();
        return;
      }

      endDrag(pos);
    },
    [dragState, clientToSVG, endDrag, cancelDrag]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && dragState) {
        cancelDrag();
      }
    },
    [dragState, cancelDrag]
  );

  return {
    svgRef,
    isDragging: !!dragState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  };
}
