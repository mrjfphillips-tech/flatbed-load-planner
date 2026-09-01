// ─── Drag-and-Drop Plan Editor ───────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Lets a planner manually adjust item positions on a top-down 2D canvas. Each
// drag updates the item's canonical X/Y placement; the move is validated in
// real time with the shared validateSinglePlacement so the editor and the
// packing engine always agree. Items with violations are outlined red and
// listed in a side panel. Supports undo/redo.
// _Requirements: 6.1, 6.2, 6.3, 6.4_

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadDiagram } from '@ptv-discovery-coach/shared';
import { useLoadDiagramStore } from './load-diagram-store';
import { getPlan } from './api';
import { extents, stopColor } from './diagram-geometry';

type PlacedItem = loadDiagram.PlacedItem;
type LoadPlan = loadDiagram.LoadPlan;
type TrailerProfile = loadDiagram.TrailerProfile;
type ConstraintViolation = loadDiagram.ConstraintViolation;

const { validateSinglePlacement, formatLength } = loadDiagram;

const CANVAS_W = 900;
const CANVAS_H = 260;
const PAD = 24;
/** Snap dragged positions to this canonical grid (mm) for tidiness. */
const SNAP_MM = 10;

export function PlanEditor() {
  const { planId, displayUnitSystem } = useLoadDiagramStore();
  const [trailer, setTrailer] = useState<TrailerProfile | null>(null);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Undo/redo stacks of full item-array snapshots.
  const [undoStack, setUndoStack] = useState<PlacedItem[][]>([]);
  const [redoStack, setRedoStack] = useState<PlacedItem[][]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    setLoading(true);
    getPlan(planId)
      .then((p: LoadPlan & { items: PlacedItem[] }) => {
        if (!cancelled) {
          setTrailer(p.trailerProfile);
          setItems(p.items);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const scale = useMemo(() => {
    if (!trailer) return 1;
    return Math.min(
      (CANVAS_W - 2 * PAD) / trailer.internalLength,
      (CANVAS_H - 2 * PAD) / trailer.internalWidth,
    );
  }, [trailer]);

  // Validation: map of itemId -> violations (recomputed whenever items change).
  const violationsByItem = useMemo(() => {
    if (!trailer) return new Map<string, ConstraintViolation[]>();
    const map = new Map<string, ConstraintViolation[]>();
    for (const it of items) {
      const v = validateSinglePlacement(it, items, trailer);
      if (v.length > 0) map.set(it.id, v);
    }
    return map;
  }, [items, trailer]);

  const allViolations = useMemo(
    () => [...violationsByItem.values()].flat(),
    [violationsByItem],
  );

  // Render.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trailer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PAD, PAD, trailer.internalLength * scale, trailer.internalWidth * scale);

    for (const it of items) {
      const { dx, dy } = extents(it);
      const x = PAD + it.placedX * scale;
      const y = PAD + it.placedY * scale;
      const w = dx * scale;
      const h = dy * scale;
      const hasViolation = violationsByItem.has(it.id);
      const isSelected = it.id === selectedId;

      ctx.fillStyle = stopColor(it.deliveryStop);
      ctx.globalAlpha = 0.78;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = hasViolation ? '#e53e3e' : isSelected ? '#1a365d' : '#ffffff';
      ctx.lineWidth = hasViolation ? 2 : isSelected ? 2 : 0.75;
      ctx.strokeRect(x, y, w, h);

      if (w > 14 && h > 10) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(String(it.loadSequence), x + 2, y + 2);
      }
    }
  }, [items, trailer, scale, violationsByItem, selectedId]);

  function itemAt(mx: number, my: number): PlacedItem | null {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const { dx, dy } = extents(it);
      const x = PAD + it.placedX * scale;
      const y = PAD + it.placedY * scale;
      if (mx >= x && mx <= x + dx * scale && my >= y && my <= y + dy * scale) return it;
    }
    return null;
  }

  function pushUndo(snapshot: PlacedItem[]) {
    setUndoStack((s) => [...s, snapshot]);
    setRedoStack([]);
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const it = itemAt(mx, my);
    if (it) {
      setSelectedId(it.id);
      dragRef.current = {
        id: it.id,
        offsetX: mx - (PAD + it.placedX * scale),
        offsetY: my - (PAD + it.placedY * scale),
      };
      // Snapshot before the drag begins.
      pushUndo(items.map((x) => ({ ...x })));
    } else {
      setSelectedId(null);
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || !trailer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== drag.id) return it;
        const { dx, dy } = extents(it);
        // Convert screen delta back to canonical mm, snap, and clamp to bounds.
        let nx = (mx - drag.offsetX - PAD) / scale;
        let ny = (my - drag.offsetY - PAD) / scale;
        nx = Math.round(nx / SNAP_MM) * SNAP_MM;
        ny = Math.round(ny / SNAP_MM) * SNAP_MM;
        nx = Math.max(0, Math.min(nx, trailer.internalLength - dx));
        ny = Math.max(0, Math.min(ny, trailer.internalWidth - dy));
        return { ...it, placedX: nx, placedY: ny };
      }),
    );
  }

  function endDrag() {
    dragRef.current = null;
  }

  function undo() {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setRedoStack((r) => [...r, items.map((x) => ({ ...x }))]);
      setItems(prev);
      return stack.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((u) => [...u, items.map((x) => ({ ...x }))]);
      setItems(next);
      return stack.slice(0, -1);
    });
  }

  if (!planId) return <p className="text-sm text-gray-500">No plan computed yet.</p>;
  if (loading) return <p className="text-sm text-gray-500">Loading editor…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!trailer) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Adjust placement (top-down)</h2>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
          >
            Redo
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
        <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full cursor-move"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
          />
        </div>

        {/* Violations panel */}
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {allViolations.length === 0 ? 'No violations' : `${allViolations.length} violation(s)`}
          </h3>
          {allViolations.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">All placements are valid.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs text-red-700">
              {allViolations.map((v, i) => (
                <li key={i} className="border-l-2 border-red-400 pl-2">
                  {v.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Drag items to reposition. Positions snap to {formatLength(SNAP_MM, displayUnitSystem)}.
        Red outlines mark constraint violations.
      </p>
    </div>
  );
}
