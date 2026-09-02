// ─── Load Diagram PDF Generator ──────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Renders a printable loading diagram PDF from a computed LoadPlan using PDFKit.
// Produces a top-down (bird's-eye) view and a side (profile) view with items
// drawn as scaled, color-coded rectangles, a summary statistics block, and a
// loading checklist in load-sequence order. All dimensions and weights are
// converted to the export unit system and labeled via the shared units module.
//
// _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.1, 7.3, 10.6_

import PDFDocument from 'pdfkit';
import { loadDiagram } from '@ptv-discovery-coach/shared';

type LoadPlan = loadDiagram.LoadPlan;
type PlacedItem = loadDiagram.PlacedItem;
type DiagramExportOptions = loadDiagram.DiagramExportOptions;
type ItemOrientation = loadDiagram.ItemOrientation;

const { formatLength, formatWeight, lengthUnitLabel } = loadDiagram;

// ─── Page sizing ─────────────────────────────────────────────────────────────

const PAGE_DIMENSIONS: Record<'A3' | 'A4', { width: number; height: number }> = {
  // Landscape, in PDF points (72 dpi).
  A4: { width: 842, height: 595 },
  A3: { width: 1191, height: 842 },
};

const MARGIN = 40;

const COLORS = {
  primary: '#1a365d',
  text: '#1a202c',
  gray: '#4a5568',
  lightGray: '#cbd5e0',
  trailer: '#2d3748',
} as const;

// A qualitative palette cycled by delivery stop.
const STOP_PALETTE = [
  '#3182ce', '#38a169', '#dd6b20', '#805ad5',
  '#d53f8c', '#319795', '#e53e3e', '#718096',
] as const;

function stopColor(stop: number | undefined): string {
  const s = stop ?? 0;
  return STOP_PALETTE[s % STOP_PALETTE.length];
}

// ─── Orientation geometry ────────────────────────────────────────────────────

const ORIENTATION_MAP: Record<
  ItemOrientation,
  ['length' | 'width' | 'height', 'length' | 'width' | 'height', 'length' | 'width' | 'height']
> = {
  LWH: ['length', 'width', 'height'],
  WLH: ['width', 'length', 'height'],
  LHW: ['length', 'height', 'width'],
  WHL: ['width', 'height', 'length'],
  HLW: ['height', 'length', 'width'],
  HWL: ['height', 'width', 'length'],
};

/** Returns the item's canonical extents along the X/Y/Z axes as placed. */
function extents(it: PlacedItem): { dx: number; dy: number; dz: number } {
  const [a, b, c] = ORIENTATION_MAP[it.placedOrientation];
  return { dx: it[a], dy: it[b], dz: it[c] };
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Generates a loading-diagram PDF for the given plan. Returns a Buffer.
 * _Requirements: 7.1_
 */
export async function generatePDF(
  plan: LoadPlan,
  options: DiagramExportOptions,
): Promise<Buffer> {
  const page = PAGE_DIMENSIONS[options.paperSize] ?? PAGE_DIMENSIONS.A4;
  const unit = options.unitSystem;

  const doc = new PDFDocument({
    size: [page.width, page.height],
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `Load Diagram — ${plan.trailerProfile.name}`,
      Author: 'OptiFlow Load Diagram Generator',
    },
  });

  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  renderHeader(doc, plan, page.width);

  const views = options.views.length ? options.views : (['topDown', 'sideView'] as const);
  if (views.includes('topDown')) {
    renderTopDown(doc, plan, unit, page.width);
  }
  if (views.includes('sideView')) {
    renderSideView(doc, plan, unit, page.width);
  }

  if (options.includeSummary) {
    renderSummary(doc, plan, unit, page.width);
  }

  if (options.includeChecklist) {
    doc.addPage();
    renderChecklist(doc, plan, unit, page.width);
  }

  doc.end();
  return done;
}

// ─── Header ──────────────────────────────────────────────────────────────────

function renderHeader(doc: PDFKit.PDFDocument, plan: LoadPlan, pageWidth: number): void {
  doc.fontSize(18).fillColor(COLORS.primary).text('LOADING DIAGRAM', MARGIN, MARGIN);
  doc
    .fontSize(10)
    .fillColor(COLORS.gray)
    .text(
      `Trailer: ${plan.trailerProfile.name}   |   Status: ${plan.status.toUpperCase()}   |   Units: ${plan.displayUnitSystem}`,
      MARGIN,
      doc.y + 2,
    );
  doc
    .moveTo(MARGIN, doc.y + 4)
    .lineTo(pageWidth - MARGIN, doc.y + 4)
    .strokeColor(COLORS.lightGray)
    .lineWidth(1)
    .stroke();
  doc.moveDown(1);
}

// ─── Top-down view (X along length, Y across width) ──────────────────────────

