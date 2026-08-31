// ─── Manifest Parser ─────────────────────────────────────────────────────────
// Parses a multi-sheet load manifest XLSX where each sheet is a per-truck
// manifest containing vehicle header info and an orders table.
// Extracts both the fleet (vehicles) and orders in one pass.
//
// Supports two manifest formats:
//
// FORMAT A (legacy): Per-truck metadata as key-value rows
//   Row 1: "License Plate" | "BMO800"
//   Row 2: "Vehicle ID" | "23015205"
//   ...
//   Row N: Orders table header (Order Number, Customer Name, ...)
//
// FORMAT B (current): Single header line with pipe-separated metadata
//   Row 1: "TRUCK MANIFEST — Vehicle 23000240 | Plate: D5Y842 | Driver: ... | Route 0 | 1 trip(s) today"
//   Row 2: "Trip 1 (1st lap)"
//   Row 3: Seq | Location | SAP Delivery | Material Code | Description | Weight (kg) | Stacking Layer | Load Side | Special Instructions
//   Row 4+: Data rows

import * as XLSX from 'xlsx';
import type { VehicleRecord, ConditionCode, VehicleStatus } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ManifestParseResult {
  /** Vehicles extracted from sheet headers */
  vehicles: VehicleRecord[];
  /** All order rows from all sheets, tagged with license plate */
  orderRows: Record<string, unknown>[];
  /** Column headers from the orders table */
  orderColumns: string[];
  /** Sheets that couldn't be parsed (name + reason) */
  skippedSheets: { name: string; reason: string }[];
  /** Whether this was detected as a manifest format */
  isManifestFormat: boolean;
}

// ─── Valid Condition Codes ────────────────────────────────────────────────────

const VALID_CONDITION_CODES = new Set(['ZN', 'ZO', 'ZB', 'ZA', 'ZF']);

// ─── Main Parser ─────────────────────────────────────────────────────────────

/**
 * Detect whether an XLSX workbook is a multi-sheet load manifest format.
 */
export function isManifestFormat(workbook: XLSX.WorkBook): boolean {
  const sheets = workbook.SheetNames.filter(
    (n) => n.toLowerCase() !== 'index' && n.toLowerCase() !== 'summary' && n.trim() !== ''
  );
  if (sheets.length < 2) return false;

  // Check first non-summary sheet for manifest patterns
  const firstSheet = workbook.Sheets[sheets[0]];
  if (!firstSheet) return false;

  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  // Look for manifest indicators in the first 10 rows
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i] as unknown[];
    if (!row) continue;
    const firstCell = String(row[0] ?? '').trim();

    // Format A: key-value metadata
    if (firstCell.toLowerCase() === 'license plate' || firstCell.toLowerCase() === 'vehicle id' || firstCell.toLowerCase() === 'vehicle type') {
      return true;
    }

    // Format B: "TRUCK MANIFEST — Vehicle ..." or header row with "Seq"
    if (firstCell.includes('TRUCK MANIFEST') || firstCell.includes('LOAD MANIFEST')) {
      return true;
    }
  }

  return false;
}

/**
 * Parse a multi-sheet manifest XLSX workbook.
 * Extracts vehicles from sheet headers and orders from the orders tables.
 */
