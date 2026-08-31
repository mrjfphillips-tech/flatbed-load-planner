// ─── Steel Handling Defaults ──────────────────────────────────────────────────
// Soft-constraint defaults per product family. These fill in Handling Method,
// Stack Permission, Max Stack Height/Weight, Orientation, and Dunnage Required
// when the source order data does not provide them.
//
// IMPORTANT: These are defaults, NOT hard rules.
// - An explicit value from the user's uploaded file always wins.
// - A completed OptiFlow plan's stacking judgment always wins.
// - If applying a default, mark it as "assumed" (not "confirmed") so downstream
//   users can distinguish the two.
//
// See: .kiro/steering/steel-stacking-defaults.md for full documentation.

import type { HandlingMethod, StackPermission, OrientationRequirement } from './types';

export interface HandlingDefault {
  /** Product type aliases this default applies to */
  productFamilies: string[];
  /** Default handling method */
  handlingMethod: HandlingMethod;
  /** Default stack permission */
  stackPermission: StackPermission;
  /** Max stack height in inches */
  maxStackHeight: number;
  /** Max stack weight in kg (will be converted to lbs internally) */
  maxStackWeightKg: number;
  /** Default orientation requirement */
  orientation: OrientationRequirement;
  /** Whether dunnage (spacers) is required between layers */
  dunnageRequired: boolean;
  /** Brief rationale for these defaults */
  reason: string;
}

/**
 * Handling defaults by product family group.
 * Heights are in inches; weights are in kg (converted to lbs at usage site).
 */
export const HANDLING_DEFAULTS: HandlingDefault[] = [
  {
    productFamilies: ['rebar_corrugated', 'rebar_dowel', 'rebar_bundle'],
    handlingMethod: 'crane',
    stackPermission: 'yes',
    maxStackHeight: 48,
    maxStackWeightKg: 20000,
    orientation: 'longitudinal',
    dunnageRequired: false,
    reason: 'Banded bundles, heavy crane loads; bands protect shape, no spacers needed.',
  },
  {
    productFamilies: ['rebar_accessory', 'fabricated_assembly'],
    handlingMethod: 'forklift',
    stackPermission: 'yes',
    maxStackHeight: 36,
    maxStackWeightKg: 5000,
    orientation: 'any',
    dunnageRequired: false,
    reason: 'Pre-bent accessories (stirrups), lighter, boxed/banded in small counts.',
  },
  {
    productFamilies: ['round_bar', 'flat_bar'],
    handlingMethod: 'crane',
    stackPermission: 'yes',
    maxStackHeight: 48,
    maxStackWeightKg: 17500, // midpoint of 15k–20k range
    orientation: 'longitudinal',
    dunnageRequired: false,
    reason: 'Heavy banded bundles, bands protect.',
  },
  {
    // Special case: polished bar requires dunnage
    productFamilies: ['round_bar_polished'],
    handlingMethod: 'crane',
    stackPermission: 'yes',
    maxStackHeight: 48,
    maxStackWeightKg: 15000,
    orientation: 'longitudinal',
    dunnageRequired: true,
    reason: 'Polished surface scratches easily against adjacent bars.',
  },
  {
    productFamilies: ['angle', 'channel', 'beam_i', 'beam_h', 'beam_wide_flange'],
    handlingMethod: 'forklift',
    stackPermission: 'yes',
    maxStackHeight: 40,
    maxStackWeightKg: 15000,
    orientation: 'longitudinal',
    dunnageRequired: true,
    reason: 'Profiles have exposed edges/corners that damage each other without spacers.',
  },
  {
    productFamilies: ['hollow_structural_section', 'pipe', 'tube'],
    handlingMethod: 'forklift',
    stackPermission: 'yes',
    maxStackHeight: 48,
    maxStackWeightKg: 15000,
    orientation: 'longitudinal',
    dunnageRequired: true,
    reason: 'Tube rolls or dents without dunnage; stops rolling off stack.',
  },
  {
    productFamilies: ['plate'],
    handlingMethod: 'crane',
    stackPermission: 'yes',
    maxStackHeight: 24,
    maxStackWeightKg: 19000, // midpoint of 18k–20k
    orientation: 'transverse', // "flat" orientation = transverse loading
    dunnageRequired: true,
    reason: 'Heavy flat stock; low stack height because weight compounds fast; dunnage prevents surface damage.',
  },
  {
    productFamilies: ['sheet_bundle'],
    handlingMethod: 'forklift',
    stackPermission: 'yes',
    maxStackHeight: 30,
    maxStackWeightKg: 8000,
    orientation: 'transverse',
    dunnageRequired: true,
    reason: 'Lighter gauge than plate, forklift-capable, but same surface-damage risk.',
  },
  {
    productFamilies: ['roofing_sheet_bundle'],
    handlingMethod: 'forklift',
    stackPermission: 'yes',
    maxStackHeight: 24,
    maxStackWeightKg: 3000,
    orientation: 'transverse',
    dunnageRequired: true,
    reason: 'Very thin gauge (calamina ~0.14–0.23mm) — fragile under stack load.',
  },
  {
    productFamilies: ['wire_rod_coil', 'wire_mesh_panel'],
    handlingMethod: 'forklift',
    stackPermission: 'conditional', // 2-high max
    maxStackHeight: 40,
    maxStackWeightKg: 5000,
    orientation: 'any', // vertical for coils
    dunnageRequired: false,
    reason: 'Rolls are unstable stacked >2 high; self-contained coil, no edge damage risk.',
  },
  {
    productFamilies: ['palletized', 'mixed_bundle'],
    handlingMethod: 'manual',
    stackPermission: 'yes',
    maxStackHeight: 60,
    maxStackWeightKg: 1000,
    orientation: 'any',
    dunnageRequired: false,
    reason: 'Palletized/boxed goods, standard warehouse handling.',
  },
];

