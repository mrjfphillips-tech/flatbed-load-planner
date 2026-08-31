import { describe, it, expect } from 'vitest';
import {
  validateTrailerProfile,
  validateTractorProfile,
  calculateEquipmentCombination,
  isPayloadValid,
} from './equipment';
import type { TractorProfile, TrailerProfile } from './types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeTrailer(overrides: Partial<TrailerProfile> = {}): TrailerProfile {
  return {
    id: 'trailer-1',
    name: 'Standard 53ft Flatbed',
    lengthFt: 53,
    deckWidthIn: 102,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 15000,
    axleCount: 2,
    axlePositions: [480, 528],
    axleWeightRatings: [34000, 34000], // sum = 68000 ≥ (80000 - 15000 = 65000) ✓
    kingpinPosition: 36,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [],
    anchorPoints: [],
    maxConcentratedLoadPSF: 500,
    ...overrides,
  };
}

function makeTractor(overrides: Partial<TractorProfile> = {}): TractorProfile {
  return {
    id: 'tractor-1',
    name: 'Standard Day Cab',
    steerAxleRating: 12000,
    driveAxleRating: 34000,
    fifthWheelPosition: 240,
    tareWeight: 18000,
    driveAxleCount: 2,
    ...overrides,
  };
}

// ─── validateTrailerProfile Tests ────────────────────────────────────────────

describe('validateTrailerProfile', () => {
  it('accepts a trailer where axle ratings sum exceeds required capacity', () => {
    const trailer = makeTrailer({
      maxGrossWeight: 80000,
      tareWeight: 15000,
      axleWeightRatings: [34000, 34000], // sum 68000 ≥ 65000
    });

    const result = validateTrailerProfile(trailer);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a trailer where axle ratings sum exactly equals required capacity', () => {
    const trailer = makeTrailer({
      maxGrossWeight: 80000,
      tareWeight: 15000,
      axleWeightRatings: [32500, 32500], // sum 65000 = 65000
    });

    const result = validateTrailerProfile(trailer);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a trailer where axle ratings sum is less than required capacity', () => {
    const trailer = makeTrailer({
      maxGrossWeight: 80000,
      tareWeight: 15000,
      axleWeightRatings: [30000, 30000], // sum 60000 < 65000
    });

    const result = validateTrailerProfile(trailer);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('60000');
    expect(result.errors[0]).toContain('65000');
  });

  it('handles a single-axle trailer', () => {
    const trailer = makeTrailer({
      axleCount: 1,
      axlePositions: [480],
      axleWeightRatings: [70000], // sum 70000 ≥ 65000
    });

    const result = validateTrailerProfile(trailer);

    expect(result.valid).toBe(true);
  });

  it('handles a trailer with many axles', () => {
    const trailer = makeTrailer({
      maxGrossWeight: 80000,
      tareWeight: 15000,
      axleCount: 4,
      axlePositions: [420, 468, 516, 564],
      axleWeightRatings: [17000, 17000, 17000, 17000], // sum 68000 ≥ 65000
    });

    const result = validateTrailerProfile(trailer);

    expect(result.valid).toBe(true);
  });
});

// ─── validateTractorProfile Tests ────────────────────────────────────────────

describe('validateTractorProfile', () => {
  it('accepts a tractor with all positive ratings', () => {
    const tractor = makeTractor();

    const result = validateTractorProfile(tractor);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a tractor with zero steer axle rating', () => {
    const tractor = makeTractor({ steerAxleRating: 0 });

    const result = validateTractorProfile(tractor);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Steer axle rating'))).toBe(true);
  });

  it('rejects a tractor with negative drive axle rating', () => {
    const tractor = makeTractor({ driveAxleRating: -1000 });

    const result = validateTractorProfile(tractor);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Drive axle rating'))).toBe(true);
  });

  it('rejects a tractor with zero tare weight', () => {
    const tractor = makeTractor({ tareWeight: 0 });

    const result = validateTractorProfile(tractor);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('tare weight'))).toBe(true);
  });

  it('reports multiple errors when multiple ratings are invalid', () => {
    const tractor = makeTractor({
      steerAxleRating: -100,
      driveAxleRating: 0,
      tareWeight: -500,
    });

    const result = validateTractorProfile(tractor);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});

// ─── calculateEquipmentCombination Tests ─────────────────────────────────────

