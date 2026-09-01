// ─── Export Panel ────────────────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Configures and triggers a PDF export: paper size, which views to include,
// the unit system for the output, and summary/checklist toggles. Shows a
// loading-checklist preview (load-sequence order) formatted in the selected
// unit system before download.
// _Requirements: 7.1, 7.3, 10.6_

import { useEffect, useMemo, useState } from 'react';
import { loadDiagram } from '@ptv-discovery-coach/shared';
import { useLoadDiagramStore } from './load-diagram-store';
import { exportPdf, getPlan } from './api';
import { extents } from './diagram-geometry';

type UnitSystem = loadDiagram.UnitSystem;
type PlacedItem = loadDiagram.PlacedItem;
type DiagramView = 'topDown' | 'sideView' | 'rearView';

const { formatLength, formatWeight } = loadDiagram;

export function ExportPanel() {
  const { planId, displayUnitSystem } = useLoadDiagramStore();

  const [paperSize, setPaperSize] = useState<'A4' | 'A3'>('A4');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(displayUnitSystem);
  const [views, setViews] = useState<Record<DiagramView, boolean>>({
    topDown: true,
    sideView: true,
    rearView: false,
  });
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeChecklist, setIncludeChecklist] = useState(true);

  const [items, setItems] = useState<PlacedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the export unit in sync with the page toggle when it changes.
  useEffect(() => {
    setUnitSystem(displayUnitSystem);
  }, [displayUnitSystem]);

  // Load placed items for the checklist preview.
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    getPlan(planId)
      .then((p) => !cancelled && setItems(p.items))
      .catch(() => {
        /* preview is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const checklist = useMemo(
    () => [...items].sort((a, b) => a.loadSequence - b.loadSequence),
    [items],
  );

  async function handleExport() {
    if (!planId) return;
    setBusy(true);
    setError(null);
    try {
      const selectedViews = (Object.keys(views) as DiagramView[]).filter((v) => views[v]);
      const blob = await exportPdf(planId, {
        paperSize,
        unitSystem,
        includeChecklist,
        includeSummary,
        views: selectedViews.length ? selectedViews : ['topDown'],
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `load-diagram-${planId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!planId) return <p className="text-sm text-gray-500">Generate a plan first.</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Export</h2>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Options */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Paper size</label>
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as 'A4' | 'A3')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Units</label>
            <select
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="metric">Metric (mm / kg)</option>
              <option value="imperial">Imperial (in / lb)</option>
            </select>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-700">Views</legend>
            <div className="mt-1 space-y-1 text-sm">
              {(['topDown', 'sideView'] as DiagramView[]).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={views[v]}
                    onChange={(e) => setViews((s) => ({ ...s, [v]: e.target.checked }))}
                  />
                  {v === 'topDown' ? 'Top-down view' : 'Side view'}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeSummary}
                onChange={(e) => setIncludeSummary(e.target.checked)}
              />
              Include summary statistics
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeChecklist}
                onChange={(e) => setIncludeChecklist(e.target.checked)}
              />
              Include loading checklist
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleExport()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {busy ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>

        {/* Checklist preview */}
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <h3 className="text-sm font-semibold text-gray-900">Loading checklist preview</h3>
          <p className="text-xs text-gray-500">Load in this order (first delivery loaded last).</p>
          <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs text-gray-700">
            {checklist.map((it) => {
              const { dx, dy, dz } = extents(it);
              return (
                <li key={it.id} className="flex gap-2">
                  <span className="text-gray-400">☐</span>
                  <span>
                    #{it.loadSequence} {it.itemId} — {formatLength(dx, unitSystem)} ×{' '}
                    {formatLength(dy, unitSystem)} × {formatLength(dz, unitSystem)},{' '}
                    {formatWeight(it.weight, unitSystem)}
                  </span>
                </li>
              );
            })}
            {checklist.length === 0 && <li className="text-gray-400">No items.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
