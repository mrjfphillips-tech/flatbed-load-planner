import { describe, it, expect } from 'vitest';
import {
  CONDITION_CODE_MAP,
  resolveVehicleProfile,
  isProfileResolutionError,
  tonnesToLbs,
  metresToFeet,
  metresToInches,
} from './profile-resolver';
import { REGIONAL_PRESETS } from '../equipment';
import type { VehicleRecord, ConditionCode, ResolvedVehicleProfile, ProfileResolutionError } from './types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeVehicleRecord(overrides: Partial<VehicleRecord> = {}): VehicleRecord {
  return {
    vehicleId: 'V001',
    vehicleType: 'Camión',
    licensePlate: 'ABC-123',
    weightCapacity: 10,      // 10 tonnes
    platformLength: 6.0,     // 6 metres
    platformWidth: 2.4,      // 2.4 metres
    conditionCode: 'ZN',
    status: 'active',
    ...overrides,
  };
}

// ─── Unit Conversion Tests ───────────────────────────────────────────────────

describe('tonnesToLbs', () => {
  it('converts 10 tonnes to approximately 22046 lbs', () => {
    expect(tonnesToLbs(10)).toBe(Math.round(10 * 2204.62));
  });

  it('converts 33 tonnes correctly', () => {
    expect(tonnesToLbs(33)).toBe(Math.round(33 * 2204.62));
  });

  it('converts 0 tonnes to 0 lbs', () => {
    expect(tonnesToLbs(0)).toBe(0);
  });
});

describe('metresToFeet', () => {
  it('converts 6 metres to approximately 20 feet', () => {
    expect(metresToFeet(6)).toBe(Math.round(6 * 3.28084));
  });

  it('converts 13 metres to approximately 43 feet', () => {
    expect(metresToFeet(13)).toBe(Math.round(13 * 3.28084));
  });
});

describe('metresToInches', () => {
  it('converts 2.4 metres to approximately 94 inches', () => {
    expect(metresToInches(2.4)).toBe(Math.round(2.4 * 39.3701));
  });

  it('converts 2.6 metres to approximately 102 inches', () => {
    expect(metresToInches(2.6)).toBe(Math.round(2.6 * 39.3701));
  });
});

// ─── CONDITION_CODE_MAP Tests ────────────────────────────────────────────────

describe('CONDITION_CODE_MAP', () => {
  it('maps ZN to pe-camion-zn', () => {
    expect(CONDITION_CODE_MAP['ZN']).toBe('pe-camion-zn');
  });

  it('maps ZO to pe-camion-zo', () => {
    expect(CONDITION_CODE_MAP['ZO']).toBe('pe-camion-zo');
  });

  it('maps ZB to pe-camion-zb', () => {
    expect(CONDITION_CODE_MAP['ZB']).toBe('pe-camion-zb');
  });

  it('maps ZA to pe-trailer-13m', () => {
    expect(CONDITION_CODE_MAP['ZA']).toBe('pe-trailer-13m');
  });

  it('maps ZF to pe-camion-grua', () => {
    expect(CONDITION_CODE_MAP['ZF']).toBe('pe-camion-grua');
  });

  it('every mapped preset ID exists in REGIONAL_PRESETS', () => {
    const presetIds = REGIONAL_PRESETS.map(p => p.id);
    for (const presetId of Object.values(CONDITION_CODE_MAP)) {
      expect(presetIds).toContain(presetId);
    }
  });
});

// ─── resolveVehicleProfile Tests ─────────────────────────────────────────────