// ─── Lookup Utilities ────────────────────────────────────────────────────────

const KG_TO_LBS = 2.20462;

/** Index for fast lookup by product type */
const familyIndex = new Map<string, HandlingDefault>();
for (const def of HANDLING_DEFAULTS) {
  for (const family of def.productFamilies) {
    familyIndex.set(family, def);
  }
}

/**
 * Get the handling default for a product type.
 * Returns null if the product type is not in the defaults table (unclassified).
 */
export function getHandlingDefault(productType: string): HandlingDefault | null {
  return familyIndex.get(productType) ?? null;
}

/**
 * Get max stack weight in lbs (internal unit) for a product type.
 * Returns 0 if no default exists.
 */
export function getMaxStackWeightLbs(productType: string): number {
  const def = getHandlingDefault(productType);
  return def ? Math.round(def.maxStackWeightKg * KG_TO_LBS) : 0;
}

/**
 * Apply handling defaults to a row object, filling in any missing fields.
 * Only fills fields that are empty/null — never overwrites explicit user values.
 * Returns whether defaults were applied (for traceability).
 */
export function applyHandlingDefaults(
  row: Record<string, unknown>,
  productType: string
): { applied: boolean; fieldsDefaulted: string[] } {
  const def = getHandlingDefault(productType);
  if (!def) {
    return { applied: false, fieldsDefaulted: [] };
  }

  const fieldsDefaulted: string[] = [];

  if (!row['handlingMethod']) {
    row['handlingMethod'] = def.handlingMethod;
    fieldsDefaulted.push('handlingMethod');
  }
  if (!row['stackPermission']) {
    row['stackPermission'] = def.stackPermission;
    fieldsDefaulted.push('stackPermission');
  }
  if (!row['maxStackHeight'] && row['maxStackHeight'] !== 0) {
    row['maxStackHeight'] = def.maxStackHeight;
    fieldsDefaulted.push('maxStackHeight');
  }
  if (!row['maxStackWeight'] && row['maxStackWeight'] !== 0) {
    row['maxStackWeight'] = Math.round(def.maxStackWeightKg * KG_TO_LBS);
    fieldsDefaulted.push('maxStackWeight');
  }
  if (!row['orientationRequirement']) {
    row['orientationRequirement'] = def.orientation;
    fieldsDefaulted.push('orientationRequirement');
  }
  if (row['dunnageRequired'] === undefined || row['dunnageRequired'] === null || row['dunnageRequired'] === '') {
    row['dunnageRequired'] = def.dunnageRequired;
    fieldsDefaulted.push('dunnageRequired');
  }

  return { applied: true, fieldsDefaulted };
}
