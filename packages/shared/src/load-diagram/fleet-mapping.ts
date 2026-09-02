// ─── Fleet Column Mapping & Flexible Units ───────────────────────────────────
// Feature: load-diagram-generator (Customer Fleet)
//
// Real-world vehicle spreadsheets rarely use our exact column headers or a
// single unit convention. This module supports:
//   - explicit unit selection per file (length: mm / cm / m / in / ft;
//     weight: kg / t / lb), all converted to canonical mm/kg;
//   - a fuzzy auto-mapper that suggests which source column feeds each field.
//
// Everything here is pure and shared so the backend parser and the frontend
// mapping UI agree.

import { MM_PER_INCH, KG_PER_POUND } from './units';

// ─── Flexible input units ────────────────────────────────────────────────────

/** Length units accepted on fleet input (converted to canonical mm). */
export type FleetLengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/** Weight units accepted on fleet input (converted to canonical kg). */
export type FleetWeightUnit = 'kg' | 't' | 'lb';

const MM_PER: Record<FleetLengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: MM_PER_INCH,
  ft: MM_PER_INCH * 12,
};

const KG_PER: Record<FleetWeightUnit, number> = {
  kg: 1,
  t: 1000,
  lb: KG_PER_POUND,
};

/** Converts a length in the given input unit to canonical millimeters. */
export function fleetLengthToCanonical(value: number, unit: FleetLengthUnit): number {
  return value * MM_PER[unit];
}

/** Converts a weight in the given input unit to canonical kilograms. */
export function fleetWeightToCanonical(value: number, unit: FleetWeightUnit): number {
  return value * KG_PER[unit];
}

export const FLEET_LENGTH_UNITS: FleetLengthUnit[] = ['mm', 'cm', 'm', 'in', 'ft'];
export const FLEET_WEIGHT_UNITS: FleetWeightUnit[] = ['kg', 't', 'lb'];

// ─── Mappable fields ─────────────────────────────────────────────────────────

/** The logical fields a fleet vehicle row can supply. */
export type FleetField =
  | 'vehicleId'
  | 'vehicleName'
  | 'vehicleAccount'
  | 'licensePlate'
  | 'maxWeight'
  | 'platformLength'
  | 'platformWidth'
  | 'platformHeight'
  | 'costPerStop'
  | 'fixedCost'
  | 'costPerHour'
  | 'costPerKm';

/** Maps each logical field to the source column name it should read from. */
export type FleetColumnMapping = Partial<Record<FleetField, string>>;

/** Fields that must be mapped for a successful import. */
export const FLEET_REQUIRED_FIELDS: FleetField[] = [
  'vehicleId',
  'vehicleName',
  'maxWeight',
  'platformLength',
  'platformWidth',
];

/** All fields in a stable display order. */
export const FLEET_ALL_FIELDS: FleetField[] = [
  'vehicleId',
  'vehicleName',
  'vehicleAccount',
  'licensePlate',
  'maxWeight',
  'platformLength',
  'platformWidth',
  'platformHeight',
  'costPerStop',
  'fixedCost',
  'costPerHour',
  'costPerKm',
];

/** Human labels for the fields (for the mapping UI). */
export const FLEET_FIELD_LABELS: Record<FleetField, string> = {
  vehicleId: 'Vehicle ID',
  vehicleName: 'Vehicle name',
  vehicleAccount: 'Vehicle account',
  licensePlate: 'License plate',
  maxWeight: 'Max weight',
  platformLength: 'Platform length',
  platformWidth: 'Platform width',
  platformHeight: 'Platform height',
  costPerStop: 'Cost per stop',
  fixedCost: 'Fixed cost',
  costPerHour: 'Cost per hour',
  costPerKm: 'Cost per km',
};

// ─── Auto-mapping (fuzzy) ────────────────────────────────────────────────────

/**
 * Alias phrases per field. Matching is token-based and case/separator
 * insensitive, so "Platform_Length", "platform length", and "PlatformLength"
 * all normalize the same way.
 */
const FLEET_FIELD_ALIASES: Record<FleetField, string[]> = {
  vehicleId: ['vehicle id', 'vehicleid', 'unit id', 'unit', 'id', 'truck id', 'asset id'],
  vehicleName: ['vehicle name', 'vehiclename', 'name', 'vehicle', 'truck', 'model', 'description'],
  vehicleAccount: ['vehicle account', 'account', 'customer', 'client', 'owner'],
  licensePlate: ['license plate', 'licence plate', 'plate', 'registration', 'reg', 'placa', 'matricula'],
  maxWeight: ['max weight', 'maxweight', 'weight', 'capacity', 'payload', 'max payload', 'gvw', 'peso'],
  platformLength: ['platform length', 'deck length', 'length', 'largo', 'longitud'],
  platformWidth: ['platform width', 'deck width', 'width', 'ancho'],
  platformHeight: ['platform height', 'deck height', 'height', 'alto', 'altura'],
  costPerStop: ['cost per stop', 'stop cost', 'per stop'],
  fixedCost: ['fixed cost', 'fixed', 'base cost', 'flat cost'],
  costPerHour: ['cost per hour', 'hourly cost', 'per hour', 'hour cost'],
  costPerKm: ['cost per km', 'cost per kilometer', 'cost per kilometre', 'per km', 'km cost', 'per kilometer'],
};

function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Jaccard token-overlap similarity between two strings (0..1). */
function similarity(a: string, b: string): number {
  const ta = new Set(normalizeTokens(a));
  const tb = new Set(normalizeTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Best alias-match score for a source column against a field. */
function fieldScore(field: FleetField, column: string): number {
  const norm = normalizeTokens(column).join(' ');
  let best = 0;
  // Exact normalized equality with the field label or an alias wins outright.
  const candidates = [FLEET_FIELD_LABELS[field], ...FLEET_FIELD_ALIASES[field]];
  for (const cand of candidates) {
    const cn = normalizeTokens(cand).join(' ');
    if (cn === norm) return 1;
    best = Math.max(best, similarity(cand, column));
  }
  return best;
}

/**
 * Suggests a column mapping from a file's source columns. Greedy best-match:
 * each field takes its highest-scoring unused column above the threshold.
 * Returns the mapping plus the score used, so the UI can flag weak guesses.
 */
export function autoMapFleetColumns(
  sourceColumns: string[],
  threshold = 0.34,
): FleetColumnMapping {
  const mapping: FleetColumnMapping = {};
  const used = new Set<string>();

  // Order fields so required/most-distinct are assigned first.
  for (const field of FLEET_ALL_FIELDS) {
    let bestCol: string | undefined;
    let bestScore = threshold;
    for (const col of sourceColumns) {
      if (used.has(col)) continue;
      const score = fieldScore(field, col);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    if (bestCol) {
      mapping[field] = bestCol;
      used.add(bestCol);
    }
  }
  return mapping;
}
