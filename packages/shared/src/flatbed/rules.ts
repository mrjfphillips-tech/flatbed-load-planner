// ─── OptiFlow Flatbed Steel Load Planner — Rules Engine ──────────────────────
// Pure functions for load plan constraint evaluation, preference scoring,
// and advisory guidance. All rules produce plain-language messages.

import type {
  AxleGroup,
  EquipmentCombination,
  PlacedFreight,
  RuleType,
  TractorProfile,
  TrailerProfile,
} from './types';
import type { WeightMetrics } from './weight';

// ─── Rules Engine Interfaces ─────────────────────────────────────────────────

/** Context provided to each rule for evaluation */
export interface RuleContext {
  placedFreight: PlacedFreight[];
  equipment: EquipmentCombination;
  trailer: TrailerProfile;
  tractor: TractorProfile;
  weightMetrics: WeightMetrics;
}

/** Result produced by evaluating a single rule */
export interface RuleResult {
  passed: boolean;
  ruleId: string;
  ruleType: RuleType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedItems: string[];
  threshold?: number;
  actual?: number;
  suggestedAction?: string;
}

/** A rule definition that can evaluate a load configuration */
export interface Rule {
  id: string;
  name: string;
  type: RuleType;
  description: string;
  evaluate: (context: RuleContext) => RuleResult;
  isApplicable: (context: RuleContext) => boolean;
}

/** Aggregated result from evaluating all applicable rules */
export interface RuleEvaluationResult {
  results: RuleResult[];
  canApprove: boolean;
}

// ─── Severity Mapping ────────────────────────────────────────────────────────

/** Maps rule type to severity level */
export function severityForType(type: RuleType): 'error' | 'warning' | 'info' {
  switch (type) {
    case 'hard_constraint':
      return 'error';
    case 'soft_preference':
      return 'warning';
    case 'advisory':
      return 'info';
  }
}

// ─── Default Hard Constraints ────────────────────────────────────────────────

/** No axle group exceeds its legal weight rating */
export const axleOverweightRule: Rule = {
  id: 'hard_axle_overweight',
  name: 'Axle Group Weight Limit',
  type: 'hard_constraint',
  description: 'No axle group may exceed its legal weight rating.',
  isApplicable: (_ctx) => true,
  evaluate: (ctx) => {
    const { weightMetrics, equipment } = ctx;
    const violations: { group: AxleGroup; actual: number; limit: number }[] = [];

    const groups: AxleGroup[] = ['steer', 'drive', 'trailer'];
    for (const group of groups) {
      const actual = group === 'steer'
        ? weightMetrics.steerWeight
        : group === 'drive'
          ? weightMetrics.driveWeight
          : weightMetrics.trailerWeight;
      const limit = equipment.perAxleLimits[group];
      if (actual > limit) {
        violations.push({ group, actual, limit });
      }
    }

    if (violations.length === 0) {
      return {
        passed: true,
        ruleId: 'hard_axle_overweight',
        ruleType: 'hard_constraint',
        severity: 'error',
        message: 'All axle groups are within legal weight limits.',
        affectedItems: [],
      };
    }

    const worst = violations[0];
    const excess = Math.round(worst.actual - worst.limit);
    return {
      passed: false,
      ruleId: 'hard_axle_overweight',
      ruleType: 'hard_constraint',
      severity: 'error',
      message: `The ${worst.group} axle group is ${excess} lbs over its ${Math.round(worst.limit)} lb limit (current: ${Math.round(worst.actual)} lbs).`,
      affectedItems: ctx.placedFreight.map((f) => f.item.orderNumber),
      threshold: worst.limit,
      actual: worst.actual,
      suggestedAction: `Move freight away from the ${worst.group} axle area or remove items to reduce weight by at least ${excess} lbs.`,
    };
  },
};

