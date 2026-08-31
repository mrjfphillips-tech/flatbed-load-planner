// ─── OptiFlow Flatbed Steel Load Planner — Planning Engine ───────────────────
// Deterministic heuristic placement algorithm for flatbed steel loads.
// Same inputs always produce identical outputs.

import type {
  EquipmentCombination,
  LoadPattern,
  Orientation,
  PlacedFreight,
  Position3D,
  SteelOrderLineItem,
  SupportMethod,
  TractorProfile,
  TrailerProfile,
  FreightGeometry,
} from './types';
import type { WeightMetrics } from './weight';
import type { Rule, RuleContext, RuleResult, RuleEvaluationResult } from './rules';
import type { SecurementAssignment } from './securement';
import { assignGeometricType, calculateContactFootprint, calculateCradleAngle, calculateChockDimensions } from './geometry';
import { calculateWeightMetrics } from './weight';
import { evaluateAllRules, defaultRules } from './rules';
import { assignSecurement } from './securement';
import { evaluateStackingRules, requiresDunnageBetween, isStackingWithinLimits } from './stacking-rules';
import type { StackingRuleEvaluation } from './stacking-rules';

// ─── Plan Request/Result Interfaces ──────────────────────────────────────────

/** Input to the planning engine */
export interface PlanRequest {
  items: SteelOrderLineItem[];
  trailer: TrailerProfile;
  tractor: TractorProfile;
  equipment: EquipmentCombination;
  rules?: Rule[];
  patternOverride?: LoadPattern;
}

/** Output of the planning engine */
export interface PlanResult {
  success: boolean;
  placedFreight: PlacedFreight[];
  unplacedItems: SteelOrderLineItem[];
  weightMetrics: WeightMetrics;
  securement: SecurementAssignment;
  loadingSequence: number[];
  detectedPattern: LoadPattern;
  ruleResults: RuleResult[];
  stackingEvaluation: StackingRuleEvaluation;
  canApprove: boolean;
  warnings: string[];
}

// ─── Load Pattern Detection ──────────────────────────────────────────────────

/** Long product types that qualify for the long_product pattern */
const LONG_PRODUCT_TYPES = new Set([
  'beam_i', 'beam_h', 'beam_wide_flange', 'channel', 'angle',
  'flat_bar', 'round_bar', 'pipe', 'tube', 'hollow_structural_section',
  'rebar_bundle',
]);

/** Product types that produce cylindrical geometry (candidates for nesting) */
const CYLINDRICAL_TYPES = new Set([
  'pipe', 'tube', 'hollow_structural_section', 'rebar_bundle',
  'coil_hot_rolled', 'coil_cold_rolled', 'coil_galvanized', 'wire_rod_coil',
]);

/**
 * Detects the most appropriate load pattern for a given set of freight items.
 *
 * Detection logic (evaluated in priority order):
 * 1. If >80% items are long products → long_product
 * 2. If all items are same geometric type and stackable → layered
 * 3. If items grouped by customer stop with distinct zones → customer_zoning
 * 4. If items vary in type but include nested cylindrical items → nested
 * 5. If mostly rectangular/plate items of similar size → column_building or row_building
 * 6. Otherwise → mixed
 *
 * @param items - The freight items to analyze
 * @returns The detected load pattern
 */
export function detectLoadPattern(items: SteelOrderLineItem[]): LoadPattern {
  if (items.length === 0) {
    return 'mixed';
  }

  // Check for long_product pattern (>80% long products)
  const longProductCount = items.filter((item) => LONG_PRODUCT_TYPES.has(item.productType)).length;
  if (longProductCount / items.length > 0.8) {
    return 'long_product';
  }

  // Check for customer_zoning (multiple distinct delivery stops) — checked before
  // layered because customer zoning is a stronger organizational signal
  const stops = new Set(items.map((item) => item.deliveryStop));
  if (stops.size >= 3) {
    return 'customer_zoning';
  }

  // Check for layered pattern (all same geometric type, same product type, and stackable)
  const geometricTypes = new Set(items.map((item) => assignGeometricType(item.productType)));
  const productTypes = new Set(items.map((item) => item.productType));
  const allStackable = items.every((item) => item.stackPermission !== 'no');
  if (geometricTypes.size === 1 && productTypes.size === 1 && allStackable) {
    return 'layered';
  }

  // Check for nested pattern (cylindrical items present among varying types)
  const cylindricalCount = items.filter((item) => CYLINDRICAL_TYPES.has(item.productType)).length;
  if (cylindricalCount > 0 && geometricTypes.size > 1) {
    return 'nested';
  }

  // Check for column_building or row_building (mostly rectangular/plate of similar size)
  const rectangularTypes = new Set(['rectangular', 'plate_stack', 'long_rectangular_bundle']);
  const rectCount = items.filter((item) => rectangularTypes.has(assignGeometricType(item.productType))).length;
  if (rectCount / items.length > 0.7) {
    // Use aspect ratio to distinguish: if items are wider than tall → row_building
    const avgAspect = items.reduce((sum, item) => sum + item.dimensions.width / item.dimensions.height, 0) / items.length;
    return avgAspect > 2 ? 'row_building' : 'column_building';
  }

  return 'mixed';
}

