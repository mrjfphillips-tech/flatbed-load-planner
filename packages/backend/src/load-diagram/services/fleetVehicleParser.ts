// ─── Fleet Vehicle Excel Parser ──────────────────────────────────────────────
// Feature: load-diagram-generator (Customer Fleet)
//
// Parses an uploaded Excel workbook of fleet vehicles into canonical FleetVehicle
// records. Detects the unit system (metric or imperial), rejects mixed-unit
// files, and converts weights/dimensions to canonical mm/kg via the shared units
// module. Cost fields are optional, currency-agnostic numbers. Mirrors the
// conventions of excelParser.ts (ExcelJS, header map, ValidationError list,
// 10 MB cap).

import ExcelJS from 'exceljs';
import { loadDiagram } from '@ptv-discovery-coach/shared';

type UnitSystem = loadDiagram.UnitSystem;
type FleetVehicle = loadDiagram.FleetVehicle;
type ValidationError = loadDiagram.ValidationError;
type FleetVehicleParseResult = loadDiagram.FleetVehicleParseResult;

const {
  FLEET_METRIC_COLUMNS,
  FLEET_IMPERIAL_COLUMNS,
  FLEET_DIMENSION_COLUMN_MAP,
  lengthToCanonical,
  weightToCanonical,
} = loadDiagram;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DATA_SHEET_NAME = 'Vehicles';

// ─── Header helpers ──────────────────────────────────────────────────────────

function headerText(value: ExcelJS.CellValue): string {
  return value == null ? '' : String(value).trim();
}

function readHeaders(sheet: ExcelJS.Worksheet): Map<string, number> {
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
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
 * Errors on mixed units or when no dimension columns are found.
 */
export function detectFleetUnitSystem(headers: Map<string, number>): UnitDetection {
  const hasMetric = FLEET_METRIC_COLUMNS.some((c) => headers.has(c));
  const hasImperial = FLEET_IMPERIAL_COLUMNS.some((c) => headers.has(c));

  if (hasMetric && hasImperial) {
    return {
      error:
        'File mixes metric and imperial columns. Use one unit system (either *_mm/*_kg or *_in/*_lb).',
    };
  }
  if (!hasMetric && !hasImperial) {
    return {
      error:
        'No dimension columns found. Expected metric (Max_Weight_kg, Platform_Length_mm, ...) or imperial (Max_Weight_lb, Platform_Length_in, ...) columns.',
    };
  }
  return { unitSystem: hasMetric ? 'metric' : 'imperial' };
}

// ─── Cell coercion ───────────────────────────────────────────────────────────

function toNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'result' in value && typeof value.result === 'number') {
    return value.result;
  }
  const n = Number(String(value).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toStringValue(value: ExcelJS.CellValue): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

function getCell(
  row: ExcelJS.Row,
  headers: Map<string, number>,
  column: string,
): ExcelJS.CellValue {
  const idx = headers.get(column);
  return idx ? row.getCell(idx).value : null;
}

// ─── Row parsing ─────────────────────────────────────────────────────────────

export function parseVehicleRow(
  row: ExcelJS.Row,
  rowIndex: number,
  headers: Map<string, number>,
  unitSystem: UnitSystem,
  errors: ValidationError[],
): FleetVehicle | null {
  const dim = FLEET_DIMENSION_COLUMN_MAP[unitSystem];

  const vehicleId = toStringValue(getCell(row, headers, 'Vehicle_ID'));
  const vehicleName = toStringValue(getCell(row, headers, 'Vehicle_Name'));

  let valid = true;
  if (!vehicleId) {
    errors.push({ row: rowIndex, column: 'Vehicle_ID', message: 'Missing required Vehicle_ID.' });
    valid = false;
  }
  if (!vehicleName) {
    errors.push({ row: rowIndex, column: 'Vehicle_Name', message: 'Missing required Vehicle_Name.' });
    valid = false;
  }

  const requirePositive = (raw: ExcelJS.CellValue, column: string): number => {
    const value = toNumber(raw);
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

  const maxWeight = requirePositive(getCell(row, headers, dim.maxWeight), dim.maxWeight);
  const platformLength = requirePositive(getCell(row, headers, dim.platformLength), dim.platformLength);
  const platformWidth = requirePositive(getCell(row, headers, dim.platformWidth), dim.platformWidth);

  const rawHeight = toNumber(getCell(row, headers, dim.platformHeight));

  // Optional cost fields — must be non-negative if present.
  const optionalCost = (column: string): number | undefined => {
    const raw = toNumber(getCell(row, headers, column));
    if (raw == null) return undefined;
    if (raw < 0) {
      errors.push({ row: rowIndex, column, message: `${column} cannot be negative.`, value: String(raw) });
      valid = false;
      return undefined;
    }
    return raw;
  };

  const costPerStop = optionalCost('Cost_Per_Stop');
  const fixedCost = optionalCost('Fixed_Cost');
  const costPerHour = optionalCost('Cost_Per_Hour');
  const costPerKm = optionalCost('Cost_Per_Km');

  if (!valid) return null;

  return {
    id: `${vehicleId}-r${rowIndex}`,
    vehicleId: vehicleId!,
    vehicleName: vehicleName!,
    vehicleAccount: toStringValue(getCell(row, headers, 'Vehicle_Account')),
    licensePlate: toStringValue(getCell(row, headers, 'License_Plate')),
    maxWeight: weightToCanonical(maxWeight, unitSystem),
    platformLength: lengthToCanonical(platformLength, unitSystem),
    platformWidth: lengthToCanonical(platformWidth, unitSystem),
    platformHeight:
      rawHeight != null && rawHeight > 0 ? lengthToCanonical(rawHeight, unitSystem) : undefined,
    costPerStop,
    fixedCost,
    costPerHour,
    costPerKm,
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────

export async function parseFleetVehicleFile(buffer: Buffer): Promise<FleetVehicleParseResult> {
  const errors: ValidationError[] = [];
  const empty = (unitSystem: UnitSystem = 'metric'): FleetVehicleParseResult => ({
    vehicles: [],
    detectedUnitSystem: unitSystem,
    errors,
    summary: { totalVehicles: 0, totalMaxWeight: 0 },
  });

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    errors.push({ row: 0, column: '', message: 'File exceeds the 10 MB size limit.' });
    return empty();
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    errors.push({ row: 0, column: '', message: 'Unable to read the file as a valid .xlsx workbook.' });
    return empty();
  }

  const sheet = workbook.getWorksheet(DATA_SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) {
    errors.push({ row: 0, column: '', message: 'Workbook contains no worksheets.' });
    return empty();
  }

  const headers = readHeaders(sheet);

  for (const col of ['Vehicle_ID', 'Vehicle_Name']) {
    if (!headers.has(col)) {
      errors.push({ row: 1, column: col, message: `Missing required column "${col}".` });
    }
  }

  const detection = detectFleetUnitSystem(headers);
  if (detection.error || !detection.unitSystem) {
    errors.push({ row: 1, column: '', message: detection.error ?? 'Could not detect unit system.' });
    return empty();
  }
  const unitSystem = detection.unitSystem;

  if (errors.length > 0) return empty(unitSystem);

  const vehicles: FleetVehicle[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (!row.hasValues) continue;
    const vehicle = parseVehicleRow(row, r, headers, unitSystem, errors);
    if (vehicle) vehicles.push(vehicle);
  }

  const totalMaxWeight = vehicles.reduce((s, v) => s + v.maxWeight, 0);

  return {
    vehicles,
    detectedUnitSystem: unitSystem,
    errors,
    summary: { totalVehicles: vehicles.length, totalMaxWeight },
  };
}
