// ─── Unit Conversion & Formatting ───────────────────────────────────────────
// Feature: load-diagram-generator
// Single source of truth for converting between canonical units (mm / kg) and
// the metric / imperial display units. Used by both backend (Excel parser, PDF
// generator) and frontend (UI display, editor) so conversion is identical
// everywhere.
//
// Canonical internal units are ALWAYS millimeters (length) and kilograms
// (weight). The UnitSystem only governs how values are entered and displayed.
// _Requirements: 10.1, 10.2, 10.3, 10.6_

import type { UnitSystem } from './types';

// ─── Exact Conversion Constants ──────────────────────────────────────────────

/** Exact number of millimeters per inch. */
export const MM_PER_INCH = 25.4;

/** Exact number of kilograms per international avoirdupois pound. */
export const KG_PER_POUND = 0.45359237;

// ─── Length: canonical (mm) <-> display unit ─────────────────────────────────

/**
 * Convert a canonical length in millimeters to the value in the given unit
 * system (millimeters for metric, inches for imperial).
 */
export function lengthFromCanonical(mm: number, unit: UnitSystem): number {
  return unit === 'imperial' ? mm / MM_PER_INCH : mm;
}

/**
 * Convert a length expressed in the given unit system (mm for metric, inches
 * for imperial) back to canonical millimeters.
 */
export function lengthToCanonical(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? value * MM_PER_INCH : value;
}

// ─── Weight: canonical (kg) <-> display unit ─────────────────────────────────

/**
 * Convert a canonical weight in kilograms to the value in the given unit system
 * (kilograms for metric, pounds for imperial).
 */
export function weightFromCanonical(kg: number, unit: UnitSystem): number {
  return unit === 'imperial' ? kg / KG_PER_POUND : kg;
}

/**
 * Convert a weight expressed in the given unit system (kg for metric, pounds
 * for imperial) back to canonical kilograms.
 */
export function weightToCanonical(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? value * KG_PER_POUND : value;
}

// ─── Unit Labels ─────────────────────────────────────────────────────────────

/** Returns the length unit symbol for the given unit system. */
export function lengthUnitLabel(unit: UnitSystem): 'mm' | 'in' {
  return unit === 'imperial' ? 'in' : 'mm';
}

/** Returns the weight unit symbol for the given unit system. */
export function weightUnitLabel(unit: UnitSystem): 'kg' | 'lb' {
  return unit === 'imperial' ? 'lb' : 'kg';
}

// ─── Display Formatters ──────────────────────────────────────────────────────

/**
 * Format a canonical length (mm) as a unit-labeled display string in the given
 * unit system, e.g. `formatLength(1200, 'metric')` -> "1200 mm" and
 * `formatLength(1200, 'imperial')` -> "47.24 in".
 *
 * @param precision Number of decimal places (default: 0 for metric, 2 for imperial)
 */
export function formatLength(
  mm: number,
  unit: UnitSystem,
  precision?: number,
): string {
  const value = lengthFromCanonical(mm, unit);
  const decimals = precision ?? (unit === 'imperial' ? 2 : 0);
  return `${value.toFixed(decimals)} ${lengthUnitLabel(unit)}`;
}

/**
 * Format a canonical weight (kg) as a unit-labeled display string in the given
 * unit system, e.g. `formatWeight(850, 'metric')` -> "850 kg" and
 * `formatWeight(850, 'imperial')` -> "1874.03 lb".
 *
 * @param precision Number of decimal places (default: 1)
 */
export function formatWeight(
  kg: number,
  unit: UnitSystem,
  precision = 1,
): string {
  const value = weightFromCanonical(kg, unit);
  return `${value.toFixed(precision)} ${weightUnitLabel(unit)}`;
}
