/**
 * PDF Export Service — Generates PDF documents for flatbed load plans.
 *
 * Creates two types of PDFs:
 * 1. Multi-page document containing: cover page, drawing views, loading
 *    sequence, securement details, weight summary, warnings, driver checklist.
 * 2. Single-page loading summary for clipboard/cab attachment.
 *
 * Validates: Requirements 15.1, 15.3
 */

import PDFDocument from 'pdfkit';

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface PdfExportOptions {
  /** Include drawing views section (default: true) */
  includeDrawings?: boolean;
  /** Paper size (default: 'LETTER') */
  paperSize?: 'LETTER' | 'A4';
}

export interface PlanExportData {
  planId: string;
  version: number;
  status: string;
  equipment: EquipmentSummary;
  freightManifest: FreightItem[];
  placedFreight: PlacedFreightItem[];
  weightMetrics: WeightSummary;
  securementPlan: SecurementSummaryData;
  loadingSequence: LoadingStepData[];
  warnings: WarningData[];
}

export interface EquipmentSummary {
  tractorName: string;
  trailerName: string;
  trailerLengthFt: number;
  maxGrossWeight: number;
  availablePayload: number;
}

export interface FreightItem {
  orderNumber: string;
  customerName: string;
  deliveryStop: number;
  productType: string;
  quantity: number;
  weight: number;
}

export interface PlacedFreightItem {
  orderNumber: string;
  productType: string;
  position: { x: number; y: number; z: number };
  orientation: string;
  layer: number;
  supportMethod: string;
  weight: number;
}

export interface WeightSummary {
  totalGross: number;
  steerAxleWeight: number;
  driveAxleWeight: number;
  trailerAxleWeight: number;
  cgLongitudinal: number;
  cgLateral: number;
  steerAxlePercent: number;
  driveAxlePercent: number;
  trailerAxlePercent: number;
}

export interface SecurementItemData {
  orderNumber: string;
  tieDownCount: number;
  requiredWLL: number;
  aggregateWLL: number;
  tieDownTypes: string;
  anchorAssignments: string;
  notes: string[];
}

export interface SecurementSummaryData {
  items: SecurementItemData[];
  totalTieDowns: number;
  totalWLL: number;
}

export interface LoadingStepData {
  stepNumber: number;
  itemDescription: string;
  positionDescription: string;
  orientation: string;
  dunnage: string;
  securement: string;
}

export interface WarningData {
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedItems: string[];
  suggestedAction?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  accent: '#3182ce',
  error: '#c53030',
  warning: '#c05621',
  info: '#2b6cb0',
  lightGray: '#e2e8f0',
  darkGray: '#4a5568',
  text: '#1a202c',
} as const;

const FONT_SIZES = {
  title: 22,
  subtitle: 16,
  sectionHeader: 14,
  body: 10,
  small: 8,
  tableHeader: 9,
  tableBody: 8,
} as const;

const MARGINS = { top: 50, bottom: 50, left: 50, right: 50 } as const;

// ─── Service ─────────────────────────────────────────────────────────────────

