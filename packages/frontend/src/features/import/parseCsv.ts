// ─── CSV Import Parser ───────────────────────────────────────────────────────
// Parses CSV files into SteelOrderLineItem[] using papaparse with field mapping.

import Papa from 'papaparse';
import type { ImportResult } from './types';
import { mapHeaders, validateRow, detectDuplicates } from './validation';

/**
 * Parses a CSV string into validated SteelOrderLineItem instances.
 * Reports per-row/field errors and detects duplicate order-line combinations.
 */
export function parseCsv(csvContent: string): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (!parsed.data || parsed.data.length === 0) {
    return { items: [], errors: [], duplicates: [], totalRows: 0 };
  }

  // Map column headers to internal field names
  const headers = parsed.meta.fields ?? [];
  const headerMapping = mapHeaders(headers);

  const items: import('@ptv-discovery-coach/shared').SteelOrderLineItem[] = [];
  const allErrors: import('./types').ImportFieldError[] = [];
  const validRowIndices: number[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const rawRow = parsed.data[i];
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
    totalRows: parsed.data.length,
  };
}

/**
 * Parses a CSV File object. Returns a Promise that resolves to an ImportResult.
 */
export function parseCsvFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        resolve(parseCsv(content));
      } else {
        reject(new Error('Failed to read CSV file as text'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read CSV file'));
    reader.readAsText(file);
  });
}
