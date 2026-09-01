// ─── 3D Bin-Packing Engine ───────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Extreme-point-based 3D bin packing with constraint awareness. All values are
// canonical mm/kg — the engine is completely unit-agnostic.
//
// Coordinate system (origin at front-left-floor corner of the trailer):
//   X = along trailer length (0 = front / cab side, increasing toward doors)
//   Y = across trailer width  (0 = left)
//   Z = vertical height       (0 = floor)
//
// Algorithm: items are sorted (delivery stop DESC, then volume DESC) so the
// first delivery stop is loaded last / nearest the doors. Each item is tried in
// every valid orientation at every extreme point; the best-scoring feasible
// placement wins (prefer lower Z, then back-of-trailer / higher X).
//
// _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4_

import type {
  LoadItem,
  PlacedItem,
  ItemOrientation,
  TrailerProfile,
  PackingResult,
} from './types';

// ─── Internal geometry helpers ───────────────────────────────────────────────

/** A candidate placement position (canonical mm). */
interface Point {
  x: number;
  y: number;
  z: number;
}

/** An item's dimensions after applying an orientation (canonical mm). */
interface OrientedDims {
  orientation: ItemOrientation;
  dx: number; // extent along X (length axis)
  dy: number; // extent along Y (width axis)
  dz: number; // extent along Z (height axis)
}