/** Total gross vehicle weight does not exceed legal maximum */
export const grossWeightRule: Rule = {
  id: 'hard_gross_weight',
  name: 'Gross Vehicle Weight Limit',
  type: 'hard_constraint',
  description: 'Total gross vehicle weight must not exceed the legal maximum.',
  isApplicable: (_ctx) => true,
  evaluate: (ctx) => {
    const { weightMetrics, equipment } = ctx;
    const limit = equipment.totalLegalGross;
    const actual = weightMetrics.totalGross;

    if (actual <= limit) {
      return {
        passed: true,
        ruleId: 'hard_gross_weight',
        ruleType: 'hard_constraint',
        severity: 'error',
        message: 'Gross vehicle weight is within the legal limit.',
        affectedItems: [],
      };
    }

    const excess = Math.round(actual - limit);
    return {
      passed: false,
      ruleId: 'hard_gross_weight',
      ruleType: 'hard_constraint',
      severity: 'error',
      message: `Gross vehicle weight (${Math.round(actual)} lbs) exceeds the legal maximum of ${Math.round(limit)} lbs by ${excess} lbs.`,
      affectedItems: ctx.placedFreight.map((f) => f.item.orderNumber),
      threshold: limit,
      actual,
      suggestedAction: `Remove items totaling at least ${excess} lbs or select a trailer with a higher gross weight rating.`,
    };
  },
};

/** No single deck area exceeds concentrated load limit */
export const concentratedLoadRule: Rule = {
  id: 'hard_concentrated_load',
  name: 'Deck Concentrated Load Limit',
  type: 'hard_constraint',
  description: 'No single deck area may exceed the concentrated load limit (PSF).',
  isApplicable: (ctx) => ctx.placedFreight.length > 0,
  evaluate: (ctx) => {
    const { weightMetrics, trailer } = ctx;
    const limit = trailer.maxConcentratedLoadPSF;
    const actual = weightMetrics.maxConcentratedLoadPSF;

    if (actual <= limit) {
      return {
        passed: true,
        ruleId: 'hard_concentrated_load',
        ruleType: 'hard_constraint',
        severity: 'error',
        message: 'All deck areas are within the concentrated load limit.',
        affectedItems: [],
      };
    }

    return {
      passed: false,
      ruleId: 'hard_concentrated_load',
      ruleType: 'hard_constraint',
      severity: 'error',
      message: `A deck area has a concentrated load of ${Math.round(actual)} PSF, exceeding the trailer's ${Math.round(limit)} PSF rating.`,
      affectedItems: ctx.placedFreight.map((f) => f.item.orderNumber),
      threshold: limit,
      actual,
      suggestedAction: 'Spread heavy items over a larger area using dunnage or reposition items to distribute weight more evenly.',
    };
  },
};

