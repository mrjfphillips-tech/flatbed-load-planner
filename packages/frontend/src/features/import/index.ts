// ─── Import Service — Barrel Export ──────────────────────────────────────────
// Central entry point for the steel order import module.

export type { ImportResult, ImportFieldError, DuplicateEntry } from './types';
export { parseCsv, parseCsvFile } from './parseCsv';
export { parseXlsx, parseXlsxFile } from './parseXlsx';
export {
  validateRow,
  detectDuplicates,
  mapHeaders,
  VALID_PRODUCT_TYPES,
  VALID_HANDLING_METHODS,
  VALID_STACK_PERMISSIONS,
  VALID_ORIENTATIONS,
  FIELD_ALIASES,
} from './validation';
export { ManualEntryForm } from './ManualEntryForm';
export type { ManualEntryFormProps } from './ManualEntryForm';
export {
  autoMapColumns,
  applyMapping,
  generateTemplate,
  downloadTemplate,
  detectUOMFromMappings,
} from './smartMapper';
export type { FieldMapping } from './smartMapper';