describe('calculateEquipmentCombination', () => {
  it('calculates available payload as totalLegalGross - tractorTare - trailerTare', () => {
    const tractor = makeTractor({ tareWeight: 18000 });
    const trailer = makeTrailer({
      maxGrossWeight: 80000,
      tareWeight: 15000,
      axleWeightRatings: [34000, 34000],
    });

    const combo = calculateEquipmentCombination(tractor, trailer);

    // totalLegalGross = min(80000, 12000 + 34000 + 68000) = min(80000, 114000) = 80000
    // availablePayload = 80000 - 18000 - 15000 = 47000
    expect(combo.availablePayload).toBe(47000);
    expect(combo.totalLegalGross).toBe(80000);
  });

  it('limits total legal gross by axle capacity when axles are the bottleneck', () => {
    const tractor = makeTractor({
      steerAxleRating: 12000,
      driveAxleRating: 20000,
      tareWeight: 18000,
    });
    const trailer = makeTrailer({
      maxGrossWeight: 80000,
      tareWeight: 15000,
      axleWeightRatings: [20000, 20000], // sum = 40000; total axle = 12000+20000+40000 = 72000
    });

    const combo = calculateEquipmentCombination(tractor, trailer);

    // totalLegalGross = min(80000, 72000) = 72000
    // availablePayload = 72000 - 18000 - 15000 = 39000
    expect(combo.totalLegalGross).toBe(72000);
    expect(combo.availablePayload).toBe(39000);
  });

  it('sets correct per-axle limits', () => {
    const tractor = makeTractor({
      steerAxleRating: 12000,
      driveAxleRating: 34000,
    });
    const trailer = makeTrailer({
      axleWeightRatings: [34000, 34000],
    });

    const combo = calculateEquipmentCombination(tractor, trailer);

    expect(combo.perAxleLimits.steer).toBe(12000);
    expect(combo.perAxleLimits.drive).toBe(34000);
    expect(combo.perAxleLimits.trailer).toBe(68000);
  });

  it('references correct tractor and trailer IDs', () => {
    const tractor = makeTractor({ id: 'tractor-abc' });
    const trailer = makeTrailer({ id: 'trailer-xyz' });

    const combo = calculateEquipmentCombination(tractor, trailer);

    expect(combo.tractorId).toBe('tractor-abc');
    expect(combo.trailerId).toBe('trailer-xyz');
  });

  it('produces negative payload when tare weights exceed legal gross', () => {
    const tractor = makeTractor({ tareWeight: 50000 });
    const trailer = makeTrailer({
      maxGrossWeight: 80000,
      tareWeight: 40000,
      axleWeightRatings: [34000, 34000],
    });

    const combo = calculateEquipmentCombination(tractor, trailer);

    // totalLegalGross = min(80000, 12000+34000+68000) = 80000
    // availablePayload = 80000 - 50000 - 40000 = -10000
    expect(combo.availablePayload).toBe(-10000);
  });

  it('produces consistent results regardless of tractor/trailer selection order', () => {
    const tractor = makeTractor();
    const trailer = makeTrailer();

    // Calculate both ways (same function, but verifying determinism)
    const combo1 = calculateEquipmentCombination(tractor, trailer);
    const combo2 = calculateEquipmentCombination(tractor, trailer);

    expect(combo1.availablePayload).toBe(combo2.availablePayload);
    expect(combo1.totalLegalGross).toBe(combo2.totalLegalGross);
    expect(combo1.perAxleLimits).toEqual(combo2.perAxleLimits);
  });
});

// ─── isPayloadValid Tests ────────────────────────────────────────────────────

describe('isPayloadValid', () => {
  it('returns true for positive payload', () => {
    const tractor = makeTractor({ tareWeight: 18000 });
    const trailer = makeTrailer({ maxGrossWeight: 80000, tareWeight: 15000 });
    const combo = calculateEquipmentCombination(tractor, trailer);

    expect(isPayloadValid(combo)).toBe(true);
  });

  it('returns true for zero payload (edge case)', () => {
    const tractor = makeTractor({ tareWeight: 40000 });
    const trailer = makeTrailer({
      maxGrossWeight: 55000,
      tareWeight: 15000,
      axleWeightRatings: [40000, 40000], // sum=80000 > 55000-15000=40000 ✓
    });
    const combo = calculateEquipmentCombination(tractor, trailer);

    // totalLegalGross = min(55000, 12000+34000+80000) = 55000
    // availablePayload = 55000 - 40000 - 15000 = 0
    expect(combo.availablePayload).toBe(0);
    expect(isPayloadValid(combo)).toBe(true);
  });

  it('returns false for negative payload', () => {
    const tractor = makeTractor({ tareWeight: 50000 });
    const trailer = makeTrailer({
      maxGrossWeight: 80000,
      tareWeight: 40000,
      axleWeightRatings: [34000, 34000],
    });
    const combo = calculateEquipmentCombination(tractor, trailer);

    expect(combo.availablePayload).toBeLessThan(0);
    expect(isPayloadValid(combo)).toBe(false);
  });
});