function renderTopDown(
  doc: PDFKit.PDFDocument,
  plan: LoadPlan,
  unit: loadDiagram.UnitSystem,
  pageWidth: number,
): void {
  const t = plan.trailerProfile;
  const label = lengthUnitLabel(unit);
  doc.fontSize(12).fillColor(COLORS.primary).text('Top-Down View (front = left)', MARGIN, doc.y);
  doc.moveDown(0.3);

  const areaW = pageWidth - 2 * MARGIN;
  const areaH = 130;
  const originX = MARGIN;
  const originY = doc.y;

  const scale = Math.min(areaW / t.internalLength, areaH / t.internalWidth);
  const drawW = t.internalLength * scale;
  const drawH = t.internalWidth * scale;

  // Trailer outline.
  doc.rect(originX, originY, drawW, drawH).lineWidth(1.2).strokeColor(COLORS.trailer).stroke();

  // Items: rect at (placedX, placedY) with extents (dx, dy).
  for (const it of plan.items) {
    const { dx, dy } = extents(it);
    const x = originX + it.placedX * scale;
    const y = originY + it.placedY * scale;
    const w = dx * scale;
    const h = dy * scale;
    doc.rect(x, y, w, h).fillOpacity(0.75).fill(stopColor(it.deliveryStop));
    doc.fillOpacity(1).strokeColor('#ffffff').lineWidth(0.5).rect(x, y, w, h).stroke();
    if (w > 12 && h > 8) {
      doc
        .fontSize(6)
        .fillColor('#ffffff')
        .text(String(it.loadSequence), x + 1, y + 1, { width: w - 2, height: h - 2 });
    }
  }

  doc.y = originY + drawH + 6;
  doc
    .fontSize(7)
    .fillColor(COLORS.gray)
    .text(
      `Trailer interior: ${formatLength(t.internalLength, unit)} L x ${formatLength(t.internalWidth, unit)} W   (numbers = load sequence, ${label})`,
      MARGIN,
      doc.y,
    );
  doc.moveDown(0.8);
}

// ─── Side view (X along length, Z vertical) ──────────────────────────────────

function renderSideView(
  doc: PDFKit.PDFDocument,
  plan: LoadPlan,
  unit: loadDiagram.UnitSystem,
  pageWidth: number,
): void {
  const t = plan.trailerProfile;
  doc.fontSize(12).fillColor(COLORS.primary).text('Side View (front = left, floor = bottom)', MARGIN, doc.y);
  doc.moveDown(0.3);

  const areaW = pageWidth - 2 * MARGIN;
  const areaH = 130;
  const originX = MARGIN;
  const topY = doc.y;

  const scale = Math.min(areaW / t.internalLength, areaH / t.internalHeight);
  const drawW = t.internalLength * scale;
  const drawH = t.internalHeight * scale;
  const floorY = topY + drawH; // Z=0 is at the bottom.

  doc.rect(originX, topY, drawW, drawH).lineWidth(1.2).strokeColor(COLORS.trailer).stroke();

  for (const it of plan.items) {
    const { dx, dz } = extents(it);
    const x = originX + it.placedX * scale;
    const w = dx * scale;
    const h = dz * scale;
    const y = floorY - (it.placedZ + dz) * scale; // invert Z for screen coords
    doc.rect(x, y, w, h).fillOpacity(0.75).fill(stopColor(it.deliveryStop));
    doc.fillOpacity(1).strokeColor('#ffffff').lineWidth(0.5).rect(x, y, w, h).stroke();
  }

  doc.y = floorY + 6;
  doc
    .fontSize(7)
    .fillColor(COLORS.gray)
    .text(`Trailer height: ${formatLength(t.internalHeight, unit)}`, MARGIN, doc.y);
  doc.moveDown(0.8);
}

// ─── Summary statistics ──────────────────────────────────────────────────────

function renderSummary(
  doc: PDFKit.PDFDocument,
  plan: LoadPlan,
  unit: loadDiagram.UnitSystem,
  pageWidth: number,
): void {
  doc.fontSize(12).fillColor(COLORS.primary).text('Summary', MARGIN, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor(COLORS.text);

  doc.text(`Items placed: ${plan.items.length}`);
  doc.text(`Total weight: ${formatWeight(plan.totalWeight, unit)}`);
  doc.text(`Volume utilization: ${plan.volumeUtilization.toFixed(1)}%`);

  const axleParts = plan.axleWeights.map((w, i) => `Axle ${i + 1}: ${formatWeight(w, unit)}`);
  doc.text(`Weight per axle — ${axleParts.join('   ')}`);

  if (plan.overflowItems && plan.overflowItems.length > 0) {
    doc
      .fillColor('#c53030')
      .text(`Overflow (did not fit): ${plan.overflowItems.length} item(s) — consider an additional trailer.`);
  }
  doc.moveDown(0.5);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(pageWidth - MARGIN, doc.y)
    .strokeColor(COLORS.lightGray)
    .lineWidth(0.5)
    .stroke();
}

// ─── Loading checklist (load-sequence order) ─────────────────────────────────

function renderChecklist(
  doc: PDFKit.PDFDocument,
  plan: LoadPlan,
  unit: loadDiagram.UnitSystem,
  pageWidth: number,
): void {
  doc.fontSize(14).fillColor(COLORS.primary).text('Loading Checklist', MARGIN, MARGIN);
  doc.fontSize(8).fillColor(COLORS.gray).text('Load in the order shown (first delivery loaded last, nearest the doors).', MARGIN, doc.y + 2);
  doc.moveDown(0.6);

  const ordered = [...plan.items].sort((a, b) => a.loadSequence - b.loadSequence);
  doc.fontSize(9).fillColor(COLORS.text);

  for (const it of ordered) {
    if (doc.y > doc.page.height - MARGIN - 20) {
      doc.addPage();
      doc.fontSize(14).fillColor(COLORS.primary).text('Loading Checklist (continued)', MARGIN, MARGIN);
      doc.moveDown(0.6);
      doc.fontSize(9).fillColor(COLORS.text);
    }
    const { dx, dy, dz } = extents(it);
    const dims = `${formatLength(dx, unit)} x ${formatLength(dy, unit)} x ${formatLength(dz, unit)}`;
    const stop = it.deliveryStop != null ? `stop ${it.deliveryStop}` : 'no stop';
    doc.text(
      `[ ]  #${it.loadSequence}  ${it.itemId}  —  ${dims}, ${formatWeight(it.weight, unit)}  (${stop})`,
      { width: pageWidth - 2 * MARGIN },
    );
  }
}
