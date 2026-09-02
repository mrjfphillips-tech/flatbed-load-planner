// ─── Constraint Validator ────────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Standalone constraint validation used both to verify a full computed plan and
// to validate a single placement in real time during manual editing. Shares the
// same geometry conventions and canonical mm/kg units as the packing engine, so
// the editor and the engine always agree on what is valid.
//
// _Requirements: 5.1, 5.5, 6.2_

import type {
  PlacedItem,
  TrailerProfile,
  ConstraintViolation,
} from './types';
import { calculateAxleWeights } from './packing-engine';

const EPS = 1e-6;

// ─── Stackability matrix ─────────────────────────────────────────────────────

/**
 * Stackability matrix: `matrix[supportClass][topClass] === false` means an item
 * of `topClass` may NOT be placed on top of an item of `supportClass`. Missing
 * entries default to allowed.
 */
export type StackabilityMatrix = Record<string, Record<string, boolean>>;

/** Returns whether `topClass` is allowed to rest on `supportClass`. */
function classAllowsOnTop(
  supportClass: string | undefined,
  topClass: string | undefined,
  matrix?: StackabilityMatrix,
): boolean {
  if (!matrix || supportClass == null || topClass == null) return true;
  const row = matrix[supportClass];
  if (!row || !(topClass in row)) return true;
  return row[topClass];
}

// ─── Geometry ────────────────────────────────────────────────────────────────

