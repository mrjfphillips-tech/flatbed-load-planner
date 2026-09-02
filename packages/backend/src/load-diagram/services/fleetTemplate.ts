// ─── Fleet Vehicle Excel Template Generator ──────────────────────────────────
// Feature: load-diagram-generator (Customer Fleet)
//
// Produces downloadable fleet-vehicle templates in metric and imperial variants,
// each with a "Vehicles" data sheet and an "Instructions" sheet. Header layout
// matches the fleet parser so a round-trip yields an identical vehicle set.

import ExcelJS from 'exceljs';
import { loadDiagram } from '@ptv-discovery-coach/shared';

type UnitSystem = loadDiagram.UnitSystem;

const { FLEET_DIMENSION_COLUMN_MAP, lengthUnitLabel, weightUnitLabel } = loadDiagram;

const DATA_SHEET_NAME = 'Vehicles';
const INSTRUCTIONS_SHEET_NAME = 'Instructions';

export function fleetTemplateColumns(unitSystem: UnitSystem): string[] {
  const dim = FLEET_DIMENSION_COLUMN_MAP[unitSystem];
  return [
    'Vehicle_ID',
    'Vehicle_Name',
    'Trailer_Type',
    'Vehicle_Account',
    'License_Plate',
    dim.maxWeight,
    dim.platformLength,
    dim.platformWidth,
    dim.platformHeight,
    'Cost_Per_Stop',
    'Fixed_Cost',
    'Cost_Per_Hour',
    'Cost_Per_Km',
  ];
}

interface ColumnDoc {
  column: string;
  meaning: string;
  example: string;
}

function instructionRows(unitSystem: UnitSystem): ColumnDoc[] {
  const dim = FLEET_DIMENSION_COLUMN_MAP[unitSystem];
  const len = lengthUnitLabel(unitSystem);
  const wt = weightUnitLabel(unitSystem);
  const isMetric = unitSystem === 'metric';
  return [
    { column: 'Vehicle_ID', meaning: 'Unique vehicle identifier (required).', example: 'TRK-001' },
    { column: 'Vehicle_Name', meaning: 'Human-readable name (required).', example: 'Volvo FH 4x2' },
    { column: 'Trailer_Type', meaning: 'flatbed, curtainsider, or enclosed (required; defaults to flatbed).', example: 'flatbed' },
    { column: 'Vehicle_Account', meaning: 'Optional owning account / customer.', example: 'ACME Logistics' },
    { column: 'License_Plate', meaning: 'Optional plate number.', example: 'ABC-1234' },
    { column: dim.maxWeight, meaning: `Maximum payload weight in ${wt} (required, > 0).`, example: isMetric ? '24000' : '52910' },
    { column: dim.platformLength, meaning: `Platform length in ${len} (required, > 0).`, example: isMetric ? '13600' : '535' },
    { column: dim.platformWidth, meaning: `Platform width in ${len} (required, > 0).`, example: isMetric ? '2480' : '98' },
    { column: dim.platformHeight, meaning: `Optional load height limit in ${len}. Leave blank for an open flatbed.`, example: isMetric ? '2700' : '106' },
    { column: 'Cost_Per_Stop', meaning: 'Optional cost per delivery stop.', example: '15' },
    { column: 'Fixed_Cost', meaning: 'Optional fixed cost per trip.', example: '120' },
    { column: 'Cost_Per_Hour', meaning: 'Optional cost per hour.', example: '45' },
    { column: 'Cost_Per_Km', meaning: 'Optional cost per kilometer.', example: '1.10' },
  ];
}

export async function generateFleetTemplate(unitSystem: UnitSystem): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OptiFlow Load Diagram Generator';
  workbook.created = new Date(0);

  const dataSheet = workbook.addWorksheet(DATA_SHEET_NAME);
  const columns = fleetTemplateColumns(unitSystem);
  const headerRow = dataSheet.getRow(1);
  columns.forEach((name, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = name;
    cell.font = { bold: true };
  });
  headerRow.commit();
  dataSheet.columns = columns.map(() => ({ width: 18 }));

  const infoSheet = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME);
  infoSheet.addRow([`Fleet Vehicles Template — ${unitSystem === 'metric' ? 'Metric (mm / kg)' : 'Imperial (in / lb)'}`]);
  infoSheet.getRow(1).font = { bold: true, size: 14 };
  infoSheet.addRow([]);
  const docHeader = infoSheet.addRow(['Column', 'Meaning', 'Example']);
  docHeader.font = { bold: true };
  for (const doc of instructionRows(unitSystem)) {
    infoSheet.addRow([doc.column, doc.meaning, doc.example]);
  }
  infoSheet.getColumn(1).width = 22;
  infoSheet.getColumn(2).width = 62;
  infoSheet.getColumn(3).width = 18;

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function fleetTemplateFilename(unitSystem: UnitSystem): string {
  return `fleet-vehicles-template-${unitSystem}.xlsx`;
}