describe('resolveVehicleProfile', () => {
  it('resolves a ZN vehicle to a valid profile', () => {
    const record = makeVehicleRecord({ conditionCode: 'ZN' });
    const result = resolveVehicleProfile(record);

    expect(isProfileResolutionError(result)).toBe(false);
    const profile = result as ResolvedVehicleProfile;
    expect(profile.trailer).toBeDefined();
    expect(profile.tractor).toBeDefined();
    expect(profile.equipment).toBeDefined();
  });

  it('resolves a ZA vehicle (trailer) to a valid profile', () => {
    const record = makeVehicleRecord({
      conditionCode: 'ZA',
      weightCapacity: 33,
      platformLength: 13,
      platformWidth: 2.6,
    });
    const result = resolveVehicleProfile(record);

    expect(isProfileResolutionError(result)).toBe(false);
    const profile = result as ResolvedVehicleProfile;
    expect(profile.tractor.id).toBe('pe-tractor-t3s3');
  });

  it('overrides maxGrossWeight with fleet file weight capacity (converted to lbs)', () => {
    const record = makeVehicleRecord({ weightCapacity: 15 });
    const result = resolveVehicleProfile(record) as ResolvedVehicleProfile;

    expect(result.trailer.maxGrossWeight).toBe(tonnesToLbs(15));
  });

  it('overrides platform length with fleet file value (converted to feet)', () => {
    const record = makeVehicleRecord({ platformLength: 7.5 });
    const result = resolveVehicleProfile(record) as ResolvedVehicleProfile;

    expect(result.trailer.lengthFt).toBe(metresToFeet(7.5));
  });

  it('overrides platform width with fleet file value (converted to inches)', () => {
    const record = makeVehicleRecord({ platformWidth: 2.6 });
    const result = resolveVehicleProfile(record) as ResolvedVehicleProfile;

    expect(result.trailer.deckWidthIn).toBe(metresToInches(2.6));
  });

  it('does not mutate the original preset trailer', () => {
    const preset = REGIONAL_PRESETS.find(p => p.id === 'pe-camion-zn')!;
    const originalLength = preset.trailer.lengthFt;
    const originalWeight = preset.trailer.maxGrossWeight;

    const record = makeVehicleRecord({
      conditionCode: 'ZN',
      weightCapacity: 99,
      platformLength: 15,
    });
    resolveVehicleProfile(record);

    expect(preset.trailer.lengthFt).toBe(originalLength);
    expect(preset.trailer.maxGrossWeight).toBe(originalWeight);
  });

  it('calculates equipment combination from resolved profiles', () => {
    const record = makeVehicleRecord({ conditionCode: 'ZO', weightCapacity: 14 });
    const result = resolveVehicleProfile(record) as ResolvedVehicleProfile;

    expect(result.equipment.tractorId).toBe(result.tractor.id);
    expect(result.equipment.trailerId).toBe(result.trailer.id);
    expect(result.equipment.availablePayload).toBeGreaterThan(0);
    expect(result.equipment.totalLegalGross).toBeGreaterThan(0);
  });

  it('resolves all valid condition codes without error', () => {
    const codes: ConditionCode[] = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'];
    for (const code of codes) {
      const record = makeVehicleRecord({ conditionCode: code });
      const result = resolveVehicleProfile(record);
      expect(isProfileResolutionError(result)).toBe(false);
    }
  });

  it('returns ProfileResolutionError for unrecognized condition code', () => {
    const record = makeVehicleRecord({ conditionCode: 'XX' as ConditionCode });
    const result = resolveVehicleProfile(record);

    expect(isProfileResolutionError(result)).toBe(true);
    const error = result as ProfileResolutionError;
    expect(error.vehicleId).toBe('V001');
    expect(error.reason).toContain('Unrecognized condition code');
  });
});

// ─── isProfileResolutionError Tests ──────────────────────────────────────────

describe('isProfileResolutionError', () => {
  it('returns true for a ProfileResolutionError', () => {
    const error: ProfileResolutionError = {
      vehicleId: 'V001',
      reason: 'Unrecognized condition code',
    };
    expect(isProfileResolutionError(error)).toBe(true);
  });

  it('returns false for a ResolvedVehicleProfile', () => {
    const record = makeVehicleRecord();
    const result = resolveVehicleProfile(record);
    expect(isProfileResolutionError(result)).toBe(false);
  });
});
