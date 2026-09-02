// ─── Fleet Vehicle Excel Parser (mapping-based) ──────────────────────────────
// Feature: load-diagram-generator (Customer Fleet)
//
// Real vehicle spreadsheets use arbitrary column names and unit conventions, so
// parsing is driven by an explicit column mapping (field -> source column) plus
// chosen input units (length + weight), rather than fixed header names. All
// dimensions/weights are converted to canonical mm/kg. Mirrors excelParser.ts
// conventions (ExcelJS, ValidationError list, 10 MB cap, base64 upload route).

import ExcelJS from 'exceljs';
import { loadDiagram } from '@ptv-discovery-coach/shared';

type FleetVehicle = loadDiagram.FleetVehicle;
type ValidationError = loadDiagram.ValidationError;
type FleetColumnMapping = loadDiagram.FleetColumnMapping;
type FleetLengthUnit = loadDiagram.FleetLengthUnit;
type FleetWeightUnit = loadDiagram.FleetWeightUnit;

const {
  fleetLengthToCanonical,
  fleetWeightToCanonical,
  autoMapFleetColumns,
  FLEET_REQUIRED_FIELDS,
} = loadDiagram;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DATA_SHEET_NAME = 'Vehicles';

/** Plausibility floors that catch a units mistake (e.g. meters entered as mm). */
const MIN_PLAUSIBLE_LENGTH_MM = 500; // 0.5 m — smaller than any real platform dimension
const MIN_PLAUSIBLE_WEIGHT_KG = 100; // 100 kg — smaller than any real payload capacity

// ─── Header helpers ──────────────────────────────────────────────────────────

function headerText(value: ExcelJS.CellValue): string {
  return value == null ? '' : String(value).trim();
}

/** Reads the header row into ordered names and a name -> column-index map. */
function readHeaders(sheet: ExcelJS.Worksheet): { names: string[]; index: Map<string, number> } {
  const names: string[] = [];
  const index = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const name = headerText(cell.value);
    if (name) {
      names.push(name);
      index.set(name, colNumber);
    }
  });
  return { names, index };
}

function pickSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return workbook.getWorksheet(DATA_SHEET_NAME) ?? workbook.worksheets[0];
}

// ─── Cell coercion ───────────────────────────────────────────────────────────

function toNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'result' in value && typeof value.result === 'number') {
    return value.result;
  }
  const raw = String(value).trim();
  // Treat placeholder dashes / n-a as "no value".
  if (raw === '' || raw === '-' || raw === '—' || /^n\/?a$/i.test(raw)) return null;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toStringValue(value: ExcelJS.CellValue): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

// ─── Inspection (headers + sample rows for the mapping UI) ────────────────────

export interface FleetInspectResult {
  sheetName: string;
  columns: string[];
  /** A few sample data rows keyed by column name (for preview). */
  sampleRows: Record<string, string>[];
  /** Suggested mapping from the auto-mapper. */
  suggestedMapping: FleetColumnMapping;
  error?: string;
}

/** Reads a workbook's headers and a few sample rows without validating. */
export async function inspectFleetFile(buffer: Buffer): Promise<FleetInspectResult> {
  const empty: FleetInspectResult = {
    sheetName: '',
    columns: [],
    sampleRows: [],
    suggestedMapping: {},
  };

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return { ...empty, error: 'File exceeds the 10 MB size limit.' };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { ...empty, error: 'Unable to read the file as a valid .xlsx workbook.' };
  }

  const sheet = pickSheet(workbook);
  if (!sheet) return { ...empty, error: 'Workbook contains no worksheets.' };

  const { names, index } = readHeaders(sheet);
  const sampleRows: Record<string, string>[] = [];
  for (let r = 2; r <= Math.min(4, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    if (!row.hasValues) continue;
    const rec: Record<string, string> = {};
    for (const name of names) {
      const idx = index.get(name)!;
      const v = row.getCell(idx).value;
      rec[name] = v == null ? '' : String(v);
    }
    sampleRows.push(rec);
  }

  return {
    sheetName: sheet.name,
    columns: names,
    sampleRows,
    suggestedMapping: autoMapFleetColumns(names),
  };
}

// ─── Parse with an explicit mapping + units ──────────────────────────────────

export interface FleetParseOptions {
  mapping: FleetColumnMapping;
  lengthUnit: FleetLengthUnit;
  weightUnit: FleetWeightUnit;
}

export interface FleetParseResult {
  vehicles: FleetVehicle[];
  errors: ValidationError[];
  summary: { totalVehicles: number; totalMaxWeight: number };
}

/**
 * Parses vehicles using the supplied field->column mapping and input units.
 * Converts lengths/weights to canonical mm/kg. Never throws on data problems.
 */