export class PdfExportService {
  /**
   * Generate a multi-page PDF for a complete load plan.
   * Contains: cover page, drawing views, loading sequence, securement,
   * weight summary, warnings, and driver verification checklist.
   */
  async generateFullPdf(
    data: PlanExportData,
    options: PdfExportOptions = {}
  ): Promise<Buffer> {
    const { paperSize = 'LETTER' } = options;

    const doc = new PDFDocument({
      size: paperSize,
      margins: MARGINS,
      info: {
        Title: `Load Plan ${data.planId}`,
        Author: 'OptiFlow Flatbed Steel Load Planner',
        Subject: `Load Plan Export v${data.version}`,
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const result = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    // Page 1: Cover Page
    this.renderCoverPage(doc, data);

    // Page 2+: Drawing Views (text-based representation)
    if (options.includeDrawings !== false) {
      doc.addPage();
      this.renderDrawingViews(doc, data);
    }

    // Page: Loading Sequence Instructions
    doc.addPage();
    this.renderLoadingSequence(doc, data.loadingSequence);

    // Page: Securement Details
    doc.addPage();
    this.renderSecurementDetails(doc, data.securementPlan);

    // Page: Weight Summary
    doc.addPage();
    this.renderWeightSummary(doc, data.weightMetrics, data.equipment);

    // Page: Warning Summary
    doc.addPage();
    this.renderWarningSummary(doc, data.warnings);

    // Page: Driver Verification Checklist
    doc.addPage();
    this.renderDriverChecklist(doc, data);

    doc.end();
    return result;
  }

  /**
   * Generate a single-page loading summary for clipboard/cab attachment.
   * Compact layout with key information on one page.
   */
  async generateSinglePageSummary(data: PlanExportData): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 30, bottom: 30, left: 30, right: 30 },
      info: {
        Title: `Loading Summary - ${data.planId}`,
        Author: 'OptiFlow Flatbed Steel Load Planner',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const result = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    this.renderSinglePageSummary(doc, data);

    doc.end();
    return result;
  }

  // ─── Cover Page ────────────────────────────────────────────────────────────

  private renderCoverPage(doc: PDFKit.PDFDocument, data: PlanExportData): void {
    const pageWidth = doc.page.width - MARGINS.left - MARGINS.right;

    // Title
    doc
      .fontSize(FONT_SIZES.title)
      .fillColor(COLORS.primary)
      .text('FLATBED LOAD PLAN', { align: 'center' });

    doc.moveDown(0.5);

    // Plan identification
    doc
      .fontSize(FONT_SIZES.subtitle)
      .fillColor(COLORS.secondary)
      .text(`Plan ID: ${data.planId}`, { align: 'center' });

    doc
      .fontSize(FONT_SIZES.body)
      .fillColor(COLORS.darkGray)
      .text(`Version: ${data.version} | Status: ${data.status.toUpperCase()}`, {
        align: 'center',
      });

    doc.moveDown(2);

    // Separator line
    this.drawHorizontalLine(doc, pageWidth);
    doc.moveDown(1);

    // Equipment Summary
    this.renderSectionHeader(doc, 'Equipment');
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
    doc.text(`Tractor: ${data.equipment.tractorName}`);
    doc.text(`Trailer: ${data.equipment.trailerName} (${data.equipment.trailerLengthFt} ft)`);
    doc.text(`Max Gross Weight: ${data.equipment.maxGrossWeight.toLocaleString()} lbs`);
    doc.text(`Available Payload: ${data.equipment.availablePayload.toLocaleString()} lbs`);

    doc.moveDown(1);

    // Freight Summary
    this.renderSectionHeader(doc, 'Freight Summary');
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
    const totalItems = data.freightManifest.length;
    const totalWeight = data.freightManifest.reduce((sum, item) => sum + item.weight, 0);
    const uniqueCustomers = Array.from(new Set(data.freightManifest.map((i) => i.customerName)));
    const maxStop = Math.max(...data.freightManifest.map((i) => i.deliveryStop), 0);

    doc.text(`Total Items: ${totalItems}`);
    doc.text(`Total Freight Weight: ${totalWeight.toLocaleString()} lbs`);
    doc.text(`Customers: ${uniqueCustomers.join(', ')}`);
    doc.text(`Delivery Stops: ${maxStop}`);

    doc.moveDown(1);

    // Weight Overview
    this.renderSectionHeader(doc, 'Weight Overview');
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
    doc.text(
      `Total Gross: ${data.weightMetrics.totalGross.toLocaleString()} lbs`
    );
    doc.text(
      `Steer Axle: ${data.weightMetrics.steerAxleWeight.toLocaleString()} lbs (${data.weightMetrics.steerAxlePercent.toFixed(1)}%)`
    );
    doc.text(
      `Drive Axle: ${data.weightMetrics.driveAxleWeight.toLocaleString()} lbs (${data.weightMetrics.driveAxlePercent.toFixed(1)}%)`
    );
    doc.text(
      `Trailer Axle: ${data.weightMetrics.trailerAxleWeight.toLocaleString()} lbs (${data.weightMetrics.trailerAxlePercent.toFixed(1)}%)`
    );

    doc.moveDown(1);

    // Warning summary count
    this.renderSectionHeader(doc, 'Warnings');
    const errors = data.warnings.filter((w) => w.severity === 'error').length;
    const warnings = data.warnings.filter((w) => w.severity === 'warning').length;
    const infos = data.warnings.filter((w) => w.severity === 'info').length;
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
    doc.text(`Errors: ${errors} | Warnings: ${warnings} | Info: ${infos}`);

    doc.moveDown(2);

    // Footer
    doc
      .fontSize(FONT_SIZES.small)
      .fillColor(COLORS.darkGray)
      .text(
        `Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
        { align: 'center' }
      );
    doc.text('OptiFlow Flatbed Steel Load Planner', { align: 'center' });
  }

  // ─── Drawing Views ─────────────────────────────────────────────────────────

  private renderDrawingViews(doc: PDFKit.PDFDocument, data: PlanExportData): void {
    const pageWidth = doc.page.width - MARGINS.left - MARGINS.right;

    this.renderPageHeader(doc, 'Load Drawing Views');
    doc.moveDown(0.5);

    // Text-based top-down representation
    this.renderSectionHeader(doc, 'Top-Down View (Plan View)');
    doc.fontSize(FONT_SIZES.small).fillColor(COLORS.darkGray);
    doc.text('Trailer deck layout — items shown by position (front = left, rear = right)');
    doc.moveDown(0.5);

    // Draw a simple deck outline
    const deckLeft = MARGINS.left;
    const deckWidth = pageWidth;
    const deckHeight = 120;
    const deckTop = doc.y;

    doc
      .rect(deckLeft, deckTop, deckWidth, deckHeight)
      .stroke(COLORS.primary);

    // Label front and rear
    doc
      .fontSize(FONT_SIZES.small)
      .fillColor(COLORS.darkGray)
      .text('FRONT', deckLeft + 5, deckTop + 5)
      .text('REAR', deckLeft + deckWidth - 35, deckTop + 5);

    // Plot placed items as labeled rectangles
    if (data.placedFreight.length > 0) {
      const maxX = Math.max(...data.placedFreight.map((p) => p.position.x), 1);
      for (const item of data.placedFreight.slice(0, 20)) {
        const scaledX = deckLeft + (item.position.x / maxX) * (deckWidth - 60) + 30;
        const scaledY = deckTop + 20 + (item.position.y + 48) * (deckHeight - 40) / 96;
        doc
          .fontSize(6)
          .fillColor(COLORS.accent)
          .text(item.orderNumber.slice(0, 8), scaledX, Math.min(scaledY, deckTop + deckHeight - 12));
      }
    }

    doc.y = deckTop + deckHeight + 20;

    // Item placement table
    this.renderSectionHeader(doc, 'Placement Summary');
    doc.moveDown(0.3);

    const headers = ['Order #', 'Product', 'X (in)', 'Y (in)', 'Z (in)', 'Layer', 'Orientation'];
    const colWidths = [70, 100, 55, 55, 55, 45, 80];
    this.renderTableHeader(doc, headers, colWidths);

    for (const item of data.placedFreight.slice(0, 30)) {
      const row = [
        item.orderNumber.slice(0, 10),
        item.productType.slice(0, 15),
        item.position.x.toFixed(0),
        item.position.y.toFixed(0),
        item.position.z.toFixed(0),
        String(item.layer),
        item.orientation,
      ];
      this.renderTableRow(doc, row, colWidths);
    }

    if (data.placedFreight.length > 30) {
      doc.moveDown(0.3);
      doc
        .fontSize(FONT_SIZES.small)
        .fillColor(COLORS.darkGray)
        .text(`... and ${data.placedFreight.length - 30} more items`);
    }
  }

  // ─── Loading Sequence ──────────────────────────────────────────────────────

  private renderLoadingSequence(
    doc: PDFKit.PDFDocument,
    steps: LoadingStepData[]
  ): void {
    this.renderPageHeader(doc, 'Loading Sequence Instructions');
    doc.moveDown(0.5);

    doc
      .fontSize(FONT_SIZES.small)
      .fillColor(COLORS.darkGray)
      .text('Execute steps in order. Place dunnage before the item, apply securement after.');
    doc.moveDown(0.5);

    for (const step of steps) {
      // Check if we need a new page
      if (doc.y > doc.page.height - MARGINS.bottom - 80) {
        doc.addPage();
        this.renderPageHeader(doc, 'Loading Sequence (continued)');
        doc.moveDown(0.5);
      }

      doc
        .fontSize(FONT_SIZES.body)
        .fillColor(COLORS.primary)
        .text(`Step ${step.stepNumber}: ${step.itemDescription}`, {
          underline: true,
        });

      doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
      doc.text(`  Position: ${step.positionDescription}`);
      doc.text(`  Orientation: ${step.orientation}`);

      if (step.dunnage) {
        doc.text(`  Dunnage: ${step.dunnage}`);
      }
      if (step.securement) {
        doc.text(`  Securement: ${step.securement}`);
      }

      doc.moveDown(0.5);
    }

    if (steps.length === 0) {
      doc
        .fontSize(FONT_SIZES.body)
        .fillColor(COLORS.darkGray)
        .text('No loading steps generated.');
    }
  }

  // ─── Securement Details ────────────────────────────────────────────────────

  private renderSecurementDetails(
    doc: PDFKit.PDFDocument,
    securement: SecurementSummaryData
  ): void {
    this.renderPageHeader(doc, 'Securement Details');
    doc.moveDown(0.5);

    // Summary
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
    doc.text(`Total Tie-Downs: ${securement.totalTieDowns}`);
    doc.text(`Total Working Load Limit: ${securement.totalWLL.toLocaleString()} lbs`);
    doc.moveDown(0.5);

    // Detail table
    const headers = ['Order #', 'Tie-Downs', 'Req WLL', 'Agg WLL', 'Types', 'Anchors'];
    const colWidths = [75, 65, 70, 70, 90, 90];
    this.renderTableHeader(doc, headers, colWidths);

    for (const item of securement.items) {
      if (doc.y > doc.page.height - MARGINS.bottom - 30) {
        doc.addPage();
        this.renderPageHeader(doc, 'Securement Details (continued)');
        doc.moveDown(0.5);
        this.renderTableHeader(doc, headers, colWidths);
      }

      const row = [
        item.orderNumber.slice(0, 10),
        String(item.tieDownCount),
        `${item.requiredWLL.toLocaleString()}`,
        `${item.aggregateWLL.toLocaleString()}`,
        item.tieDownTypes.slice(0, 14),
        item.anchorAssignments.slice(0, 14),
      ];
      this.renderTableRow(doc, row, colWidths);
    }

    if (securement.items.length === 0) {
      doc
        .fontSize(FONT_SIZES.body)
        .fillColor(COLORS.darkGray)
        .text('No securement data available.');
    }
  }

  // ─── Weight Summary ────────────────────────────────────────────────────────

  private renderWeightSummary(
    doc: PDFKit.PDFDocument,
    metrics: WeightSummary,
    equipment: EquipmentSummary
  ): void {
    this.renderPageHeader(doc, 'Weight Distribution Summary');
    doc.moveDown(0.5);

    const pageWidth = doc.page.width - MARGINS.left - MARGINS.right;

    // Gross weight box
    doc
      .fontSize(FONT_SIZES.subtitle)
      .fillColor(COLORS.primary)
      .text(`Total Gross: ${metrics.totalGross.toLocaleString()} lbs`, {
        align: 'center',
      });
    doc
      .fontSize(FONT_SIZES.small)
      .fillColor(COLORS.darkGray)
      .text(`Max Legal Gross: ${equipment.maxGrossWeight.toLocaleString()} lbs`, {
        align: 'center',
      });

    doc.moveDown(1);
    this.drawHorizontalLine(doc, pageWidth);
    doc.moveDown(1);

    // Axle breakdown
    this.renderSectionHeader(doc, 'Axle Group Weights');
    doc.moveDown(0.3);

    const axleData = [
      ['Steer Axle', metrics.steerAxleWeight, metrics.steerAxlePercent],
      ['Drive Axle', metrics.driveAxleWeight, metrics.driveAxlePercent],
      ['Trailer Axle', metrics.trailerAxleWeight, metrics.trailerAxlePercent],
    ] as const;

    for (const [label, weight, percent] of axleData) {
      const color = percent > 100 ? COLORS.error : percent > 95 ? COLORS.warning : COLORS.text;
      doc.fontSize(FONT_SIZES.body).fillColor(color);
      doc.text(`${label}: ${weight.toLocaleString()} lbs (${percent.toFixed(1)}% of rating)`);
    }

    doc.moveDown(1);

    // Center of gravity
    this.renderSectionHeader(doc, 'Center of Gravity');
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
    doc.text(`Longitudinal CG: ${metrics.cgLongitudinal.toFixed(1)} inches from kingpin`);
    doc.text(`Lateral CG Offset: ${metrics.cgLateral.toFixed(1)} inches from centerline`);
  }

  // ─── Warning Summary ───────────────────────────────────────────────────────

  private renderWarningSummary(doc: PDFKit.PDFDocument, warnings: WarningData[]): void {
    this.renderPageHeader(doc, 'Warning Summary');
    doc.moveDown(0.5);

    const errors = warnings.filter((w) => w.severity === 'error');
    const warningItems = warnings.filter((w) => w.severity === 'warning');
    const infos = warnings.filter((w) => w.severity === 'info');

    // Summary counts
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
    doc.text(
      `Total: ${warnings.length} — Errors: ${errors.length}, Warnings: ${warningItems.length}, Info: ${infos.length}`
    );
    doc.moveDown(0.5);

    // Group by severity
    if (errors.length > 0) {
      this.renderWarningGroup(doc, 'ERRORS', errors, COLORS.error);
    }
    if (warningItems.length > 0) {
      this.renderWarningGroup(doc, 'WARNINGS', warningItems, COLORS.warning);
    }
    if (infos.length > 0) {
      this.renderWarningGroup(doc, 'INFO', infos, COLORS.info);
    }

    if (warnings.length === 0) {
      doc
        .fontSize(FONT_SIZES.body)
        .fillColor(COLORS.darkGray)
        .text('No warnings — all checks passed.');
    }
  }

  private renderWarningGroup(
    doc: PDFKit.PDFDocument,
    title: string,
    items: WarningData[],
    color: string
  ): void {
    doc.fontSize(FONT_SIZES.sectionHeader).fillColor(color).text(title);
    doc.moveDown(0.3);

    for (const warning of items) {
      if (doc.y > doc.page.height - MARGINS.bottom - 60) {
        doc.addPage();
        this.renderPageHeader(doc, 'Warning Summary (continued)');
        doc.moveDown(0.5);
      }

      doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
      doc.text(`• ${warning.message}`);
      if (warning.affectedItems.length > 0) {
        doc
          .fontSize(FONT_SIZES.small)
          .fillColor(COLORS.darkGray)
          .text(`  Affected: ${warning.affectedItems.join(', ')}`);
      }
      if (warning.suggestedAction) {
        doc
          .fontSize(FONT_SIZES.small)
          .fillColor(COLORS.darkGray)
          .text(`  Suggested: ${warning.suggestedAction}`);
      }
      doc.moveDown(0.3);
    }
    doc.moveDown(0.5);
  }

  // ─── Driver Verification Checklist ─────────────────────────────────────────

  private renderDriverChecklist(doc: PDFKit.PDFDocument, data: PlanExportData): void {
    this.renderPageHeader(doc, 'Driver Verification Checklist');
    doc.moveDown(0.5);

    doc
      .fontSize(FONT_SIZES.small)
      .fillColor(COLORS.darkGray)
      .text(
        'Check each item before departure. Mark non-conforming items and report to Supervisor.'
      );
    doc.moveDown(0.5);

    // Item Presence Checks
    this.renderSectionHeader(doc, '1. Item Presence Check');
    doc.moveDown(0.3);
    for (const item of data.freightManifest) {
      this.renderCheckbox(
        doc,
        `${item.orderNumber} — ${item.productType} (${item.quantity} pcs, ${item.weight.toLocaleString()} lbs)`
      );
    }

    doc.moveDown(0.5);

    // Securement Check
    this.renderSectionHeader(doc, '2. Securement Check');
    doc.moveDown(0.3);
    this.renderCheckbox(doc, 'All tie-downs in place and properly tensioned');
    this.renderCheckbox(doc, 'Edge protectors installed where required');
    this.renderCheckbox(doc, 'Coil racks/cradles secured (if applicable)');
    this.renderCheckbox(doc, 'Blocking and bracing in place');
    this.renderCheckbox(
      doc,
      `Total tie-downs installed: _____ (Required: ${data.securementPlan.totalTieDowns})`
    );

    doc.moveDown(0.5);

    // Weight Check
    this.renderSectionHeader(doc, '3. Weight Check');
    doc.moveDown(0.3);
    this.renderCheckbox(
      doc,
      `Gross weight within tolerance of ${data.weightMetrics.totalGross.toLocaleString()} lbs`
    );
    this.renderCheckbox(doc, 'Scale ticket obtained and matches plan (+/- 2%)');
    this.renderCheckbox(doc, 'No axle group over legal limit');

    doc.moveDown(0.5);

    // Damage Check
    this.renderSectionHeader(doc, '4. Damage Check');
    doc.moveDown(0.3);
    this.renderCheckbox(doc, 'No visible damage to freight');
    this.renderCheckbox(doc, 'No damage to dunnage or securement equipment');
    this.renderCheckbox(doc, 'Trailer deck and equipment in good condition');

    doc.moveDown(1);

    // Signature lines
    this.drawHorizontalLine(
      doc,
      doc.page.width - MARGINS.left - MARGINS.right
    );
    doc.moveDown(0.5);
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text);
    doc.text('Driver Name: ____________________________    Date: _______________');
    doc.moveDown(0.3);
    doc.text('Driver Signature: _______________________    Time: _______________');
    doc.moveDown(0.3);
    doc.text('Discrepancies (if any): ______________________________________________');
  }

  // ─── Single-Page Summary ───────────────────────────────────────────────────

  private renderSinglePageSummary(doc: PDFKit.PDFDocument, data: PlanExportData): void {
    // Compact header
    doc
      .fontSize(FONT_SIZES.subtitle)
      .fillColor(COLORS.primary)
      .text('LOADING SUMMARY', { align: 'center' });
    doc
      .fontSize(FONT_SIZES.body)
      .fillColor(COLORS.secondary)
      .text(`Plan: ${data.planId} | v${data.version} | ${data.status}`, {
        align: 'center',
      });
    doc.moveDown(0.3);

    const pageWidth = doc.page.width - 60; // using 30 margins
    this.drawHorizontalLine(doc, pageWidth);
    doc.moveDown(0.3);

    // Equipment (compact)
    doc.fontSize(FONT_SIZES.small).fillColor(COLORS.text);
    doc.text(
      `${data.equipment.tractorName} + ${data.equipment.trailerName} (${data.equipment.trailerLengthFt}ft) | Payload: ${data.equipment.availablePayload.toLocaleString()} lbs`
    );
    doc.moveDown(0.3);

    // Weight row
    doc.text(
      `Gross: ${data.weightMetrics.totalGross.toLocaleString()} lbs | Steer: ${data.weightMetrics.steerAxlePercent.toFixed(0)}% | Drive: ${data.weightMetrics.driveAxlePercent.toFixed(0)}% | Trailer: ${data.weightMetrics.trailerAxlePercent.toFixed(0)}%`
    );
    doc.moveDown(0.3);
    this.drawHorizontalLine(doc, pageWidth);
    doc.moveDown(0.3);

    // Compact loading sequence (abbreviated)
    doc
      .fontSize(FONT_SIZES.tableHeader)
      .fillColor(COLORS.primary)
      .text('LOADING SEQUENCE');
    doc.moveDown(0.2);

    for (const step of data.loadingSequence.slice(0, 15)) {
      doc
        .fontSize(FONT_SIZES.tableBody)
        .fillColor(COLORS.text)
        .text(
          `${step.stepNumber}. ${step.itemDescription} → ${step.positionDescription} (${step.orientation})`
        );
    }

    if (data.loadingSequence.length > 15) {
      doc
        .fontSize(FONT_SIZES.tableBody)
        .fillColor(COLORS.darkGray)
        .text(`... +${data.loadingSequence.length - 15} more steps (see full plan)`);
    }

    doc.moveDown(0.3);
    this.drawHorizontalLine(doc, pageWidth);
    doc.moveDown(0.3);

    // Compact securement summary
    doc
      .fontSize(FONT_SIZES.tableHeader)
      .fillColor(COLORS.primary)
      .text('SECUREMENT');
    doc.moveDown(0.2);
    doc.fontSize(FONT_SIZES.tableBody).fillColor(COLORS.text);
    doc.text(
      `Tie-downs: ${data.securementPlan.totalTieDowns} | Total WLL: ${data.securementPlan.totalWLL.toLocaleString()} lbs`
    );

    doc.moveDown(0.3);
    this.drawHorizontalLine(doc, pageWidth);
    doc.moveDown(0.3);

    // Warnings (compact)
    const errors = data.warnings.filter((w) => w.severity === 'error');
    const warningItems = data.warnings.filter((w) => w.severity === 'warning');
    if (errors.length > 0 || warningItems.length > 0) {
      doc
        .fontSize(FONT_SIZES.tableHeader)
        .fillColor(COLORS.error)
        .text('ACTIVE WARNINGS');
      doc.moveDown(0.2);
      for (const w of [...errors, ...warningItems].slice(0, 5)) {
        const icon = w.severity === 'error' ? '✗' : '⚠';
        doc
          .fontSize(FONT_SIZES.tableBody)
          .fillColor(w.severity === 'error' ? COLORS.error : COLORS.warning)
          .text(`${icon} ${w.message}`);
      }
      doc.moveDown(0.3);
      this.drawHorizontalLine(doc, pageWidth);
      doc.moveDown(0.3);
    }

    // Quick driver sign-off
    doc
      .fontSize(FONT_SIZES.tableHeader)
      .fillColor(COLORS.primary)
      .text('DRIVER SIGN-OFF');
    doc.moveDown(0.2);
    doc.fontSize(FONT_SIZES.tableBody).fillColor(COLORS.text);
    doc.text('☐ Items verified   ☐ Securement checked   ☐ Weight confirmed   ☐ No damage');
    doc.moveDown(0.5);
    doc.text('Driver: _________________________  Signature: _________________________');
    doc.text('Date: ____________  Time: ____________');
  }

  // ─── Shared Helpers ────────────────────────────────────────────────────────

  private renderPageHeader(doc: PDFKit.PDFDocument, title: string): void {
    doc.fontSize(FONT_SIZES.sectionHeader).fillColor(COLORS.primary).text(title);
    const pageWidth = doc.page.width - MARGINS.left - MARGINS.right;
    this.drawHorizontalLine(doc, pageWidth);
    doc.moveDown(0.3);
  }

  private renderSectionHeader(doc: PDFKit.PDFDocument, title: string): void {
    doc
      .fontSize(FONT_SIZES.body)
      .fillColor(COLORS.secondary)
      .text(title, { underline: true });
  }

  private renderCheckbox(doc: PDFKit.PDFDocument, label: string): void {
    doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text).text(`☐  ${label}`);
  }

  private drawHorizontalLine(
    doc: PDFKit.PDFDocument,
    width: number
  ): void {
    const startX = doc.x;
    const y = doc.y;
    doc
      .moveTo(startX, y)
      .lineTo(startX + width, y)
      .strokeColor(COLORS.lightGray)
      .lineWidth(0.5)
      .stroke();
  }

  private renderTableHeader(
    doc: PDFKit.PDFDocument,
    headers: string[],
    colWidths: number[]
  ): void {
    const startX = MARGINS.left;
    let x = startX;

    doc.fontSize(FONT_SIZES.tableHeader).fillColor(COLORS.primary);
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, doc.y, { width: colWidths[i], continued: false });
      x += colWidths[i];
    }
  }

  private renderTableRow(
    doc: PDFKit.PDFDocument,
    values: string[],
    colWidths: number[]
  ): void {
    const startX = MARGINS.left;
    let x = startX;
    const y = doc.y;

    doc.fontSize(FONT_SIZES.tableBody).fillColor(COLORS.text);
    for (let i = 0; i < values.length; i++) {
      doc.text(values[i], x, y, { width: colWidths[i], continued: false });
      x += colWidths[i];
    }
  }
}