/** An axis-aligned box occupying trailer space (canonical mm). */
interface Box {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

/** Optional packing tuning / constraint inputs. */
export interface PackingConstraints {
  /**
   * Stackability matrix: `matrix[a][b] === false` means an item of class `b`
   * may NOT be placed on top of an item of class `a`. Missing entries default
   * to allowed.
   */
  stackabilityMatrix?: Record<string, Record<string, boolean>>;
}

const ALL_ORIENTATIONS: ItemOrientation[] = [
  'LWH',
  'WLH',
  'LHW',
  'WHL',
  'HLW',
  'HWL',
];

/** Small epsilon to absorb floating point noise in overlap/bounds tests (mm). */
const EPS = 1e-6;

// ─── Orientation enumeration ─────────────────────────────────────────────────

/**
 * Returns the oriented dimensions for a given item and orientation code. The
 * code names the source dimension mapped onto the X, Y, Z axes in order, where
 * L = length, W = width, H = height of the item.
 */
function orient(item: LoadItem, orientation: ItemOrientation): OrientedDims {
  const { length: L, width: W, height: H } = item;
  const map: Record<ItemOrientation, [number, number, number]> = {
    LWH: [L, W, H],
    WLH: [W, L, H],
    LHW: [L, H, W],
    WHL: [W, H, L],
    HLW: [H, L, W],
    HWL: [H, W, L],
  };
  const [dx, dy, dz] = map[orientation];
  return { orientation, dx, dy, dz };
}

/**
 * Enumerates the distinct oriented dimensions for an item. Orientations that
 * produce identical (dx, dy, dz) footprints are de-duplicated for determinism
 * and efficiency, keeping the first orientation code in ALL_ORIENTATIONS order.
 */
function enumerateOrientations(item: LoadItem): OrientedDims[] {
  const seen = new Set<string>();
  const result: OrientedDims[] = [];
  for (const o of ALL_ORIENTATIONS) {
    const dims = orient(item, o);
    const key = `${dims.dx}x${dims.dy}x${dims.dz}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(dims);
    }
  }
  return result;
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/**
 * Sorts items for packing: delivery stop DESC (last stop loaded first), then
 * volume DESC, then itemId ASC as a final deterministic tie-breaker.
 */
function sortItemsForPacking(items: LoadItem[]): LoadItem[] {
  return [...items].sort((a, b) => {
    const stopA = a.deliveryStop ?? 0;
    const stopB = b.deliveryStop ?? 0;
    if (stopA !== stopB) return stopB - stopA;

    const volA = a.length * a.width * a.height;
    const volB = b.length * b.width * b.height;
    if (volA !== volB) return volB - volA;

    return a.itemId.localeCompare(b.itemId);
  });
}

// ─── Overlap & support geometry ──────────────────────────────────────────────

function boxOf(p: Point, dims: OrientedDims): Box {
  return {
    x0: p.x,
    y0: p.y,
    z0: p.z,
    x1: p.x + dims.dx,
    y1: p.y + dims.dy,
    z1: p.z + dims.dz,
  };
}

function placedBox(it: PlacedItem): Box {
  const dims = orient(it, it.placedOrientation);
  return boxOf({ x: it.placedX, y: it.placedY, z: it.placedZ }, dims);
}

/** True if two boxes overlap with positive volume (touching faces do not count). */
function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x0 < b.x1 - EPS &&
    a.x1 > b.x0 + EPS &&
    a.y0 < b.y1 - EPS &&
    a.y1 > b.y0 + EPS &&
    a.z0 < b.z1 - EPS &&
    a.z1 > b.z0 + EPS
  );
}

/** True if boxes a and b overlap when projected onto the X-Y (floor) plane. */
function overlapsXY(a: Box, b: Box): boolean {
  return (
    a.x0 < b.x1 - EPS &&
    a.x1 > b.x0 + EPS &&
    a.y0 < b.y1 - EPS &&
    a.y1 > b.y0 + EPS
  );
}

// ─── Extreme points ──────────────────────────────────────────────────────────

/**
 * Generates candidate extreme points produced by placing `box`: the three
 * "far corner" projections along each axis. The origin remains available via
 * the initial extreme point set.
 */
function generateExtremePoints(box: Box): Point[] {
  return [
    { x: box.x1, y: box.y0, z: box.z0 }, // beyond in X
    { x: box.x0, y: box.y1, z: box.z0 }, // beyond in Y
    { x: box.x0, y: box.y0, z: box.z1 }, // on top (Z)
  ];
}

function pointKey(p: Point): string {
  return `${p.x}|${p.y}|${p.z}`;
}

/** Sorts extreme points: lower Z first, then lower X, then lower Y (deterministic). */
function sortExtremePoints(points: Point[]): Point[] {
  return [...points].sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });
}

// ─── Constraint helpers ──────────────────────────────────────────────────────

/**
 * Returns the set of already-placed items that directly support `box` from
 * below (their top face is level with the box's bottom and they overlap in XY).
 */
function supportingItems(box: Box, placed: PlacedItem[]): PlacedItem[] {
  if (box.z0 <= EPS) return []; // resting on the floor
  return placed.filter((it) => {
    const pb = placedBox(it);
    return Math.abs(pb.z1 - box.z0) <= EPS && overlapsXY(pb, box);
  });
}

/** Stackability matrix lookup — defaults to allowed when unspecified. */
function classAllowsOnTop(
  supportClass: string | undefined,
  topClass: string | undefined,
  constraints: PackingConstraints,
): boolean {
  const matrix = constraints.stackabilityMatrix;
  if (!matrix || supportClass == null || topClass == null) return true;
  const row = matrix[supportClass];
  if (!row || !(topClass in row)) return true;
  return row[topClass];
}

/**
 * Checks all placement constraints for putting `item` (with `dims`) at `point`
 * against the current set of placed items. Returns true if the placement is
 * feasible. Bounds and overlap are checked by the caller before this runs.
 * _Requirements: 5.1, 5.2, 5.3, 5.4_
 */
function placementSatisfiesConstraints(
  item: LoadItem,
  dims: OrientedDims,
  point: Point,
  placed: PlacedItem[],
  constraints: PackingConstraints,
): boolean {
  const box = boxOf(point, dims);
  const onFloor = box.z0 <= EPS;

  // Floor-only items must rest directly on the trailer floor.
  if (item.floorOnly && !onFloor) return false;

  const supporters = supportingItems(box, placed);

  // Items above the floor must be fully supported (no floating items). We
  // require at least one supporter; full-area support is approximated by
  // requiring the supporters to exist and none to prohibit top loading.
  if (!onFloor && supporters.length === 0) return false;

  for (const s of supporters) {
    // Cannot place anything on a top-load-prohibited item.
    if (s.topLoadProhibited) return false;

    // Stackability class matrix: does the support class allow this on top?
    if (!classAllowsOnTop(s.stackabilityClass, item.stackabilityClass, constraints)) {
      return false;
    }
  }

  // Weight-on-top: adding this item must not cause any item in the support
  // column below to exceed its declared max stack weight.
  if (!onFloor) {
    if (!weightOnTopWithinLimits(item, box, placed)) return false;
  }

  // Temperature zone boundary: an item with a temperature zone may only sit in
  // a column consistent with that zone (supporters must share the zone).
  if (item.temperatureZone != null) {
    for (const s of supporters) {
      if (s.temperatureZone != null && s.temperatureZone !== item.temperatureZone) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Ensures that placing `item` at `box` does not push any supporting item (or
 * item transitively below) past its `maxStackWeight`. Weight of everything
 * currently resting on a support column plus the new item must stay within the
 * lowest declared limit in that column.
 * _Requirements: 3.3_
 */
function weightOnTopWithinLimits(
  item: LoadItem,
  box: Box,
  placed: PlacedItem[],
): boolean {
  // Walk down from the new item's footprint: any placed item whose XY overlaps
  // and whose top is at or below the new box bottom bears part of the load.
  for (const support of placed) {
    const sb = placedBox(support);
    const bearsLoad = sb.z1 <= box.z0 + EPS && overlapsXY(sb, box);
    if (!bearsLoad) continue;
    if (support.maxStackWeight == null) continue;

    // Sum weight already on top of this support plus the new item.
    const existingOnTop = placed
      .filter((p) => {
        const pb = placedBox(p);
        return pb.z0 >= sb.z1 - EPS && overlapsXY(pb, sb);
      })
      .reduce((sum, p) => sum + p.weight, 0);

    if (existingOnTop + item.weight > support.maxStackWeight + EPS) {
      return false;
    }
  }
  return true;
}

// ─── Axle weight distribution ────────────────────────────────────────────────

/**
 * Distributes each placed item's weight across the trailer's axles based on the
 * longitudinal (X) position of its center of gravity, then returns weight per
 * axle in canonical kg. Axles are assumed evenly spaced along the trailer
 * length; a single axle receives the full weight. Total is conserved.
 * _Requirements: 3.4, 5 (axle limits)_
 */
export function calculateAxleWeights(
  placedItems: PlacedItem[],
  trailer: TrailerProfile,
): number[] {
  const n = Math.max(1, trailer.axleCount);
  const weights = new Array<number>(n).fill(0);

  if (n === 1) {
    weights[0] = placedItems.reduce((s, it) => s + it.weight, 0);
    return weights;
  }

  // Axle longitudinal positions, evenly distributed across the usable length.
  const L = trailer.internalLength;
  const axlePositions = Array.from({ length: n }, (_, i) => (L * (i + 1)) / (n + 1));

  for (const it of placedItems) {
    const dims = orient(it, it.placedOrientation);
    const cogX = it.placedX + dims.dx / 2;

    // Find the two nearest axles and split the load by inverse distance
    // (linear interpolation between the bracketing axles).
    let lower = 0;
    let upper = n - 1;
    for (let i = 0; i < n - 1; i++) {
      if (cogX >= axlePositions[i] && cogX <= axlePositions[i + 1]) {
        lower = i;
        upper = i + 1;
        break;
      }
      if (cogX < axlePositions[0]) {
        lower = 0;
        upper = 0;
      } else if (cogX > axlePositions[n - 1]) {
        lower = n - 1;
        upper = n - 1;
      }
    }

    if (lower === upper) {
      weights[lower] += it.weight;
    } else {
      const span = axlePositions[upper] - axlePositions[lower];
      const frac = span > 0 ? (cogX - axlePositions[lower]) / span : 0;
      weights[lower] += it.weight * (1 - frac);
      weights[upper] += it.weight * frac;
    }
  }

  return weights;
}

/** True if the given axle weights are all within the trailer's per-axle limits. */
function axleWeightsWithinLimits(
  weights: number[],
  trailer: TrailerProfile,
): boolean {
  return weights.every((w, i) => {
    const limit = trailer.axleWeightLimits[i];
    return limit == null || w <= limit + EPS;
  });
}

// ─── Placement scoring ───────────────────────────────────────────────────────

/**
 * Scores a feasible placement — lower is better. Prefer lower Z (keep the load
 * low), then higher X (pack toward the back / doors first so earlier stops end
 * up nearest the doors), then lower Y for determinism.
 */
function scorePlacement(point: Point, trailer: TrailerProfile): number {
  const zTerm = point.z; // minimize height
  const xTerm = trailer.internalLength - point.x; // minimize => maximize X
  const yTerm = point.y;
  // Weighted lexicographic ordering collapsed into a single comparable number.
  return zTerm * 1e12 + xTerm * 1e6 + yTerm;
}

// ─── Main packing routine ────────────────────────────────────────────────────

/**
 * Computes a load plan by placing all items within the trailer using the
 * extreme-point heuristic with constraint enforcement. Deterministic: identical
 * inputs produce identical output.
 *
 * Note: the caller is responsible for expanding item quantities into individual
 * unit records before calling (one LoadItem per physical unit).
 * _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_
 */
export function computeLoadPlan(
  items: LoadItem[],
  trailer: TrailerProfile,
  constraints: PackingConstraints = {},
): PackingResult {
  const start = Date.now();

  const sorted = sortItemsForPacking(items);
  const placed: PlacedItem[] = [];
  const overflow: LoadItem[] = [];

  // Extreme point set, keyed for de-duplication. Seeded with the origin.
  let extremePoints: Point[] = [{ x: 0, y: 0, z: 0 }];
  const pointKeys = new Set<string>([pointKey(extremePoints[0])]);

  let loadSequence = 1;

  for (const item of sorted) {
    const orientations = enumerateOrientations(item);

    let best: {
      point: Point;
      dims: OrientedDims;
      score: number;
    } | null = null;

    for (const point of sortExtremePoints(extremePoints)) {
      for (const dims of orientations) {
        const box = boxOf(point, dims);

        // Trailer bounds.
        if (
          box.x1 > trailer.internalLength + EPS ||
          box.y1 > trailer.internalWidth + EPS ||
          box.z1 > trailer.internalHeight + EPS ||
          box.x0 < -EPS ||
          box.y0 < -EPS ||
          box.z0 < -EPS
        ) {
          continue;
        }

        // Overlap with existing items.
        if (placed.some((p) => boxesOverlap(box, placedBox(p)))) continue;

        // Constraints (floor-only, stackability, weight-on-top, zones, support).
        if (!placementSatisfiesConstraints(item, dims, point, placed, constraints)) {
          continue;
        }

        // Axle weight limits — evaluate as if this item were placed.
        const trial: PlacedItem = {
          ...item,
          placedX: point.x,
          placedY: point.y,
          placedZ: point.z,
          placedOrientation: dims.orientation,
          loadSequence,
        };
        const axle = calculateAxleWeights([...placed, trial], trailer);
        if (!axleWeightsWithinLimits(axle, trailer)) continue;

        // Max payload weight.
        const totalWeight = placed.reduce((s, p) => s + p.weight, 0) + item.weight;
        if (totalWeight > trailer.maxPayloadWeight + EPS) continue;

        const score = scorePlacement(point, trailer);
        if (best === null || score < best.score) {
          best = { point, dims, score };
        }
      }
    }

    if (best === null) {
      overflow.push(item);
      continue;
    }

    const placedItem: PlacedItem = {
      ...item,
      placedX: best.point.x,
      placedY: best.point.y,
      placedZ: best.point.z,
      placedOrientation: best.dims.orientation,
      loadSequence: loadSequence++,
    };
    placed.push(placedItem);

    // Retire the consumed extreme point and add new ones from this box.
    const consumedKey = pointKey(best.point);
    extremePoints = extremePoints.filter((p) => pointKey(p) !== consumedKey);
    pointKeys.delete(consumedKey);

    const box = placedBox(placedItem);
    for (const ep of generateExtremePoints(box)) {
      // Keep only points inside the trailer.
      if (
        ep.x > trailer.internalLength + EPS ||
        ep.y > trailer.internalWidth + EPS ||
        ep.z > trailer.internalHeight + EPS
      ) {
        continue;
      }
      const key = pointKey(ep);
      if (!pointKeys.has(key)) {
        pointKeys.add(key);
        extremePoints.push(ep);
      }
    }
  }

  const totalWeight = placed.reduce((s, p) => s + p.weight, 0);
  const axleWeights = calculateAxleWeights(placed, trailer);

  const trailerVolume =
    trailer.internalLength * trailer.internalWidth * trailer.internalHeight;
  const usedVolume = placed.reduce(
    (s, p) => s + p.length * p.width * p.height,
    0,
  );
  const volumeUtilization =
    trailerVolume > 0 ? (usedVolume / trailerVolume) * 100 : 0;

  return {
    placedItems: placed,
    overflowItems: overflow,
    volumeUtilization,
    totalWeight,
    axleWeights,
    computeTimeMs: Date.now() - start,
  };
}