export function parseManifestWorkbook(workbook: XLSX.WorkBook): ManifestParseResult {
  const vehicles: VehicleRecord[] = [];
  const allOrderRows: Record<string, unknown>[] = [];
  let orderColumns: string[] = [];
  const skippedSheets: { name: string; reason: string }[] = [];

  const sheetNames = workbook.SheetNames.filter(
    (n) => n.toLowerCase() !== 'index' && n.toLowerCase() !== 'summary' && n.trim() !== ''
  );

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      skippedSheets.push({ name: sheetName, reason: 'Sheet not found' });
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (rows.length === 0) {
      skippedSheets.push({ name: sheetName, reason: 'Empty sheet' });
      continue;
    }

    // Detect format by checking first cell content
    const firstCell = String((rows[0] as unknown[])?.[0] ?? '').trim();
    const isFormatB = firstCell.includes('TRUCK MANIFEST') || firstCell.includes('LOAD MANIFEST');

    let vehicleInfo: VehicleRecord | null = null;

    if (isFormatB) {
      vehicleInfo = extractVehicleFromFormatB(rows, sheetName);
    } else {
      vehicleInfo = extractVehicleFromFormatA(rows, sheetName);
    }

    if (vehicleInfo) {
      // Only add if not already present (avoid duplicates)
      if (!vehicles.some((v) => v.vehicleId === vehicleInfo!.vehicleId)) {
        vehicles.push(vehicleInfo);
      }
    } else {
      skippedSheets.push({ name: sheetName, reason: 'Could not extract vehicle header' });
      continue;
    }

    // Extract orders from all tables in the sheet
    const { headers, dataRows } = isFormatB
      ? extractOrdersFromFormatB(rows)
      : extractOrdersFromFormatA(rows);

    if (headers.length === 0 || dataRows.length === 0) {
      // Vehicle was extracted but no orders — still add vehicle, just skip orders
      continue;
    }

    // Use the first sheet's headers as the canonical column list
    if (orderColumns.length === 0) {
      orderColumns = headers;
    }

    // Convert data rows to objects and tag with license plate
    const licensePlate = sheetName.trim().toUpperCase();
    for (const dataRow of dataRows) {
      const rowObj: Record<string, unknown> = {};
      for (let col = 0; col < headers.length; col++) {
        if (headers[col]) {
          rowObj[headers[col]] = dataRow[col] ?? '';
        }
      }
      rowObj['__licensePlate'] = licensePlate;
      allOrderRows.push(rowObj);
    }
  }

  return {
    vehicles,
    orderRows: allOrderRows,
    orderColumns,
    skippedSheets,
    isManifestFormat: true,
  };
}

// ─── Format B: Single-line header parsing ────────────────────────────────────
// "TRUCK MANIFEST — Vehicle 23000240  |  Plate: D5Y842  |  Driver: 8000006077  |  Route 0  |  1 trip(s) today"

function extractVehicleFromFormatB(
  rows: unknown[][],
  sheetName: string
): VehicleRecord | null {
  // Find the TRUCK MANIFEST header line
  let headerLine = '';
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const cell = String((rows[i] as unknown[])?.[0] ?? '').trim();
    if (cell.includes('TRUCK MANIFEST') || cell.includes('LOAD MANIFEST')) {
      headerLine = cell;
      break;
    }
  }

  if (!headerLine) return null;

  // Parse: "TRUCK MANIFEST — Vehicle 23000240  |  Plate: D5Y842  |  Driver: 8000006077  |  Route 0"
  const vehicleIdMatch = headerLine.match(/Vehicle\s+(\d+)/i);
  const plateMatch = headerLine.match(/Plate:\s*([A-Z0-9]+)/i);

  const vehicleId = vehicleIdMatch?.[1] ?? '';
  const licensePlate = plateMatch?.[1] ?? sheetName.trim().toUpperCase();

  if (!vehicleId && !licensePlate) return null;

  // Format B doesn't include weight/dimensions/condition in the header
  // We'll use defaults that can be overridden if the user has a separate fleet file
  return {
    vehicleId: vehicleId || licensePlate,
    vehicleType: 'Camión',
    licensePlate,
    weightCapacity: 16, // default
    platformLength: 9, // default
    platformWidth: 2.6, // default
    conditionCode: 'ZB' as ConditionCode, // default
    status: 'active' as VehicleStatus,
  };
}

