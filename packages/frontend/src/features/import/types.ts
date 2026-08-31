// ─── Import Service Types ────────────────────────────────────────────────────
// Types specific to the import/parsing layer (errors, results, etc.)

import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';

/** Identifies a specific field error in an imported row */
export interface ImportFieldError {
  row: number; // 1-based row index (matches spreadsheet row for user clarity)
  field: string; // field name that failed validation
  value: unknown; // the invalid value provided
  message: string; // plain-language description of the problem
}

/** Identifies a duplicate order-line combination */
export interface DuplicateEntry {
  orderNumber: string;
  rowIndices: number[]; // all rows containing this duplicate
  message: string;
}

/** Complete result of parsing and validating an import file */
export interface ImportResult {
  /** Successfully parsed and validated line items */
  items: SteelOrderLineItem[];
  /** Per-row/field validation errors */
  errors: ImportFieldError[];
  /** Detected duplicate order-line combinations */
  duplicates: DuplicateEntry[];
  /** Total number of rows processed (excluding header) */
  totalRows: number;
}