// ─── Geometry Builder ────────────────────────────────────────────────────────

/**
 * Builds a complete FreightGeometry for a line item based on its product type
 * and physical dimensions.
 */
function buildGeometry(item: SteelOrderLineItem): FreightGeometry {
  const geoType = assignGeometricType(item.productType);
  const { length, width, height } = item.dimensions;

  // For cylindrical items, height represents diameter
  const boundingBox = { length, width, height };

  // Build a basic geometry to calculate footprint
  const baseGeometry: FreightGeometry = {
    type: geoType,
    boundingBox,
    contactFootprint: { area: 0, shape: 'rectangle' },
    centerOfMass: { x: length / 2, y: width / 2, z: height / 2 },
  };

  // Calculate contact footprint
  const footprintArea = calculateContactFootprint(baseGeometry);
  const footprintShape = geoType === 'vertical_coil' ? 'circle' as const :
    (geoType === 'cylindrical_bundle' || geoType === 'horizontal_coil') ? 'line' as const :
    'rectangle' as const;

  baseGeometry.contactFootprint = { area: footprintArea, shape: footprintShape };

  // Add cradle angle and chock dimensions for cylindrical items
  if (geoType === 'horizontal_coil') {
    const diameter = height; // for coils, height = diameter
    const cradleWidth = diameter * 0.6; // standard cradle width = 60% of diameter
    baseGeometry.cradleAngle = calculateCradleAngle(diameter, cradleWidth);
    baseGeometry.chockDimensions = calculateChockDimensions(diameter);
  } else if (geoType === 'cylindrical_bundle') {
    const diameter = height;
    const cradleWidth = diameter * 0.6;
    baseGeometry.cradleAngle = calculateCradleAngle(diameter, cradleWidth);
  }

  return baseGeometry;
}

// ─── Placement Heuristic ─────────────────────────────────────────────────────

/**
 * Determines the effective length and width of an item given its orientation.
 */
function getOrientedDimensions(item: SteelOrderLineItem, orientation: Orientation): { effectiveLength: number; effectiveWidth: number } {
  if (orientation === 'longitudinal') {
    return { effectiveLength: item.dimensions.length, effectiveWidth: item.dimensions.width };
  }
  // Transverse: swap length and width
  return { effectiveLength: item.dimensions.width, effectiveWidth: item.dimensions.length };
}

/**
 * Chooses the best orientation for an item on the trailer.
 * Respects orientation requirements; if 'any', prefers longitudinal for long items.
 */
function chooseOrientation(item: SteelOrderLineItem, trailerDeckWidthIn: number): Orientation {
  if (item.orientationRequirement === 'longitudinal') return 'longitudinal';
  if (item.orientationRequirement === 'transverse') return 'transverse';

  // For 'any': use longitudinal if item length > deck width, or if it's a long product
  if (item.dimensions.length > trailerDeckWidthIn) return 'longitudinal';
  if (LONG_PRODUCT_TYPES.has(item.productType)) return 'longitudinal';

  return 'longitudinal'; // default
}

/** Represents an occupied region on the deck */
interface DeckSlot {
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  item: SteelOrderLineItem;
  layer: number;
}

/**
 * Checks if a proposed position overlaps with any existing placement in XY.
 */
function overlapsXY(
  x: number, y: number, length: number, width: number,
  existing: DeckSlot[]
): DeckSlot[] {
  const overlapping: DeckSlot[] = [];
  for (const slot of existing) {
    const noOverlap =
      x >= slot.x + slot.length ||
      x + length <= slot.x ||
      y >= slot.y + slot.width ||
      y + width <= slot.y;
    if (!noOverlap) {
      overlapping.push(slot);
    }
  }
  return overlapping;
}

/**
 * Determines if an item can be stacked on top of existing items at a position.
 * Returns the z-position and layer if stacking is valid, or null if not.
 * 
 * Enforces:
 * - No-stack items cannot have items placed above them (Req 7.1)
 * - Max stack weight limits (Req 7.2)
 * - Max stack height limits (Req 7.3)
 * - Dunnage insertion for dissimilar hardness materials (Req 7.5)
 */
