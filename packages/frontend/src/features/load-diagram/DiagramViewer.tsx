// ─── 2D Canvas Diagram Viewer ────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Renders top-down and side views of a computed load plan on an HTML5 canvas.
// Items are color-coded by delivery stop and labeled with load-sequence numbers.
// Supports zoom/pan and hover tooltips. All measurements are canonical mm and
// are formatted for display in the selected unit system via the shared units
// module.
// _Requirements: 4.1, 4.2, 4.3, 4.4_

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadDiagram } from '@ptv-discovery-coach/shared';
import { useLoadDiagramStore } from './load-diagram-store';
import { getPlan } from './api';
import { extents, stopColor, distinctStops } from './diagram-geometry';
import { ThreeDViewer } from './ThreeDViewer';

type PlacedItem = loadDiagram.PlacedItem;
type LoadPlan = loadDiagram.LoadPlan;

const { formatLength, formatWeight } = loadDiagram;

type ViewMode = 'topDown' | 'sideView' | 'threeD';

interface Hover {
  item: PlacedItem;
  screenX: number;
  screenY: number;
}

const CANVAS_W = 900;
const CANVAS_H = 260;
const PAD = 24;

export function DiagramViewer() {
  const { planId, displayUnitSystem } = useLoadDiagramStore();
  const [plan, setPlan] = useState<(LoadPlan & { items: PlacedItem[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('topDown');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<Hover | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Fetch the plan with placed items on mount / plan change.
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPlan(planId)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  // Base scale so the trailer fits the canvas (before user zoom).
  const baseScale = useMemo(() => {
    if (!plan?.trailerProfile) return 1;
    const t = plan.trailerProfile;
    const across = view === 'topDown' ? t.internalWidth : t.internalHeight;
    const sx = (CANVAS_W - 2 * PAD) / t.internalLength;
    const sy = (CANVAS_H - 2 * PAD) / across;
    return Math.min(sx, sy);
  }, [plan, view]);

  // Render.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = baseScale * zoom;
    const t = plan.trailerProfile;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();

    // Trailer outline.
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1.5;
    if (view === 'topDown') {
      ctx.strokeRect(PAD + pan.x, PAD + pan.y, t.internalLength * s, t.internalWidth * s);
    } else {
      ctx.strokeRect(PAD + pan.x, PAD + pan.y, t.internalLength * s, t.internalHeight * s);
    }

    // Items.
    for (const it of plan.items) {
      const { dx, dy, dz } = extents(it);
      let x: number, y: number, w: number, h: number;
      if (view === 'topDown') {
        x = PAD + it.placedX * s + pan.x;
        y = PAD + it.placedY * s + pan.y;
        w = dx * s;
        h = dy * s;
      } else {
        const floorY = PAD + t.internalHeight * s;
        x = PAD + it.placedX * s + pan.x;
        y = floorY - (it.placedZ + dz) * s + pan.y;
        w = dx * s;
        h = dz * s;
      }
      ctx.fillStyle = stopColor(it.deliveryStop);
      ctx.globalAlpha = 0.78;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(x, y, w, h);

      // Load sequence label.
      if (w > 14 && h > 10) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(String(it.loadSequence), x + 2, y + 2);
      }
    }
    ctx.restore();
  }, [plan, view, zoom, pan, baseScale]);

  // Hit-testing for hover tooltip.
  function itemAt(mx: number, my: number): PlacedItem | null {
    if (!plan) return null;
    const s = baseScale * zoom;
    const t = plan.trailerProfile;
    // Iterate in reverse so topmost drawn wins.
    for (let i = plan.items.length - 1; i >= 0; i--) {
      const it = plan.items[i];
      const { dx, dy, dz } = extents(it);
      let x: number, y: number, w: number, h: number;
      if (view === 'topDown') {
        x = PAD + it.placedX * s + pan.x;
        y = PAD + it.placedY * s + pan.y;
        w = dx * s;
        h = dy * s;
      } else {
        const floorY = PAD + t.internalHeight * s;
        x = PAD + it.placedX * s + pan.x;
        y = floorY - (it.placedZ + dz) * s + pan.y;
        w = dx * s;
        h = dz * s;
      }
      if (mx >= x && mx <= x + w && my >= y && my <= y + h) return it;
    }
    return null;
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const drag = dragRef.current;
    if (drag) {
      setPan((p) => ({
        x: p.x + (mx - drag.x),
        y: p.y + (my - drag.y),
      }));
      dragRef.current = { x: mx, y: my };
      return;
    }

    const it = itemAt(mx, my);
    setHover(it ? { item: it, screenX: mx, screenY: my } : null);
  }

  if (!planId) return <p className="text-sm text-gray-500">No plan computed yet.</p>;
  if (loading) return <p className="text-sm text-gray-500">Loading diagram…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!plan || !plan.trailerProfile) return null;

  const stops = distinctStops(plan.items);
  const packingWarnings = plan.warnings ?? [];
  const ruleErrors = plan.ruleValidation?.errors ?? [];
  const ruleWarnings = plan.ruleValidation?.warnings ?? [];
  // Combine engine advisory warnings with rule-engine warnings for display.
  const allWarnings = [
    ...packingWarnings.map((w) => w.message),
    ...ruleWarnings.map((w) => w.rationale),
  ];

  return (
    <div className="space-y-4">
      {/* Rule errors — block finalize/export, but the load still renders so the
          planner can see and fix the problem. */}
      {ruleErrors.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">
            {ruleErrors.length} rule violation{ruleErrors.length === 1 ? '' : 's'} — resolve before finalizing:
          </p>
          <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5">
            {ruleErrors.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.rule}:</span> {e.rationale}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Advisory warnings — review-worthy, never block. */}
      {allWarnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">
            {allWarnings.length} warning{allWarnings.length === 1 ? '' : 's'} to review:
          </p>
          <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5">
            {allWarnings.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
          {(['topDown', 'sideView', 'threeD'] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm font-medium rounded ${
                view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {v === 'topDown' ? 'Top-down' : v === 'sideView' ? 'Side' : '3D'}
            </button>
          ))}
        </div>
        {view !== 'threeD' && (
          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">−</button>
            <span className="w-12 text-center text-gray-600">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">+</button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">Reset</button>
          </div>
        )}
      </div>

      {view === 'threeD' ? (
        <ThreeDViewer />
      ) : (
      <div className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            dragRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          }}
          onMouseUp={() => (dragRef.current = null)}
          onMouseLeave={() => {
            dragRef.current = null;
            setHover(null);
          }}
          onMouseMove={onMouseMove}
        />
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow"
            style={{ left: Math.min(hover.screenX + 12, CANVAS_W - 160), top: hover.screenY + 12 }}
          >
            <div className="font-medium">#{hover.item.loadSequence} · {hover.item.itemId}</div>
            <div>
              {formatLength(extents(hover.item).dx, displayUnitSystem)} ·{' '}
              {formatLength(extents(hover.item).dy, displayUnitSystem)} ·{' '}
              {formatLength(extents(hover.item).dz, displayUnitSystem)}
            </div>
            <div>{formatWeight(hover.item.weight, displayUnitSystem)}</div>
            {hover.item.deliveryStop != null && <div>Stop {hover.item.deliveryStop}</div>}
          </div>
        )}
      </div>
      )}

      {/* Legend */}
      {stops.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span className="font-medium">Delivery stops:</span>
          {stops.map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: stopColor(s) }} />
              Stop {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
