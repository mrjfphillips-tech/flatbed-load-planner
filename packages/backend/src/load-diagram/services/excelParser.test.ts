// ─── Tests for the Excel Parser & Template ───────────────────────────────────
// Feature: load-diagram-generator
// Validates: Requirements 1.2, 1.3, 1.4, 9.2, 9.3, 9.4, 9.5, 10.2, 10.5

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseExcelFile, detectUnitSystem } from './excelParser';
import { generateTemplate, templateColumns } from './excelTemplate';
import { loadDiagram } from '@ptv-discovery-coach/shared';

const { MM_PER_INCH, KG_PER_POUND } = loadDiagram;

/** Builds an in-memory workbook with the given headers and data rows. */
async function buildWorkbook(
  headers: string[],
  rows: (string | number | boolean | null)[][],
  sheetName = 'Load Items',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

describe('detectUnitSystem', () => {
  it('detects metric', () => {
    const headers = new Map([['Length_mm', 1], ['Item_ID', 2]]);
    expect(detectUnitSystem(headers).unitSystem).toBe('metric');
  });

  it('detects imperial', () => {
    const headers = new Map([['Length_in', 1], ['Item_ID', 2]]);
    expect(detectUnitSystem(headers).unitSystem).toBe('imperial');
  });

  it('errors on mixed units', () => {
    const headers = new Map([['Length_mm', 1], ['Length_in', 2]]);
    const d = detectUnitSystem(headers);
    expect(d.unitSystem).toBeUndefined();
    expect(d.error).toMatch(/mixes metric and imperial/i);
  });

  it('errors when no dimension columns present', () => {
    const headers = new Map([['Item_ID', 1]]);
    expect(detectUnitSystem(headers).error).toMatch(/No dimension columns/i);
  });
});

describe('parseExcelFile', () => {
  it('parses a metric file into canonical units', async () => {
    const buf = await buildWorkbook(
      ['Item_ID', 'Length_mm', 'Width_mm', 'Height_mm', 'Weight_kg', 'Quantity'],
      [['SKU-1', 1200, 800, 1050, 450, 2]],
    );
    const result = await parseExcelFile(buf);
    expect(result.errors).toEqual([]);
    expect(result.detectedUnitSystem).toBe('metric');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      itemId: 'SKU-1',
      length: 1200,
      width: 800,
      height: 1050,
      weight: 450,
      quantity: 2,
    });
    // Summary respects quantity.
    expect(result.summary.totalItems).toBe(2);
    expect(result.summary.totalWeight).toBe(900);
  });

  it('parses an imperial file and converts to canonical mm/kg', async () => {
    const buf = await buildWorkbook(
      ['Item_ID', 'Length_in', 'Width_in', 'Height_in', 'Weight_lb'],
      [['SKU-2', 10, 20, 5, 100]],
    );
    const result = await parseExcelFile(buf);
    expect(result.errors).toEqual([]);
    expect(result.detectedUnitSystem).toBe('imperial');
    expect(result.items[0].length).toBeCloseTo(10 * MM_PER_INCH, 6);
    expect(result.items[0].width).toBeCloseTo(20 * MM_PER_INCH, 6);
    expect(result.items[0].weight).toBeCloseTo(100 * KG_PER_POUND, 6);
  });

  it('rejects a file that mixes units', async () => {
    const buf = await buildWorkbook(
      ['Item_ID', 'Length_mm', 'Length_in'],
      [['SKU-3', 1000, 40]],
    );
    const result = await parseExcelFile(buf);
    expect(result.items).toEqual([]);
    expect(result.errors.some((e) => /mixes metric and imperial/i.test(e.message))).toBe(true);
  });

  it('flags missing required Item_ID column', async () => {
    const buf = await buildWorkbook(
      ['Length_mm', 'Width_mm', 'Height_mm', 'Weight_kg'],
      [[1000, 800, 900, 100]],
    );
    const result = await parseExcelFile(buf);
    expect(result.errors.some((e) => e.column === 'Item_ID')).toBe(true);
  });

  it('flags rows with non-positive dimensions', async () => {
    const buf = await buildWorkbook(
      ['Item_ID', 'Length_mm', 'Width_mm', 'Height_mm', 'Weight_kg'],
      [['SKU-4', -5, 800, 900, 100]],
    );
    const result = await parseExcelFile(buf);
    expect(result.items).toHaveLength(0);
    expect(result.errors.some((e) => e.column === 'Length_mm')).toBe(true);
  });
});

describe('template round-trip', () => {
  for (const unit of ['metric', 'imperial'] as const) {
    it(`round-trips ${unit}: generate template -> fill -> parse yields identical items`, async () => {
      // Generate a template, then fill in one data row using the template's own
      // column order, write it back, and parse it.
      const templateBuf = await generateTemplate(unit);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(templateBuf as unknown as ArrayBuffer);
      const ws = wb.getWorksheet('Load Items')!;

      const cols = templateColumns(unit);
      const values: Record<string, string | number> = {
        Item_ID: 'RT-1',
        Description: 'Round trip item',
        Quantity: 3,
        Stackability_Class: 'standard',
        Delivery_Stop: 2,
        Temperature_Zone: 'ambient',
        Floor_Only_Flag: 'no',
      };
      // Dimension values in the template's native unit.
      const dim = loadDiagram.EXCEL_DIMENSION_COLUMN_MAP[unit];
      values[dim.length] = unit === 'metric' ? 1200 : 47;
      values[dim.width] = unit === 'metric' ? 800 : 31;
      values[dim.height] = unit === 'metric' ? 1000 : 39;
      values[dim.weight] = unit === 'metric' ? 450 : 990;
      values[dim.maxStackWeight] = unit === 'metric' ? 600 : 1320;

      const dataRow = ws.getRow(2);
      cols.forEach((name, i) => {
        dataRow.getCell(i + 1).value = values[name] ?? null;
      });
      dataRow.commit();

      const filledBuf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
      const result = await parseExcelFile(filledBuf);

      expect(result.errors).toEqual([]);
      expect(result.detectedUnitSystem).toBe(unit);
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.itemId).toBe('RT-1');
      expect(item.quantity).toBe(3);
      // Canonical values must match converting the entered native values.
      expect(item.length).toBeCloseTo(loadDiagram.lengthToCanonical(values[dim.length] as number, unit), 6);
      expect(item.weight).toBeCloseTo(loadDiagram.weightToCanonical(values[dim.weight] as number, unit), 6);
    });
  }

  it('template includes an instructions sheet', async () => {
    const buf = await generateTemplate('metric');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Instructions')).toBeTruthy();
    expect(wb.getWorksheet('Load Items')).toBeTruthy();
  });
});
