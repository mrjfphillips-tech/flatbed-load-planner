// ─── Delivery Number Matcher ─────────────────────────────────────────────────
// Matches Delivery_Number values from orders to vehicle IDs in the fleet file.
// Supports exact match, pattern (substring) match, and custom extraction rules.

import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';
import type { ExtractionRule } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result of matching delivery numbers to vehicle IDs.
 */
export interface MatchResult {
  /** Delivery numbers successfully matched to exactly one vehicle ID */
  matched: Map<string, string>;        // deliveryNumber → vehicleId
  /** Delivery numbers that could not be matched to any vehicle */
  unmatched: string[];
  /** Delivery numbers that matched multiple vehicles (ambiguous) */
  ambiguous: string[];
}

// ─── Extraction Helpers ──────────────────────────────────────────────────────

/**
 * Extract a candidate vehicle ID from a delivery number using a custom rule.
 * Returns the extracted string, or null if extraction fails.
 */
function applyExtractionRule(
  deliveryNumber: string,
  rule: ExtractionRule
): string | null {
  switch (rule.type) {
    case 'substring': {
      const start = rule.startPosition ?? 0;
      const end = rule.endPosition ?? deliveryNumber.length;
      if (start < 0 || end > deliveryNumber.length || start >= end) {
        return null;
      }
      return deliveryNumber.substring(start, end);
    }

    case 'delimiter': {
      const delimiter = rule.delimiter ?? '-';
      const fieldIndex = rule.fieldIndex ?? 0;
      const parts = deliveryNumber.split(delimiter);
      if (fieldIndex < 0 || fieldIndex >= parts.length) {
        return null;
      }
      return parts[fieldIndex];
    }

    case 'regex': {
      const pattern = rule.pattern;
      if (!pattern) return null;
      try {
        const regex = new RegExp(pattern);
        const match = regex.exec(deliveryNumber);
        if (!match) return null;
        const groupIndex = rule.captureGroup ?? 1;
        return match[groupIndex] ?? null;
      } catch {
        // Invalid regex pattern
        return null;
      }
    }

    default:
      return null;
  }
}

// ─── Match Strategies ────────────────────────────────────────────────────────

/**
 * Exact match: deliveryNumber === vehicleId
 */
function findExactMatches(
  deliveryNumber: string,
  vehicleIds: string[]
): string[] {
  return vehicleIds.filter((id) => deliveryNumber === id);
}

/**
 * Pattern match: vehicleId appears as a substring within deliveryNumber
 */
function findPatternMatches(
  deliveryNumber: string,
  vehicleIds: string[]
): string[] {
  return vehicleIds.filter(
    (id) => id.length > 0 && deliveryNumber.includes(id)
  );
}

/**
 * Custom extraction match: extract a candidate from deliveryNumber using
 * the extraction rule, then exact-match the extracted value against vehicleIds.
 */
function findCustomMatches(
  deliveryNumber: string,
  vehicleIds: string[],
  rule: ExtractionRule
): string[] {
  const extracted = applyExtractionRule(deliveryNumber, rule);
  if (extracted === null || extracted === '') return [];
  return vehicleIds.filter((id) => extracted === id);
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Match delivery numbers to vehicle IDs using the specified strategy.
 *
 * @param deliveryNumbers - Array of delivery number strings from orders
 * @param vehicleIds - Array of vehicle ID strings from the fleet file
 * @param strategy - Matching strategy: 'exact', 'pattern', or 'custom'
 * @param extractionRule - Required when strategy is 'custom'
 * @returns MatchResult with matched, unmatched, and ambiguous delivery numbers
 */
export function matchDeliveryNumbers(
  deliveryNumbers: string[],
  vehicleIds: string[],
  strategy: 'exact' | 'pattern' | 'custom',
  extractionRule?: ExtractionRule
): MatchResult {
  const matched = new Map<string, string>();
  const unmatched: string[] = [];
  const ambiguous: string[] = [];

  for (const dn of deliveryNumbers) {
    let matches: string[];

    switch (strategy) {
      case 'exact':
        matches = findExactMatches(dn, vehicleIds);
        break;
      case 'pattern':
        matches = findPatternMatches(dn, vehicleIds);
        break;
      case 'custom':
        if (!extractionRule) {
          unmatched.push(dn);
          continue;
        }
        matches = findCustomMatches(dn, vehicleIds, extractionRule);
        break;
      default:
        matches = [];
    }

    if (matches.length === 1) {
      matched.set(dn, matches[0]);
    } else if (matches.length > 1) {
      ambiguous.push(dn);
    } else {
      unmatched.push(dn);
    }
  }

  return { matched, unmatched, ambiguous };
}


// ─── Order Grouping ──────────────────────────────────────────────────────────

/**
 * Group orders by their delivery number.
 *
 * Orders with the same deliveryNumber are collected into the same group.
 * Orders without a deliveryNumber (undefined or empty string) are placed
 * in a special group keyed by an empty string ''.
 *
 * The resulting Map's groups are disjoint and their union equals the
 * original input set — no orders are lost or duplicated.
 *
 * @param orders - Array of steel order line items to group
 * @returns Map from delivery number to the orders assigned to that delivery
 */
export function groupOrdersByDeliveryNumber(
  orders: SteelOrderLineItem[]
): Map<string, SteelOrderLineItem[]> {
  const groups = new Map<string, SteelOrderLineItem[]>();

  for (const order of orders) {
    const key = order.deliveryNumber?.trim() || '';

    const existing = groups.get(key);
    if (existing) {
      existing.push(order);
    } else {
      groups.set(key, [order]);
    }
  }

  return groups;
}
