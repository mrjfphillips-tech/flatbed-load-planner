// ─── Property-Based Tests for Profile Resolver ───────────────────────────────
// Feature: daily-fleet-load-planner
// Property 4: Profile resolution maps condition codes to correct presets
// **Validates: Requirements 2.1**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  resolveVehicleProfile,
  isProfileResolutionError,
  CONDITION_CODE_MAP,
} from './profile-resolver';
import { REGIONAL_PRESETS } from '../equipment';
import type { VehicleRecord, ConditionCode } from './types';

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates a valid VehicleRecord with a recognized condition code.
 * - vehicleId: arbitrary non-empty alphanumeric string
 * - vehicleType: arbitrary non-empty string
 * - licensePlate: arbitrary non-empty string
 * - weightCapacity: positive number in tonnes (1–50)
 * - platformLength: positive number in metres (3–20)
 * - platformWidth: positive number in metres (1.5–3.5)
 * - conditionCode: drawn from the recognized set (ZN, ZO, ZB, ZA, ZF)
 */
function arbitraryVehicleRecord(): fc.Arbitrary<VehicleRecord> {
  return fc.record({
    vehicleId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    vehicleType: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    licensePlate: fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
    weightCapacity: fc.double({ min: 1, max: 50, noNaN: true }),
    platformLength: fc.double({ min: 3, max: 20, noNaN: true }),
    platformWidth: fc.double({ min: 1.5, max: 3.5, noNaN: true }),
    conditionCode: fc.constantFrom('ZN' as ConditionCode, 'ZO' as ConditionCode, 'ZB' as ConditionCode, 'ZA' as ConditionCode, 'ZF' as ConditionCode),
    status: fc.constant('active' as const),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a lookup from condition code → the trailer id stored inside the preset.
 * CONDITION_CODE_MAP maps condition code → preset ID, and each preset has a
 * trailer with its own `id` field. The property under test is that the resolved
 * trailer id matches the trailer id from the correct preset.
 */
function buildExpectedTrailerIdMap(): Record<ConditionCode, string> {
  const map: Record<string, string> = {};
  for (const [code, presetId] of Object.entries(CONDITION_CODE_MAP)) {
    const preset = REGIONAL_PRESETS.find(p => p.id === presetId);
    if (preset) {
      map[code] = preset.trailer.id;
    }
  }
  return map as Record<ConditionCode, string>;
}

const EXPECTED_TRAILER_IDS = buildExpectedTrailerIdMap();

// ─── Property 4: Profile resolution maps condition codes to correct presets ──

describe('Feature: daily-fleet-load-planner, Property 4: Profile resolution maps condition codes to correct presets', () => {
  /**
   * **Validates: Requirements 2.1**
   *
   * For any valid VehicleRecord with a recognized condition code (ZN, ZO, ZB, ZA, ZF),
   * the profile resolver should return a ResolvedVehicleProfile whose trailer `id`
   * matches the expected preset's trailer id from CONDITION_CODE_MAP[record.conditionCode].
   */
  it('resolves any valid VehicleRecord to a profile whose trailer id matches the preset found via CONDITION_CODE_MAP', () => {
    fc.assert(
      fc.property(
        arbitraryVehicleRecord(),
        (record) => {
          const result = resolveVehicleProfile(record);

          // The result must NOT be an error for recognized condition codes
          expect(isProfileResolutionError(result)).toBe(false);

          // The resolved trailer's id must match the trailer id from the preset
          // that CONDITION_CODE_MAP[conditionCode] points to
          if (!isProfileResolutionError(result)) {
            const expectedTrailerId = EXPECTED_TRAILER_IDS[record.conditionCode];
            expect(result.trailer.id).toBe(expectedTrailerId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.1**
   *
   * Verify the resolved trailer id corresponds to a trailer that actually belongs
   * to an entry in REGIONAL_PRESETS, ensuring the mapping is consistent end-to-end
   * across arbitrary valid inputs.
   */
  it('resolved trailer id always corresponds to a preset in REGIONAL_PRESETS catalog', () => {
    const allTrailerIds = REGIONAL_PRESETS.map(p => p.trailer.id);

    fc.assert(
      fc.property(
        arbitraryVehicleRecord(),
        (record) => {
          const result = resolveVehicleProfile(record);

          expect(isProfileResolutionError(result)).toBe(false);

          if (!isProfileResolutionError(result)) {
            expect(allTrailerIds).toContain(result.trailer.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.1**
   *
   * The relationship between condition code and resolved preset is deterministic:
   * two records with the same condition code always resolve to the same trailer id,
   * regardless of other field values.
   */
  it('same condition code always resolves to the same trailer id regardless of other fields', () => {
    fc.assert(
      fc.property(
        arbitraryVehicleRecord(),
        arbitraryVehicleRecord(),
        (recordA, recordB) => {
          // Force same condition code
          const sharedCode = recordA.conditionCode;
          const recordBSameCode: VehicleRecord = { ...recordB, conditionCode: sharedCode };

          const resultA = resolveVehicleProfile(recordA);
          const resultB = resolveVehicleProfile(recordBSameCode);

          expect(isProfileResolutionError(resultA)).toBe(false);
          expect(isProfileResolutionError(resultB)).toBe(false);

          if (!isProfileResolutionError(resultA) && !isProfileResolutionError(resultB)) {
            expect(resultA.trailer.id).toBe(resultB.trailer.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
