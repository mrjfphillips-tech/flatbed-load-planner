/**
 * Unit Tests for ExcelExportService — Generates Excel workbooks for flatbed load plans.
 *
 * Tests sheet structure, header accuracy, and data correctness for all 5 sheets:
 * 1. Freight Manifest
 * 2. Placement Coordinates
 * 3. Weight Calculations
 * 4. Securement Requirements
 * 5. Loading Sequence
 *
 * Validates: Requirements 15.2
 */

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  ExcelExportService,
  type ExcelExportInput,
} from './ExcelExportService.js';

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function createSampleInput(): ExcelExportInput {
  return {
    planId: 'plan-001',
    freightManifest: [
      {
        orderNumber: 'ORD-100',
        customerName: 'Acme Steel',
        deliveryStop: 1,
        productType: 'coil_hot_rolled',
        quantity: 2,
        weight: 42000,
        length: 72,
        width: 48,
        height: 48,
        handlingMethod: 'crane',
        stackPermission: 'no',
      },
      {
        orderNumber: 'ORD-101',
        customerName: 'Beta Manufacturing',
        deliveryStop: 2,
        productType: 'plate',
        quantity: 5,
        weight: 18000,
        length: 240,
        width: 96,
        height: 12,
        handlingMethod: 'forklift',
        stackPermission: 'yes',
      },
    ],
    placements: [
      {
        orderNumber: 'ORD-100',
        x: 120,
        y: 24,
        z: 0,
        orientation: 'transverse',
        layer: 0,
        supportMethod: 'on_dunnage',
      },
      {
        orderNumber: 'ORD-101',
        x: 240,
        y: 48,
        z: 0,
        orientation: 'longitudinal',
        layer: 0,
        supportMethod: 'direct_to_deck',
      },
    ],
    weightCalculations: {
      steerAxleWeight: 12000,
      driveAxleWeight: 28000,
      trailerAxleWeight: 38000,
      totalGross: 78000,
      cgLongitudinal: 252,
      cgLateral: 1.5,
      steerAxlePercent: 85.7,
      driveAxlePercent: 82.4,
      trailerAxlePercent: 79.2,
      concentratedLoads: [
        { orderNumber: 'ORD-100', loadPSF: 145, maxAllowedPSF: 200 },
      ],
    },
    securementRequirements: [
      {
        orderNumber: 'ORD-100',
        tieDownCount: 4,
        requiredWLL: 21000,
        tieDownTypes: 'chain_with_binder',
        anchorAssignments: 'AP-1, AP-2, AP-3, AP-4',
        specialSecurement: 'Chain through coil eye, blocking fore/aft',
      },
      {
        orderNumber: 'ORD-101',
        tieDownCount: 4,
        requiredWLL: 9000,
        tieDownTypes: 'strap',
        anchorAssignments: 'AP-5, AP-6, AP-7, AP-8',
        specialSecurement: '',
      },
    ],
    loadingSequence: [
      {
        stepNumber: 1,
        itemDescription: 'Hot-Rolled Coil 42,000 lbs (ORD-100)',
        positionDescription: 'Place at center of deck, 10 feet from headboard',
        orientation: 'transverse',
        dunnage: '4x4 hardwood blocking on both sides',
        securement: 'Apply 4 chains with binders through coil eye',
      },
      {
        stepNumber: 2,
        itemDescription: 'Steel Plate Stack 18,000 lbs (ORD-101)',
        positionDescription: 'Place at rear-center, 20 feet from headboard',
        orientation: 'longitudinal',
        dunnage: 'None required',
        securement: 'Apply 4 straps with edge protectors',
      },
    ],
  };
}

// ─── Helper to parse workbook from buffer ─────────────────────────────────────

