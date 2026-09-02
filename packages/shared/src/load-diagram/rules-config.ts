// ─── Rules Configuration (single source of thresholds) ───────────────────────
// Feature: load-diagram-generator (rules engine)
//
// Every rule threshold lives in rules.config.json — no rule constant appears in
// code. This module loads it, types it, and exposes a typed accessor plus an
// override hook (so callers/tests or per-customer config can supply their own).
//
// Canonical units are millimeters and kilograms; distance thresholds here are in
// mm. Fractions (support, CoG) are unitless and adopted verbatim from the spec.

import rawConfig from './rules.config.json';

export type UnloadMode = 'side' | 'rear';
export type RuleSeverity = 'error' | 'warning';

/** Fail-closed allow-list: class -> the classes it may directly carry. */
export type StackCompatibilityMatrix = Record<string, string[]>;

export interface RulesConfig {
  unloadMode: UnloadMode;
  tolerances: {
    overlapEpsilonMm: number;
    supportGapEpsilonMm: number;
    positionEpsilonMm: number;
  };
  support: { minSupportedFraction: number };
  vehicle: { rearOverhangMm: number };
  shapeClassification: {
    flatSmallestToLargestRatio: number;
    longLargestToMidRatio: number;
  };
  stackCompatibility: StackCompatibilityMatrix;
  planLayerOrder: Record<string, number>;
  loadSide: { centreToleranceMm: number };
  cog: {
    minLongitudinalFraction: number;
    maxLongitudinalFraction: number;
    maxLateralImbalanceFraction: number;
    maxHeightFractionWarn: number;
  };
  sanity: { minItemDimensionMm: number; minDeckLengthMm: number };
  severity: Record<string, RuleSeverity>;
}

/** The default configuration loaded from rules.config.json. */
export const DEFAULT_RULES_CONFIG: RulesConfig = rawConfig as RulesConfig;

/** Overrides accepted by resolveRulesConfig: partial nested numeric sections,
 *  whole-object replacement for the data-driven maps. */
export interface RulesConfigOverrides {
  unloadMode?: UnloadMode;
  tolerances?: Partial<RulesConfig['tolerances']>;
  support?: Partial<RulesConfig['support']>;
  vehicle?: Partial<RulesConfig['vehicle']>;
  shapeClassification?: Partial<RulesConfig['shapeClassification']>;
  stackCompatibility?: StackCompatibilityMatrix;
  planLayerOrder?: Record<string, number>;
  loadSide?: Partial<RulesConfig['loadSide']>;
  cog?: Partial<RulesConfig['cog']>;
  sanity?: Partial<RulesConfig['sanity']>;
  severity?: Record<string, RuleSeverity>;
}

/**
 * Merges partial overrides onto the default config (numeric sections merge per
 * key; the data-driven maps replace wholesale). Returns a new config; never
 * mutates the default. Enables per-customer config or test overrides without
 * touching the JSON.
 */
export function resolveRulesConfig(overrides?: RulesConfigOverrides): RulesConfig {
  if (!overrides) return DEFAULT_RULES_CONFIG;
  const base = DEFAULT_RULES_CONFIG;
  return {
    unloadMode: overrides.unloadMode ?? base.unloadMode,
    tolerances: { ...base.tolerances, ...overrides.tolerances },
    support: { ...base.support, ...overrides.support },
    vehicle: { ...base.vehicle, ...overrides.vehicle },
    shapeClassification: { ...base.shapeClassification, ...overrides.shapeClassification },
    // Matrix and layer order are replaced wholesale when provided (data-driven
    // swap for the future product-family hierarchy).
    stackCompatibility: overrides.stackCompatibility ?? base.stackCompatibility,
    planLayerOrder: overrides.planLayerOrder ?? base.planLayerOrder,
    loadSide: { ...base.loadSide, ...overrides.loadSide },
    cog: { ...base.cog, ...overrides.cog },
    sanity: { ...base.sanity, ...overrides.sanity },
    severity: { ...base.severity, ...overrides.severity },
  };
}

/**
 * Fail-closed compatibility lookup: returns true only if `supportClass` is a
 * known key AND explicitly lists `topClass`. Unknown support class, unknown top
 * class, or missing entry all return false (never a silent pass).
 */
export function classCanCarry(
  supportClass: string | undefined,
  topClass: string | undefined,
  matrix: StackCompatibilityMatrix,
): boolean {
  if (supportClass == null || topClass == null) return false;
  const allowed = matrix[supportClass];
  if (!allowed) return false;
  return allowed.includes(topClass);
}