interface Box {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

const ORIENTATION_MAP: Record<
  PlacedItem['placedOrientation'],
  ['length' | 'width' | 'height', 'length' | 'width' | 'height', 'length' | 'width' | 'height']
> = {
  LWH: ['length', 'width', 'height'],
  WLH: ['width', 'length', 'height'],
  LHW: ['length', 'height', 'width'],
  WHL: ['width', 'height', 'length'],
  HLW: ['height', 'length', 'width'],
  HWL: ['height', 'width', 'length'],
};

function boxOf(it: PlacedItem): Box {
  const [a, b, c] = ORIENTATION_MAP[it.placedOrientation];
  return {
    x0: it.placedX,
    y0: it.placedY,
    z0: it.placedZ,
    x1: it.placedX + it[a],
    y1: it.placedY + it[b],
    z1: it.placedZ + it[c],
  };
}

function overlaps3D(a: Box, b: Box): boolean {
  return (
    a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS &&
    a.y0 < b.y1 - EPS && a.y1 > b.y0 + EPS &&
    a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS
  );
}

function overlapsXY(a: Box, b: Box): boolean {
  return (
    a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS &&
    a.y0 < b.y1 - EPS && a.y1 > b.y0 + EPS
  );
}

// ─── Single-placement validation ─────────────────────────────────────────────

/**
 * Validates a single item's placement against the trailer and the other items
 * already in the plan. Returns every violation found (empty array = valid).
 * Intended for real-time feedback while a planner drags an item.
 *
 * `existingItems` should exclude the item being validated (or include it — it
 * is matched out by `id`).
 * _Requirements: 5.5, 6.2_
 */
export function validateSinglePlacement(
  item: PlacedItem,
  existingItems: PlacedItem[],
  trailer: TrailerProfile,
  matrix?: StackabilityMatrix,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const others = existingItems.filter((o) => o.id !== item.id);
  const box = boxOf(item);

  // Bounds.
  if (
    box.x0 < -EPS ||
    box.y0 < -EPS ||
    box.z0 < -EPS ||
    box.x1 > trailer.internalLength + EPS ||
    box.y1 > trailer.internalWidth + EPS ||
    box.z1 > trailer.internalHeight + EPS
  ) {
    violations.push({
      type: 'out_of_bounds',
      message: `Item ${item.itemId} extends beyond the trailer interior.`,
      itemId: item.id,
    });
  }

  // Overlap.
  for (const o of others) {
    if (overlaps3D(box, boxOf(o))) {
      violations.push({
        type: 'overlap',
        message: `Item ${item.itemId} overlaps item ${o.itemId}.`,
        itemId: item.id,
        relatedItemIds: [o.id],
      });
    }
  }

  const onFloor = box.z0 <= EPS;

  // Floor-only.
  if (item.floorOnly && !onFloor) {
    violations.push({
      type: 'floor_only',
      message: `Item ${item.itemId} is floor-only but is not resting on the floor.`,
      itemId: item.id,
    });
  }

  // Support / stackability for elevated items.
  const supporters = onFloor
    ? []
    : others.filter((o) => {
        const ob = boxOf(o);
        return Math.abs(ob.z1 - box.z0) <= EPS && overlapsXY(ob, box);
      });

  if (!onFloor && supporters.length === 0) {
    violations.push({
      type: 'unsupported',
      message: `Item ${item.itemId} is floating with no supporting item below.`,
      itemId: item.id,
    });
  }

  for (const s of supporters) {
    if (s.topLoadProhibited) {
      violations.push({
        type: 'top_load_prohibited',
        message: `Item ${item.itemId} rests on ${s.itemId}, which prohibits top loading.`,
        itemId: item.id,
        relatedItemIds: [s.id],
      });
    }
    if (!classAllowsOnTop(s.stackabilityClass, item.stackabilityClass, matrix)) {
      violations.push({
        type: 'stackability_class',
        message: `Item class "${item.stackabilityClass}" may not be stacked on class "${s.stackabilityClass}" (item ${s.itemId}).`,
        itemId: item.id,
        relatedItemIds: [s.id],
      });
    }
    if (
      s.temperatureZone != null &&
      item.temperatureZone != null &&
      s.temperatureZone !== item.temperatureZone
    ) {
      violations.push({
        type: 'temperature_zone',
        message: `Item ${item.itemId} (zone ${item.temperatureZone}) rests on ${s.itemId} in zone ${s.temperatureZone}.`,
        itemId: item.id,
        relatedItemIds: [s.id],
      });
    }
  }

  // Max stack weight of any load-bearing item below this footprint.
  for (const support of others) {
    const sb = boxOf(support);
    const bearsLoad = sb.z1 <= box.z0 + EPS && overlapsXY(sb, box);
    if (!bearsLoad || support.maxStackWeight == null) continue;

    const existingOnTop = others
      .filter((p) => {
        const pb = boxOf(p);
        return pb.z0 >= sb.z1 - EPS && overlapsXY(pb, sb);
      })
      .reduce((sum, p) => sum + p.weight, 0);

    if (existingOnTop + item.weight > support.maxStackWeight + EPS) {
      violations.push({
        type: 'max_stack_weight',
        message: `Item ${item.itemId} would exceed the ${support.maxStackWeight} kg stack limit of ${support.itemId}.`,
        itemId: item.id,
        relatedItemIds: [support.id],
      });
    }
  }

  return violations;
}

// ─── Full-plan validation ────────────────────────────────────────────────────

/**
 * Validates every constraint across a full set of placed items. Combines
 * per-item placement checks with plan-wide checks (axle weight limits, max
 * payload). Returns all violations found.
 * _Requirements: 5.1, 5.5_
 */
export function validateAllConstraints(
  placedItems: PlacedItem[],
  trailer: TrailerProfile,
  matrix?: StackabilityMatrix,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  // Per-item checks. Each item is validated against all others; overlaps are
  // de-duplicated so a pair is only reported once.
  const reportedOverlaps = new Set<string>();
  for (const item of placedItems) {
    for (const v of validateSinglePlacement(item, placedItems, trailer, matrix)) {
      if (v.type === 'overlap' && v.relatedItemIds?.length) {
        const pair = [item.id, v.relatedItemIds[0]].sort().join('::');
        if (reportedOverlaps.has(pair)) continue;
        reportedOverlaps.add(pair);
      }
      violations.push(v);
    }
  }

  // Plan-wide: max payload.
  const totalWeight = placedItems.reduce((s, p) => s + p.weight, 0);
  if (totalWeight > trailer.maxPayloadWeight + EPS) {
    violations.push({
      type: 'max_payload',
      message: `Total weight ${totalWeight.toFixed(1)} kg exceeds max payload ${trailer.maxPayloadWeight} kg.`,
      itemId: '',
    });
  }

  // Plan-wide: axle weight limits.
  const axleWeights = calculateAxleWeights(placedItems, trailer);
  axleWeights.forEach((w, i) => {
    const limit = trailer.axleWeightLimits[i];
    if (limit != null && w > limit + EPS) {
      violations.push({
        type: 'axle_weight_limit',
        message: `Axle ${i + 1} carries ${w.toFixed(1)} kg, exceeding its ${limit} kg limit.`,
        itemId: '',
        axleIndex: i,
      });
    }
  });

  return violations;
}
