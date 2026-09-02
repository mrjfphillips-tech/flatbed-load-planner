// ─── Excel Parser Service ────────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Parses uploaded Excel workbooks into canonical LoadItem records. Detects the
// file's unit system (metric or imperial), rejects files that mix the two, and
// converts all dimensions/weights to canonical mm/kg via the shared units
// module. Uses ExcelJS (already a backend dependency) rather than SheetJS.
//
// _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.2, 9.3, 10.2, 10.5_

import ExcelJS from 'exceljs';
import { loadDiagram } from '@ptv-discovery-coach/shared';

type UnitSystem = loadDiagram.UnitSystem;
type LoadItem = loadDiagram.LoadItem;
type ValidationError = loadDiagram.ValidationError;
type ExcelParseResult = loadDiagram.ExcelParseResult;

const {
  UNIT_INDEPENDENT_COLUMNS,
  METRIC_DIMENSION_COLUMNS,
  IMPERIAL_DIMENSION_COLUMNS,
  EXCEL_DIMENSION_COLUMN_MAP,
  lengthToCanonical,
  weightToCanonical,
} = loadDiagram;

/** Maximum accepted file size in bytes (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Finds the (optional) column that identifies a fleet vehicle, tolerant of
 * naming variations like "Vehicle_ID", "Vehicle Assigned", "Assigned Vehicle",
 * "Vehicle", "Truck", "Placa/Plate". Returns the column index or undefined.
 */
export function findVehicleColumn(headers: Map<string, number>): number | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const entries = [...headers.entries()];
  // Priority-ordered phrases; first match wins.
  const phrases = [
    'vehicle id',
    'vehicle assigned',
    'assigned vehicle',
    'vehicle',
    'unit id',
    'truck id',
    'truck',
    'license plate',
    'plate',
    'placa',
    'matricula',
  ];
  for (const phrase of phrases) {
    const hit = entries.find(([name]) => norm(name) === phrase);
    if (hit) return hit[1];
  }
  // Fallback: any header containing "vehicle".
  const contains = entries.find(([name]) => norm(name).includes('vehicle'));
  return contains?.[1];
}

/** The worksheet name the parser reads (falls back to the first sheet). */
const DATA_SHEET_NAME = 'Load Items';

// ─── Header helpers ──────────────────────────────────────────────────────────

/** Normalizes a header cell to a trimmed string. */
function headerText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  return String(value).trim();
}

/** Reads the header row into a map of column name -> 1-based column index. */
function readHeaders(sheet: ExcelJS.Worksheet): Map<string, number> {
  const headers = new Map<string, number>();
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const name = headerText(cell.value);
    if (name) headers.set(name, colNumber);
  });
  return headers;
}

// ─── Unit detection ──────────────────────────────────────────────────────────

interface UnitDetection {
  unitSystem?: UnitSystem;
  error?: string;
}

/**
 * Determines the file's unit system from which dimension columns are present.
 * Returns an error if both metric and imperial dimension columns appear, or if
 * neither does.
 * _Requirements: 9.3, 10.5_
 */
export function detectUnitSystem(headers: Map<string, number>): UnitDetection {
  const hasMetric = METRIC_DIMENSION_COLUMNS.some((c) => headers.has(c));
  const hasImperial = IMPERIAL_DIMENSION_COLUMNS.some((c) => headers.has(c));

  if (hasMetric && hasImperial) {
    return {
      error:
        'File mixes metric and imperial dimension columns. Use a single unit system (either *_mm/*_kg or *_in/*_lb).',
    };
  }
  if (!hasMetric && !hasImperial) {
    return {
      error:
        'No dimension columns found. Expected metric (Length_mm, Width_mm, ...) or imperial (Length_in, Width_in, ...) columns.',
    };
  }
  return { unitSystem: hasMetric ? 'metric' : 'imperial' };
}

// ─── Cell value coercion ─────────────────────────────────────────────────────

function toNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'result' in value && typeof value.result === 'number') {
    return value.result; // formula cell
  }
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function toStringValue(value: ExcelJS.CellValue): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

function toBool(value: ExcelJS.CellValue): boolean {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y' || s === '1' || s === 'x';
}

// ─── Row parsing ─────────────────────────────────────────────────────────────

const REQUIRED_UNIT_INDEPENDENT = ['Item_ID'] as const;

function getCell(
  row: ExcelJS.Row,
  headers: Map<string, number>,
  column: string,
): ExcelJS.CellValue {
  const idx = headers.get(column);
  return idx ? row.getCell(idx).value : null;
}

/**
 * Validates and converts a single data row into a LoadItem (canonical units).
 * Pushes any errors into `errors` and returns null when the row cannot be used.
 * _Requirements: 1.4_
 */
