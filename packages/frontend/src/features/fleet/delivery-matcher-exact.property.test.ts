// ─── Property-Based Tests for Delivery Number Exact Match ────────────────────
// Feature: daily-fleet-load-planner, Property 7: Delivery number exact match is identity
// Validates: Requirements 8.1

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { matchDeliveryNumbers } from './delivery-matcher';

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates an array of unique non-empty strings to serve as both
 * delivery numbers and vehicle IDs (identity case).
 */
function arbitraryUniqueNonEmptyStrings(): fc.Arbitrary<string[]> {
  return fc
    .uniqueArray(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0), {
      minLength: 1,
      maxLength: 50,
    })
    .filter((arr) => arr.length > 0);
}

// ─── Property 7: Delivery number exact match is identity ─────────────────────
// For any set of delivery numbers and vehicle IDs where each delivery number
// exactly equals one vehicle ID, the matcher with 'exact' strategy should
// produce a complete one-to-one mapping with zero unmatched entries.

describe('Feature: daily-fleet-load-planner, Property 7: Delivery number exact match is identity', () => {
  /**
   * **Validates: Requirements 8.1**
   *
   * When deliveryNumbers and vehicleIds are the same set of unique values,
   * exact matching should produce a perfect one-to-one mapping where each
   * delivery number maps to itself.
   */
  it('exact match with identical delivery numbers and vehicle IDs produces complete one-to-one mapping', () => {
    fc.assert(
      fc.property(arbitraryUniqueNonEmptyStrings(), (ids) => {
        const deliveryNumbers = [...ids];
        const vehicleIds = [...ids];

        const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'exact');

        // All delivery numbers should be matched
        expect(result.matched.size).toBe(deliveryNumbers.length);

        // Each delivery number maps to itself (identity)
        for (const dn of deliveryNumbers) {
          expect(result.matched.get(dn)).toBe(dn);
        }

        // No unmatched entries
        expect(result.unmatched.length).toBe(0);

        // No ambiguous entries
        expect(result.ambiguous.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
