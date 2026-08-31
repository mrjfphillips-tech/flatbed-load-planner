// ─── Property-Based Tests for Profile Resolver Overrides ─────────────────────
// Feature: daily-fleet-load-planner
// Property 5: Fleet file overrides supersede preset defaults
// Validates: Requirements 2.3, 2.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  resolveVehicleProfile,
  tonnesToLbs,
  metresToFeet,
  metresToInches,
} from './profile-resolver';
import type { VehicleRecord, ConditionCode, ResolvedVehicleProfile } from './types';

// ─── Custom Generators ───────────────────────────────────────────────────────

/** Valid condition codes for Peru fleet */
const VALID_CONDITION_CODES: ConditionCode[] = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'];

/**
 * Generates an arbitrary VehicleRecord with:
 * - weightCapacity: 1–100 tonnes
 * - platformLength: 3–20 metres
 * - platformWidth: 1.5–3.5 metres
 * - A valid condition code
 */
function arbitraryVehicleRecordWithOverrides(): fc.Arbitrary<VehicleRecord> {
  return fc.record({
    vehicleId: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
    vehicleType: fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
    licensePlate: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
    weightCapacity: fc.double({ min: 1, max: 100, noNaN: true }).map(n => Math.round(n * 100) / 100),
    platformLength: fc.double({ min: 3, max: 20, noNaN: true }).map(n => Math.round(n * 100) / 100),
    platformWidth: fc.double({ min: 1.5, max: 3.5, noNaN: true }).map(n => Math.round(n * 100) / 100),
    conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
    status: fc.constant('active' as const),
  });
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Profile Resolver Overrides — Property Tests', () => {
  // Feature: daily-fleet-load-planner, Property 5: Fleet file overrides supersede preset defaults
  // **Validates: Requirements 2.3, 2.4**
  it('Property 5: fleet file weight/dimension values always supersede preset defaults after conversion', () => {
    fc.assert(
      fc.property(
        arbitraryVehicleRecordWithOverrides(),
        (record) => {
          const result = resolveVehicleProfile(record);

          // The result must be a valid profile (not an error) since we use valid condition codes
          expect('trailer' in result).toBe(true);
          const profile = result as ResolvedVehicleProfile;

          // Assert maxGrossWeight equals tonnesToLbs(record.weightCapacity)
          expect(profile.trailer.maxGrossWeight).toBe(tonnesToLbs(record.weightCapacity));

          // Assert lengthFt equals metresToFeet(record.platformLength)
          expect(profile.trailer.lengthFt).toBe(metresToFeet(record.platformLength));

          // Assert deckWidthIn equals metresToInches(record.platformWidth)
          expect(profile.trailer.deckWidthIn).toBe(metresToInches(record.platformWidth));
        },
      ),
      { numRuns: 100 },
    );
  });
});