export function parseRow(
  row: ExcelJS.Row,
  rowIndex: number,
  headers: Map<string, number>,
  unitSystem: UnitSystem,
  errors: ValidationError[],
): LoadItem | null {
  const dimCols = EXCEL_DIMENSION_COLUMN_MAP[unitSystem];

  const itemId = toStringValue(getCell(row, headers, 'Item_ID'));
  if (!itemId) {
    errors.push({ row: rowIndex, column: 'Item_ID', message: 'Missing required Item_ID.' });
    return null;
  }

  const rawLength = toNumber(getCell(row, headers, dimCols.length));
  const rawWidth = toNumber(getCell(row, headers, dimCols.width));
  const rawHeight = toNumber(getCell(row, headers, dimCols.height));
  const rawWeight = toNumber(getCell(row, headers, dimCols.weight));

  let valid = true;
  const requirePositive = (value: number | null, column: string): number => {
    if (value == null || value <= 0) {
      errors.push({
        row: rowIndex,
        column,
        message: `${column} must be a positive number.`,
        value: value == null ? undefined : String(value),
      });
      valid = false;
      return 0;
    }
    return value;
  };

  const length = requirePositive(rawLength, dimCols.length);
  const width = requirePositive(rawWidth, dimCols.width);
  const height = requirePositive(rawHeight, dimCols.height);
  const weight = requirePositive(rawWeight, dimCols.weight);

  const rawQuantity = toNumber(getCell(row, headers, 'Quantity'));
  const quantity = rawQuantity == null ? 1 : Math.trunc(rawQuantity);
  if (quantity <= 0) {
    errors.push({ row: rowIndex, column: 'Quantity', message: 'Quantity must be a positive integer.' });
    valid = false;
  }

  const rawMaxStack = toNumber(getCell(row, headers, dimCols.maxStackWeight));

  if (!valid) return null;

  return {
    id: `${itemId}-r${rowIndex}`,
    itemId,
    description: toStringValue(getCell(row, headers, 'Description')),
    length: lengthToCanonical(length, unitSystem),
    width: lengthToCanonical(width, unitSystem),
    height: lengthToCanonical(height, unitSystem),
    weight: weightToCanonical(weight, unitSystem),
    quantity,
    stackabilityClass: toStringValue(getCell(row, headers, 'Stackability_Class')),
    maxStackWeight:
      rawMaxStack == null ? undefined : weightToCanonical(rawMaxStack, unitSystem),
    deliveryStop: toNumber(getCell(row, headers, 'Delivery_Stop')) ?? undefined,
    temperatureZone: toStringValue(getCell(row, headers, 'Temperature_Zone')),
    floorOnly: toBool(getCell(row, headers, 'Floor_Only_Flag')),
    topLoadProhibited: false,
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Parses an uploaded Excel file buffer into an ExcelParseResult with canonical
 * units and the detected unit system. Never throws on data problems — instead
 * it collects row/column validation errors.
 * _Requirements: 1.1, 1.2, 1.3, 1.5_
 */
export async function parseExcelFile(buffer: Buffer): Promise<ExcelParseResult> {
  const errors: ValidationError[] = [];
  const emptyResult = (unitSystem: UnitSystem = 'metric'): ExcelParseResult => ({
    items: [],
    detectedUnitSystem: unitSystem,
    errors,
    summary: { totalItems: 0, totalWeight: 0, totalVolume: 0 },
  });

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    errors.push({ row: 0, column: '', message: 'File exceeds the 10 MB size limit.' });
    return emptyResult();
  }

  const workbook = new ExcelJS.Workbook();
  try {
    // ExcelJS declares its own `Buffer extends ArrayBuffer` type; a Node Buffer
    // is accepted at runtime. Cast through unknown to satisfy the mismatched
    // static type.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    errors.push({ row: 0, column: '', message: 'Unable to read the file as a valid .xlsx workbook.' });
    return emptyResult();
  }

  const sheet = workbook.getWorksheet(DATA_SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) {
    errors.push({ row: 0, column: '', message: 'Workbook contains no worksheets.' });
    return emptyResult();
  }

  const headers = readHeaders(sheet);

  // Required unit-independent columns.
  for (const col of REQUIRED_UNIT_INDEPENDENT) {
    if (!headers.has(col)) {
      errors.push({ row: 1, column: col, message: `Missing required column "${col}".` });
    }
  }

  const detection = detectUnitSystem(headers);
  if (detection.error || !detection.unitSystem) {
    errors.push({ row: 1, column: '', message: detection.error ?? 'Could not detect unit system.' });
    return emptyResult();
  }
  const unitSystem = detection.unitSystem;

  // Bail out early if required columns are missing (row-level parsing would be noise).
  if (errors.length > 0) {
    return emptyResult(unitSystem);
  }

  const items: LoadItem[] = [];
  const vehicleIds = new Set<string>();
  const vehicleIdCol = findVehicleColumn(headers);
  // Row 1 is the header; data starts at row 2.
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    // Skip fully empty rows.
    if (!row.hasValues) continue;
    if (vehicleIdCol) {
      const v = toStringValue(row.getCell(vehicleIdCol).value);
      if (v) vehicleIds.add(v);
    }
    const item = parseRow(row, r, headers, unitSystem, errors);
    if (item) items.push(item);
  }

  // Auto-assign only when the sheet names exactly one vehicle.
  const detectedVehicleId = vehicleIds.size === 1 ? [...vehicleIds][0] : undefined;

  const totalItems = items.reduce((s, it) => s + it.quantity, 0);
  const totalWeight = items.reduce((s, it) => s + it.weight * it.quantity, 0);
  const totalVolume = items.reduce(
    (s, it) => s + it.length * it.width * it.height * it.quantity,
    0,
  );

  return {
    items,
    detectedUnitSystem: unitSystem,
    detectedVehicleId,
    errors,
    summary: { totalItems, totalWeight, totalVolume },
  };
}

/** Re-exported column groups for template generation and tests. */
export const COLUMN_GROUPS = {
  unitIndependent: UNIT_INDEPENDENT_COLUMNS,
  metric: METRIC_DIMENSION_COLUMNS,
  imperial: IMPERIAL_DIMENSION_COLUMNS,
};
