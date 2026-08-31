// ─── Fleet Smart Column Mapper ───────────────────────────────────────────────
// Fuzzy-matches uploaded fleet file column headers to the expected Vehicle_Record
// fields. Supports English and Spanish column names commonly used in Peru fleet
// dispatch systems.

import type { FieldMapping } from '../import/smartMapper';

// ─── Fleet Field Configuration ───────────────────────────────────────────────

/** Required fields for a valid Vehicle_Record */
export const FLEET_REQUIRED_FIELDS = [
  'vehicleId',
  'vehicleType',
  'licensePlate',
  'weightCapacity',
  'platformLength',
  'platformWidth',
  'conditionCode',
  'status',
] as const;

/** Human-readable labels for fleet target fields */
const FLEET_FIELD_LABELS: Record<string, string> = {
  vehicleId: 'Vehicle ID',
  vehicleType: 'Vehicle Type',
  licensePlate: 'License Plate',
  weightCapacity: 'Weight Capacity',
  platformLength: 'Platform Length',
  platformWidth: 'Platform Width',
  conditionCode: 'Condition Code',
  status: 'Status',
};

/**
 * Aliases mapping normalized column names → target field name.
 * Each alias covers common English, Spanish, camelCase, and snake_case variants.
 */
export const FLEET_FIELD_ALIASES: Record<string, string> = {
  // vehicleId
  'vehicle id': 'vehicleId',
  'vehicle_id': 'vehicleId',
  'vehicleid': 'vehicleId',
  'truck id': 'vehicleId',
  'truck_id': 'vehicleId',
  'id vehiculo': 'vehicleId',
  'id_vehiculo': 'vehicleId',
  'codigo vehiculo': 'vehicleId',
  'vehicle code': 'vehicleId',

  // licensePlate
  'placa': 'licensePlate',
  'license plate': 'licensePlate',
  'license_plate': 'licensePlate',
  'licenseplate': 'licensePlate',
  'plate': 'licensePlate',
  'plate number': 'licensePlate',
  'numero placa': 'licensePlate',
  'matricula': 'licensePlate',
  'registration': 'licensePlate',

  // vehicleType
  'tipo': 'vehicleType',
  'vehicle type': 'vehicleType',
  'vehicle_type': 'vehicleType',
  'vehicletype': 'vehicleType',
  'type': 'vehicleType',
  'truck type': 'vehicleType',
  'tipo vehiculo': 'vehicleType',
  'tipo_vehiculo': 'vehicleType',
  'clase': 'vehicleType',

  // weightCapacity
  'capacidad': 'weightCapacity',
  'weight capacity': 'weightCapacity',
  'weight_capacity': 'weightCapacity',
  'weightcapacity': 'weightCapacity',
  'capacity': 'weightCapacity',
  'peso maximo': 'weightCapacity',
  'peso_maximo': 'weightCapacity',
  'max weight': 'weightCapacity',
  'max_weight': 'weightCapacity',
  'capacidad peso': 'weightCapacity',
  'carga maxima': 'weightCapacity',
  'tonnage': 'weightCapacity',
  'tonelaje': 'weightCapacity',

  // platformLength
  'largo': 'platformLength',
  'platform length': 'platformLength',
  'platform_length': 'platformLength',
  'platformlength': 'platformLength',
  'length': 'platformLength',
  'largo plataforma': 'platformLength',
  'longitud': 'platformLength',
  'longitud plataforma': 'platformLength',
  'deck length': 'platformLength',

  // platformWidth
  'ancho': 'platformWidth',
  'platform width': 'platformWidth',
  'platform_width': 'platformWidth',
  'platformwidth': 'platformWidth',
  'width': 'platformWidth',
  'ancho plataforma': 'platformWidth',
  'anchura': 'platformWidth',
  'deck width': 'platformWidth',

  // conditionCode
  'condicion': 'conditionCode',
  'condition code': 'conditionCode',
  'condition_code': 'conditionCode',
  'conditioncode': 'conditionCode',
  'condition': 'conditionCode',
  'zona': 'conditionCode',
  'zone': 'conditionCode',
  'zone code': 'conditionCode',
  'codigo condicion': 'conditionCode',
  'codigo_condicion': 'conditionCode',
  'clasificacion': 'conditionCode',

  // status
  'status': 'status',
  'estado': 'status',
  'active': 'status',
  'vehicle status': 'status',
  'vehicle_status': 'status',
  'vehiclestatus': 'status',
  'availability': 'status',
  'disponibilidad': 'status',
  'disponible': 'status',
  'state': 'status',
};

// ─── Fuzzy Matching Logic (mirrors smartMapper.ts) ───────────────────────────

/**
 * Normalize a column header for comparison:
 * lowercased, trimmed, underscores/hyphens/dots → spaces, collapse whitespace,
 * strip parentheses and brackets.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[_\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[()[\]]/g, '');
}

/**
 * Calculate similarity between two strings using token overlap (Jaccard-like).
 * Returns 1.0 for exact match, 0.85 for substring containment, else token overlap ratio.
 */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  // Token overlap (Jaccard index)
  const tokensA = new Set(na.split(' '));
  const tokensB = new Set(nb.split(' '));
  const intersection = [...tokensA].filter((t) => tokensB.has(t));
  const union = new Set([...tokensA, ...tokensB]);
  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

// ─── Grouped Aliases (inverted view for iteration) ───────────────────────────

/**
 * Build a map of targetField → alias strings[] from FLEET_FIELD_ALIASES.
 */
function buildAliasGroups(): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const field of FLEET_REQUIRED_FIELDS) {
    groups[field] = [];
  }
  for (const [alias, field] of Object.entries(FLEET_FIELD_ALIASES)) {
    if (!groups[field]) groups[field] = [];
    groups[field].push(alias);
  }
  return groups;
}

const ALIAS_GROUPS = buildAliasGroups();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Auto-map fleet file column headers to Vehicle_Record target fields.
 * Uses fuzzy matching against known aliases for each field.
 * Returns one FieldMapping per target field with the best-matched source column
 * (or null if no match exceeds the confidence threshold).
 */
export function autoMapFleetColumns(sourceColumns: string[]): FieldMapping[] {
  const usedSourceColumns = new Set<string>();

  const mappings: FieldMapping[] = FLEET_REQUIRED_FIELDS.map((field) => {
    const aliases = ALIAS_GROUPS[field] || [];
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const srcCol of sourceColumns) {
      if (usedSourceColumns.has(srcCol)) continue;

      for (const alias of aliases) {
        const score = similarity(srcCol, alias);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = srcCol;
        }
      }
    }

    // Accept matches above 0.5 threshold (same as existing smartMapper)
    if (bestScore >= 0.5 && bestMatch) {
      usedSourceColumns.add(bestMatch);
      return {
        targetField: field,
        label: FLEET_FIELD_LABELS[field] || field,
        required: field !== 'status', // Status is optional (defaults to 'active')
        sourceColumn: bestMatch,
        confidence: bestScore,
      };
    }

    return {
      targetField: field,
      label: FLEET_FIELD_LABELS[field] || field,
      required: field !== 'status',
      sourceColumn: null,
      confidence: 0,
    };
  });

  return mappings;
}
