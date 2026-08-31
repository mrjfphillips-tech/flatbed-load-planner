// ─── Import Service Unit Tests ───────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseCsv } from './parseCsv';
import { parseXlsx } from './parseXlsx';
import {
  validateRow,
  detectDuplicates,
  mapHeaders,
  VALID_PRODUCT_TYPES,
} from './validation';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';

// ─── Helper: Build a valid CSV row string ────────────────────────────────────

const CSV_HEADERS = [
  'Order Number',
  'Customer Name',
  'Stop',
  'Product Type',
  'Quantity',
  'Piece Weight',
  'Length',
  'Width',
  'Height',
  'Total Weight',
  'Handling Method',
  'Stack Permission',
  'Max Stack Height',
  'Max Stack Weight',
  'Orientation',
  'Dunnage',
  'Notes',
].join(',');

function validCsvRow(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    'Order Number': 'ORD-001',
    'Customer Name': 'Acme Steel Co',
    'Stop': '1',
    'Product Type': 'coil_hot_rolled',
    'Quantity': '3',
    'Piece Weight': '5000',
    'Length': '48',
    'Width': '48',
    'Height': '36',
    'Total Weight': '15000',
    'Handling Method': 'crane',
    'Stack Permission': 'no',
    'Max Stack Height': '72',
    'Max Stack Weight': '20000',
    'Orientation': 'longitudinal',
    'Dunnage': 'yes',
    'Notes': 'Handle with care',
  };

  const merged = { ...defaults, ...overrides };
  return Object.values(merged).join(',');
}

function buildCsv(rows: string[]): string {
  return [CSV_HEADERS, ...rows].join('\n');
}

// ─── Helper: Build XLSX buffer from rows ─────────────────────────────────────

function buildXlsxBuffer(
  data: Record<string, unknown>[]
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf;
}

