/**
 * Unit Tests for Delivery Number Matcher
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

import { describe, it, expect } from 'vitest';
import { matchDeliveryNumbers, groupOrdersByDeliveryNumber } from './delivery-matcher';
import type { ExtractionRule } from './types';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';

describe('delivery-matcher', () => {
  // ─── Exact Match Strategy ────────────────────────────────────────────────

  describe('exact match strategy', () => {
    it('matches delivery numbers that exactly equal vehicle IDs', () => {
      const deliveryNumbers = ['V001', 'V002', 'V003'];
      const vehicleIds = ['V001', 'V002', 'V003'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'exact');

      expect(result.matched.size).toBe(3);
      expect(result.matched.get('V001')).toBe('V001');
      expect(result.matched.get('V002')).toBe('V002');
      expect(result.matched.get('V003')).toBe('V003');
      expect(result.unmatched).toEqual([]);
      expect(result.ambiguous).toEqual([]);
    });

    it('reports unmatched when no exact match exists', () => {
      const deliveryNumbers = ['DN-V001-2024', 'V002'];
      const vehicleIds = ['V001', 'V002'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'exact');

      expect(result.matched.size).toBe(1);
      expect(result.matched.get('V002')).toBe('V002');
      expect(result.unmatched).toEqual(['DN-V001-2024']);
      expect(result.ambiguous).toEqual([]);
    });

    it('handles empty delivery numbers array', () => {
      const result = matchDeliveryNumbers([], ['V001', 'V002'], 'exact');

      expect(result.matched.size).toBe(0);
      expect(result.unmatched).toEqual([]);
      expect(result.ambiguous).toEqual([]);
    });

    it('handles empty vehicle IDs array', () => {
      const result = matchDeliveryNumbers(['V001'], [], 'exact');

      expect(result.matched.size).toBe(0);
      expect(result.unmatched).toEqual(['V001']);
      expect(result.ambiguous).toEqual([]);
    });
  });

  // ─── Pattern Match Strategy ──────────────────────────────────────────────

  describe('pattern match strategy', () => {
    it('matches when vehicle ID is a substring of delivery number', () => {
      const deliveryNumbers = ['DN-V001-2024', 'SHIP-V002-JAN', 'V003-LOAD'];
      const vehicleIds = ['V001', 'V002', 'V003'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'pattern');

      expect(result.matched.size).toBe(3);
      expect(result.matched.get('DN-V001-2024')).toBe('V001');
      expect(result.matched.get('SHIP-V002-JAN')).toBe('V002');
      expect(result.matched.get('V003-LOAD')).toBe('V003');
      expect(result.unmatched).toEqual([]);
      expect(result.ambiguous).toEqual([]);
    });

    it('reports ambiguous when multiple vehicle IDs are substrings', () => {
      const deliveryNumbers = ['V001-V002-COMBINED'];
      const vehicleIds = ['V001', 'V002'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'pattern');

      expect(result.matched.size).toBe(0);
      expect(result.ambiguous).toEqual(['V001-V002-COMBINED']);
    });

    it('reports unmatched when no vehicle ID is a substring', () => {
      const deliveryNumbers = ['ABCDEF'];
      const vehicleIds = ['V001', 'V002'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'pattern');

      expect(result.matched.size).toBe(0);
      expect(result.unmatched).toEqual(['ABCDEF']);
    });

    it('ignores empty vehicle IDs in pattern matching', () => {
      const deliveryNumbers = ['DN-V001'];
      const vehicleIds = ['', 'V001'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'pattern');

      // Empty string would match everything, so it's filtered out
      expect(result.matched.size).toBe(1);
      expect(result.matched.get('DN-V001')).toBe('V001');
    });
  });

  // ─── Custom Extraction: Substring ────────────────────────────────────────

  describe('custom extraction — substring', () => {
    it('extracts vehicle ID from character positions', () => {
      // Delivery numbers encode vehicle ID in positions 3-7: "DN-V001-2024"
      const deliveryNumbers = ['DN-V001-2024', 'DN-V002-2024'];
      const vehicleIds = ['V001', 'V002', 'V003'];
      const rule: ExtractionRule = {
        type: 'substring',
        startPosition: 3,
        endPosition: 7,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.matched.size).toBe(2);
      expect(result.matched.get('DN-V001-2024')).toBe('V001');
      expect(result.matched.get('DN-V002-2024')).toBe('V002');
    });

    it('reports unmatched when extraction yields no match', () => {
      const deliveryNumbers = ['DN-XXXX-2024'];
      const vehicleIds = ['V001', 'V002'];
      const rule: ExtractionRule = {
        type: 'substring',
        startPosition: 3,
        endPosition: 7,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.unmatched).toEqual(['DN-XXXX-2024']);
    });

    it('handles out-of-range positions gracefully', () => {
      const deliveryNumbers = ['AB'];
      const vehicleIds = ['AB'];
      const rule: ExtractionRule = {
        type: 'substring',
        startPosition: 0,
        endPosition: 10, // beyond string length
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      // endPosition > length, so extraction returns null
      expect(result.unmatched).toEqual(['AB']);
    });
  });

  // ─── Custom Extraction: Delimiter ────────────────────────────────────────

  describe('custom extraction — delimiter', () => {
    it('splits by delimiter and picks the correct field', () => {
      const deliveryNumbers = ['2024-V001-LOAD', '2024-V002-LOAD'];
      const vehicleIds = ['V001', 'V002'];
      const rule: ExtractionRule = {
        type: 'delimiter',
        delimiter: '-',
        fieldIndex: 1,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.matched.size).toBe(2);
      expect(result.matched.get('2024-V001-LOAD')).toBe('V001');
      expect(result.matched.get('2024-V002-LOAD')).toBe('V002');
    });

    it('handles field index out of bounds', () => {
      const deliveryNumbers = ['V001'];
      const vehicleIds = ['V001'];
      const rule: ExtractionRule = {
        type: 'delimiter',
        delimiter: '-',
        fieldIndex: 5, // only 1 field when no delimiter in string
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.unmatched).toEqual(['V001']);
    });

    it('uses default delimiter (-) when not specified', () => {
      const deliveryNumbers = ['2024-V001'];
      const vehicleIds = ['V001'];
      const rule: ExtractionRule = {
        type: 'delimiter',
        fieldIndex: 1,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.matched.get('2024-V001')).toBe('V001');
    });
  });

  // ─── Custom Extraction: Regex ────────────────────────────────────────────

  describe('custom extraction — regex', () => {
    it('extracts vehicle ID using capture group', () => {
      const deliveryNumbers = ['DN_V001_20240115', 'DN_V002_20240115'];
      const vehicleIds = ['V001', 'V002'];
      const rule: ExtractionRule = {
        type: 'regex',
        pattern: 'DN_(V\\d+)_\\d+',
        captureGroup: 1,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.matched.size).toBe(2);
      expect(result.matched.get('DN_V001_20240115')).toBe('V001');
      expect(result.matched.get('DN_V002_20240115')).toBe('V002');
    });

    it('handles no regex match gracefully', () => {
      const deliveryNumbers = ['NOMATCH'];
      const vehicleIds = ['V001'];
      const rule: ExtractionRule = {
        type: 'regex',
        pattern: 'DN_(V\\d+)',
        captureGroup: 1,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.unmatched).toEqual(['NOMATCH']);
    });

    it('handles invalid regex pattern gracefully', () => {
      const deliveryNumbers = ['DN-V001'];
      const vehicleIds = ['V001'];
      const rule: ExtractionRule = {
        type: 'regex',
        pattern: '([', // invalid regex
        captureGroup: 1,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.unmatched).toEqual(['DN-V001']);
    });

    it('returns unmatched when capture group does not exist', () => {
      const deliveryNumbers = ['DN-V001'];
      const vehicleIds = ['V001'];
      const rule: ExtractionRule = {
        type: 'regex',
        pattern: 'DN-(V\\d+)',
        captureGroup: 5, // group 5 does not exist
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.unmatched).toEqual(['DN-V001']);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles custom strategy without extraction rule', () => {
      const deliveryNumbers = ['V001'];
      const vehicleIds = ['V001'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom');

      expect(result.unmatched).toEqual(['V001']);
    });

    it('handles duplicate delivery numbers independently', () => {
      const deliveryNumbers = ['V001', 'V001'];
      const vehicleIds = ['V001'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'exact');

      // Each delivery number is matched independently
      expect(result.matched.size).toBe(1); // Map deduplicates keys
      expect(result.matched.get('V001')).toBe('V001');
    });

    it('pattern match is case-sensitive', () => {
      const deliveryNumbers = ['DN-v001-LOAD'];
      const vehicleIds = ['V001'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'pattern');

      // 'V001' is not a substring of 'DN-v001-LOAD' (case mismatch)
      expect(result.unmatched).toEqual(['DN-v001-LOAD']);
    });

    it('pattern match with vehicle ID at start of delivery number', () => {
      const deliveryNumbers = ['V001-EXTRA'];
      const vehicleIds = ['V001'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'pattern');

      expect(result.matched.size).toBe(1);
      expect(result.matched.get('V001-EXTRA')).toBe('V001');
    });

    it('pattern match with vehicle ID at end of delivery number', () => {
      const deliveryNumbers = ['LOAD-V001'];
      const vehicleIds = ['V001'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'pattern');

      expect(result.matched.size).toBe(1);
      expect(result.matched.get('LOAD-V001')).toBe('V001');
    });

    it('custom delimiter extraction with multi-character delimiter', () => {
      const deliveryNumbers = ['2024::V001::LOAD'];
      const vehicleIds = ['V001'];
      const rule: ExtractionRule = {
        type: 'delimiter',
        delimiter: '::',
        fieldIndex: 1,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.matched.size).toBe(1);
      expect(result.matched.get('2024::V001::LOAD')).toBe('V001');
    });

    it('custom regex with multiple capture groups uses specified group', () => {
      const deliveryNumbers = ['ROUTE-A-VH001-2024'];
      const vehicleIds = ['VH001'];
      const rule: ExtractionRule = {
        type: 'regex',
        pattern: '(ROUTE-\\w+)-(VH\\d+)-(\\d+)',
        captureGroup: 2,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.matched.size).toBe(1);
      expect(result.matched.get('ROUTE-A-VH001-2024')).toBe('VH001');
    });

    it('custom substring extraction with startPosition only (to end of string)', () => {
      const deliveryNumbers = ['PREF-VH001'];
      const vehicleIds = ['VH001'];
      const rule: ExtractionRule = {
        type: 'substring',
        startPosition: 5,
        endPosition: 10,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.matched.size).toBe(1);
      expect(result.matched.get('PREF-VH001')).toBe('VH001');
    });

    it('handles all delivery numbers being ambiguous', () => {
      const deliveryNumbers = ['AB-CD', 'AB-CD'];
      const vehicleIds = ['AB', 'CD'];

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'pattern');

      // Both 'AB' and 'CD' are substrings of 'AB-CD' → ambiguous
      expect(result.ambiguous.length).toBeGreaterThanOrEqual(1);
      expect(result.matched.size).toBe(0);
    });

    it('custom delimiter with empty string after split', () => {
      const deliveryNumbers = ['-V001-'];
      const vehicleIds = ['V001'];
      const rule: ExtractionRule = {
        type: 'delimiter',
        delimiter: '-',
        fieldIndex: 1,
      };

      const result = matchDeliveryNumbers(deliveryNumbers, vehicleIds, 'custom', rule);

      expect(result.matched.size).toBe(1);
      expect(result.matched.get('-V001-')).toBe('V001');
    });
  });
});


// ─── Order Grouping Tests ────────────────────────────────────────────────────

/**
 * Unit Tests for groupOrdersByDeliveryNumber
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

function makeOrder(overrides: Partial<SteelOrderLineItem> = {}): SteelOrderLineItem {
  return {
    orderNumber: 'ORD-001',
    customerName: 'Test Customer',
    deliveryStop: 1,
    productType: 'coil_hot_rolled',
    quantity: 1,
    pieceWeight: 5000,
    dimensions: { length: 48, width: 48, height: 48 },
    totalLineWeight: 5000,
    handlingMethod: 'crane',
    stackPermission: 'no',
    maxStackHeight: 0,
    maxStackWeight: 0,
    orientationRequirement: 'any',
    dunnageRequired: false,
    specialNotes: '',
    ...overrides,
  };
}

describe('groupOrdersByDeliveryNumber', () => {
  it('groups orders with the same delivery number together', () => {
    const orders = [
      makeOrder({ orderNumber: 'ORD-001', deliveryNumber: 'DN-V001' }),
      makeOrder({ orderNumber: 'ORD-002', deliveryNumber: 'DN-V001' }),
      makeOrder({ orderNumber: 'ORD-003', deliveryNumber: 'DN-V002' }),
    ];

    const groups = groupOrdersByDeliveryNumber(orders);

    expect(groups.size).toBe(2);
    expect(groups.get('DN-V001')!.length).toBe(2);
    expect(groups.get('DN-V002')!.length).toBe(1);
  });

  it('returns an empty map for an empty order array', () => {
    const groups = groupOrdersByDeliveryNumber([]);
    expect(groups.size).toBe(0);
  });

  it('places orders without deliveryNumber in the empty-string group', () => {
    const orders = [
      makeOrder({ orderNumber: 'ORD-001', deliveryNumber: undefined }),
      makeOrder({ orderNumber: 'ORD-002', deliveryNumber: '' }),
      makeOrder({ orderNumber: 'ORD-003', deliveryNumber: 'DN-V001' }),
    ];

    const groups = groupOrdersByDeliveryNumber(orders);

    expect(groups.size).toBe(2);
    expect(groups.get('')!.length).toBe(2);
    expect(groups.get('DN-V001')!.length).toBe(1);
  });

  it('preserves all orders — union of groups equals input', () => {
    const orders = [
      makeOrder({ orderNumber: 'ORD-001', deliveryNumber: 'A' }),
      makeOrder({ orderNumber: 'ORD-002', deliveryNumber: 'B' }),
      makeOrder({ orderNumber: 'ORD-003', deliveryNumber: 'A' }),
      makeOrder({ orderNumber: 'ORD-004', deliveryNumber: 'C' }),
    ];

    const groups = groupOrdersByDeliveryNumber(orders);

    const totalItems = [...groups.values()].reduce((sum, arr) => sum + arr.length, 0);
    expect(totalItems).toBe(orders.length);
  });

  it('trims whitespace from delivery numbers for grouping', () => {
    const orders = [
      makeOrder({ orderNumber: 'ORD-001', deliveryNumber: '  DN-V001  ' }),
      makeOrder({ orderNumber: 'ORD-002', deliveryNumber: 'DN-V001' }),
    ];

    const groups = groupOrdersByDeliveryNumber(orders);

    // Both should be in the same group after trimming
    expect(groups.size).toBe(1);
    expect(groups.get('DN-V001')!.length).toBe(2);
  });

  it('creates one group per unique delivery number', () => {
    const orders = [
      makeOrder({ orderNumber: 'ORD-001', deliveryNumber: 'X' }),
      makeOrder({ orderNumber: 'ORD-002', deliveryNumber: 'Y' }),
      makeOrder({ orderNumber: 'ORD-003', deliveryNumber: 'Z' }),
    ];

    const groups = groupOrdersByDeliveryNumber(orders);

    expect(groups.size).toBe(3);
    expect(groups.has('X')).toBe(true);
    expect(groups.has('Y')).toBe(true);
    expect(groups.has('Z')).toBe(true);
  });
});
