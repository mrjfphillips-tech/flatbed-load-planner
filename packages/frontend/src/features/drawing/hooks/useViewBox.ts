// ─── useViewBox Hook ─────────────────────────────────────────────────────────
// Manages SVG viewBox state with zoom, pan, and reset support.

import { useCallback, useRef, useState } from 'react';
import type { ViewBox } from '../types';

interface UseViewBoxOptions {
  /** Initial viewBox dimensions */
  initial: ViewBox;
  /** Minimum zoom scale (1 = no zoom) */
  minScale?: number;
  /** Maximum zoom scale */
  maxScale?: number;
}

interface UseViewBoxReturn {
  viewBox: ViewBox;
  /** Apply zoom (positive = zoom in, negative = zoom out) */
  zoom: (delta: number, centerX?: number, centerY?: number) => void;
  /** Pan the view by dx/dy in SVG coordinates */
  pan: (dx: number, dy: number) => void;
  /** Reset to initial viewBox */
  reset: () => void;
  /** Current zoom scale (1 = initial) */
  scale: number;
  /** Handler for mouse wheel zoom */
  handleWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
  /** Handlers for drag-to-pan */
  handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseUp: () => void;
}

export function useViewBox({
  initial,
  minScale = 0.25,
  maxScale = 8,
}: UseViewBoxOptions): UseViewBoxReturn {
  const [viewBox, setViewBox] = useState<ViewBox>(initial);
  const [scale, setScale] = useState(1);
  const dragStart = useRef<{ x: number; y: number; vbX: number; vbY: number } | null>(null);

  const zoom = useCallback(
    (delta: number, centerX?: number, centerY?: number) => {
      setViewBox((vb) => {
        const factor = delta > 0 ? 0.9 : 1.1;
        const newWidth = vb.width * factor;
        const newHeight = vb.height * factor;

        // Check scale bounds
        const newScale = initial.width / newWidth;
        if (newScale < minScale || newScale > maxScale) return vb;

        // Zoom toward center point (default: center of current viewBox)
        const cx = centerX ?? vb.x + vb.width / 2;
        const cy = centerY ?? vb.y + vb.height / 2;

        const newX = cx - (cx - vb.x) * factor;
        const newY = cy - (cy - vb.y) * factor;

        setScale(newScale);
        return { x: newX, y: newY, width: newWidth, height: newHeight };
      });
    },
    [initial.width, minScale, maxScale]
  );

  const pan = useCallback((dx: number, dy: number) => {
    setViewBox((vb) => ({
      ...vb,
      x: vb.x - dx,
      y: vb.y - dy,
    }));
  }, []);

  const reset = useCallback(() => {
    setViewBox(initial);
    setScale(1);
  }, [initial]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      // Convert mouse position to SVG coordinates
      const mouseX = ((e.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
      const mouseY = ((e.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;
      zoom(e.deltaY, mouseX, mouseY);
    },
    [zoom, viewBox]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 1 && !e.shiftKey) return; // Middle button or shift+left
      e.preventDefault();
      dragStart.current = { x: e.clientX, y: e.clientY, vbX: viewBox.x, vbY: viewBox.y };
    },
    [viewBox]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragStart.current) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - dragStart.current.x) / rect.width) * viewBox.width;
      const dy = ((e.clientY - dragStart.current.y) / rect.height) * viewBox.height;
      setViewBox({
        x: dragStart.current.vbX - dx,
        y: dragStart.current.vbY - dy,
        width: viewBox.width,
        height: viewBox.height,
      });
    },
    [viewBox.width, viewBox.height]
  );

  const handleMouseUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  return {
    viewBox,
    zoom,
    pan,
    reset,
    scale,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