/** Freight at later stops is accessible without moving freight for earlier stops */
export const stopOrderAccessibilityRule: Rule = {
  id: 'hard_stop_order',
  name: 'Delivery Stop Accessibility',
  type: 'hard_constraint',
  description: 'Freight at later stops must not block access to freight at earlier stops.',
  isApplicable: (ctx) => {
    const stops = new Set(ctx.placedFreight.map((f) => f.item.deliveryStop));
    return stops.size > 1;
  },
  evaluate: (ctx) => {
    const { placedFreight } = ctx;

    // Check that items for earlier stops are not blocked by later-stop items above them
    const violations: { blockedItem: string; blockingItem: string; blockedStop: number; blockingStop: number }[] = [];

    for (const item of placedFreight) {
      const itemStop = item.item.deliveryStop;

      // Find items stacked above this one that are for a LATER stop
      for (const other of placedFreight) {
        if (other === item) continue;
        if (other.item.deliveryStop <= itemStop) continue; // same or earlier stop is fine
        if (other.layer <= item.layer) continue; // not above

        // Check XY overlap (later-stop item is above earlier-stop item)
        if (doItemsOverlapXY(item, other)) {
          violations.push({
            blockedItem: item.item.orderNumber,
            blockingItem: other.item.orderNumber,
            blockedStop: itemStop,
            blockingStop: other.item.deliveryStop,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        passed: true,
        ruleId: 'hard_stop_order',
        ruleType: 'hard_constraint',
        severity: 'error',
        message: 'All delivery stops have proper unloading access.',
        affectedItems: [],
      };
    }

    const v = violations[0];
    return {
      passed: false,
      ruleId: 'hard_stop_order',
      ruleType: 'hard_constraint',
      severity: 'error',
      message: `Item "${v.blockingItem}" (stop ${v.blockingStop}) is stacked above item "${v.blockedItem}" (stop ${v.blockedStop}), blocking access for the earlier delivery.`,
      affectedItems: [...new Set(violations.flatMap((x) => [x.blockedItem, x.blockingItem]))],
      suggestedAction: 'Rearrange items so that earlier-stop freight is accessible from the top without moving later-stop freight.',
    };
  },
};

/** Cylindrical items have adequate anti-roll securement */
export const antiRollSecurementRule: Rule = {
  id: 'hard_anti_roll',
  name: 'Cylindrical Item Anti-Roll Securement',
  type: 'hard_constraint',
  description: 'Horizontal cylindrical items must have anti-roll securement (cradles, racks, or chocking).',
  isApplicable: (ctx) => {
    return ctx.placedFreight.some(
      (f) => f.geometry.type === 'horizontal_coil' || f.geometry.type === 'cylindrical_bundle'
    );
  },
  evaluate: (ctx) => {
    const cylindricalItems = ctx.placedFreight.filter(
      (f) => f.geometry.type === 'horizontal_coil' || f.geometry.type === 'cylindrical_bundle'
    );

    // Items without chock dimensions or cradle angle are not properly secured
    const unsecured = cylindricalItems.filter(
      (f) => !f.geometry.cradleAngle && !f.geometry.chockDimensions
    );

    if (unsecured.length === 0) {
      return {
        passed: true,
        ruleId: 'hard_anti_roll',
        ruleType: 'hard_constraint',
        severity: 'error',
        message: 'All cylindrical items have anti-roll securement.',
        affectedItems: [],
      };
    }

    const itemRefs = unsecured.map((f) => f.item.orderNumber);
    return {
      passed: false,
      ruleId: 'hard_anti_roll',
      ruleType: 'hard_constraint',
      severity: 'error',
      message: `${unsecured.length} cylindrical item(s) lack anti-roll securement: ${itemRefs.join(', ')}. Coils and round bundles must be secured with cradles, racks, or chocking.`,
      affectedItems: itemRefs,
      suggestedAction: 'Add coil racks, cradles, or chocks on both sides of each unsecured cylindrical item.',
    };
  },
};

/** No freight extends beyond trailer width or length boundaries */
export const boundaryViolationRule: Rule = {
  id: 'hard_boundary',
  name: 'Trailer Boundary Limits',
  type: 'hard_constraint',
  description: 'No freight may extend beyond the trailer width or length boundaries.',
  isApplicable: (ctx) => ctx.placedFreight.length > 0,
  evaluate: (ctx) => {
    const { placedFreight, trailer } = ctx;
    const trailerLengthIn = trailer.lengthFt * 12;
    const halfWidth = trailer.deckWidthIn / 2;

    const outOfBounds: string[] = [];

    for (const freight of placedFreight) {
      const xEnd = freight.position.x + freight.geometry.boundingBox.length;
      const yStart = freight.position.y;
      const yEnd = freight.position.y + freight.geometry.boundingBox.width;

      // Longitudinal: freight must fit between kingpin (x=0) and trailer end
      if (freight.position.x < 0 || xEnd > trailerLengthIn) {
        outOfBounds.push(freight.item.orderNumber);
        continue;
      }

      // Lateral: freight must fit within deck width (centered on y=0)
      // Position y is from centerline; deck extends from -halfWidth to +halfWidth
      if (yStart < -halfWidth || yEnd > halfWidth) {
        outOfBounds.push(freight.item.orderNumber);
      }
    }

    if (outOfBounds.length === 0) {
      return {
        passed: true,
        ruleId: 'hard_boundary',
        ruleType: 'hard_constraint',
        severity: 'error',
        message: 'All freight is within trailer boundaries.',
        affectedItems: [],
      };
    }

    const unique = [...new Set(outOfBounds)];
    return {
      passed: false,
      ruleId: 'hard_boundary',
      ruleType: 'hard_constraint',
      severity: 'error',
      message: `${unique.length} item(s) extend beyond the trailer boundaries: ${unique.join(', ')}. The trailer is ${trailer.lengthFt} ft long and ${trailer.deckWidthIn} inches wide.`,
      affectedItems: unique,
      threshold: trailerLengthIn,
      suggestedAction: 'Reposition or reorient items to fit within the deck area, or select a longer/wider trailer.',
    };
  },
};

// ─── Default Soft Preferences ────────────────────────────────────────────────

/** Heavier items placed lower in the stack */
export const heavierItemsLowerRule: Rule = {
  id: 'soft_heavier_lower',
  name: 'Heavier Items Lower',
  type: 'soft_preference',
  description: 'Heavier items should be placed lower in the stack for stability.',
  isApplicable: (ctx) => {
    // Only relevant if there are stacked items (layer > 0)
    return ctx.placedFreight.some((f) => f.layer > 0);
  },
  evaluate: (ctx) => {
    const { placedFreight } = ctx;
    const violations: { upperItem: string; lowerItem: string }[] = [];

    for (const upper of placedFreight) {
      if (upper.layer === 0) continue;

      // Find items directly below (lower layer, overlapping XY)
      for (const lower of placedFreight) {
        if (lower.layer >= upper.layer) continue;
        if (!doItemsOverlapXY(lower, upper)) continue;

        const upperWeight = upper.item.pieceWeight * upper.item.quantity;
        const lowerWeight = lower.item.pieceWeight * lower.item.quantity;

        if (upperWeight > lowerWeight) {
          violations.push({
            upperItem: upper.item.orderNumber,
            lowerItem: lower.item.orderNumber,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        passed: true,
        ruleId: 'soft_heavier_lower',
        ruleType: 'soft_preference',
        severity: 'warning',
        message: 'All heavier items are placed lower in the stack.',
        affectedItems: [],
      };
    }

    const v = violations[0];
    return {
      passed: false,
      ruleId: 'soft_heavier_lower',
      ruleType: 'soft_preference',
      severity: 'warning',
      message: `Item "${v.upperItem}" is heavier than item "${v.lowerItem}" below it. Placing heavier items lower improves load stability.`,
      affectedItems: [...new Set(violations.flatMap((x) => [x.upperItem, x.lowerItem]))],
      suggestedAction: 'Swap the positions of the heavier and lighter items so the heavier item is on the lower layer.',
    };
  },
};

/** Center of gravity positioned between 40% and 50% of trailer length from kingpin */
export const cgPositionRule: Rule = {
  id: 'soft_cg_position',
  name: 'Center of Gravity Position',
  type: 'soft_preference',
  description: 'The longitudinal center of gravity should be between 40% and 50% of trailer length from the kingpin.',
  isApplicable: (ctx) => ctx.placedFreight.length > 0,
  evaluate: (ctx) => {
    const { weightMetrics, trailer } = ctx;
    const trailerLengthIn = trailer.lengthFt * 12;
    const cgPosition = weightMetrics.cgLongitudinal;
    const cgPercent = (cgPosition / trailerLengthIn) * 100;

    const lowerBound = 40;
    const upperBound = 50;

    if (cgPercent >= lowerBound && cgPercent <= upperBound) {
      return {
        passed: true,
        ruleId: 'soft_cg_position',
        ruleType: 'soft_preference',
        severity: 'warning',
        message: `Center of gravity is at ${cgPercent.toFixed(1)}% of trailer length — within the ideal 40–50% range.`,
        affectedItems: [],
      };
    }

    const direction = cgPercent < lowerBound ? 'too far forward (toward cab)' : 'too far rearward';
    return {
      passed: false,
      ruleId: 'soft_cg_position',
      ruleType: 'soft_preference',
      severity: 'warning',
      message: `Center of gravity is at ${cgPercent.toFixed(1)}% of trailer length, which is ${direction}. The ideal range is 40–50%.`,
      affectedItems: ctx.placedFreight.map((f) => f.item.orderNumber),
      threshold: cgPercent < lowerBound ? lowerBound : upperBound,
      actual: cgPercent,
      suggestedAction: cgPercent < lowerBound
        ? 'Move heavier items slightly rearward to shift the center of gravity toward the 40–50% range.'
        : 'Move heavier items slightly forward to shift the center of gravity toward the 40–50% range.',
    };
  },
};

/** Left-to-right weight imbalance does not exceed 5% of total freight weight */
export const lateralImbalanceRule: Rule = {
  id: 'soft_lateral_imbalance',
  name: 'Lateral Weight Balance',
  type: 'soft_preference',
  description: 'Left-to-right weight imbalance should not exceed 5% of total freight weight.',
  isApplicable: (ctx) => ctx.placedFreight.length > 0,
  evaluate: (ctx) => {
    const { weightMetrics } = ctx;
    const threshold = 5; // percent
    const actual = weightMetrics.lateralImbalancePercent;

    if (actual <= threshold) {
      return {
        passed: true,
        ruleId: 'soft_lateral_imbalance',
        ruleType: 'soft_preference',
        severity: 'warning',
        message: `Lateral weight imbalance is ${actual.toFixed(1)}% — within the 5% tolerance.`,
        affectedItems: [],
      };
    }

    return {
      passed: false,
      ruleId: 'soft_lateral_imbalance',
      ruleType: 'soft_preference',
      severity: 'warning',
      message: `Lateral weight imbalance is ${actual.toFixed(1)}%, exceeding the 5% tolerance. The load is heavier on one side.`,
      affectedItems: ctx.placedFreight.map((f) => f.item.orderNumber),
      threshold,
      actual,
      suggestedAction: 'Redistribute items laterally so that weight is more evenly balanced between the left and right sides of the trailer.',
    };
  },
};

/** Dunnage placed between dissimilar metals */
export const dissimilarMetalsDunnageRule: Rule = {
  id: 'soft_dissimilar_metals_dunnage',
  name: 'Dunnage Between Dissimilar Metals',
  type: 'soft_preference',
  description: 'Dunnage should be placed between items of dissimilar metal types to prevent galvanic corrosion.',
  isApplicable: (ctx) => {
    // Only relevant if stacked items exist with different product types
    return ctx.placedFreight.some((f) => f.layer > 0);
  },
  evaluate: (ctx) => {
    const { placedFreight } = ctx;
    const violations: { upperItem: string; lowerItem: string }[] = [];

    for (const upper of placedFreight) {
      if (upper.layer === 0) continue;
      if (upper.supportMethod === 'on_dunnage') continue; // dunnage already present

      for (const lower of placedFreight) {
        if (lower.layer >= upper.layer) continue;
        if (!doItemsOverlapXY(lower, upper)) continue;

        // Check if product types are dissimilar (different base metal categories)
        if (areDissimilarMetals(lower.item.productType, upper.item.productType)) {
          violations.push({
            upperItem: upper.item.orderNumber,
            lowerItem: lower.item.orderNumber,
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        passed: true,
        ruleId: 'soft_dissimilar_metals_dunnage',
        ruleType: 'soft_preference',
        severity: 'warning',
        message: 'Dunnage is properly placed between all dissimilar metal pairs.',
        affectedItems: [],
      };
    }

    const v = violations[0];
    return {
      passed: false,
      ruleId: 'soft_dissimilar_metals_dunnage',
      ruleType: 'soft_preference',
      severity: 'warning',
      message: `Item "${v.upperItem}" is stacked directly on "${v.lowerItem}" without dunnage, but they are dissimilar metals. This can cause galvanic corrosion or surface damage.`,
      affectedItems: [...new Set(violations.flatMap((x) => [x.upperItem, x.lowerItem]))],
      suggestedAction: 'Insert dunnage (wood or rubber blocking) between the dissimilar metal items to prevent contact corrosion.',
    };
  },
};

// ─── Rule Evaluation Engine ──────────────────────────────────────────────────

/**
 * Evaluates all applicable rules against the given context.
 *
 * Returns the full results array and a `canApprove` flag that is `true`
 * only if no hard constraint violations (errors) exist.
 *
 * @param rules - Array of rules to evaluate
 * @param context - The rule context containing placement, equipment, and metrics
 * @returns Aggregated results and approval status
 */
export function evaluateAllRules(rules: Rule[], context: RuleContext): RuleEvaluationResult {
  const results: RuleResult[] = [];

  for (const rule of rules) {
    if (rule.isApplicable(context)) {
      results.push(rule.evaluate(context));
    }
  }

  // canApprove = no hard constraint violations (no errors)
  const canApprove = !results.some((r) => !r.passed && r.severity === 'error');

  return { results, canApprove };
}

// ─── Default Rule Set ────────────────────────────────────────────────────────

/** The complete set of default rules for the load planner */
export const defaultRules: Rule[] = [
  // Hard constraints
  axleOverweightRule,
  grossWeightRule,
  concentratedLoadRule,
  stopOrderAccessibilityRule,
  antiRollSecurementRule,
  boundaryViolationRule,
  // Soft preferences
  heavierItemsLowerRule,
  cgPositionRule,
  lateralImbalanceRule,
  dissimilarMetalsDunnageRule,
];

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Checks whether two placed freight items overlap in the X-Y plane (deck footprint).
 */
function doItemsOverlapXY(a: PlacedFreight, b: PlacedFreight): boolean {
  const aLeft = a.position.x;
  const aRight = a.position.x + a.geometry.boundingBox.length;
  const aBottom = a.position.y;
  const aTop = a.position.y + a.geometry.boundingBox.width;

  const bLeft = b.position.x;
  const bRight = b.position.x + b.geometry.boundingBox.length;
  const bBottom = b.position.y;
  const bTop = b.position.y + b.geometry.boundingBox.width;

  return aLeft < bRight && aRight > bLeft && aBottom < bTop && aTop > bBottom;
}

/**
 * Determines if two steel product types represent dissimilar metals
 * that require dunnage between them to prevent galvanic corrosion.
 *
 * Galvanized items are dissimilar to non-galvanized; carbon steel (hot-rolled)
 * is dissimilar to coated/galvanized products.
 */
function areDissimilarMetals(typeA: string, typeB: string): boolean {
  const galvanizedTypes = new Set(['coil_galvanized']);
  const coatedTypes = new Set(['coil_galvanized', 'roofing_sheet_bundle']);

  const aIsCoated = coatedTypes.has(typeA);
  const bIsCoated = coatedTypes.has(typeB);

  // If one is coated/galvanized and the other is not, they are dissimilar
  if (aIsCoated !== bIsCoated) {
    return true;
  }

  // Galvanized touching non-galvanized hot-rolled
  const aIsGalvanized = galvanizedTypes.has(typeA);
  const bIsGalvanized = galvanizedTypes.has(typeB);
  if (aIsGalvanized !== bIsGalvanized) {
    return true;
  }

  return false;
}
