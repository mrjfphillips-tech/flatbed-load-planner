// ─── Excel Template Generator ────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Produces downloadable Excel templates in metric and imperial variants, each
// with a "Load Items" data sheet (pre-defined headers) and an "Instructions"
// sheet explaining every column. The header layout matches what the parser
// expects, so a round-trip (generate template → fill → re-upload) yields an
// identical item set with the same unit system.
//
// _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.2_

import ExcelJS from 'exceljs';
import { loadDiagram } from '@ptv-discovery-coach/shared';

type UnitSystem = loadDiagram.UnitSystem;

const {
  EXCEL_DIMENSION_COLUMN_MAP,
  lengthUnitLabel,
  weightUnitLabel,
} = loadDiagram;

const DATA_SHEET_NAME = 'Load Items';
const INSTRUCTIONS_SHEET_NAME = 'Instructions';

/**
 * Returns the ordered list of column headers for a given unit system. The order
 * is stable so templates are deterministic.
 */
export function templateColumns(unitSystem: UnitSystem): string[] {
  const dim = EXCEL_DIMENSION_COLUMN_MAP[unitSystem];
  return [
    'Item_ID',
    'Description',
    dim.length,
    dim.width,
    dim.height,
    dim.weight,
    'Quantity',
    'Stackability_Class',
    dim.maxStackWeight,
    'Delivery_Stop',
    'Temperature_Zone',
    'Floor_Only_Flag',
  ];
}

interface ColumnDoc {
  column: string;
  meaning: string;
  example: string;
}

function instructionRows(unitSystem: UnitSystem): ColumnDoc[] {
  const dim = EXCEL_DIMENSION_COLUMN_MAP[unitSystem];
  const len = lengthUnitLabel(unitSystem);
  const wt = weightUnitLabel(unitSystem);
  return [
    { column: 'Item_ID', meaning: 'Unique identifier for the item (required).', example: 'SKU-0001' },
    { column: 'Description', meaning: 'Optional free-text description.', example: 'Pallet of tiles' },
    { column: dim.length, meaning: `Item length in ${len} (required, > 0).`, example: unitSystem === 'metric' ? '1200' : '47.24' },
    { column: dim.width, meaning: `Item width in ${len} (required, > 0).`, example: unitSystem === 'metric' ? '800' : '31.5' },
    { column: dim.height, meaning: `Item height in ${len} (required, > 0).`, example: unitSystem === 'metric' ? '1050' : '41.34' },
    { column: dim.weight, meaning: `Item weight in ${wt} (required, > 0).`, example: unitSystem === 'metric' ? '450' : '992' },
    { column: 'Quantity', meaning: 'Number of identical units (default 1).', example: '2' },
    { column: 'Stackability_Class', meaning: 'Optional class name for stacking rules.', example: 'standard' },
    { column: dim.maxStackWeight, meaning: `Optional max weight allowed on top, in ${wt}.`, example: unitSystem === 'metric' ? '600' : '1323' },
    { column: 'Delivery_Stop', meaning: 'Delivery stop number (loaded in reverse order).', example: '3' },
    { column: 'Temperature_Zone', meaning: 'Optional temperature zone label.', example: 'ambient' },
    { column: 'Floor_Only_Flag', meaning: 'TRUE/yes/x if the item must sit on the floor.', example: 'no' },
  ];
}

/**
 * Builds an Excel template workbook buffer for the given unit system.
 * _Requirements: 9.1, 9.3, 9.4_
 */
export async function generateTemplate(unitSystem: UnitSystem): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OptiFlow Load Diagram Generator';
  workbook.created = new Date(0); // deterministic metadata for round-trip stability

  // ── Data sheet ──────────────────────────────────────────────────────────────
  const dataSheet = workbook.addWorksheet(DATA_SHEET_NAME);
  const columns = templateColumns(unitSystem);
  const headerRow = dataSheet.getRow(1);
  columns.forEach((name, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = name;
    cell.font = { bold: true };
  });
  headerRow.commit();
  dataSheet.columns = columns.map(() => ({ width: 18 }));

  // ── Instructions sheet ────────────────────────────────────────────────────────
  const infoSheet = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME);
  infoSheet.addRow([`Load Items Template — ${unitSystem === 'metric' ? 'Metric (mm / kg)' : 'Imperial (in / lb)'}`]);
  infoSheet.getRow(1).font = { bold: true, size: 14 };
  infoSheet.addRow([]);
  const docHeader = infoSheet.addRow(['Column', 'Meaning', 'Example']);
  docHeader.font = { bold: true };
  for (const doc of instructionRows(unitSystem)) {
    infoSheet.addRow([doc.column, doc.meaning, doc.example]);
  }
  infoSheet.getColumn(1).width = 22;
  infoSheet.getColumn(2).width = 60;
  infoSheet.getColumn(3).width = 16;

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Suggested download filename for a template variant. */
export function templateFilename(unitSystem: UnitSystem): string {
  return `load-items-template-${unitSystem}.xlsx`;
}