function validXlsxRow(_overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    'Order Number': 'ORD-001',
    'Customer Name': 'Acme Steel Co',
    'Stop': 1,
    'Product Type': 'coil_hot_rolled',
    'Quantity': 3,
    'Piece Weight': 5000,
    'Length': 48,
    'Width': 48,
    'Height': 36,
    'Total Weight': 15000,
    'Handling Method': 'crane',
    'Stack Permission': 'no',
    'Max Stack Height': 72,
    'Max Stack Weight': 20000,
    'Orientation': 'longitudinal',
    'Dunnage': 'yes',
    'Notes': 'Handle with care',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Import Service: CSV Parsing', () => {
  it('parses a valid CSV row into a SteelOrderLineItem', () => {
    const csv = buildCsv([validCsvRow()]);
    const result = parseCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.totalRows).toBe(1);

    const item = result.items[0];
    expect(item.orderNumber).toBe('ORD-001');
    expect(item.customerName).toBe('Acme Steel Co');
    expect(item.deliveryStop).toBe(1);
    expect(item.productType).toBe('coil_hot_rolled');
    expect(item.quantity).toBe(3);
    expect(item.pieceWeight).toBe(5000);
    expect(item.dimensions.length).toBe(48);
    expect(item.dimensions.width).toBe(48);
    expect(item.dimensions.height).toBe(36);
    expect(item.totalLineWeight).toBe(15000);
    expect(item.handlingMethod).toBe('crane');
    expect(item.stackPermission).toBe('no');
    expect(item.maxStackHeight).toBe(72);
    expect(item.maxStackWeight).toBe(20000);
    expect(item.orientationRequirement).toBe('longitudinal');
    expect(item.dunnageRequired).toBe(true);
    expect(item.specialNotes).toBe('Handle with care');
  });

  it('handles multiple valid rows', () => {
    const csv = buildCsv([
      validCsvRow({ 'Order Number': 'ORD-001' }),
      validCsvRow({ 'Order Number': 'ORD-002', 'Product Type': 'plate' }),
      validCsvRow({ 'Order Number': 'ORD-003', 'Product Type': 'pipe' }),
    ]);
    const result = parseCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(3);
    expect(result.totalRows).toBe(3);
  });

  it('reports errors for missing required fields', () => {
    const csv = buildCsv([validCsvRow({ 'Order Number': '', 'Customer Name': '' })]);
    const result = parseCsv(csv);

    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.some((e) => e.field === 'orderNumber')).toBe(true);
    expect(result.errors.some((e) => e.field === 'customerName')).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it('reports error for invalid product type', () => {
    const csv = buildCsv([validCsvRow({ 'Product Type': 'invalid_type' })]);
    const result = parseCsv(csv);

    expect(result.errors.some((e) => e.field === 'productType')).toBe(true);
  });

  it('reports error for non-numeric quantity', () => {
    const csv = buildCsv([validCsvRow({ 'Quantity': 'abc' })]);
    const result = parseCsv(csv);

    expect(result.errors.some((e) => e.field === 'quantity')).toBe(true);
  });

  it('reports error for invalid handling method', () => {
    const csv = buildCsv([validCsvRow({ 'Handling Method': 'telekinesis' })]);
    const result = parseCsv(csv);

    expect(result.errors.some((e) => e.field === 'handlingMethod')).toBe(true);
  });

  it('reports error for invalid stack permission', () => {
    const csv = buildCsv([validCsvRow({ 'Stack Permission': 'maybe' })]);
    const result = parseCsv(csv);

    expect(result.errors.some((e) => e.field === 'stackPermission')).toBe(true);
  });

  it('reports error for invalid orientation', () => {
    const csv = buildCsv([validCsvRow({ 'Orientation': 'diagonal' })]);
    const result = parseCsv(csv);

    expect(result.errors.some((e) => e.field === 'orientationRequirement')).toBe(true);
  });

  it('detects duplicate order-line combinations', () => {
    const csv = buildCsv([
      validCsvRow({ 'Order Number': 'ORD-001' }),
      validCsvRow({ 'Order Number': 'ORD-001' }),
      validCsvRow({ 'Order Number': 'ORD-002' }),
    ]);
    const result = parseCsv(csv);

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].orderNumber).toBe('ORD-001');
    expect(result.duplicates[0].rowIndices).toHaveLength(2);
  });

  it('handles empty CSV', () => {
    const result = parseCsv('');
    expect(result.items).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.totalRows).toBe(0);
  });

  it('handles header-only CSV', () => {
    const result = parseCsv(CSV_HEADERS);
    expect(result.items).toHaveLength(0);
    expect(result.totalRows).toBe(0);
  });

  it('supports all 22 steel product type categories', () => {
    for (const productType of VALID_PRODUCT_TYPES) {
      const csv = buildCsv([validCsvRow({ 'Product Type': productType })]);
      const result = parseCsv(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.items[0].productType).toBe(productType);
    }
  });

  it('calculates totalLineWeight when missing from CSV', () => {
    const csv = buildCsv([
      validCsvRow({ 'Piece Weight': '2000', 'Quantity': '5', 'Total Weight': '' }),
    ]);
    const result = parseCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.items[0].totalLineWeight).toBe(10000);
  });

  it('provides row number in error messages', () => {
    const csv = buildCsv([
      validCsvRow(),
      validCsvRow({ 'Order Number': '' }), // Row 3 (header=1, first data=2, this=3)
    ]);
    const result = parseCsv(csv);

    const errorForRow3 = result.errors.find((e) => e.row === 3);
    expect(errorForRow3).toBeDefined();
    expect(errorForRow3!.message).toContain('Row 3');
  });
});