export async function parseFleetVehicleFile(
  buffer: Buffer,
  options: FleetParseOptions,
): Promise<FleetParseResult> {
  const errors: ValidationError[] = [];
  const empty: FleetParseResult = {
    vehicles: [],
    errors,
    summary: { totalVehicles: 0, totalMaxWeight: 0 },
  };

  const { mapping, lengthUnit, weightUnit } = options;

  // Validate that required fields are mapped.
  for (const field of FLEET_REQUIRED_FIELDS) {
    if (!mapping[field]) {
      errors.push({ row: 1, column: field, message: `Required field "${field}" is not mapped to a column.` });
    }
  }
  if (errors.length > 0) return empty;

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    errors.push({ row: 0, column: '', message: 'File exceeds the 10 MB size limit.' });
    return empty;
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    errors.push({ row: 0, column: '', message: 'Unable to read the file as a valid .xlsx workbook.' });
    return empty;
  }

  const sheet = pickSheet(workbook);
  if (!sheet) {
    errors.push({ row: 0, column: '', message: 'Workbook contains no worksheets.' });
    return empty;
  }

  const { index } = readHeaders(sheet);

  // Confirm mapped columns actually exist in the file.
  for (const [field, col] of Object.entries(mapping)) {
    if (col && !index.has(col)) {
      errors.push({ row: 1, column: col, message: `Mapped column "${col}" for "${field}" not found in the file.` });
    }
  }
  if (errors.length > 0) return empty;

  const cell = (row: ExcelJS.Row, field: loadDiagram.FleetField): ExcelJS.CellValue => {
    const col = mapping[field];
    if (!col) return null;
    const idx = index.get(col);
    return idx ? row.getCell(idx).value : null;
  };

  const vehicles: FleetVehicle[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (!row.hasValues) continue;

    let valid = true;
    const vehicleId = toStringValue(cell(row, 'vehicleId'));
    const vehicleName = toStringValue(cell(row, 'vehicleName'));
    if (!vehicleId) {
      errors.push({ row: r, column: mapping.vehicleId ?? 'vehicleId', message: 'Missing Vehicle ID.' });
      valid = false;
    }
    if (!vehicleName) {
      errors.push({ row: r, column: mapping.vehicleName ?? 'vehicleName', message: 'Missing Vehicle name.' });
      valid = false;
    }

    const requirePositive = (field: loadDiagram.FleetField): number => {
      const value = toNumber(cell(row, field));
      if (value == null || value <= 0) {
        errors.push({
          row: r,
          column: mapping[field] ?? field,
          message: `${field} must be a positive number.`,
          value: value == null ? undefined : String(value),
        });
        valid = false;
        return 0;
      }
      return value;
    };

    const maxWeight = requirePositive('maxWeight');
    const platformLength = requirePositive('platformLength');
    const platformWidth = requirePositive('platformWidth');
    const rawHeight = toNumber(cell(row, 'platformHeight'));

    const optionalCost = (field: loadDiagram.FleetField): number | undefined => {
      const v = toNumber(cell(row, field));
      if (v == null) return undefined;
      if (v < 0) {
        errors.push({ row: r, column: mapping[field] ?? field, message: `${field} cannot be negative.`, value: String(v) });
        valid = false;
        return undefined;
      }
      return v;
    };

    const costPerStop = optionalCost('costPerStop');
    const fixedCost = optionalCost('fixedCost');
    const costPerHour = optionalCost('costPerHour');
    const costPerKm = optionalCost('costPerKm');

    if (!valid) continue;

    const canonicalLength = fleetLengthToCanonical(platformLength, lengthUnit);
    const canonicalWidth = fleetLengthToCanonical(platformWidth, lengthUnit);
    const canonicalMaxWeight = fleetWeightToCanonical(maxWeight, weightUnit);

    // Plausibility check: catch a units mistake (e.g. meters entered as mm)
    // before it produces a microscopic, unusable "trailer". A real platform is
    // at least ~1 m long/wide and carries at least ~100 kg.
    if (canonicalLength < MIN_PLAUSIBLE_LENGTH_MM || canonicalWidth < MIN_PLAUSIBLE_LENGTH_MM) {
      errors.push({
        row: r,
        column: mapping.platformLength ?? 'platformLength',
        message: `Platform dimensions look too small (${canonicalLength.toFixed(0)} x ${canonicalWidth.toFixed(0)} mm). Check the Length unit — did you mean meters (m) instead of ${lengthUnit}?`,
      });
      continue;
    }
    if (canonicalMaxWeight < MIN_PLAUSIBLE_WEIGHT_KG) {
      errors.push({
        row: r,
        column: mapping.maxWeight ?? 'maxWeight',
        message: `Max weight looks too small (${canonicalMaxWeight.toFixed(0)} kg). Check the Weight unit — did you mean tonnes (t) instead of ${weightUnit}?`,
      });
      continue;
    }

    vehicles.push({
      id: `${vehicleId}-r${r}`,
      vehicleId: vehicleId!,
      vehicleName: vehicleName!,
      vehicleAccount: toStringValue(cell(row, 'vehicleAccount')),
      licensePlate: toStringValue(cell(row, 'licensePlate')),
      maxWeight: canonicalMaxWeight,
      platformLength: canonicalLength,
      platformWidth: canonicalWidth,
      platformHeight:
        rawHeight != null && rawHeight > 0
          ? fleetLengthToCanonical(rawHeight, lengthUnit)
          : undefined,
      costPerStop,
      fixedCost,
      costPerHour,
      costPerKm,
    });
  }

  const totalMaxWeight = vehicles.reduce((s, v) => s + v.maxWeight, 0);
  return {
    vehicles,
    errors,
    summary: { totalVehicles: vehicles.length, totalMaxWeight },
  };
}
