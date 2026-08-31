// ─── Fleet File Parser & Validator ───────────────────────────────────────────
// Parses raw spreadsheet rows into validated VehicleRecord objects using
// confirmed field mappings. Reports per-row validation errors and detects
// duplicate vehicle IDs across the fleet file.

import type { FieldMapping } from '../import/smartMapper';
import type {
  VehicleRecord,
  ConditionCode,
  FleetFileValidationError,
} from './types';

// ─── Result Interface ────────────────────────────────────────────────────────

/** Result of parsing and validating a fleet manifest file */
export interface FleetParseResult {
  /** Valid vehicle records that passed all validation checks */
  records: VehicleRecord[];
  /** Per-row validation errors (missing/invalid fields) */
  errors: FleetFileValidationError[];
  /** Duplicate vehicle IDs with the row numbers where each appears */
  duplicates: { vehicleId: string; rows: number[] }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Valid condition codes for Peru regional fleet */
const VALID_CONDITION_CODES: ReadonlySet<string> = new Set<string>([
  'ZN', 'ZO', 'ZB', 'ZA', 'ZF',
]);

// ─── Validation Helpers ──────────────────────────────────────────────────────

/**
 * Check if a value is a non-empty string after trimming.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parse a numeric value from an unknown input. Returns the parsed number
 * or NaN if the value cannot be interpreted as a finite number.
 */
function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '');
    if (trimmed === '') return NaN;
    return Number(trimmed);
  }
  return NaN;
}

/**
 * Check if a value represents a valid positive number (> 0, finite).
 */
function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

// ─── Per-Row Validation ──────────────────────────────────────────────────────

/**
 * Validate a single mapped row and produce a VehicleRecord if all fields pass.
 * Returns the record (or null on failure) and any validation errors found.
 *
 * @param row - A record with target field names as keys (after mapping applied)
 * @param rowIndex - 1-based row number for error reporting
 */
export function validateVehicleRecord(
  row: Record<string, unknown>,
  rowIndex: number,
): { record: VehicleRecord | null; errors: FleetFileValidationError[] } {
  const errors: FleetFileValidationError[] = [];

  // ── String fields ──────────────────────────────────────────────────────
  const vehicleId = row['vehicleId'];
  if (!isNonEmptyString(vehicleId)) {
    errors.push({
      row: rowIndex,
      field: 'vehicleId',
      value: vehicleId ?? null,
      message: 'Vehicle ID is required and must be a non-empty string.',
    });
  }

  const vehicleType = row['vehicleType'];
  if (!isNonEmptyString(vehicleType)) {
    errors.push({
      row: rowIndex,
      field: 'vehicleType',
      value: vehicleType ?? null,
      message: 'Vehicle type is required and must be a non-empty string.',
    });
  }

  const licensePlate = row['licensePlate'];
  if (!isNonEmptyString(licensePlate)) {
    errors.push({
      row: rowIndex,
      field: 'licensePlate',
      value: licensePlate ?? null,
      message: 'License plate is required and must be a non-empty string.',
    });
  }

  // ── Numeric fields ─────────────────────────────────────────────────────
  const weightCapacityRaw = row['weightCapacity'];
  const weightCapacity = parseNumeric(weightCapacityRaw);
  if (!isPositiveNumber(weightCapacity)) {
    errors.push({
      row: rowIndex,
      field: 'weightCapacity',
      value: weightCapacityRaw ?? null,
      message: 'Weight capacity must be a positive number (tonnes).',
    });
  }

  const platformLengthRaw = row['platformLength'];
  const platformLength = parseNumeric(platformLengthRaw);
  if (!isPositiveNumber(platformLength)) {
    errors.push({
      row: rowIndex,
      field: 'platformLength',
      value: platformLengthRaw ?? null,
      message: 'Platform length must be a positive number (metres).',
    });
  }

  const platformWidthRaw = row['platformWidth'];
  const platformWidth = parseNumeric(platformWidthRaw);
  if (!isPositiveNumber(platformWidth)) {
    errors.push({
      row: rowIndex,
      field: 'platformWidth',
      value: platformWidthRaw ?? null,
      message: 'Platform width must be a positive number (metres).',
    });
  }

  // ── Condition code ─────────────────────────────────────────────────────
  const conditionCodeRaw = row['conditionCode'];
  const conditionCodeStr = typeof conditionCodeRaw === 'string'
    ? conditionCodeRaw.trim().toUpperCase()
    : '';
  if (!VALID_CONDITION_CODES.has(conditionCodeStr)) {
    errors.push({
      row: rowIndex,
      field: 'conditionCode',
      value: conditionCodeRaw ?? null,
      message: `Condition code must be one of: ${[...VALID_CONDITION_CODES].join(', ')}.`,
    });
  }

  // ── Build record if no errors ──────────────────────────────────────────
  if (errors.length > 0) {
    return { record: null, errors };
  }

  // ── Status field (optional — defaults to 'active') ─────────────────────
  const statusRaw = row['status'];
  const statusStr = typeof statusRaw === 'string'
    ? statusRaw.trim().toLowerCase()
    : '';
  const status: import('./types').VehicleStatus =
    statusStr === 'idle' || statusStr === 'inactivo' || statusStr === 'inactive' || statusStr === 'no'
      ? 'idle'
      : 'active'; // default to active if missing, empty, or unrecognized

  const record: VehicleRecord = {
    vehicleId: (vehicleId as string).trim(),
    vehicleType: (vehicleType as string).trim(),
    licensePlate: (licensePlate as string).trim(),
    weightCapacity,
    platformLength,
    platformWidth,
    conditionCode: conditionCodeStr as ConditionCode,
    status,
  };

  return { record, errors: [] };
}

