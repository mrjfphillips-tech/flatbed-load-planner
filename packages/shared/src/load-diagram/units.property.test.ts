// ─── Property-Based Tests for Unit Conversion ───────────────────────────────
// Feature: load-diagram-generator
// Property: canonical -> display unit -> canonical round-trips within tolerance
// for both metric and imperial unit systems.
// Validates: Requirements 10.2, 10.3

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  lengthFromCanonical,
  lengthToCanonical,
  weightFromCanonical,
  weightToCanonical,
  formatLength,
  formatWeight,
  lengthUnitLabel,
  weightUnitLabel,
  MM_PER_INCH,
  KG_PER_POUND,
} from './units';
import type { UnitSystem } from './types';

const UNIT_SYSTEMS: UnitSystem[] = ['metric', 'imperial'];

/** Realistic canonical length in mm (0 .. 20 m). */
const arbitraryCanonicalMm = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 20_000, noNaN: true, noDefaultInfinity: true });

/** Realistic canonical weight in kg (0 .. 30 t). */
const arbitraryCanonicalKg = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 30_000, noNaN: true, noDefaultInfinity: true });

describe('unit conversion round-trip', () => {
  it('preserves canonical length through convert-and-back for both systems', () => {
    fc.assert(
      fc.property(
        arbitraryCanonicalMm(),
        fc.constantFrom(...UNIT_SYSTEMS),
        (mm, unit) => {
          const roundTripped = lengthToCanonical(lengthFromCanonical(mm, unit), unit);
          // Tolerance well below one micron — conversion is exact floating point.
          expect(roundTripped).toBeCloseTo(mm, 6);
        },
      ),
    );
  });

  it('preserves canonical weight through convert-and-back for both systems', () => {
    fc.assert(
      fc.property(
        arbitraryCanonicalKg(),
        fc.constantFrom(...UNIT_SYSTEMS),
        (kg, unit) => {
          const roundTripped = weightToCanonical(weightFromCanonical(kg, unit), unit);
          expect(roundTripped).toBeCloseTo(kg, 6);
        },
      ),
    );
  });
});

describe('metric is identity', () => {
  it('does not change length values in metric', () => {
    fc.assert(
      fc.property(arbitraryCanonicalMm(), (mm) => {
        expect(lengthFromCanonical(mm, 'metric')).toBe(mm);
        expect(lengthToCanonical(mm, 'metric')).toBe(mm);
      }),
    );
  });

  it('does not change weight values in metric', () => {
    fc.assert(
      fc.property(arbitraryCanonicalKg(), (kg) => {
        expect(weightFromCanonical(kg, 'metric')).toBe(kg);
        expect(weightToCanonical(kg, 'metric')).toBe(kg);
      }),
    );
  });
});

describe('exact conversion factors', () => {
  it('uses 25.4 mm per inch', () => {
    expect(lengthToCanonical(1, 'imperial')).toBe(MM_PER_INCH);
    expect(lengthToCanonical(1, 'imperial')).toBe(25.4);
  });

  it('uses 0.45359237 kg per pound', () => {
    expect(weightToCanonical(1, 'imperial')).toBe(KG_PER_POUND);
    expect(weightToCanonical(1, 'imperial')).toBe(0.45359237);
  });
});

describe('display formatting', () => {
  it('labels length with the correct unit symbol', () => {
    expect(formatLength(1200, 'metric')).toBe('1200 mm');
    expect(formatLength(1200, 'metric').endsWith(lengthUnitLabel('metric'))).toBe(true);

    const imperial = formatLength(1200, 'imperial');
    expect(imperial.endsWith('in')).toBe(true);
    expect(imperial).toBe(`${(1200 / 25.4).toFixed(2)} in`);
  });

  it('labels weight with the correct unit symbol', () => {
    expect(formatWeight(850, 'metric')).toBe('850.0 kg');
    expect(formatWeight(850, 'metric').endsWith(weightUnitLabel('metric'))).toBe(true);

    const imperial = formatWeight(850, 'imperial');
    expect(imperial.endsWith('lb')).toBe(true);
  });

  it('respects a custom precision', () => {
    expect(formatLength(1000, 'imperial', 4)).toBe(`${(1000 / 25.4).toFixed(4)} in`);
    expect(formatWeight(1000, 'metric', 0)).toBe('1000 kg');
  });
});
