// ─── Property-Based Tests for Import Service ─────────────────────────────────
// Feature: flatbed-load-planner
// Property 3: Import field round-trip preservation
// Property 4: Import validation error identification
// Validates: Requirements 2.2, 2.3, 2.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseCsv } from './parseCsv';
import { validateRow, VALID_PRODUCT_TYPES, VALID_HANDLING_METHODS, VALID_STACK_PERMISSIONS, VALID_ORIENTATIONS } from './validation';
import type { SteelOrderLineItem, SteelProductType, HandlingMethod, StackPermission, OrientationRequirement } from '@ptv-discovery-coach/shared';

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates an arbitrary valid SteelOrderLineItem suitable for CSV round-trip testing.
 * Values are constrained to:
 * - Avoid CSV-breaking characters (commas, newlines, quotes) in string fields
 * - Use pre-trimmed strings (the parser normalizes whitespace, so round-trip
 *   equivalence only holds for already-trimmed values)
 */
function arbitraryValidSteelOrderLineItem(): fc.Arbitrary<SteelOrderLineItem> {
  // Alphanumeric strings that won't break CSV parsing and are already trimmed
  // (no leading/trailing spaces) since the parser trims on read.
  const safeString = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,28}[A-Za-z0-9]$/)
    .filter(s => s.trim() === s && s.length > 0);

  return fc.record({
    orderNumber: fc.stringMatching(/^ORD-[0-9]{3,6}$/),
    customerName: safeString,
    deliveryStop: fc.integer({ min: 1, max: 20 }),
    productType: fc.constantFrom(...VALID_PRODUCT_TYPES) as fc.Arbitrary<SteelProductType>,
    quantity: fc.integer({ min: 1, max: 500 }),
    pieceWeight: fc.integer({ min: 1, max: 100000 }),
    dimensions: fc.record({
      length: fc.integer({ min: 1, max: 1000 }),
      width: fc.integer({ min: 1, max: 500 }),
      height: fc.integer({ min: 1, max: 300 }),
    }),
    totalLineWeight: fc.integer({ min: 1, max: 500000 }),
    handlingMethod: fc.constantFrom(...VALID_HANDLING_METHODS) as fc.Arbitrary<HandlingMethod>,
    stackPermission: fc.constantFrom(...VALID_STACK_PERMISSIONS) as fc.Arbitrary<StackPermission>,
    maxStackHeight: fc.integer({ min: 0, max: 200 }),
    maxStackWeight: fc.integer({ min: 0, max: 200000 }),
    orientationRequirement: fc.constantFrom(...VALID_ORIENTATIONS) as fc.Arbitrary<OrientationRequirement>,
    dunnageRequired: fc.boolean(),
    specialNotes: fc.constantFrom('', 'Handle with care', 'Fragile', 'No special notes'),
  });
}

/**
 * CSV headers matching the import service's expected header format.
 */
const CSV_HEADERS = [
  'Order Number',
  'Customer Name',
  'Stop',
  'Product Type',
  'Quantity',
  'Piece Weight',
  'Length',
  'Width',
  'Height',
  'Total Weight',
  'Handling Method',
  'Stack Permission',
  'Max Stack Height',
  'Max Stack Weight',
  'Orientation',
  'Dunnage',
  'Notes',
];

/**
 * Serializes a SteelOrderLineItem to a CSV row string matching the expected column order.
 */
function serializeItemToCsvRow(item: SteelOrderLineItem): string {
  return [
    item.orderNumber,
    item.customerName,
    item.deliveryStop.toString(),
    item.productType,
    item.quantity.toString(),
    item.pieceWeight.toString(),
    item.dimensions.length.toString(),
    item.dimensions.width.toString(),
    item.dimensions.height.toString(),
    item.totalLineWeight.toString(),
    item.handlingMethod,
    item.stackPermission,
    item.maxStackHeight.toString(),
    item.maxStackWeight.toString(),
    item.orientationRequirement,
    item.dunnageRequired ? 'yes' : 'no',
    item.specialNotes,
  ].join(',');
}

/**
 * Builds a complete CSV string from an array of items.
 */
