// ─── OptiFlow Flatbed Steel Load Planner — Securement Planner ────────────────
// Pure functions for FMCSA tie-down calculations, securement type recommendations,
// coil-specific securement, and anchor point assignment with overflow detection.

import type {
  PlacedFreight,
  Position2D,
  SteelProductType,
  TrailerProfile,
} from './types';

// ─── Securement Types ────────────────────────────────────────────────────────

/** Classification of securement device */
export type SecurementType =
  | 'chain'
  | 'strap'
  | 'binder'
  | 'edge_protector'
  | 'coil_rack'
  | 'chock'
  | 'blocking';

/** A single tie-down applied to a freight item */
export interface TieDown {
  type: SecurementType;
  wll: number; // Working Load Limit in lbs
  anchorPointId?: string; // reference to trailer anchor point
  position: Position2D; // where on the item this tie-down is placed
}

/** Securement plan for a single freight item */
export interface SecurementPlan {
  itemOrderNumber: string;
  tieDowns: TieDown[];
  additionalSecurement: SecurementType[]; // edge protectors, blocking, etc.
  aggregateWLL: number;
  requiredWLL: number;
  meetsRequirements: boolean;
  notes: string[];
}

/** Overall securement assignment result for a full load */
export interface SecurementAssignment {
  plans: SecurementPlan[];
  anchorPointsUsed: number;
  anchorPointsAvailable: number;
  hasOverflow: boolean; // true if more anchor points needed than available
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Standard 3/8" Grade 70 chain WLL in lbs */
export const CHAIN_WLL = 4700;

/** Standard 4" flat hook strap WLL in lbs */
export const STRAP_WLL = 5400;

/** FMCSA tie-down interval: one tie-down per 10 feet (120 inches) of article length */
const TIE_DOWN_INTERVAL_INCHES = 120;

/** Minimum number of tie-downs per article per FMCSA */
const MIN_TIE_DOWNS = 2;

// ─── FMCSA Tie-Down Calculation ──────────────────────────────────────────────

/**
 * Calculates the minimum number of tie-downs required per FMCSA regulations.
 *
 * Rules:
 * - Minimum 2 tie-downs per article regardless of length
 * - For items over 10 feet (120 inches): ceil(length / 120)
 * - Take the max of these two values
 *
 * @param itemLength - Item length in inches
 * @param _itemWeight - Item weight in lbs (reserved for future weight-based rules)
 * @returns Minimum number of tie-downs required
 */
export function calculateMinTieDowns(itemLength: number, _itemWeight: number): number {
  if (itemLength <= 0) {
    return MIN_TIE_DOWNS;
  }

  const lengthBased = Math.ceil(itemLength / TIE_DOWN_INTERVAL_INCHES);
  return Math.max(MIN_TIE_DOWNS, lengthBased);
}

// ─── Working Load Limit Calculation ──────────────────────────────────────────

/**
 * Calculates the required aggregate Working Load Limit (WLL) for all tie-downs
 * securing a cargo item, per the FMCSA 50% rule.
 *
 * The aggregate WLL of all tie-downs must equal or exceed 50% of the cargo weight.
 *
 * @param cargoWeight - Weight of the cargo item in lbs
 * @returns Required aggregate WLL in lbs
 */
export function calculateRequiredWLL(cargoWeight: number): number {
  if (cargoWeight <= 0) {
    return 0;
  }
  return cargoWeight * 0.5;
}

// ─── Securement Type Recommendations ────────────────────────────────────────

/**
 * Determines the primary securement type for a given steel product type.
 *
 * Recommendations:
 * - Coils (hot_rolled, cold_rolled, galvanized, wire_rod): chains
 * - Plate, sheet_bundle: chains
 * - Rebar, pipe, tube, HSS: straps
 * - Beams, channels, angles: chains for heavy items (>5000 lbs), straps otherwise
 * - Palletized: straps
 * - All others: straps (default)
 *
 * @param productType - The steel product type
 * @param itemWeight - The item weight in lbs (used for beam threshold)
 * @returns The primary securement type to use
 */
export function recommendPrimarySecurement(
  productType: SteelProductType,
  itemWeight: number
): SecurementType {
  switch (productType) {
    // Coils — chains with binders
    case 'coil_hot_rolled':
    case 'coil_cold_rolled':
    case 'coil_galvanized':
    case 'wire_rod_coil':
      return 'chain';

    // Heavy plate and sheet bundles — chains
    case 'plate':
    case 'sheet_bundle':
      return 'chain';

    // Rebar, pipe, tube — straps with edge protectors
    case 'rebar_bundle':
    case 'pipe':
    case 'tube':
    case 'hollow_structural_section':
      return 'strap';

    // Structural beams — chains for heavy, straps for lighter
    case 'beam_i':
    case 'beam_h':
    case 'beam_wide_flange':
    case 'channel':
    case 'angle':
      return itemWeight > 5000 ? 'chain' : 'strap';

    // Bar stock
    case 'flat_bar':
    case 'round_bar':
      return 'strap';

    // Palletized
    case 'palletized':
      return 'strap';

    // Roofing sheets, wire mesh, fabricated, mixed
    case 'roofing_sheet_bundle':
    case 'wire_mesh_panel':
    case 'fabricated_assembly':
    case 'mixed_bundle':
      return 'strap';

    default: {
      const _exhaustive: never = productType;
      return _exhaustive;
    }
  }
}

/**
 * Determines additional securement devices needed beyond primary tie-downs.
 *
 * Rules:
 * - Coils: coil_rack + chock + blocking
 * - Plate, sheet_bundle: edge_protector
 * - Rebar, pipe, tube, HSS: edge_protector
 * - Palletized: edge_protector
 * - Beams/channels/angles with straps: edge_protector
 *
 * @param productType - The steel product type
 * @param primaryType - The primary securement type being used
 * @returns Array of additional securement types needed
 */
export function recommendAdditionalSecurement(
  productType: SteelProductType,
  primaryType: SecurementType
): SecurementType[] {
  switch (productType) {
    // Coils require specialized securement
    case 'coil_hot_rolled':
    case 'coil_cold_rolled':
    case 'coil_galvanized':
    case 'wire_rod_coil':
      return ['coil_rack', 'chock', 'blocking'];

    // Plate and sheet bundles need edge protection
    case 'plate':
    case 'sheet_bundle':
    case 'roofing_sheet_bundle':
      return ['edge_protector'];

    // Cylindrical items need edge protectors where straps contact edges
    case 'rebar_bundle':
    case 'pipe':
    case 'tube':
    case 'hollow_structural_section':
      return ['edge_protector'];

    // Structural shapes — edge protectors when using straps
    case 'beam_i':
    case 'beam_h':
    case 'beam_wide_flange':
    case 'channel':
    case 'angle':
      return primaryType === 'strap' ? ['edge_protector'] : [];

    // Bar stock with straps needs edge protection
    case 'flat_bar':
    case 'round_bar':
      return ['edge_protector'];

    // Palletized — edge protectors
    case 'palletized':
      return ['edge_protector'];

    // Wire mesh, fabricated, mixed — edge protectors
    case 'wire_mesh_panel':
    case 'fabricated_assembly':
    case 'mixed_bundle':
      return ['edge_protector'];

    default: {
      const _exhaustive: never = productType;
      return _exhaustive;
    }
  }
}

// ─── Coil-Specific Securement ────────────────────────────────────────────────

/**
 * Checks whether a product type is a coil requiring specialized securement.
 */
export function isCoilProduct(productType: SteelProductType): boolean {
  return (
    productType === 'coil_hot_rolled' ||
    productType === 'coil_cold_rolled' ||
    productType === 'coil_galvanized' ||
    productType === 'wire_rod_coil'
  );
}

/**
 * Generates coil-specific securement notes per FMCSA coil securement rules.
 *
 * For coils:
 * - Direct chain tie-down through the coil eye
 * - Blocking fore and aft to prevent longitudinal movement
 * - Chocking on both sides for horizontal-eye coils
 *
 * @param productType - The steel product type
 * @returns Array of securement instruction notes for coils (empty if not a coil)
 */
export function generateCoilSecurementNotes(productType: SteelProductType): string[] {
  if (!isCoilProduct(productType)) {
    return [];
  }

  return [
    'Chain tie-down through coil eye required',
    'Blocking required fore and aft to prevent longitudinal movement',
    'Chocking required on both sides to prevent rolling',
    'Coil rack or cradle required for support',
  ];
}

// ─── Single Item Securement Plan ─────────────────────────────────────────────

/**
 * Generates a SecurementPlan for a single placed freight item.
 *
 * @param freight - The placed freight item
 * @returns A complete SecurementPlan for the item
 */
export function generateItemSecurementPlan(freight: PlacedFreight): SecurementPlan {
  const { item, position, geometry } = freight;
  const itemLength = geometry.boundingBox.length;
  const itemWeight = item.totalLineWeight;

  // Calculate FMCSA requirements
  const minTieDowns = calculateMinTieDowns(itemLength, itemWeight);
  const requiredWLL = calculateRequiredWLL(itemWeight);

  // Determine securement types
  const primaryType = recommendPrimarySecurement(item.productType, itemWeight);
  const additionalSecurement = recommendAdditionalSecurement(item.productType, primaryType);

  // Determine WLL per tie-down based on type
  const wllPerTieDown = primaryType === 'chain' ? CHAIN_WLL : STRAP_WLL;

  // Ensure enough tie-downs to meet WLL requirement
  const tieDownsForWLL = Math.ceil(requiredWLL / wllPerTieDown);
  const totalTieDowns = Math.max(minTieDowns, tieDownsForWLL);

  // Generate tie-down positions distributed evenly along the item
  const tieDowns: TieDown[] = [];
  for (let i = 0; i < totalTieDowns; i++) {
    const fraction = totalTieDowns === 1 ? 0.5 : i / (totalTieDowns - 1);
    const xOffset = itemLength * fraction;

    tieDowns.push({
      type: primaryType,
      wll: wllPerTieDown,
      position: {
        x: position.x + xOffset,
        y: position.y,
      },
    });
  }

  // Calculate aggregate WLL
  const aggregateWLL = tieDowns.reduce((sum, td) => sum + td.wll, 0);

  // Generate notes
  const notes: string[] = [];
  if (isCoilProduct(item.productType)) {
    notes.push(...generateCoilSecurementNotes(item.productType));
  }
  if (additionalSecurement.includes('edge_protector')) {
    notes.push('Edge protectors required where tie-downs contact sharp edges');
  }

  return {
    itemOrderNumber: item.orderNumber,
    tieDowns,
    additionalSecurement,
    aggregateWLL,
    requiredWLL,
    meetsRequirements: aggregateWLL >= requiredWLL,
    notes,
  };
}

// ─── Anchor Point Assignment ─────────────────────────────────────────────────

/**
 * Finds the nearest available anchor point to a given position.
 *
 * @param position - The target position to find an anchor point for
 * @param anchorPoints - All available anchor points on the trailer
 * @param usedIndices - Set of already-used anchor point indices
 * @returns The index of the nearest available anchor point, or -1 if none available
 */
function findNearestAnchorPoint(
  position: Position2D,
  anchorPoints: Position2D[],
  usedIndices: Set<number>
): number {
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < anchorPoints.length; i++) {
    if (usedIndices.has(i)) continue;

    const dx = anchorPoints[i].x - position.x;
    const dy = anchorPoints[i].y - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Assigns anchor points to tie-downs and detects overflow when more
 * anchor points are needed than available on the trailer.
 *
 * @param plans - Array of securement plans (one per item)
 * @param trailer - The trailer profile with anchor point positions
 * @returns SecurementAssignment with anchor assignments and overflow status
 */
export function assignAnchorPoints(
  plans: SecurementPlan[],
  trailer: TrailerProfile
): SecurementAssignment {
  const anchorPoints = trailer.anchorPoints;
  const usedIndices = new Set<number>();
  let totalTieDownsNeeded = 0;

  // Assign anchor points to each tie-down in each plan
  for (const plan of plans) {
    for (const tieDown of plan.tieDowns) {
      totalTieDownsNeeded++;
      const nearestIdx = findNearestAnchorPoint(tieDown.position, anchorPoints, usedIndices);

      if (nearestIdx >= 0) {
        usedIndices.add(nearestIdx);
        tieDown.anchorPointId = `anchor-${nearestIdx}`;
      }
      // If no anchor point available, leave anchorPointId undefined (overflow)
    }
  }

  return {
    plans,
    anchorPointsUsed: usedIndices.size,
    anchorPointsAvailable: anchorPoints.length,
    hasOverflow: totalTieDownsNeeded > anchorPoints.length,
  };
}

// ─── Full Securement Assignment ──────────────────────────────────────────────

/**
 * Generates a complete securement assignment for all placed freight on a trailer.
 *
 * This is the main entry point that:
 * 1. Generates individual securement plans for each freight item
 * 2. Assigns anchor points with nearest-match algorithm
 * 3. Detects anchor point overflow
 *
 * @param placedFreight - Array of all placed freight items
 * @param trailer - The trailer profile with anchor points
 * @returns Complete SecurementAssignment with all plans and overflow status
 */
export function assignSecurement(
  placedFreight: PlacedFreight[],
  trailer: TrailerProfile
): SecurementAssignment {
  // Generate individual securement plans
  const plans = placedFreight.map((freight) => generateItemSecurementPlan(freight));

  // Assign anchor points and detect overflow
  return assignAnchorPoints(plans, trailer);
}