function canStackAt(
  item: SteelOrderLineItem,
  _x: number, _y: number, _length: number, _width: number, itemHeight: number,
  overlapping: DeckSlot[],
  allSlots: DeckSlot[],
  maxTrailerHeight: number
): { z: number; layer: number; supportMethod: SupportMethod } | null {
  if (overlapping.length === 0) {
    return { z: 0, layer: 0, supportMethod: item.dunnageRequired ? 'on_dunnage' : 'direct_to_deck' };
  }

  // Check if the items below allow stacking (Req 7.1: no-stack enforcement)
  // ANY overlapping item marked "no stack" prevents placing items above
  for (const below of overlapping) {
    if (below.item.stackPermission === 'no') return null;
  }

  const topLayer = Math.max(...overlapping.map((s) => s.layer));
  const topItems = overlapping.filter((s) => s.layer === topLayer);

  // Calculate total weight above EVERY overlapping item (Req 7.2)
  // Property 10 requires: for any item, cumulative weight above ≤ item.maxStackWeight
  const newWeight = item.pieceWeight * item.quantity;
  const maxZ = Math.max(...overlapping.map((s) => s.z + s.height));
  const proposedTopZ = maxZ + itemHeight;

  for (const below of overlapping) {
    // Sum weight of all items above this specific item (higher layer AND overlapping with it)
    // Use allSlots to find ALL items above 'below', not just those overlapping with the new item
    const weightAboveThis = allSlots
      .filter(s => s.layer > below.layer && !(
        s.x >= below.x + below.length ||
        s.x + s.length <= below.x ||
        s.y >= below.y + below.width ||
        s.y + s.width <= below.y
      ))
      .reduce((sum, s) => sum + s.item.pieceWeight * s.item.quantity, 0);

    // Check if adding the new item would exceed this item's maxStackWeight
    if (!isStackingWithinLimits(
      newWeight,
      weightAboveThis,
      below.item.maxStackWeight,
      proposedTopZ,
      below.item.maxStackHeight,
      maxTrailerHeight,
    )) {
      return null;
    }
  }

  // Calculate z position (top of highest overlapping item) — reuse maxZ from above
  const newZ = maxZ;

  // Determine support method — check if dunnage is needed for dissimilar hardness (Req 7.5)
  let supportMethod: SupportMethod = 'on_prior_layer';

  // Check if any item directly below has dissimilar hardness
  const needsDunnage = item.dunnageRequired || topItems.some(below =>
    requiresDunnageBetween(item.productType, below.item.productType)
  );
  if (needsDunnage) {
    supportMethod = 'on_dunnage';
  }

  return {
    z: newZ,
    layer: topLayer + 1,
    supportMethod,
  };
}

/**
 * Main deterministic placement heuristic.
 *
 * Priority order:
 * 1. Stop-order accessibility (last stop loaded first, placed toward rear)
 * 2. Hard constraints (boundary, weight)
 * 3. Weight distribution optimization (keep CG in 40-50% zone)
 * 4. Steel stacking/support rules
 * 5. Soft preferences
 * 6. Minimize unused space
 *
 * Sorting: deliveryStop DESC (last stop first = loaded first = behind),
 *          then weight DESC (heavier items placed first for stability)
 */