function buildCsvFromItems(items: SteelOrderLineItem[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = items.map(serializeItemToCsvRow);
  return [header, ...rows].join('\n');
}

// ─── Required fields that must be present for a valid row ────────────────────

const REQUIRED_FIELDS = [
  'orderNumber',
  'customerName',
  'deliveryStop',
  'productType',
  'quantity',
  'pieceWeight',
] as const;

// ─── Product types where dimension fields are optional ───────────────────────

const LENGTH_OPTIONAL_TYPES = new Set(['palletized', 'wire_rod_coil', 'fabricated_assembly']);
const WIDTH_OPTIONAL_TYPES = new Set(['pipe', 'round_bar', 'rebar_bundle', 'wire_rod_coil', 'palletized', 'channel', 'fabricated_assembly']);
const HEIGHT_OPTIONAL_TYPES = new Set(['palletized', 'wire_rod_coil']);

/**
 * Returns the dimension fields that are required for a given product type.
 */
function requiredDimensionFields(productType: string): readonly string[] {
  const fields: string[] = [];
  if (!LENGTH_OPTIONAL_TYPES.has(productType)) fields.push('length');
  if (!WIDTH_OPTIONAL_TYPES.has(productType)) fields.push('width');
  if (!HEIGHT_OPTIONAL_TYPES.has(productType)) fields.push('height');
  return fields;
}

// ─── Property 3: Import field round-trip preservation ────────────────────────
// For any valid SteelOrderLineItem, serializing it to CSV format and parsing it
// back SHALL produce an equivalent object with all fields preserved.

describe('Feature: flatbed-load-planner, Property 3: Import field round-trip preservation', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any valid steel order line item, serialize → CSV string → parse →
   * result equals original (round-trip).
   */
  it('serialize to CSV then parse back produces equivalent object with all fields preserved', () => {
    fc.assert(
      fc.property(
        arbitraryValidSteelOrderLineItem(),
        (originalItem) => {
          // Serialize the item to a CSV string
          const csvString = buildCsvFromItems([originalItem]);

          // Parse it back using the import service
          const result = parseCsv(csvString);

          // Should parse without errors
          expect(result.errors).toHaveLength(0);
          expect(result.items).toHaveLength(1);

          const parsed = result.items[0];

          // Verify all fields are preserved through round-trip
          expect(parsed.orderNumber).toBe(originalItem.orderNumber);
          expect(parsed.customerName).toBe(originalItem.customerName);
          expect(parsed.deliveryStop).toBe(originalItem.deliveryStop);
          expect(parsed.productType).toBe(originalItem.productType);
          expect(parsed.quantity).toBe(originalItem.quantity);
          expect(parsed.pieceWeight).toBe(originalItem.pieceWeight);
          expect(parsed.dimensions.length).toBe(originalItem.dimensions.length);
          expect(parsed.dimensions.width).toBe(originalItem.dimensions.width);
          expect(parsed.dimensions.height).toBe(originalItem.dimensions.height);
          expect(parsed.totalLineWeight).toBe(originalItem.totalLineWeight);
          expect(parsed.handlingMethod).toBe(originalItem.handlingMethod);
          expect(parsed.stackPermission).toBe(originalItem.stackPermission);
          expect(parsed.maxStackHeight).toBe(originalItem.maxStackHeight);
          expect(parsed.maxStackWeight).toBe(originalItem.maxStackWeight);
          expect(parsed.orientationRequirement).toBe(originalItem.orientationRequirement);
          expect(parsed.dunnageRequired).toBe(originalItem.dunnageRequired);
          expect(parsed.specialNotes).toBe(originalItem.specialNotes);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   *
   * Multiple items round-trip correctly — serializing N items then parsing
   * back produces N equivalent items in the same order.
   */
  it('multiple items round-trip preserves all items and order', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryValidSteelOrderLineItem(), { minLength: 1, maxLength: 10 }),
        (originalItems) => {
          const csvString = buildCsvFromItems(originalItems);
          const result = parseCsv(csvString);

          // All items should parse without errors
          expect(result.errors).toHaveLength(0);
          expect(result.items).toHaveLength(originalItems.length);

          // Each item should match the original
          for (let i = 0; i < originalItems.length; i++) {
            const original = originalItems[i];
            const parsed = result.items[i];

            expect(parsed.orderNumber).toBe(original.orderNumber);
            expect(parsed.customerName).toBe(original.customerName);
            expect(parsed.deliveryStop).toBe(original.deliveryStop);
            expect(parsed.productType).toBe(original.productType);
            expect(parsed.quantity).toBe(original.quantity);
            expect(parsed.pieceWeight).toBe(original.pieceWeight);
            expect(parsed.dimensions.length).toBe(original.dimensions.length);
            expect(parsed.dimensions.width).toBe(original.dimensions.width);
            expect(parsed.dimensions.height).toBe(original.dimensions.height);
            expect(parsed.totalLineWeight).toBe(original.totalLineWeight);
            expect(parsed.handlingMethod).toBe(original.handlingMethod);
            expect(parsed.stackPermission).toBe(original.stackPermission);
            expect(parsed.orientationRequirement).toBe(original.orientationRequirement);
            expect(parsed.dunnageRequired).toBe(original.dunnageRequired);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Import validation error identification ──────────────────────
// For any steel order line item with one or more required fields missing or
// containing invalid values, the Import Service SHALL produce a non-empty error
// set that identifies the specific row number and field name for each invalid entry.

describe('Feature: flatbed-load-planner, Property 4: Import validation error identification', () => {
  /**
   * **Validates: Requirements 2.3, 2.5**
   *
   * For any item with a required field missing, validation produces non-empty
   * error set identifying row and field.
   */
  it('missing required field produces error identifying the row and field name', () => {
    fc.assert(
      fc.property(
        arbitraryValidSteelOrderLineItem(),
        fc.integer({ min: 2, max: 100 }), // row index (1-based, starting at 2 for data rows)
        (validItem, rowIndex) => {
          // Determine which fields are actually required for this product type
          const allRequired = [
            ...REQUIRED_FIELDS,
            ...requiredDimensionFields(validItem.productType),
          ];
          // Pick a random required field to remove (deterministic from the item)
          const fieldToRemove = allRequired[rowIndex % allRequired.length];

          // Build a valid mapped row, then remove/empty one required field
          const row: Record<string, unknown> = {
            orderNumber: validItem.orderNumber,
            customerName: validItem.customerName,
            deliveryStop: validItem.deliveryStop,
            productType: validItem.productType,
            quantity: validItem.quantity,
            pieceWeight: validItem.pieceWeight,
            length: validItem.dimensions.length,
            width: validItem.dimensions.width,
            height: validItem.dimensions.height,
            totalLineWeight: validItem.totalLineWeight,
            handlingMethod: validItem.handlingMethod,
            stackPermission: validItem.stackPermission,
            maxStackHeight: validItem.maxStackHeight,
            maxStackWeight: validItem.maxStackWeight,
            orientationRequirement: validItem.orientationRequirement,
            dunnageRequired: validItem.dunnageRequired ? 'yes' : 'no',
            specialNotes: validItem.specialNotes,
          };

          // Remove the selected required field
          row[fieldToRemove] = '';

          const { errors } = validateRow(row, rowIndex);

          // Must produce at least one error
          expect(errors.length).toBeGreaterThan(0);

          // At least one error must reference the field we removed
          const fieldError = errors.find(e => e.field === fieldToRemove);
          expect(fieldError).toBeDefined();

          // The error must identify the correct row
          expect(fieldError!.row).toBe(rowIndex);

          // The error must have a non-empty message
          expect(fieldError!.message.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3, 2.5**
   *
   * For any item with an invalid enum value (product type, handling method,
   * stack permission, orientation), validation produces an error identifying
   * the specific field.
   */
  it('invalid enum values produce errors identifying row and field', () => {
    // Generator for invalid enum values (strings that aren't valid options)
    const invalidEnumValue = fc.stringMatching(/^[a-z_]{3,15}$/).filter(s =>
      !VALID_PRODUCT_TYPES.includes(s as SteelProductType) &&
      !VALID_HANDLING_METHODS.includes(s as HandlingMethod) &&
      !VALID_STACK_PERMISSIONS.includes(s as StackPermission) &&
      !VALID_ORIENTATIONS.includes(s as OrientationRequirement)
    );

    const enumFields = [
      'productType',
      'handlingMethod',
      'stackPermission',
      'orientationRequirement',
    ] as const;

    fc.assert(
      fc.property(
        arbitraryValidSteelOrderLineItem(),
        fc.constantFrom(...enumFields),
        invalidEnumValue,
        fc.integer({ min: 2, max: 100 }),
        (validItem, fieldToCorrupt, invalidValue, rowIndex) => {
          const row: Record<string, unknown> = {
            orderNumber: validItem.orderNumber,
            customerName: validItem.customerName,
            deliveryStop: validItem.deliveryStop,
            productType: validItem.productType,
            quantity: validItem.quantity,
            pieceWeight: validItem.pieceWeight,
            length: validItem.dimensions.length,
            width: validItem.dimensions.width,
            height: validItem.dimensions.height,
            totalLineWeight: validItem.totalLineWeight,
            handlingMethod: validItem.handlingMethod,
            stackPermission: validItem.stackPermission,
            maxStackHeight: validItem.maxStackHeight,
            maxStackWeight: validItem.maxStackWeight,
            orientationRequirement: validItem.orientationRequirement,
            dunnageRequired: validItem.dunnageRequired ? 'yes' : 'no',
            specialNotes: validItem.specialNotes,
          };

          // Corrupt the selected enum field with an invalid value
          row[fieldToCorrupt] = invalidValue;

          const { errors } = validateRow(row, rowIndex);

          // Must produce at least one error
          expect(errors.length).toBeGreaterThan(0);

          // At least one error must reference the corrupted field
          const fieldError = errors.find(e => e.field === fieldToCorrupt);
          expect(fieldError).toBeDefined();

          // The error must identify the correct row
          expect(fieldError!.row).toBe(rowIndex);

          // The error must have a descriptive message
          expect(fieldError!.message.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3, 2.5**
   *
   * For any item with invalid numeric values (negative, zero, non-numeric, or
   * non-integer for integer-requiring fields) in numeric required fields,
   * validation produces an error identifying the field.
   */
  it('invalid numeric values produce errors identifying row and field', () => {
    // Fields that require positive integers
    const integerFields = ['deliveryStop', 'quantity'] as const;
    // Fields that require positive numbers (integer or float)
    const alwaysRequiredPositiveFields = ['pieceWeight'] as const;

    // Values invalid for ALL numeric fields (non-numeric, empty, negative, zero)
    const universallyInvalidValues = fc.constantFrom('abc', '', '-5', '0');

    // Values invalid only for integer fields (valid positive float)
    const invalidForIntegerOnly = fc.constantFrom('1.5', '2.7', '0.5');

    fc.assert(
      fc.property(
        arbitraryValidSteelOrderLineItem(),
        fc.oneof(
          // Case 1: universally invalid value on always-required numeric fields
          fc.tuple(
            fc.constantFrom(...integerFields, ...alwaysRequiredPositiveFields),
            universallyInvalidValues,
          ),
          // Case 2: non-integer value on integer-requiring fields
          fc.tuple(
            fc.constantFrom(...integerFields),
            invalidForIntegerOnly,
          ),
        ),
        fc.integer({ min: 2, max: 100 }),
        (validItem, [fieldToCorrupt, invalidValue], rowIndex) => {
          const row: Record<string, unknown> = {
            orderNumber: validItem.orderNumber,
            customerName: validItem.customerName,
            deliveryStop: validItem.deliveryStop,
            productType: validItem.productType,
            quantity: validItem.quantity,
            pieceWeight: validItem.pieceWeight,
            length: validItem.dimensions.length,
            width: validItem.dimensions.width,
            height: validItem.dimensions.height,
            totalLineWeight: validItem.totalLineWeight,
            handlingMethod: validItem.handlingMethod,
            stackPermission: validItem.stackPermission,
            maxStackHeight: validItem.maxStackHeight,
            maxStackWeight: validItem.maxStackWeight,
            orientationRequirement: validItem.orientationRequirement,
            dunnageRequired: validItem.dunnageRequired ? 'yes' : 'no',
            specialNotes: validItem.specialNotes,
          };

          // Corrupt the selected numeric field with an invalid value
          row[fieldToCorrupt] = invalidValue;

          const { errors } = validateRow(row, rowIndex);

          // Must produce at least one error
          expect(errors.length).toBeGreaterThan(0);

          // At least one error must reference the corrupted field
          const fieldError = errors.find(e => e.field === fieldToCorrupt);
          expect(fieldError).toBeDefined();

          // The error must identify the correct row
          expect(fieldError!.row).toBe(rowIndex);

          // The error must have a non-empty descriptive message
          expect(fieldError!.message.length).toBeGreaterThan(0);

          // The error must record what was provided
          expect(fieldError!.value).toBe(invalidValue);
        }
      ),
      { numRuns: 100 }
    );
  });
});