// ─── Fleet File Parsing ──────────────────────────────────────────────────────

/**
 * Parse a fleet file from raw spreadsheet rows using the confirmed field mappings.
 *
 * Flow:
 * 1. Apply field mappings to transform source column names → target field names
 * 2. Validate each row individually (type checks, non-empty, positive numbers, valid code)
 * 3. Detect duplicate vehicle IDs across all valid records
 * 4. Return the combined result with records, errors, and duplicate report
 *
 * @param rows - Raw row objects from the parsed spreadsheet (source column names as keys)
 * @param mappings - Confirmed field mappings from the smart mapper (or manual mapping)
 * @returns FleetParseResult with valid records, errors, and duplicates
 */
export function parseFleetFile(
  rows: Record<string, unknown>[],
  mappings: FieldMapping[],
): FleetParseResult {
  const allErrors: FleetFileValidationError[] = [];
  const validRecords: VehicleRecord[] = [];

  // Build a lookup from targetField → sourceColumn for active mappings
  const fieldToSource = new Map<string, string>();
  for (const mapping of mappings) {
    if (mapping.sourceColumn) {
      fieldToSource.set(mapping.targetField, mapping.sourceColumn);
    }
  }

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const rowIndex = i + 1; // 1-based for user-facing errors

    // Map source columns to target fields
    const mappedRow: Record<string, unknown> = {};
    for (const [targetField, sourceColumn] of fieldToSource) {
      if (sourceColumn in rawRow) {
        mappedRow[targetField] = rawRow[sourceColumn];
      }
    }

    // Validate the mapped row
    const { record, errors } = validateVehicleRecord(mappedRow, rowIndex);
    if (errors.length > 0) {
      allErrors.push(...errors);
    }
    if (record) {
      validRecords.push(record);
    }
  }

  // Detect duplicate vehicle IDs among valid records
  const duplicates = detectDuplicateVehicleIds(validRecords, rows, mappings);

  return {
    records: validRecords,
    errors: allErrors,
    duplicates,
  };
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

/**
 * Detect duplicate vehicle IDs across all valid records.
 * Reports the vehicle ID and all 1-based row numbers where it appears.
 *
 * This scans ALL rows (including those with other validation errors) to detect
 * duplicates based on the vehicleId field, so users get complete duplicate info
 * even if some rows have other issues.
 */
function detectDuplicateVehicleIds(
  _validRecords: VehicleRecord[],
  rows: Record<string, unknown>[],
  mappings: FieldMapping[],
): { vehicleId: string; rows: number[] }[] {
  // Find the source column for vehicleId
  const vehicleIdMapping = mappings.find(m => m.targetField === 'vehicleId');
  const sourceColumn = vehicleIdMapping?.sourceColumn;

  if (!sourceColumn) {
    return [];
  }

  // Collect all vehicle IDs with their row numbers (only non-empty strings)
  const idToRows = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i][sourceColumn];
    if (isNonEmptyString(raw)) {
      const id = raw.trim();
      const existing = idToRows.get(id);
      if (existing) {
        existing.push(i + 1);
      } else {
        idToRows.set(id, [i + 1]);
      }
    }
  }

  // Filter to only IDs that appear more than once
  const duplicates: { vehicleId: string; rows: number[] }[] = [];
  for (const [vehicleId, rowNumbers] of idToRows) {
    if (rowNumbers.length > 1) {
      duplicates.push({ vehicleId, rows: rowNumbers });
    }
  }

  return duplicates;
}
