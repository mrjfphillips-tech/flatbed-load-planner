// ─── XLSX Import Parser ──────────────────────────────────────────────────────
// Parses Excel (.xlsx) files into SteelOrderLineItem[] using the xlsx library.

import * as XLSX from 'xlsx';
import type { ImportResult } from './types';
import { mapHeaders, validateRow, detectDuplicates } from './validation';

/**
 * Parses an XLSX ArrayBuffer into validated SteelOrderLineItem instances.
 * Uses the first sheet of the workbook. Reports per-row/field errors
 * and detects duplicate order-line combinations.
 */
export function parseXlsx(buffer: ArrayBuffer): ImportResult {
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Use the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { items: [], errors: [], duplicates: [], totalRows: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  if (!rawData || rawData.length === 0) {
    return { items: [], errors: [], duplicates: [], totalRows: 0 };
  }

  // Extract headers from the first row's keys
  const headers = Object.keys(rawData[0]);
  const headerMapping = mapHeaders(headers);

  const items: import('@ptv-discovery-coach/shared').SteelOrderLineItem[] = [];
  const allErrors: import('./types').ImportFieldError[] = [];
  const validRowIndices: number[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const rawRow = rawData[i];
    const rowIndex = i + 2; // 1-based, +1 for header row

    // Remap raw row using header mapping
    const mappedRow: Record<string, unknown> = {};
    for (const [originalHeader, value] of Object.entries(rawRow)) {
      const internalField = headerMapping[originalHeader];
      if (internalField) {
        mappedRow[internalField] = value;
      }
    }

    const { item, errors } = validateRow(mappedRow, rowIndex);

    if (item) {
      items.push(item);
      validRowIndices.push(rowIndex);
    }

    allErrors.push(...errors);
  }

  // Detect duplicate order-line combinations
  const duplicates = detectDuplicates(items, validRowIndices);

  return {
    items,
    errors: allErrors,
    duplicates,
    totalRows: rawData.length,
  };
}

/**
 * Parses an XLSX File object. Returns a Promise that resolves to an ImportResult.
 */
export function parseXlsxFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result;
      if (buffer instanceof ArrayBuffer) {
        resolve(parseXlsx(buffer));
      } else {
        reject(new Error('Failed to read XLSX file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read XLSX file'));
    reader.readAsArrayBuffer(file);
  });
}