describe('Import Service: XLSX Parsing', () => {
  it('parses a valid XLSX row into a SteelOrderLineItem', () => {
    const buffer = buildXlsxBuffer([validXlsxRow()]);
    const result = parseXlsx(buffer);

    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.orderNumber).toBe('ORD-001');
    expect(item.customerName).toBe('Acme Steel Co');
    expect(item.deliveryStop).toBe(1);
    expect(item.productType).toBe('coil_hot_rolled');
    expect(item.quantity).toBe(3);
    expect(item.pieceWeight).toBe(5000);
  });

  it('handles multiple XLSX rows', () => {
    const buffer = buildXlsxBuffer([
      validXlsxRow({ 'Order Number': 'ORD-001' }),
      validXlsxRow({ 'Order Number': 'ORD-002', 'Product Type': 'beam_i' }),
    ]);
    const result = parseXlsx(buffer);

    expect(result.items).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('reports validation errors in XLSX rows', () => {
    // Build a sheet with explicit cell values to avoid XLSX round-trip issues in jsdom
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Order Number', 'Customer Name', 'Stop', 'Product Type', 'Quantity', 'Piece Weight', 'Length', 'Width', 'Height', 'Total Weight', 'Handling Method', 'Stack Permission', 'Max Stack Height', 'Max Stack Weight', 'Orientation', 'Dunnage', 'Notes'],
      ['ORD-001', 'Acme Steel Co', 1, 'coil_hot_rolled', 3, -100, 48, 48, 36, 15000, 'crane', 'no', 72, 20000, 'longitudinal', 'yes', 'Handle with care'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = parseXlsx(buf);

    expect(result.errors.some((e) => e.field === 'pieceWeight')).toBe(true);
  });

  it('detects duplicates in XLSX data', () => {
    // Build a sheet with explicit cell values to avoid XLSX round-trip issues in jsdom
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Order Number', 'Customer Name', 'Stop', 'Product Type', 'Quantity', 'Piece Weight', 'Length', 'Width', 'Height', 'Total Weight', 'Handling Method', 'Stack Permission', 'Max Stack Height', 'Max Stack Weight', 'Orientation', 'Dunnage', 'Notes'],
      ['ORD-DUP', 'Acme Steel Co', 1, 'coil_hot_rolled', 3, 5000, 48, 48, 36, 15000, 'crane', 'no', 72, 20000, 'longitudinal', 'yes', ''],
      ['ORD-DUP', 'Acme Steel Co', 1, 'coil_hot_rolled', 3, 5000, 48, 48, 36, 15000, 'crane', 'no', 72, 20000, 'longitudinal', 'yes', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = parseXlsx(buf);

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].orderNumber).toBe('ORD-DUP');
  });

  it('handles empty workbook', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = parseXlsx(buf);

    expect(result.items).toHaveLength(0);
    expect(result.totalRows).toBe(0);
  });
});

describe('Import Service: Header Mapping', () => {
  it('maps common header aliases to internal field names', () => {
    const mapping = mapHeaders([
      'Order Number',
      'Customer Name',
      'Stop',
      'Product Type',
      'Qty',
      'Piece Weight',
      'Length',
      'Width',
      'Height',
      'Handling',
      'Stackable',
      'Orientation',
      'Dunnage',
      'Notes',
    ]);

    expect(mapping['Order Number']).toBe('orderNumber');
    expect(mapping['Customer Name']).toBe('customerName');
    expect(mapping['Stop']).toBe('deliveryStop');
    expect(mapping['Product Type']).toBe('productType');
    expect(mapping['Qty']).toBe('quantity');
    expect(mapping['Piece Weight']).toBe('pieceWeight');
    expect(mapping['Length']).toBe('length');
    expect(mapping['Width']).toBe('width');
    expect(mapping['Height']).toBe('height');
    expect(mapping['Handling']).toBe('handlingMethod');
    expect(mapping['Stackable']).toBe('stackPermission');
    expect(mapping['Orientation']).toBe('orientationRequirement');
    expect(mapping['Dunnage']).toBe('dunnageRequired');
    expect(mapping['Notes']).toBe('specialNotes');
  });

  it('handles case-insensitive headers', () => {
    const mapping = mapHeaders(['ORDER NUMBER', 'customer name', 'STOP']);
    // Headers are normalized to lowercase for lookup
    expect(mapping['ORDER NUMBER']).toBe('orderNumber');
    expect(mapping['customer name']).toBe('customerName');
    expect(mapping['STOP']).toBe('deliveryStop');
  });
});

