/**
 * Excel Export Service — Generates Excel workbooks for flatbed load plans.
 *
 * Creates a multi-sheet workbook containing:
 * 1. Freight Manifest — order details and item attributes
 * 2. Placement Coordinates — position, orientation, layer, support method
 * 3. Weight Calculations — axle loads, CG, percentages, concentrated loads
 * 4. Securement Requirements — tie-downs, WLL, types, anchors, special securement
 * 5. Loading Sequence — step-by-step instructions
 *
 * Validates: Requirements 15.2
 */

import ExcelJS from 'exceljs';

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface FreightManifestRow {
  orderNumber: string;
  customerName: string;
  deliveryStop: number;
  productType: string;
  quantity: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  handlingMethod: string;
  stackPermission: string;
}

export interface PlacementRow {
  orderNumber: string;
  x: number;
  y: number;
  z: number;
  orientation: string;
  layer: number;
  supportMethod: string;
}

export interface WeightCalculationsData {
  steerAxleWeight: number;
  driveAxleWeight: number;
  trailerAxleWeight: number;
  totalGross: number;
  cgLongitudinal: number;
  cgLateral: number;
  steerAxlePercent: number;
  driveAxlePercent: number;
  trailerAxlePercent: number;
  concentratedLoads: ConcentratedLoadRow[];
}

export interface ConcentratedLoadRow {
  orderNumber: string;
  loadPSF: number;
  maxAllowedPSF: number;
}

export interface SecurementRow {
  orderNumber: string;
  tieDownCount: number;
  requiredWLL: number;
  tieDownTypes: string;
  anchorAssignments: string;
  specialSecurement: string;
}

export interface LoadingSequenceRow {
  stepNumber: number;
  itemDescription: string;
  positionDescription: string;
  orientation: string;
  dunnage: string;
  securement: string;
}

export interface ExcelExportInput {
  planId: string;
  freightManifest: FreightManifestRow[];
  placements: PlacementRow[];
  weightCalculations: WeightCalculationsData;
  securementRequirements: SecurementRow[];
  loadingSequence: LoadingSequenceRow[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ExcelExportService {
  /**
   * Generate an Excel workbook buffer from load plan data.
   */
  async generateWorkbook(input: ExcelExportInput): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OptiFlow Flatbed Steel Load Planner';
    workbook.created = new Date();

    this.addFreightManifestSheet(workbook, input.freightManifest);
    this.addPlacementCoordinatesSheet(workbook, input.placements);
    this.addWeightCalculationsSheet(workbook, input.weightCalculations);
    this.addSecurementRequirementsSheet(workbook, input.securementRequirements);
    this.addLoadingSequenceSheet(workbook, input.loadingSequence);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── Sheet Builders ──────────────────────────────────────────────────────────

  private addFreightManifestSheet(
    workbook: ExcelJS.Workbook,
    rows: FreightManifestRow[]
  ): void {
    const sheet = workbook.addWorksheet('Freight Manifest');

    sheet.columns = [
      { header: 'Order Number', key: 'orderNumber', width: 16 },
      { header: 'Customer', key: 'customerName', width: 20 },
      { header: 'Stop', key: 'deliveryStop', width: 8 },
      { header: 'Product Type', key: 'productType', width: 22 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Weight (lbs)', key: 'weight', width: 14 },
      { header: 'Length (in)', key: 'length', width: 12 },
      { header: 'Width (in)', key: 'width', width: 12 },
      { header: 'Height (in)', key: 'height', width: 12 },
      { header: 'Handling', key: 'handlingMethod', width: 14 },
      { header: 'Stacking', key: 'stackPermission', width: 12 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of rows) {
      sheet.addRow(row);
    }
  }

  private addPlacementCoordinatesSheet(
    workbook: ExcelJS.Workbook,
    rows: PlacementRow[]
  ): void {
    const sheet = workbook.addWorksheet('Placement Coordinates');

    sheet.columns = [
      { header: 'Order Number', key: 'orderNumber', width: 16 },
      { header: 'X Position (in)', key: 'x', width: 14 },
      { header: 'Y Position (in)', key: 'y', width: 14 },
      { header: 'Z Position (in)', key: 'z', width: 14 },
      { header: 'Orientation', key: 'orientation', width: 14 },
      { header: 'Layer', key: 'layer', width: 8 },
      { header: 'Support Method', key: 'supportMethod', width: 18 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of rows) {
      sheet.addRow(row);
    }
  }

  private addWeightCalculationsSheet(
    workbook: ExcelJS.Workbook,
    data: WeightCalculationsData
  ): void {
    const sheet = workbook.addWorksheet('Weight Calculations');

    // Summary section
    sheet.addRow(['Axle Group', 'Weight (lbs)', '% of Rating']);
    this.styleHeaderRow(sheet);

    sheet.addRow(['Steer Axle', data.steerAxleWeight, `${data.steerAxlePercent.toFixed(1)}%`]);
    sheet.addRow(['Drive Axle', data.driveAxleWeight, `${data.driveAxlePercent.toFixed(1)}%`]);
    sheet.addRow(['Trailer Axle', data.trailerAxleWeight, `${data.trailerAxlePercent.toFixed(1)}%`]);
    sheet.addRow([]);
    sheet.addRow(['Total Gross Weight', data.totalGross]);
    sheet.addRow(['CG Longitudinal (in from kingpin)', data.cgLongitudinal]);
    sheet.addRow(['CG Lateral Offset (in from centerline)', data.cgLateral]);

    // Concentrated loads section
    if (data.concentratedLoads.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- Concentrated Loads ---']);
      sheet.addRow(['Order Number', 'Load (PSF)', 'Max Allowed (PSF)']);

      const concentratedHeaderRow = sheet.lastRow!;
      concentratedHeaderRow.font = { bold: true };

      for (const load of data.concentratedLoads) {
        sheet.addRow([load.orderNumber, load.loadPSF, load.maxAllowedPSF]);
      }
    }

    // Auto-width columns
    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 18;
  }

  private addSecurementRequirementsSheet(
    workbook: ExcelJS.Workbook,
    rows: SecurementRow[]
  ): void {
    const sheet = workbook.addWorksheet('Securement Requirements');

    sheet.columns = [
      { header: 'Order Number', key: 'orderNumber', width: 16 },
      { header: 'Tie-Down Count', key: 'tieDownCount', width: 14 },
      { header: 'Required WLL (lbs)', key: 'requiredWLL', width: 18 },
      { header: 'Tie-Down Types', key: 'tieDownTypes', width: 24 },
      { header: 'Anchor Assignments', key: 'anchorAssignments', width: 22 },
      { header: 'Special Securement', key: 'specialSecurement', width: 28 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of rows) {
      sheet.addRow(row);
    }
  }

  private addLoadingSequenceSheet(
    workbook: ExcelJS.Workbook,
    rows: LoadingSequenceRow[]
  ): void {
    const sheet = workbook.addWorksheet('Loading Sequence');

    sheet.columns = [
      { header: 'Step', key: 'stepNumber', width: 8 },
      { header: 'Item Description', key: 'itemDescription', width: 30 },
      { header: 'Position', key: 'positionDescription', width: 36 },
      { header: 'Orientation', key: 'orientation', width: 14 },
      { header: 'Dunnage', key: 'dunnage', width: 24 },
      { header: 'Securement', key: 'securement', width: 28 },
    ];

    this.styleHeaderRow(sheet);

    for (const row of rows) {
      sheet.addRow(row);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private styleHeaderRow(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };
  }
}
