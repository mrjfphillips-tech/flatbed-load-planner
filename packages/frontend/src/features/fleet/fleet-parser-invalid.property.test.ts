// ─── Property Test: Invalid Fleet Row Error Reporting ────────────────────────
// Feature: daily-fleet-load-planner, Property 2: Invalid fleet rows produce per-row errors
// **Validates: Requirements 1.2, 1.3**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateVehicleRecord } from './fleet-parser';

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_CONDITION_CODES = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'] as const;

/** Fields that require non-empty strings */
const STRING_FIELDS = ['vehicleId', 'vehicleType', 'licensePlate'] as const;

/** Fields that require positive numbers */
const NUMERIC_FIELDS = ['weightCapacity', 'platformLength', 'platformWidth'] as const;

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid base row (all fields correct) */
const validRowArb = fc.record({
  vehicleId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  vehicleType: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  licensePlate: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  weightCapacity: fc.double({ min: 0.01, max: 100_000, noNaN: true }),
  platformLength: fc.double({ min: 0.01, max: 1000, noNaN: true }),
  platformWidth: fc.double({ min: 0.01, max: 100, noNaN: true }),
  conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
});

/** Generate an invalid value for a string field (empty or whitespace-only) */
const invalidStringArb = fc.constantFrom('', '   ', '\t', '\n');

/** Generate an invalid value for a numeric field (zero, negative, NaN-producing, or non-numeric) */
const invalidNumericArb = fc.oneof(
  fc.constant(0),
  fc.double({ min: -100_000, max: -0.001, noNaN: true }),
  fc.constant(''),
  fc.constant('abc'),
  fc.constant(null),
  fc.constant(undefined),
);

/** Generate an invalid condition code (not one of ZN, ZO, ZB, ZA, ZF) */
const invalidConditionCodeArb = fc.oneof(
  fc.constant(''),
  fc.constant('XX'),
  fc.constant('ZZ'),
  fc.constant('invalid'),
  fc.string({ minLength: 1, maxLength: 5 }).filter(
    s => !VALID_CONDITION_CODES.includes(s.trim().toUpperCase() as typeof VALID_CONDITION_CODES[number])
  ),
);

/**
 * Generate a row with at least one invalid field.
 * Strategy: start from a valid row, then corrupt at least one field.
 * Returns the corrupted row and the set of field names that were corrupted.
 */
const invalidRowArb = validRowArb.chain(baseRow => {
  // Choose which fields to corrupt (at least one)
  const allFields = [...STRING_FIELDS, ...NUMERIC_FIELDS, 'conditionCode'] as const;

  return fc.subarray([...allFields], { minLength: 1 }).chain(fieldsToCorrupt => {
    // Build corruption overrides
    const overrides: fc.Arbitrary<Record<string, unknown>>[] = fieldsToCorrupt.map(field => {
      if (STRING_FIELDS.includes(field as typeof STRING_FIELDS[number])) {
        return invalidStringArb.map(v => ({ [field]: v }));
      }
      if (NUMERIC_FIELDS.includes(field as typeof NUMERIC_FIELDS[number])) {
        return invalidNumericArb.map(v => ({ [field]: v }));
      }
      // conditionCode
      return invalidConditionCodeArb.map(v => ({ [field]: v }));
    });

    return fc.tuple(...overrides).map(overrideArray => {
      const corrupted: Record<string, unknown> = { ...baseRow };
      for (const override of overrideArray) {
        Object.assign(corrupted, override);
      }
      return {
        row: corrupted,
        corruptedFields: fieldsToCorrupt as string[],
      };
    });
  });
});

/** Generate a positive integer for the row index */
const rowIndexArb = fc.integer({ min: 1, max: 10_000 });

// ─── Property Test ───────────────────────────────────────────────────────────

describe('Property 2: Invalid fleet rows produce per-row errors', () => {
  it('rows with at least one invalid field produce errors and no VehicleRecord', () => {
    fc.assert(
      fc.property(
        invalidRowArb,
        rowIndexArb,
        ({ row, corruptedFields }, rowIndex) => {
          const result = validateVehicleRecord(row, rowIndex);

          // record must be null for an invalid row
          expect(result.record).toBeNull();

          // at least one error must be produced
          expect(result.errors.length).toBeGreaterThanOrEqual(1);

          // every error must reference the correct row index
          for (const error of result.errors) {
            expect(error.row).toBe(rowIndex);
          }

          // at least one error must reference a field from the corrupted set
          const errorFields = result.errors.map(e => e.field);
          const hasMatchingField = corruptedFields.some(f => errorFields.includes(f));
          expect(hasMatchingField).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('each error has a non-empty field name matching a known required field', () => {
    const ALL_REQUIRED_FIELDS = [
      'vehicleId', 'vehicleType', 'licensePlate',
      'weightCapacity', 'platformLength', 'platformWidth',
      'conditionCode',
    ];

    fc.assert(
      fc.property(
        invalidRowArb,
        rowIndexArb,
        ({ row }, rowIndex) => {
          const result = validateVehicleRecord(row, rowIndex);

          for (const error of result.errors) {
            // field must be a non-empty string
            expect(error.field).toBeTruthy();
            expect(typeof error.field).toBe('string');

            // field must be one of the known required fields
            expect(ALL_REQUIRED_FIELDS).toContain(error.field);

            // message must be non-empty
            expect(error.message).toBeTruthy();
            expect(typeof error.message).toBe('string');
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
