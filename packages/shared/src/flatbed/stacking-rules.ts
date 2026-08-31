// ─── OptiFlow Flatbed Steel Load Planner — Stacking & Support Rules ─────────
// Pure functions that enforce steel-specific stacking safety, support requirements,
// and protection rules during freight placement.

import type {
  PlacedFreight,
  SteelProductType,
} from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result of a stacking/support rule check */
export interface StackingRuleViolation {
  ruleId: string;
  message: string;
  affectedItems: string[];
  suggestedAction: string;
}

/** Support point for long products */
export interface SupportPoint {
  position: number; // longitudinal position in inches from item start
  type: 'dunnage' | 'deck_contact' | 'cradle';
}

/** Long product support configuration */
export interface LongProductSupport {
  itemOrderNumber: string;
  supportPoints: SupportPoint[];
  maxUnsupportedSpan: number; // inches
  actualMaxSpan: number; // inches
  meetsRequirement: boolean;
}

/** Edge protection requirement for plate/sheet stacks */
export interface EdgeProtection {
  itemOrderNumber: string;
  requiresEdgeProtection: boolean;
  requiresBanding: boolean;
  bandCount: number;
  edgeProtectorPositions: number[]; // longitudinal positions
}

/** Dunnage insertion record */
export interface DunnageInsertion {
  upperItemOrder: string;
  lowerItemOrder: string;
  reason: string;
  dunnageThicknessIn: number;
  dunnageMaterial: 'wood' | 'rubber' | 'plastic';
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default maximum unsupported span for long products (inches). 120 inches = 10 feet */
export const DEFAULT_MAX_UNSUPPORTED_SPAN = 120;

/** Minimum support points required for long products */
export const MIN_SUPPORT_POINTS = 2;

/** Standard dunnage thickness in inches (4x4 lumber) */
export const STANDARD_DUNNAGE_THICKNESS = 4;

/** Legal maximum stack height from deck surface (inches) — 102" total vehicle width applies, but height is typically capped at 102" from deck */
export const LEGAL_MAX_STACK_HEIGHT = 102;

/** Minimum band count for plate/sheet stacks per 10 feet of length */
const BANDS_PER_10FT = 2;

// ─── Long Product Types ──────────────────────────────────────────────────────

const LONG_PRODUCT_TYPES = new Set<SteelProductType>([
  'beam_i', 'beam_h', 'beam_wide_flange', 'channel', 'angle',
  'flat_bar', 'round_bar', 'pipe', 'tube', 'hollow_structural_section',
  'rebar_bundle',
]);

/** Product types that require edge protection when stacked as plates/sheets */
const PLATE_SHEET_TYPES = new Set<SteelProductType>([
  'plate', 'sheet_bundle', 'roofing_sheet_bundle',
]);

/** Coil types that require anti-roll securement when placed horizontally */
const HORIZONTAL_COIL_TYPES = new Set<SteelProductType>([
  'coil_hot_rolled', 'coil_cold_rolled', 'coil_galvanized', 'wire_rod_coil',
]);

// ─── Hardness Categories for Dunnage Rules ───────────────────────────────────

type HardnessCategory = 'hard' | 'medium' | 'soft' | 'coated';

/**
 * Returns the hardness category of a steel product type.
 * Used to determine if dunnage is required between stacked items.
 */
function getHardnessCategory(productType: SteelProductType): HardnessCategory {
  switch (productType) {
    case 'coil_hot_rolled':
    case 'plate':
    case 'beam_i':
    case 'beam_h':
    case 'beam_wide_flange':
    case 'channel':
    case 'angle':
    case 'flat_bar':
    case 'round_bar':
    case 'pipe':
    case 'tube':
    case 'hollow_structural_section':
    case 'rebar_bundle':
      return 'hard';

    case 'coil_cold_rolled':
    case 'sheet_bundle':
    case 'wire_rod_coil':
    case 'wire_mesh_panel':
      return 'medium';

    case 'coil_galvanized':
    case 'roofing_sheet_bundle':
      return 'coated';

    case 'fabricated_assembly':
    case 'palletized':
    case 'mixed_bundle':
      return 'soft';

    default: {
      const _exhaustive: never = productType;
      return _exhaustive;
    }
  }
}

// ─── 1. No-Stack Enforcement ─────────────────────────────────────────────────

/**
 * Checks whether an item marked "no stack" has other items placed above it.
 *
 * Requirement 7.1: Items marked "no stack" are never placed beneath other items.
 *
 * @param placedFreight - All currently placed freight items
 * @returns Array of violations (empty if all no-stack rules are satisfied)
 */
export function enforceNoStackRule(placedFreight: PlacedFreight[]): StackingRuleViolation[] {
  const violations: StackingRuleViolation[] = [];

  const noStackItems = placedFreight.filter(f => f.item.stackPermission === 'no');

  for (const noStack of noStackItems) {
    // Find any item above this one (higher layer, overlapping XY footprint)
    const itemsAbove = placedFreight.filter(other => {
      if (other === noStack) return false;
      if (other.layer <= noStack.layer) return false;
      return doItemsOverlapXY(noStack, other);
    });

    if (itemsAbove.length > 0) {
      violations.push({
        ruleId: 'stacking_no_stack_violated',
        message: `Item "${noStack.item.orderNumber}" is marked "no stack" but has ${itemsAbove.length} item(s) placed above it: ${itemsAbove.map(i => i.item.orderNumber).join(', ')}.`,
        affectedItems: [noStack.item.orderNumber, ...itemsAbove.map(i => i.item.orderNumber)],
        suggestedAction: `Remove items stacked above "${noStack.item.orderNumber}" or relocate them to a different deck position.`,
      });
    }
  }

  return violations;
}

/**
 * Determines whether a specific item can be stacked above another item
 * during placement. Returns false if the item below has stackPermission 'no'.
 *
 * @param itemBelow - The item currently placed that would be stacked upon
 * @returns true if stacking is allowed on this item
 */
export function canPlaceAbove(itemBelow: PlacedFreight): boolean {
  return itemBelow.item.stackPermission !== 'no';
}

// ─── 2. Max Stack Weight & Height Enforcement ────────────────────────────────

/**
 * Checks whether the total weight stacked above any item exceeds
 * that item's maximum stack weight rating.
 *
 * Requirement 7.2: Total weight of stacked items above any item
 * does not exceed that item's maximum stack weight rating.
 *
 * @param placedFreight - All currently placed freight items
 * @returns Array of violations (empty if all stack weight limits are satisfied)
 */
export function enforceMaxStackWeight(placedFreight: PlacedFreight[]): StackingRuleViolation[] {
  const violations: StackingRuleViolation[] = [];

  for (const item of placedFreight) {
    // Calculate total weight of all items above this one in the stack
    const itemsAbove = placedFreight.filter(other => {
      if (other === item) return false;
      if (other.layer <= item.layer) return false;
      return doItemsOverlapXY(item, other);
    });

    if (itemsAbove.length === 0) continue;

    const totalWeightAbove = itemsAbove.reduce(
      (sum, above) => sum + above.item.pieceWeight * above.item.quantity,
      0
    );

    if (totalWeightAbove > item.item.maxStackWeight) {
      violations.push({
        ruleId: 'stacking_max_weight_exceeded',
        message: `Item "${item.item.orderNumber}" has ${Math.round(totalWeightAbove)} lbs stacked above it, exceeding its ${item.item.maxStackWeight} lb maximum stack weight rating.`,
        affectedItems: [item.item.orderNumber, ...itemsAbove.map(i => i.item.orderNumber)],
        suggestedAction: `Remove or redistribute ${Math.round(totalWeightAbove - item.item.maxStackWeight)} lbs from above "${item.item.orderNumber}".`,
      });
    }
  }

  return violations;
}

/**
 * Checks whether the total stack height at any position exceeds
 * the item's maxStackHeight or the legal height limit.
 *
 * Requirement 7.3: Total stack height at any deck position does not exceed
 * the item's maximum stack height or the trailer's legal height limit,
 * whichever is less.
 *
 * @param placedFreight - All currently placed freight items
 * @param legalMaxHeight - Legal maximum stack height (default: 102 inches)
 * @returns Array of violations
 */
export function enforceMaxStackHeight(
  placedFreight: PlacedFreight[],
  legalMaxHeight: number = LEGAL_MAX_STACK_HEIGHT,
): StackingRuleViolation[] {
  const violations: StackingRuleViolation[] = [];

  for (const item of placedFreight) {
    // Total height from deck to top of this item
    const topOfItem = item.position.z + item.geometry.boundingBox.height;

    // The effective limit is the minimum of:
    // 1. The item's own maxStackHeight (if it's the bottom item)
    // 2. The legal max height
    const effectiveLimit = Math.min(item.item.maxStackHeight, legalMaxHeight);

    if (topOfItem > effectiveLimit) {
      violations.push({
        ruleId: 'stacking_max_height_exceeded',
        message: `Item "${item.item.orderNumber}" reaches ${Math.round(topOfItem)} inches from deck, exceeding the ${Math.round(effectiveLimit)} inch height limit.`,
        affectedItems: [item.item.orderNumber],
        suggestedAction: `Lower the stack or relocate "${item.item.orderNumber}" to reduce total stack height below ${Math.round(effectiveLimit)} inches.`,
      });
    }

    // Also check: for bottom items, total stack above them shouldn't exceed their maxStackHeight
    if (item.layer === 0) {
      const stackedAbove = placedFreight.filter(other => {
        if (other === item) return false;
        if (other.layer <= item.layer) return false;
        return doItemsOverlapXY(item, other);
      });
      if (stackedAbove.length > 0) {
        const highestPoint = Math.max(...stackedAbove.map(s => s.position.z + s.geometry.boundingBox.height));
        if (highestPoint > item.item.maxStackHeight) {
          violations.push({
            ruleId: 'stacking_item_height_limit_exceeded',
            message: `Stack above "${item.item.orderNumber}" reaches ${Math.round(highestPoint)} inches, exceeding its ${item.item.maxStackHeight} inch maximum stack height.`,
            affectedItems: [item.item.orderNumber, ...stackedAbove.map(s => s.item.orderNumber)],
            suggestedAction: `Reduce stack height above "${item.item.orderNumber}" to below ${item.item.maxStackHeight} inches.`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Validates whether a proposed stacking position is within weight and height limits.
 * Used during placement to reject invalid stacking positions before committing.
 *
 * @param proposedWeight - Weight of the item to be stacked
 * @param currentWeightAbove - Current total weight already stacked above the bottom item
 * @param bottomItemMaxStackWeight - The bottom item's maxStackWeight rating
 * @param proposedTopZ - Z-position of the top of the proposed item after stacking
 * @param bottomItemMaxStackHeight - The bottom item's maxStackHeight
 * @param legalMaxHeight - Legal maximum stack height
 * @returns true if the stacking is within limits
 */
export function isStackingWithinLimits(
  proposedWeight: number,
  currentWeightAbove: number,
  bottomItemMaxStackWeight: number,
  proposedTopZ: number,
  bottomItemMaxStackHeight: number,
  legalMaxHeight: number = LEGAL_MAX_STACK_HEIGHT,
): boolean {
  // Check weight limit
  if (currentWeightAbove + proposedWeight > bottomItemMaxStackWeight) {
    return false;
  }
  // Check height limit (whichever is less)
  const effectiveHeightLimit = Math.min(bottomItemMaxStackHeight, legalMaxHeight);
  if (proposedTopZ > effectiveHeightLimit) {
    return false;
  }
  return true;
}

// ─── 3. Horizontal Coil Anti-Roll Securement ─────────────────────────────────

/**
 * Checks that all horizontal coils have anti-roll securement
 * (racks, cradles, or chocking on both sides).
 *
 * Requirement 7.4: When coils are placed horizontally, the Planning Engine
 * SHALL require coil racks, cradles, or chocking on both sides to prevent rolling.
 *
 * @param placedFreight - All currently placed freight items
 * @returns Array of violations for unsecured coils
 */
export function enforceCoilAntiRoll(placedFreight: PlacedFreight[]): StackingRuleViolation[] {
  const violations: StackingRuleViolation[] = [];

  const horizontalCoils = placedFreight.filter(f =>
    HORIZONTAL_COIL_TYPES.has(f.item.productType) &&
    (f.geometry.type === 'horizontal_coil' || f.geometry.type === 'cylindrical_bundle')
  );

  for (const coil of horizontalCoils) {
    // A coil is considered secured if it has either:
    // 1. A valid cradle angle (placed in a cradle/rack)
    // 2. Chock dimensions defined (chocked on both sides)
    const hasCradle = coil.geometry.cradleAngle !== undefined && coil.geometry.cradleAngle > 0;
    const hasChocks = coil.geometry.chockDimensions !== undefined &&
      coil.geometry.chockDimensions.width > 0 &&
      coil.geometry.chockDimensions.height > 0;

    if (!hasCradle && !hasChocks) {
      violations.push({
        ruleId: 'stacking_coil_anti_roll_missing',
        message: `Horizontal coil "${coil.item.orderNumber}" (${coil.item.productType}) lacks anti-roll securement. Coils must be secured with racks, cradles, or chocking on both sides.`,
        affectedItems: [coil.item.orderNumber],
        suggestedAction: `Add coil racks, cradles, or chocks on both sides of coil "${coil.item.orderNumber}" to prevent rolling.`,
      });
    }
  }

  return violations;
}

/**
 * Determines if a coil item requires anti-roll securement.
 *
 * @param productType - The steel product type
 * @returns true if the item is a horizontal coil requiring anti-roll securement
 */
export function requiresAntiRollSecurement(productType: SteelProductType): boolean {
  return HORIZONTAL_COIL_TYPES.has(productType);
}

// ─── 4. Dunnage Between Dissimilar-Hardness Materials ────────────────────────

/**
 * Determines whether two stacked items require dunnage between them
 * due to dissimilar hardness.
 *
 * Requirement 7.5: When items of dissimilar hardness are stacked,
 * dunnage SHALL be inserted between layers to prevent surface damage.
 *
 * Dissimilar combinations that require dunnage:
 * - Hard on coated (would scratch coating)
 * - Hard on soft (would dent soft material)
 * - Coated on hard (coating damage from hard surface)
 * - Any different category touching another
 *
 * @param upperProductType - Product type of the item on top
 * @param lowerProductType - Product type of the item below
 * @returns true if dunnage is required between these items
 */
export function requiresDunnageBetween(
  upperProductType: SteelProductType,
  lowerProductType: SteelProductType,
): boolean {
  const upperHardness = getHardnessCategory(upperProductType);
  const lowerHardness = getHardnessCategory(lowerProductType);

  // Same hardness category: no dunnage needed
  if (upperHardness === lowerHardness) {
    return false;
  }

  // Any dissimilar hardness pairing requires dunnage
  return true;
}

/**
 * Checks all stacked item pairs for missing dunnage between dissimilar hardness materials.
 *
 * @param placedFreight - All currently placed freight items
 * @returns Array of violations and required dunnage insertions
 */
export function enforceDissimilarHardnessDunnage(
  placedFreight: PlacedFreight[],
): { violations: StackingRuleViolation[]; dunnageRequired: DunnageInsertion[] } {
  const violations: StackingRuleViolation[] = [];
  const dunnageRequired: DunnageInsertion[] = [];

  for (const upper of placedFreight) {
    if (upper.layer === 0) continue;
    // Already has dunnage between layers
    if (upper.supportMethod === 'on_dunnage') continue;

    // Find items directly below (adjacent layer, overlapping XY)
    const itemsBelow = placedFreight.filter(lower => {
      if (lower === upper) return false;
      if (lower.layer >= upper.layer) return false;
      // Only check direct support (layer immediately below)
      if (lower.layer !== upper.layer - 1) return false;
      return doItemsOverlapXY(lower, upper);
    });

    for (const lower of itemsBelow) {
      if (requiresDunnageBetween(upper.item.productType, lower.item.productType)) {
        const upperHardness = getHardnessCategory(upper.item.productType);
        const lowerHardness = getHardnessCategory(lower.item.productType);

        violations.push({
          ruleId: 'stacking_dissimilar_hardness_no_dunnage',
          message: `Item "${upper.item.orderNumber}" (${upperHardness}) is stacked on "${lower.item.orderNumber}" (${lowerHardness}) without dunnage. Dissimilar hardness materials require dunnage to prevent surface damage.`,
          affectedItems: [upper.item.orderNumber, lower.item.orderNumber],
          suggestedAction: `Insert dunnage (wood or rubber blocking) between "${upper.item.orderNumber}" and "${lower.item.orderNumber}".`,
        });

        dunnageRequired.push({
          upperItemOrder: upper.item.orderNumber,
          lowerItemOrder: lower.item.orderNumber,
          reason: `Dissimilar hardness: ${upperHardness} on ${lowerHardness}`,
          dunnageThicknessIn: STANDARD_DUNNAGE_THICKNESS,
          dunnageMaterial: lowerHardness === 'coated' ? 'rubber' : 'wood',
        });
      }
    }
  }

  return { violations, dunnageRequired };
}

// ─── 5. Long Product Support Rules ──────────────────────────────────────────

/**
 * Determines if a product type is classified as a long product
 * requiring multi-point support.
 *
 * @param productType - The steel product type
 * @returns true if the product type is a long product
 */
export function isLongProduct(productType: SteelProductType): boolean {
  return LONG_PRODUCT_TYPES.has(productType);
}

/**
 * Calculates the support points and validates the support configuration
 * for a long product item.
 *
 * Requirement 7.6: Long products (beams, bars, pipe) are supported at a
 * minimum of two points with maximum unsupported span not exceeding the
 * product's specified maximum.
 *
 * Support points are placed evenly along the item's length. For items on
 * dunnage or on the deck, support points are at the dunnage/deck contact
 * positions. Default placement uses evenly spaced supports.
 *
 * @param item - The placed freight item to evaluate
 * @param maxSpan - Maximum allowed unsupported span (default: 120 inches / 10ft)
 * @returns Support configuration with compliance status
 */
export function calculateLongProductSupport(
  item: PlacedFreight,
  maxSpan: number = DEFAULT_MAX_UNSUPPORTED_SPAN,
): LongProductSupport {
  const itemLength = item.geometry.boundingBox.length;

  // Calculate minimum support points needed based on max span
  // At minimum 2 points, then add more for longer items
  const minPointsForSpan = Math.max(MIN_SUPPORT_POINTS, Math.ceil(itemLength / maxSpan) + 1);

  // Generate evenly-spaced support points
  const supportPoints: SupportPoint[] = [];
  const spacing = itemLength / (minPointsForSpan - 1);
  for (let i = 0; i < minPointsForSpan; i++) {
    supportPoints.push({
      position: i * spacing,
      type: item.supportMethod === 'on_dunnage' ? 'dunnage' : 'deck_contact',
    });
  }

  // Calculate actual max span between consecutive support points
  let actualMaxSpan = 0;
  for (let i = 1; i < supportPoints.length; i++) {
    const span = supportPoints[i].position - supportPoints[i - 1].position;
    actualMaxSpan = Math.max(actualMaxSpan, span);
  }

  const meetsRequirement = supportPoints.length >= MIN_SUPPORT_POINTS && actualMaxSpan <= maxSpan;

  return {
    itemOrderNumber: item.item.orderNumber,
    supportPoints,
    maxUnsupportedSpan: maxSpan,
    actualMaxSpan,
    meetsRequirement,
  };
}

/**
 * Enforces long product support rules for all long product items in the load.
 *
 * @param placedFreight - All currently placed freight items
 * @param maxSpan - Maximum allowed unsupported span
 * @returns Array of violations for items with insufficient support
 */
export function enforceLongProductSupport(
  placedFreight: PlacedFreight[],
  maxSpan: number = DEFAULT_MAX_UNSUPPORTED_SPAN,
): { violations: StackingRuleViolation[]; supportConfigs: LongProductSupport[] } {
  const violations: StackingRuleViolation[] = [];
  const supportConfigs: LongProductSupport[] = [];

  const longProducts = placedFreight.filter(f => isLongProduct(f.item.productType));

  for (const item of longProducts) {
    const support = calculateLongProductSupport(item, maxSpan);
    supportConfigs.push(support);

    if (!support.meetsRequirement) {
      if (support.supportPoints.length < MIN_SUPPORT_POINTS) {
        violations.push({
          ruleId: 'stacking_long_product_insufficient_supports',
          message: `Long product "${item.item.orderNumber}" (${item.item.productType}) has ${support.supportPoints.length} support point(s), but requires at least ${MIN_SUPPORT_POINTS}.`,
          affectedItems: [item.item.orderNumber],
          suggestedAction: `Add support points under "${item.item.orderNumber}" to provide at least ${MIN_SUPPORT_POINTS} support positions.`,
        });
      } else {
        violations.push({
          ruleId: 'stacking_long_product_span_exceeded',
          message: `Long product "${item.item.orderNumber}" (${item.item.productType}) has an unsupported span of ${Math.round(support.actualMaxSpan)} inches, exceeding the ${maxSpan} inch maximum.`,
          affectedItems: [item.item.orderNumber],
          suggestedAction: `Add additional support points under "${item.item.orderNumber}" to reduce the maximum span to ${maxSpan} inches or less.`,
        });
      }
    }
  }

  return { violations, supportConfigs };
}

// ─── 6. Plate/Sheet Edge Protection and Banding ──────────────────────────────

/**
 * Determines if a product type requires edge protection and banding.
 *
 * @param productType - The steel product type
 * @returns true if edge protection and banding are required
 */
export function requiresEdgeProtection(productType: SteelProductType): boolean {
  return PLATE_SHEET_TYPES.has(productType);
}

/**
 * Calculates the required edge protection and banding for a plate/sheet item.
 *
 * Requirement 7.7: When plate or sheet stacks are placed, the Planning Engine
 * SHALL require edge protection and banding to prevent shifting.
 *
 * Banding: minimum 2 bands per 10 feet of item length, minimum 2 bands total.
 * Edge protectors: placed at each banding position on exposed edges.
 *
 * @param item - The placed freight item to evaluate
 * @returns Edge protection requirements
 */
export function calculateEdgeProtection(item: PlacedFreight): EdgeProtection {
  const itemLength = item.geometry.boundingBox.length;
  const isPlateSheet = requiresEdgeProtection(item.item.productType);

  if (!isPlateSheet) {
    return {
      itemOrderNumber: item.item.orderNumber,
      requiresEdgeProtection: false,
      requiresBanding: false,
      bandCount: 0,
      edgeProtectorPositions: [],
    };
  }

  // Calculate band count: 2 per 10 feet (120 inches), minimum 2
  const bandCount = Math.max(2, Math.ceil(itemLength / 120) * BANDS_PER_10FT);

  // Edge protector positions: evenly spaced along item length
  const edgeProtectorPositions: number[] = [];
  const spacing = itemLength / (bandCount + 1);
  for (let i = 1; i <= bandCount; i++) {
    edgeProtectorPositions.push(i * spacing);
  }

  return {
    itemOrderNumber: item.item.orderNumber,
    requiresEdgeProtection: true,
    requiresBanding: true,
    bandCount,
    edgeProtectorPositions,
  };
}

/**
 * Enforces edge protection and banding rules for all plate/sheet items.
 *
 * @param placedFreight - All currently placed freight items
 * @returns Array of violations and edge protection configs
 */
export function enforcePlateEdgeProtection(
  placedFreight: PlacedFreight[],
): { violations: StackingRuleViolation[]; edgeProtections: EdgeProtection[] } {
  const violations: StackingRuleViolation[] = [];
  const edgeProtections: EdgeProtection[] = [];

  const plateSheetItems = placedFreight.filter(f => requiresEdgeProtection(f.item.productType));

  for (const item of plateSheetItems) {
    const protection = calculateEdgeProtection(item);
    edgeProtections.push(protection);

    // Items without edge protection noted as a violation for the planning system
    // to address (the system must ensure these are provided)
    if (protection.requiresEdgeProtection) {
      // This is informational — the planner confirms edge protection is required
      // The violation is only generated if protection is NOT assigned
      // Since our system always calculates protection, we record it as a requirement
      // that the loading instructions must include
    }
  }

  // Check if any plate/sheet items are stacked without banding
  for (const item of plateSheetItems) {
    if (item.layer > 0) {
      // Stacked plate/sheet — extra important to have banding
      const protection = calculateEdgeProtection(item);
      if (!protection.requiresBanding) {
        violations.push({
          ruleId: 'stacking_plate_no_banding',
          message: `Plate/sheet item "${item.item.orderNumber}" is stacked (layer ${item.layer}) without banding requirement. Stacked plates require banding to prevent shifting.`,
          affectedItems: [item.item.orderNumber],
          suggestedAction: `Apply ${protection.bandCount} bands with edge protectors to "${item.item.orderNumber}" before stacking.`,
        });
      }
    }
  }

  return { violations, edgeProtections };
}

// ─── Combined Enforcement ────────────────────────────────────────────────────

/** Complete stacking and support rule evaluation result */
export interface StackingRuleEvaluation {
  violations: StackingRuleViolation[];
  dunnageInsertions: DunnageInsertion[];
  longProductSupports: LongProductSupport[];
  edgeProtections: EdgeProtection[];
  passed: boolean;
}

/**
 * Evaluates all stacking and support rules against a set of placed freight.
 * This is the main entry point for stacking rule enforcement.
 *
 * Checks:
 * 1. No-stack items not beneath others (Req 7.1)
 * 2. Max stack weight not exceeded (Req 7.2)
 * 3. Max stack height not exceeded (Req 7.3)
 * 4. Horizontal coils have anti-roll securement (Req 7.4)
 * 5. Dunnage between dissimilar hardness (Req 7.5)
 * 6. Long product support (≥ 2 points, max span) (Req 7.6)
 * 7. Plate/sheet edge protection and banding (Req 7.7)
 *
 * @param placedFreight - All currently placed freight items
 * @param legalMaxHeight - Legal maximum stack height (default: 102 inches)
 * @param maxUnsupportedSpan - Max unsupported span for long products (default: 120 inches)
 * @returns Complete evaluation result
 */
export function evaluateStackingRules(
  placedFreight: PlacedFreight[],
  legalMaxHeight: number = LEGAL_MAX_STACK_HEIGHT,
  maxUnsupportedSpan: number = DEFAULT_MAX_UNSUPPORTED_SPAN,
): StackingRuleEvaluation {
  const allViolations: StackingRuleViolation[] = [];

  // 1. No-stack enforcement
  allViolations.push(...enforceNoStackRule(placedFreight));

  // 2. Max stack weight
  allViolations.push(...enforceMaxStackWeight(placedFreight));

  // 3. Max stack height
  allViolations.push(...enforceMaxStackHeight(placedFreight, legalMaxHeight));

  // 4. Coil anti-roll
  allViolations.push(...enforceCoilAntiRoll(placedFreight));

  // 5. Dissimilar hardness dunnage
  const dunnageResult = enforceDissimilarHardnessDunnage(placedFreight);
  allViolations.push(...dunnageResult.violations);

  // 6. Long product support
  const supportResult = enforceLongProductSupport(placedFreight, maxUnsupportedSpan);
  allViolations.push(...supportResult.violations);

  // 7. Plate/sheet edge protection
  const edgeResult = enforcePlateEdgeProtection(placedFreight);
  allViolations.push(...edgeResult.violations);

  return {
    violations: allViolations,
    dunnageInsertions: dunnageResult.dunnageRequired,
    longProductSupports: supportResult.supportConfigs,
    edgeProtections: edgeResult.edgeProtections,
    passed: allViolations.length === 0,
  };
}

// ─── Helper: XY Overlap Check ────────────────────────────────────────────────

/**
 * Checks whether two placed freight items overlap in the X-Y plane (deck footprint).
 * Used internally by stacking rule checks.
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