async function parseWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  return workbook;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExcelExportService', () => {
  const service = new ExcelExportService();

  describe('generateWorkbook', () => {
    it('returns a valid Buffer', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('creates a workbook with exactly 5 sheets', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);

      expect(workbook.worksheets.length).toBe(5);
    });

    it('names sheets correctly', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);

      const sheetNames = workbook.worksheets.map((ws) => ws.name);
      expect(sheetNames).toContain('Freight Manifest');
      expect(sheetNames).toContain('Placement Coordinates');
      expect(sheetNames).toContain('Weight Calculations');
      expect(sheetNames).toContain('Securement Requirements');
      expect(sheetNames).toContain('Loading Sequence');
    });

    it('sets workbook creator metadata', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);

      expect(workbook.creator).toBe('OptiFlow Flatbed Steel Load Planner');
    });
  });

  // ─── Freight Manifest Sheet ──────────────────────────────────────────────────

  describe('Freight Manifest sheet', () => {
    it('has correct header columns', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Freight Manifest')!;

      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell) => headers.push(cell.value as string));

      expect(headers).toEqual([
        'Order Number',
        'Customer',
        'Stop',
        'Product Type',
        'Quantity',
        'Weight (lbs)',
        'Length (in)',
        'Width (in)',
        'Height (in)',
        'Handling',
        'Stacking',
      ]);
    });

    it('has bold header row', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Freight Manifest')!;

      const headerRow = sheet.getRow(1);
      expect(headerRow.font?.bold).toBe(true);
    });

    it('contains correct number of data rows', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Freight Manifest')!;

      // Header + 2 data rows
      expect(sheet.rowCount).toBe(3);
    });

    it('writes freight manifest data accurately', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Freight Manifest')!;

      const row2 = sheet.getRow(2);
      expect(row2.getCell(1).value).toBe('ORD-100');
      expect(row2.getCell(2).value).toBe('Acme Steel');
      expect(row2.getCell(3).value).toBe(1);
      expect(row2.getCell(4).value).toBe('coil_hot_rolled');
      expect(row2.getCell(5).value).toBe(2);
      expect(row2.getCell(6).value).toBe(42000);
      expect(row2.getCell(7).value).toBe(72);
      expect(row2.getCell(8).value).toBe(48);
      expect(row2.getCell(9).value).toBe(48);
      expect(row2.getCell(10).value).toBe('crane');
      expect(row2.getCell(11).value).toBe('no');

      const row3 = sheet.getRow(3);
      expect(row3.getCell(1).value).toBe('ORD-101');
      expect(row3.getCell(2).value).toBe('Beta Manufacturing');
      expect(row3.getCell(3).value).toBe(2);
    });
  });

  // ─── Placement Coordinates Sheet ─────────────────────────────────────────────

  describe('Placement Coordinates sheet', () => {
    it('has correct header columns', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Placement Coordinates')!;

      const headerRow = sheet.getRow(1);
      const headers: unknown[] = [];
      headerRow.eachCell((cell) => headers.push(cell.value));

      expect(headers).toEqual([
        'Order Number',
        'X Position (in)',
        'Y Position (in)',
        'Z Position (in)',
        'Orientation',
        'Layer',
        'Support Method',
      ]);
    });

    it('writes placement data accurately', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Placement Coordinates')!;

      const row2 = sheet.getRow(2);
      expect(row2.getCell(1).value).toBe('ORD-100');
      expect(row2.getCell(2).value).toBe(120);
      expect(row2.getCell(3).value).toBe(24);
      expect(row2.getCell(4).value).toBe(0);
      expect(row2.getCell(5).value).toBe('transverse');
      expect(row2.getCell(6).value).toBe(0);
      expect(row2.getCell(7).value).toBe('on_dunnage');
    });

    it('contains correct number of data rows', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Placement Coordinates')!;

      expect(sheet.rowCount).toBe(3); // header + 2 data rows
    });
  });

  // ─── Weight Calculations Sheet ───────────────────────────────────────────────

  describe('Weight Calculations sheet', () => {
    it('has axle group summary section with headers', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Weight Calculations')!;

      const row1 = sheet.getRow(1);
      expect(row1.getCell(1).value).toBe('Axle Group');
      expect(row1.getCell(2).value).toBe('Weight (lbs)');
      expect(row1.getCell(3).value).toBe('% of Rating');
    });

    it('writes axle weight data correctly', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Weight Calculations')!;

      const steerRow = sheet.getRow(2);
      expect(steerRow.getCell(1).value).toBe('Steer Axle');
      expect(steerRow.getCell(2).value).toBe(12000);
      expect(steerRow.getCell(3).value).toBe('85.7%');

      const driveRow = sheet.getRow(3);
      expect(driveRow.getCell(1).value).toBe('Drive Axle');
      expect(driveRow.getCell(2).value).toBe(28000);
      expect(driveRow.getCell(3).value).toBe('82.4%');

      const trailerRow = sheet.getRow(4);
      expect(trailerRow.getCell(1).value).toBe('Trailer Axle');
      expect(trailerRow.getCell(2).value).toBe(38000);
      expect(trailerRow.getCell(3).value).toBe('79.2%');
    });

    it('writes total gross weight and CG positions', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Weight Calculations')!;

      // Row 5 is empty separator, row 6 = total gross, row 7 = CG longitudinal, row 8 = CG lateral
      const totalGrossRow = sheet.getRow(6);
      expect(totalGrossRow.getCell(1).value).toBe('Total Gross Weight');
      expect(totalGrossRow.getCell(2).value).toBe(78000);

      const cgLongRow = sheet.getRow(7);
      expect(cgLongRow.getCell(1).value).toBe('CG Longitudinal (in from kingpin)');
      expect(cgLongRow.getCell(2).value).toBe(252);

      const cgLatRow = sheet.getRow(8);
      expect(cgLatRow.getCell(1).value).toBe('CG Lateral Offset (in from centerline)');
      expect(cgLatRow.getCell(2).value).toBe(1.5);
    });

    it('includes concentrated loads section when data exists', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Weight Calculations')!;

      // Find the concentrated loads section
      let foundConcentratedHeader = false;
      let concentratedDataRowNum = -1;
      sheet.eachRow((row, rowNumber) => {
        if (row.getCell(1).value === '--- Concentrated Loads ---') {
          foundConcentratedHeader = true;
        }
        if (row.getCell(1).value === 'ORD-100') {
          concentratedDataRowNum = rowNumber;
        }
      });

      expect(foundConcentratedHeader).toBe(true);
      expect(concentratedDataRowNum).toBeGreaterThan(0);

      const dataRow = sheet.getRow(concentratedDataRowNum);
      expect(dataRow.getCell(1).value).toBe('ORD-100');
      expect(dataRow.getCell(2).value).toBe(145);
      expect(dataRow.getCell(3).value).toBe(200);
    });

    it('omits concentrated loads section when no data', async () => {
      const input = createSampleInput();
      input.weightCalculations.concentratedLoads = [];
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Weight Calculations')!;

      let foundConcentratedHeader = false;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === '--- Concentrated Loads ---') {
          foundConcentratedHeader = true;
        }
      });

      expect(foundConcentratedHeader).toBe(false);
    });
  });

  // ─── Securement Requirements Sheet ───────────────────────────────────────────

  describe('Securement Requirements sheet', () => {
    it('has correct header columns', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Securement Requirements')!;

      const headerRow = sheet.getRow(1);
      const headers: unknown[] = [];
      headerRow.eachCell((cell) => headers.push(cell.value));

      expect(headers).toEqual([
        'Order Number',
        'Tie-Down Count',
        'Required WLL (lbs)',
        'Tie-Down Types',
        'Anchor Assignments',
        'Special Securement',
      ]);
    });

    it('writes securement data accurately', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Securement Requirements')!;

      const row2 = sheet.getRow(2);
      expect(row2.getCell(1).value).toBe('ORD-100');
      expect(row2.getCell(2).value).toBe(4);
      expect(row2.getCell(3).value).toBe(21000);
      expect(row2.getCell(4).value).toBe('chain_with_binder');
      expect(row2.getCell(5).value).toBe('AP-1, AP-2, AP-3, AP-4');
      expect(row2.getCell(6).value).toBe('Chain through coil eye, blocking fore/aft');

      const row3 = sheet.getRow(3);
      expect(row3.getCell(1).value).toBe('ORD-101');
      expect(row3.getCell(2).value).toBe(4);
      expect(row3.getCell(3).value).toBe(9000);
      expect(row3.getCell(4).value).toBe('strap');
    });

    it('contains correct number of data rows', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Securement Requirements')!;

      expect(sheet.rowCount).toBe(3); // header + 2 data rows
    });
  });

  // ─── Loading Sequence Sheet ──────────────────────────────────────────────────

  describe('Loading Sequence sheet', () => {
    it('has correct header columns', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Loading Sequence')!;

      const headerRow = sheet.getRow(1);
      const headers: unknown[] = [];
      headerRow.eachCell((cell) => headers.push(cell.value));

      expect(headers).toEqual([
        'Step',
        'Item Description',
        'Position',
        'Orientation',
        'Dunnage',
        'Securement',
      ]);
    });

    it('writes loading sequence data accurately', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Loading Sequence')!;

      const row2 = sheet.getRow(2);
      expect(row2.getCell(1).value).toBe(1);
      expect(row2.getCell(2).value).toBe('Hot-Rolled Coil 42,000 lbs (ORD-100)');
      expect(row2.getCell(3).value).toBe('Place at center of deck, 10 feet from headboard');
      expect(row2.getCell(4).value).toBe('transverse');
      expect(row2.getCell(5).value).toBe('4x4 hardwood blocking on both sides');
      expect(row2.getCell(6).value).toBe('Apply 4 chains with binders through coil eye');

      const row3 = sheet.getRow(3);
      expect(row3.getCell(1).value).toBe(2);
      expect(row3.getCell(2).value).toBe('Steel Plate Stack 18,000 lbs (ORD-101)');
    });

    it('contains correct number of data rows', async () => {
      const input = createSampleInput();
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Loading Sequence')!;

      expect(sheet.rowCount).toBe(3); // header + 2 data rows
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty freight manifest gracefully', async () => {
      const input = createSampleInput();
      input.freightManifest = [];
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Freight Manifest')!;

      // Only header row
      expect(sheet.rowCount).toBe(1);
    });

    it('handles empty placements gracefully', async () => {
      const input = createSampleInput();
      input.placements = [];
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Placement Coordinates')!;

      expect(sheet.rowCount).toBe(1);
    });

    it('handles empty securement requirements gracefully', async () => {
      const input = createSampleInput();
      input.securementRequirements = [];
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Securement Requirements')!;

      expect(sheet.rowCount).toBe(1);
    });

    it('handles empty loading sequence gracefully', async () => {
      const input = createSampleInput();
      input.loadingSequence = [];
      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Loading Sequence')!;

      expect(sheet.rowCount).toBe(1);
    });

    it('handles zero values in weight calculations', async () => {
      const input = createSampleInput();
      input.weightCalculations = {
        steerAxleWeight: 0,
        driveAxleWeight: 0,
        trailerAxleWeight: 0,
        totalGross: 0,
        cgLongitudinal: 0,
        cgLateral: 0,
        steerAxlePercent: 0,
        driveAxlePercent: 0,
        trailerAxlePercent: 0,
        concentratedLoads: [],
      };

      const buffer = await service.generateWorkbook(input);
      const workbook = await parseWorkbook(buffer);
      const sheet = workbook.getWorksheet('Weight Calculations')!;

      const steerRow = sheet.getRow(2);
      expect(steerRow.getCell(2).value).toBe(0);
      expect(steerRow.getCell(3).value).toBe('0.0%');
    });
  });
});