describe('Import Service: Row Validation', () => {
  it('returns a valid item when all fields are correct', () => {
    const row: Record<string, unknown> = {
      orderNumber: 'ORD-001',
      customerName: 'Test Co',
      deliveryStop: 1,
      productType: 'plate',
      quantity: 2,
      pieceWeight: 3000,
      length: 120,
      width: 48,
      height: 1,
      totalLineWeight: 6000,
      handlingMethod: 'forklift',
      stackPermission: 'yes',
      maxStackHeight: 60,
      maxStackWeight: 15000,
      orientationRequirement: 'any',
      dunnageRequired: 'true',
      specialNotes: 'Fragile edges',
    };

    const { item, errors } = validateRow(row, 2);
    expect(errors).toHaveLength(0);
    expect(item).not.toBeNull();
    expect(item!.orderNumber).toBe('ORD-001');
    expect(item!.dunnageRequired).toBe(true);
  });

  it('rejects zero or negative delivery stop', () => {
    const row: Record<string, unknown> = {
      orderNumber: 'ORD-001',
      customerName: 'Test',
      deliveryStop: 0,
      productType: 'plate',
      quantity: 1,
      pieceWeight: 100,
      length: 10,
      width: 10,
      height: 10,
      handlingMethod: 'manual',
      stackPermission: 'no',
      orientationRequirement: 'any',
    };

    const { errors } = validateRow(row, 2);
    expect(errors.some((e) => e.field === 'deliveryStop')).toBe(true);
  });

  it('rejects non-integer quantity', () => {
    const row: Record<string, unknown> = {
      orderNumber: 'ORD-001',
      customerName: 'Test',
      deliveryStop: 1,
      productType: 'plate',
      quantity: 2.5,
      pieceWeight: 100,
      length: 10,
      width: 10,
      height: 10,
      handlingMethod: 'manual',
      stackPermission: 'no',
      orientationRequirement: 'any',
    };

    const { errors } = validateRow(row, 2);
    expect(errors.some((e) => e.field === 'quantity')).toBe(true);
  });
});

describe('Import Service: Duplicate Detection', () => {
  it('identifies items with duplicate order numbers', () => {
    const items: SteelOrderLineItem[] = [
      {
        orderNumber: 'A',
        customerName: 'C1',
        deliveryStop: 1,
        productType: 'plate',
        quantity: 1,
        pieceWeight: 100,
        dimensions: { length: 10, width: 10, height: 1 },
        totalLineWeight: 100,
        handlingMethod: 'crane',
        stackPermission: 'no',
        maxStackHeight: 0,
        maxStackWeight: 0,
        orientationRequirement: 'any',
        dunnageRequired: false,
        specialNotes: '',
      },
      {
        orderNumber: 'A',
        customerName: 'C1',
        deliveryStop: 1,
        productType: 'plate',
        quantity: 1,
        pieceWeight: 100,
        dimensions: { length: 10, width: 10, height: 1 },
        totalLineWeight: 100,
        handlingMethod: 'crane',
        stackPermission: 'no',
        maxStackHeight: 0,
        maxStackWeight: 0,
        orientationRequirement: 'any',
        dunnageRequired: false,
        specialNotes: '',
      },
      {
        orderNumber: 'B',
        customerName: 'C2',
        deliveryStop: 2,
        productType: 'pipe',
        quantity: 5,
        pieceWeight: 200,
        dimensions: { length: 240, width: 6, height: 6 },
        totalLineWeight: 1000,
        handlingMethod: 'forklift',
        stackPermission: 'yes',
        maxStackHeight: 48,
        maxStackWeight: 5000,
        orientationRequirement: 'longitudinal',
        dunnageRequired: true,
        specialNotes: '',
      },
    ];

    const duplicates = detectDuplicates(items, [2, 3, 4]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].orderNumber).toBe('A');
    expect(duplicates[0].rowIndices).toEqual([2, 3]);
  });

  it('returns empty array when no duplicates', () => {
    const items: SteelOrderLineItem[] = [
      {
        orderNumber: 'A',
        customerName: 'C1',
        deliveryStop: 1,
        productType: 'plate',
        quantity: 1,
        pieceWeight: 100,
        dimensions: { length: 10, width: 10, height: 1 },
        totalLineWeight: 100,
        handlingMethod: 'crane',
        stackPermission: 'no',
        maxStackHeight: 0,
        maxStackWeight: 0,
        orientationRequirement: 'any',
        dunnageRequired: false,
        specialNotes: '',
      },
      {
        orderNumber: 'B',
        customerName: 'C2',
        deliveryStop: 2,
        productType: 'pipe',
        quantity: 2,
        pieceWeight: 500,
        dimensions: { length: 120, width: 6, height: 6 },
        totalLineWeight: 1000,
        handlingMethod: 'forklift',
        stackPermission: 'yes',
        maxStackHeight: 48,
        maxStackWeight: 5000,
        orientationRequirement: 'longitudinal',
        dunnageRequired: true,
        specialNotes: '',
      },
    ];

    const duplicates = detectDuplicates(items, [2, 3]);
    expect(duplicates).toHaveLength(0);
  });
});