function extractOrdersFromFormatB(rows: unknown[][]): {
  headers: string[];
  dataRows: unknown[][];
} {
  const allDataRows: unknown[][] = [];
  let headers: string[] = [];

  // Find ALL header rows (there may be multiple trips with their own headers)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row) continue;

    const firstCell = String(row[0] ?? '').trim();

    // Detect the table header row: starts with "Seq"
    if (firstCell === 'Seq') {
      if (headers.length === 0) {
        headers = row.map((h) => String(h).trim()).filter((h) => h !== '');
      }
      continue;
    }

    // Skip non-data rows
    if (!firstCell) continue;
    if (firstCell.includes('TRUCK MANIFEST') || firstCell.includes('LOAD MANIFEST')) continue;
    if (firstCell.startsWith('Trip ')) continue;
    if (firstCell.includes('item line') || firstCell.includes('stop(s)')) continue;

    // Skip if first cell is not a number (Seq should be numeric)
    const seqNum = Number(firstCell);
    if (isNaN(seqNum) || seqNum < 1) continue;

    allDataRows.push(row);
  }

  return { headers, dataRows: allDataRows };
}

// ─── Format A: Key-value metadata parsing (legacy) ───────────────────────────

function extractVehicleFromFormatA(
  rows: unknown[][],
  sheetName: string
): VehicleRecord | null {
  const headerData: Record<string, string> = {};

  // Scan the first 15 rows for key-value pairs
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 2) continue;

    const key = String(row[0] ?? '').trim().toLowerCase();
    const value = String(row[1] ?? '').trim();

    if (!key || !value) continue;

    if (key === 'license plate' || key === 'placa') {
      headerData['licensePlate'] = value;
    } else if (key === 'vehicle id' || key === 'id vehiculo') {
      headerData['vehicleId'] = value;
    } else if (key === 'vehicle type' || key === 'tipo' || key === 'tipo vehiculo') {
      headerData['vehicleType'] = value;
    } else if (key.includes('weight capacity') || key.includes('capacidad')) {
      headerData['weightCapacity'] = value;
    } else if (key.includes('platform') || key.includes('plataforma')) {
      headerData['platform'] = value;
    } else if (key === 'condition code' || key === 'condicion' || key === 'zona') {
      headerData['conditionCode'] = value;
    }
  }

  const vehicleId = headerData['vehicleId'] || '';
  const licensePlate = headerData['licensePlate'] || sheetName.trim();

  if (!vehicleId && !licensePlate) return null;

  // Parse platform dimensions "9.2 x 2.6"
  let platformLength = 9;
  let platformWidth = 2.6;
  const platformStr = headerData['platform'] || '';
  const platformMatch = platformStr.match(/([\d.]+)\s*[x×]\s*([\d.]+)/i);
  if (platformMatch) {
    platformLength = parseFloat(platformMatch[1]) || platformLength;
    platformWidth = parseFloat(platformMatch[2]) || platformWidth;
  }

  const weightStr = headerData['weightCapacity'] || '16';
  const weightCapacity = parseFloat(weightStr.replace(/[^\d.]/g, '')) || 16;

  const codeStr = (headerData['conditionCode'] || '').toUpperCase();
  const conditionCode: ConditionCode = VALID_CONDITION_CODES.has(codeStr)
    ? (codeStr as ConditionCode)
    : 'ZB';

  return {
    vehicleId: vehicleId || licensePlate,
    vehicleType: headerData['vehicleType'] || 'Camión',
    licensePlate,
    weightCapacity,
    platformLength,
    platformWidth,
    conditionCode,
    status: 'active' as VehicleStatus,
  };
}

function extractOrdersFromFormatA(rows: unknown[][]): {
  headers: string[];
  dataRows: unknown[][];
} {
  // Find the header row containing "Order Number"
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row) continue;
    if (row.some((cell) => String(cell).trim() === 'Order Number')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) return { headers: [], dataRows: [] };

  const headerRow = rows[headerRowIdx] as unknown[];
  const headers = headerRow.map((h) => String(h).trim()).filter((h) => h !== '');

  const dataRows: unknown[][] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row) continue;
    if (row.every((cell) => String(cell ?? '').trim() === '')) continue;

    const firstCell = String(row[0] ?? '').trim();
    if (
      !firstCell ||
      firstCell.toLowerCase().startsWith('driver') ||
      firstCell.toLowerCase().startsWith('signature') ||
      firstCell.toLowerCase().startsWith('date') ||
      firstCell.toLowerCase().startsWith('checked')
    ) {
      continue;
    }

    dataRows.push(row);
  }

  return { headers, dataRows };
}