function placeItems(
  items: SteelOrderLineItem[],
  trailer: TrailerProfile,
  _tractor: TractorProfile,
  _equipment: EquipmentCombination
): { placed: PlacedFreight[]; unplaced: SteelOrderLineItem[] } {
  const trailerLengthIn = trailer.lengthFt * 12;
  const halfWidth = trailer.deckWidthIn / 2;
  // Standard legal max height from ground for flatbed: 102 inches from deck (approximation)
  const maxStackableHeight = 102;

  // Sort items: deliveryStop DESC, then weight DESC for determinism
  const sortedItems = [...items].sort((a, b) => {
    if (b.deliveryStop !== a.deliveryStop) return b.deliveryStop - a.deliveryStop;
    const aWeight = a.pieceWeight * a.quantity;
    const bWeight = b.pieceWeight * b.quantity;
    if (bWeight !== aWeight) return bWeight - aWeight;
    // Tie-break by order number for determinism
    return a.orderNumber.localeCompare(b.orderNumber);
  });

  const occupiedSlots: DeckSlot[] = [];
  const placedFreight: PlacedFreight[] = [];
  const unplacedItems: SteelOrderLineItem[] = [];

  // Target CG zone: 40-50% of trailer length from kingpin
  const cgTargetMin = trailerLengthIn * 0.4;
  const cgTargetMax = trailerLengthIn * 0.5;
  const cgTargetCenter = (cgTargetMin + cgTargetMax) / 2;

  for (const item of sortedItems) {
    const orientation = chooseOrientation(item, trailer.deckWidthIn);
    const { effectiveLength, effectiveWidth } = getOrientedDimensions(item, orientation);
    const itemHeight = item.dimensions.height;
    const geometry = buildGeometry(item);

    // Adjust bounding box for orientation
    if (orientation === 'transverse') {
      geometry.boundingBox = {
        length: item.dimensions.width,
        width: item.dimensions.length,
        height: item.dimensions.height,
      };
      geometry.centerOfMass = {
        x: item.dimensions.width / 2,
        y: item.dimensions.length / 2,
        z: item.dimensions.height / 2,
      };
    }

    let bestPosition: { x: number; y: number; z: number; layer: number; supportMethod: SupportMethod; score: number } | null = null;

    // Scan positions on the deck in a grid pattern
    // Start from rear of trailer (higher x = rear), scan forward
    const xStep = Math.max(6, Math.floor(effectiveLength / 4)); // 6-inch increments or item/4
    const yStep = Math.max(6, Math.floor(effectiveWidth / 4));

    for (let x = trailerLengthIn - effectiveLength; x >= 0; x -= xStep) {
      for (let y = -halfWidth; y + effectiveWidth <= halfWidth; y += yStep) {
        // Check boundary constraints
        if (x < 0 || x + effectiveLength > trailerLengthIn) continue;
        if (y < -halfWidth || y + effectiveWidth > halfWidth) continue;

        // Check overlaps
        const overlapping = overlapsXY(x, y, effectiveLength, effectiveWidth, occupiedSlots);

        let placement: { z: number; layer: number; supportMethod: SupportMethod } | null;

        if (overlapping.length === 0) {
          // Direct placement on deck
          placement = {
            z: 0,
            layer: 0,
            supportMethod: item.dunnageRequired ? 'on_dunnage' : 'direct_to_deck',
          };
        } else {
          // Try stacking
          placement = canStackAt(item, x, y, effectiveLength, effectiveWidth, itemHeight, overlapping, occupiedSlots, maxStackableHeight);
        }

        if (!placement) continue;

        // Check stop-order accessibility: items for earlier stops should not be
        // placed BELOW items for later stops at the same XY position
        let stopViolation = false;
        if (placement.layer > 0) {
          for (const below of overlapping) {
            if (below.item.deliveryStop < item.deliveryStop) {
              // We're stacking a later-stop item on top of an earlier-stop item = OK
              // (earlier stop items need to be accessible from top)
              // Actually this IS a violation: the later-stop item blocks the earlier-stop item
              stopViolation = true;
              break;
            }
          }
        }
        if (stopViolation) continue;

        // Score this position (lower is better)
        // Factor 1: CG optimization — prefer positions near the CG target
        const itemCGx = x + effectiveLength / 2;
        const cgDistance = Math.abs(itemCGx - cgTargetCenter);
        const cgScore = cgDistance / trailerLengthIn;

        // Factor 2: Prefer lower layers (more stable)
        const layerScore = placement.layer * 0.3;

        // Factor 3: Prefer centered lateral placement (reduce imbalance)
        const lateralCenter = y + effectiveWidth / 2;
        const lateralScore = Math.abs(lateralCenter) / halfWidth * 0.2;

        // Factor 4: Minimize gaps — prefer positions adjacent to existing items or at rear
        const rearProximity = (trailerLengthIn - x) / trailerLengthIn * 0.1;

        const totalScore = cgScore + layerScore + lateralScore - rearProximity;

        if (!bestPosition || totalScore < bestPosition.score) {
          bestPosition = { x, y, z: placement.z, layer: placement.layer, supportMethod: placement.supportMethod, score: totalScore };
        }
      }
    }

    if (bestPosition) {
      const position: Position3D = {
        x: bestPosition.x,
        y: bestPosition.y,
        z: bestPosition.z,
      };

      const placed: PlacedFreight = {
        item,
        geometry,
        position,
        orientation,
        supportMethod: bestPosition.supportMethod,
        layer: bestPosition.layer,
      };

      placedFreight.push(placed);
      occupiedSlots.push({
        x: bestPosition.x,
        y: bestPosition.y,
        z: bestPosition.z,
        length: effectiveLength,
        width: effectiveWidth,
        height: itemHeight,
        item,
        layer: bestPosition.layer,
      });
    } else {
      unplacedItems.push(item);
    }
  }

  return { placed: placedFreight, unplaced: unplacedItems };
}

