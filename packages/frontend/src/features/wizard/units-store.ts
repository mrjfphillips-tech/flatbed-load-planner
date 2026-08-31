// ─── Unit System Store ────────────────────────────────────────────────────────
// Manages whether the UI displays metric or imperial units.
// The internal engine always uses inches/lbs — this store only affects display.

import { create } from 'zustand';

export type UnitSystem = 'metric' | 'imperial';

export interface UnitsState {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
}

export const useUnitsStore = create<UnitsState>()((set) => ({
  unitSystem: 'metric', // default to metric (international)
  setUnitSystem: (system) => set({ unitSystem: system }),
}));

// ─── Conversion Utilities ────────────────────────────────────────────────────

const IN_TO_MM = 25.4;
const IN_TO_CM = 2.54;
const IN_TO_M = 0.0254;
const FT_TO_M = 0.3048;
const LBS_TO_KG = 0.4536;
const LBS_TO_T = 0.000454;
const PSF_TO_KPA = 0.04788;

/** Convert internal inches to display unit */
export function displayLength(inches: number, system: UnitSystem): string {
  if (system === 'metric') {
    const mm = inches * IN_TO_MM;
    if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
    return `${Math.round(mm)} mm`;
  }
  return `${inches.toFixed(1)} in`;
}

/** Convert internal feet to display unit */
export function displayLengthFt(feet: number, system: UnitSystem): string {
  if (system === 'metric') {
    const m = feet * FT_TO_M;
    return `${m.toFixed(2)} m`;
  }
  return `${feet} ft`;
}

/** Convert internal lbs to display unit */
export function displayWeight(lbs: number, system: UnitSystem): string {
  if (system === 'metric') {
    const kg = lbs * LBS_TO_KG;
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
    return `${Math.round(kg)} kg`;
  }
  return `${lbs.toLocaleString()} lbs`;
}

/** Convert internal PSF to display unit */
export function displayPressure(psf: number, system: UnitSystem): string {
  if (system === 'metric') {
    return `${(psf * PSF_TO_KPA).toFixed(1)} kPa`;
  }
  return `${psf} PSF`;
}

/** Convert user input length to internal inches */
export function inputToInches(value: number, system: UnitSystem, inputUnit?: 'mm' | 'cm' | 'm'): number {
  if (system === 'imperial') return value; // already inches
  switch (inputUnit) {
    case 'mm': return value / IN_TO_MM;
    case 'cm': return value / IN_TO_CM;
    case 'm': return value / IN_TO_M;
    default: return value / IN_TO_MM; // default metric input is mm
  }
}

/** Convert user input length to internal feet */
export function inputToFeet(value: number, system: UnitSystem): number {
  if (system === 'imperial') return value; // already feet
  return value / FT_TO_M; // metric input is meters
}

/** Convert user input weight to internal lbs */
export function inputToLbs(value: number, system: UnitSystem, inputUnit?: 'kg' | 't'): number {
  if (system === 'imperial') return value; // already lbs
  switch (inputUnit) {
    case 't': return value / LBS_TO_T;
    case 'kg':
    default: return value / LBS_TO_KG;
  }
}

/** Get the appropriate unit label for display */
export function lengthUnit(system: UnitSystem): string {
  return system === 'metric' ? 'mm' : 'in';
}

export function lengthUnitLarge(system: UnitSystem): string {
  return system === 'metric' ? 'm' : 'ft';
}

export function weightUnit(system: UnitSystem): string {
  return system === 'metric' ? 'kg' : 'lbs';
}

export function weightUnitLarge(system: UnitSystem): string {
  return system === 'metric' ? 't' : 'lbs';
}