// ─── Loading Sequence Generation ─────────────────────────────────────────────

/**
 * Generates the loading sequence — the order items should be physically placed
 * on the trailer. Items on layer 0 placed first (from rear to front),
 * then layer 1, etc. Within a layer, rear items first.
 *
 * Returns an array of indices into the placedFreight array.
 */
function generateLoadingSequence(placedFreight: PlacedFreight[]): number[] {
  const indexed = placedFreight.map((pf, idx) => ({ pf, idx }));

  // Sort by layer ASC (lower layers first), then x DESC (rear first)
  indexed.sort((a, b) => {
    if (a.pf.layer !== b.pf.layer) return a.pf.layer - b.pf.layer;
    if (b.pf.position.x !== a.pf.position.x) return b.pf.position.x - a.pf.position.x;
    // Tie-break by y for determinism
    return a.pf.position.y - b.pf.position.y;
  });

  return indexed.map((entry) => entry.idx);
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Generates a complete load plan for the given request.
 *
 * This is a deterministic heuristic — same inputs always produce identical outputs.
 * It does NOT perform optimization search; it uses a greedy approach that respects
 * the priority order defined in the requirements.
 *
 * @param request - The plan request with items, equipment, trailer, tractor, and rules
 * @returns A complete PlanResult with placement, metrics, securement, and loading sequence
 */
export function generateLoadPlan(request: PlanRequest): PlanResult {
  const { items, trailer, tractor, equipment, patternOverride } = request;
  const rules = request.rules ?? defaultRules;

  // Empty request — return empty success
  if (items.length === 0) {
    const emptyMetrics = calculateWeightMetrics([], equipment, trailer, tractor);
    const emptySecurement = assignSecurement([], trailer);
    return {
      success: true,
      placedFreight: [],
      unplacedItems: [],
      weightMetrics: emptyMetrics,
      securement: emptySecurement,
      loadingSequence: [],
      detectedPattern: 'mixed',
      ruleResults: [],
      stackingEvaluation: { violations: [], dunnageInsertions: [], longProductSupports: [], edgeProtections: [], passed: true },
      canApprove: true,
      warnings: [],
    };
  }

  // Step 1: Detect load pattern (or use override)
  const detectedPattern = patternOverride ?? detectLoadPattern(items);

  // Step 2: Place items using the deterministic heuristic
  const { placed, unplaced } = placeItems(items, trailer, tractor, equipment);

  // Step 3: Calculate weight metrics for the placed freight
  const weightMetrics = calculateWeightMetrics(placed, equipment, trailer, tractor);

  // Step 4: Evaluate all rules
  const ruleContext: RuleContext = {
    placedFreight: placed,
    equipment,
    trailer,
    tractor,
    weightMetrics,
  };
  const ruleEvaluation: RuleEvaluationResult = evaluateAllRules(rules, ruleContext);

  // Step 5: Assign securement
  const securement = assignSecurement(placed, trailer);

  // Step 6: Generate loading sequence
  const loadingSequence = generateLoadingSequence(placed);

  // Step 7: Evaluate stacking and support rules
  const stackingEvaluation = evaluateStackingRules(placed);

  // Step 8: Collect warnings
  const warnings: string[] = ruleEvaluation.results
    .filter((r) => !r.passed)
    .map((r) => r.message);

  // Add stacking rule violations as warnings
  for (const violation of stackingEvaluation.violations) {
    warnings.push(violation.message);
  }

  if (unplaced.length > 0) {
    warnings.push(
      `${unplaced.length} item(s) could not be placed on the trailer: ${unplaced.map((i) => i.orderNumber).join(', ')}. Consider using a longer trailer or reducing load.`
    );
  }

  if (securement.hasOverflow) {
    warnings.push(
      `More tie-down anchor points needed (${securement.anchorPointsUsed} used) than available (${securement.anchorPointsAvailable}). Consider alternative securement arrangements.`
    );
  }

  const success = placed.length > 0;
  const canApprove = ruleEvaluation.canApprove && stackingEvaluation.passed && unplaced.length === 0;

  return {
    success,
    placedFreight: placed,
    unplacedItems: unplaced,
    weightMetrics,
    securement,
    loadingSequence,
    detectedPattern,
    ruleResults: ruleEvaluation.results,
    stackingEvaluation,
    canApprove,
    warnings,
  };
}
