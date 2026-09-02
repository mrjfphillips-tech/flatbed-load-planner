// ─── Load Rules Engine ───────────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// One pure function per rule. Each returns RuleViolations with a rationale
// string written for a dispatcher (not a developer) plus a severity. No rule
// constant appears here — everything comes from RulesConfig. validate() runs
// every rule and returns { errors, warnings }. assertValid() throws on errors.
//
// This is the single source of legality: the solver tests candidate placements
// with the same predicates the validator uses (see packing-engine).
//
// Canonical units throughout: millimeters and kilograms.
//
// This first module implements the 8 rules that need NO data beyond what the
// current model already carries (dimensions, weight, quantity, delivery stop,
// floorOnly, stack class). Metadata-dependent rules (plan layer, load side,
// trip, unload banding, temperature multi-zone) are added later, each gated on
// its field being present and failing closed when absent.

import type { PlacedItem, LoadItem, TrailerProfile } from './types';
import type { RulesConfig, RuleSeverity } from './rules-config';
import { DEFAULT_RULES_CONFIG, classCanCarry } from './rules-config';

// ─── Result shapes ───────────────────────────────────────────────────────────

/** A single rule violation, phrased for a dispatcher. */
export interface RuleViolation {
  /** The rule that produced this (stable code for filtering/telemetry). */
  rule: RuleCode;
  severity: RuleSeverity;
  /** Dispatcher-facing explanation of what's wrong and why it matters. */
  rationale: string;
  /** Affected placed-item ids (empty for load-wide checks). */
  itemIds: string[];
}

export type RuleCode =
  | 'CANONICAL_UNITS'
  | 'PLACEMENT_COMPLETENESS'
  | 'VEHICLE_ENVELOPE'
  | 'NO_OVERLAP'
  | 'SUPPORT_CONTINUITY'
  | 'FLOOR_ONLY'
  | 'MAX_STACK_WEIGHT'
  | 'STACK_CLASS_COMPATIBILITY'
  | 'AXLE_AND_COG'
  | 'COG_HEIGHT';

/** The full plan handed to the rules engine. */
export interface RulePlan {
  trailer: TrailerProfile;
  /** The manifest (per-item, with quantities) the plan was computed from. */
  items: LoadItem[];
  /** The placed units (quantities expanded to individual placements). */
  placed: PlacedItem[];
}

export interface ValidationResult {
  errors: RuleViolation[];
  warnings: RuleViolation[];
  /** Convenience: true when there are no error-severity violations. */
  valid: boolean;
}

// ─── Geometry helpers (canonical mm) ─────────────────────────────────────────

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

interface Box {
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
}

function extents(it: PlacedItem): { dx: number; dy: number; dz: number } {
  const [a, b, c] = ORIENTATION_MAP[it.placedOrientation];
  return { dx: it[a], dy: it[b], dz: it[c] };
}

function boxOf(it: PlacedItem): Box {
  const { dx, dy, dz } = extents(it);
  return {
    x0: it.placedX, y0: it.placedY, z0: it.placedZ,
    x1: it.placedX + dx, y1: it.placedY + dy, z1: it.placedZ + dz,
  };
}

/** Overlap area of two boxes projected on the X-Y (floor) plane, in mm². */
function overlapAreaXY(a: Box, b: Box): number {
  const ox = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const oy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return ox * oy;
}

function volumeOverlap(a: Box, b: Box, eps: number): boolean {
  return (
    a.x0 < b.x1 - eps && a.x1 > b.x0 + eps &&
    a.y0 < b.y1 - eps && a.y1 > b.y0 + eps &&
    a.z0 < b.z1 - eps && a.z1 > b.z0 + eps
  );
}

// ─── Rule: CANONICAL_UNITS ───────────────────────────────────────────────────

/** Dimensions/weights finite and > 0; quantity/stop integers >= 1; catches a
 *  metric leak (absurdly small dimension or deck). _Rule: CANONICAL_UNITS_ */
export function ruleCanonicalUnits(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const { minItemDimensionMm, minDeckLengthMm } = cfg.sanity;

  for (const it of plan.items) {
    const dims = [it.length, it.width, it.height];
    if (dims.some((d) => !Number.isFinite(d) || d <= 0) || !Number.isFinite(it.weight) || it.weight <= 0) {
      v.push({ rule: 'CANONICAL_UNITS', severity: 'error', itemIds: [it.id],
        rationale: `${it.itemId} has a non-positive or invalid dimension/weight — check the source data.` });
    }
    if (dims.some((d) => d > 0 && d < minItemDimensionMm)) {
      v.push({ rule: 'CANONICAL_UNITS', severity: 'error', itemIds: [it.id],
        rationale: `${it.itemId} has a dimension under ${minItemDimensionMm} mm — likely a units error (e.g. meters read as millimeters).` });
    }
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      v.push({ rule: 'CANONICAL_UNITS', severity: 'error', itemIds: [it.id],
        rationale: `${it.itemId} has an invalid quantity (${it.quantity}); it must be a whole number of 1 or more.` });
    }
    if (it.deliveryStop != null && (!Number.isInteger(it.deliveryStop) || it.deliveryStop < 1)) {
      v.push({ rule: 'CANONICAL_UNITS', severity: 'error', itemIds: [it.id],
        rationale: `${it.itemId} has an invalid delivery stop (${it.deliveryStop}); stops start at 1.` });
    }
  }
  if (plan.trailer.internalLength < minDeckLengthMm) {
    v.push({ rule: 'CANONICAL_UNITS', severity: 'error', itemIds: [],
      rationale: `The vehicle deck is only ${Math.round(plan.trailer.internalLength)} mm long — likely a units error on the vehicle (meters entered as millimeters).` });
  }
  return v;
}

// ─── Rule: PLACEMENT_COMPLETENESS ────────────────────────────────────────────

/** Each item placed exactly `quantity` times, footprint preserved (or 90°
 *  rotation), height unchanged. Nothing dropped/duplicated/resized. */
export function rulePlacementCompleteness(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const eps = cfg.tolerances.positionEpsilonMm;
  const counts = new Map<string, number>();
  for (const p of plan.placed) counts.set(p.itemId, (counts.get(p.itemId) ?? 0) + 1);

  for (const it of plan.items) {
    const placedCount = counts.get(it.itemId) ?? 0;
    if (placedCount !== it.quantity) {
      v.push({ rule: 'PLACEMENT_COMPLETENESS', severity: 'error', itemIds: [it.id],
        rationale: `${it.itemId} should appear ${it.quantity} time(s) but is placed ${placedCount} — nothing may be dropped or duplicated to make it fit.` });
    }
  }

  // Footprint / height preserved for every placement.
  for (const p of plan.placed) {
    const { dx, dy, dz } = extents(p);
    const footprintOk =
      (approx(dx, p.length, eps) && approx(dy, p.width, eps)) ||
      (approx(dx, p.width, eps) && approx(dy, p.length, eps));
    if (!footprintOk || !approx(dz, p.height, eps)) {
      v.push({ rule: 'PLACEMENT_COMPLETENESS', severity: 'error', itemIds: [p.id],
        rationale: `${p.itemId} was resized to fit — its placed footprint/height doesn't match the real item.` });
    }
  }
  return v;
}

function approx(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}

// ─── Rule: VEHICLE_ENVELOPE ──────────────────────────────────────────────────

/** Every unit inside the deck box (plus rear overhang allowance). */
export function ruleVehicleEnvelope(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const eps = cfg.tolerances.positionEpsilonMm;
  const t = plan.trailer;
  const maxX = t.internalLength + cfg.vehicle.rearOverhangMm;
  for (const p of plan.placed) {
    const b = boxOf(p);
    if (b.x0 < -eps || b.y0 < -eps || b.z0 < -eps ||
        b.x1 > maxX + eps || b.y1 > t.internalWidth + eps || b.z1 > t.internalHeight + eps) {
      v.push({ rule: 'VEHICLE_ENVELOPE', severity: 'error', itemIds: [p.id],
        rationale: `${p.itemId} extends outside the vehicle deck — it won't physically fit as placed.` });
    }
  }
  return v;
}

// ─── Rule: NO_OVERLAP ────────────────────────────────────────────────────────

/** No two units intersect in 3D. */
export function ruleNoOverlap(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const eps = cfg.tolerances.overlapEpsilonMm;
  const boxes = plan.placed.map((p) => ({ p, box: boxOf(p) }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (volumeOverlap(boxes[i].box, boxes[j].box, eps)) {
        v.push({ rule: 'NO_OVERLAP', severity: 'error', itemIds: [boxes[i].p.id, boxes[j].p.id],
          rationale: `${boxes[i].p.itemId} and ${boxes[j].p.itemId} occupy the same space — they can't both be loaded there.` });
      }
    }
  }
  return v;
}

// ─── Support column helpers (shared by support/weight/compatibility) ─────────

/** Items whose top face is level with `p`'s base and overlap it in XY. */
function supportersOf(p: PlacedItem, all: PlacedItem[], gapEps: number): PlacedItem[] {
  const b = boxOf(p);
  if (b.z0 <= gapEps) return []; // on the floor
  return all.filter((o) => {
    if (o.id === p.id) return false;
    const ob = boxOf(o);
    return Math.abs(ob.z1 - b.z0) <= gapEps && overlapAreaXY(ob, b) > 0;
  });
}

// ─── Rule: SUPPORT_CONTINUITY (>= 80%) ───────────────────────────────────────

/** A unit above the floor must rest on supporters covering >= minSupportedFraction
 *  of its base. Zero supporters = floating = error. */
export function ruleSupportContinuity(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const gapEps = cfg.tolerances.supportGapEpsilonMm;
  const minFrac = cfg.support.minSupportedFraction;

  for (const p of plan.placed) {
    const b = boxOf(p);
    if (b.z0 <= gapEps) continue; // resting on the deck — fully supported
    const supporters = supportersOf(p, plan.placed, gapEps);
    const baseArea = (b.x1 - b.x0) * (b.y1 - b.y0);
    const supportedArea = supporters.reduce((s, o) => s + overlapAreaXY(boxOf(o), b), 0);
    const frac = baseArea > 0 ? Math.min(1, supportedArea / baseArea) : 0;
    if (supporters.length === 0) {
      v.push({ rule: 'SUPPORT_CONTINUITY', severity: 'error', itemIds: [p.id],
        rationale: `${p.itemId} is floating with nothing beneath it — it must rest on the deck or on another unit.` });
    } else if (frac < minFrac) {
      v.push({ rule: 'SUPPORT_CONTINUITY', severity: 'error', itemIds: [p.id, ...supporters.map((s) => s.id)],
        rationale: `${p.itemId} is only ${Math.round(frac * 100)}% supported (needs ${Math.round(minFrac * 100)}%) — it would overhang and could tip.` });
    }
  }
  return v;
}

// ─── Rule: FLOOR_ONLY ────────────────────────────────────────────────────────

/** floorOnly items must sit on the deck (z = 0). */
export function ruleFloorOnly(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const eps = cfg.tolerances.supportGapEpsilonMm;
  for (const p of plan.placed) {
    if (p.floorOnly && p.placedZ > eps) {
      v.push({ rule: 'FLOOR_ONLY', severity: 'error', itemIds: [p.id],
        rationale: `${p.itemId} is marked floor-only but is stacked off the deck — it must go directly on the floor.` });
    }
  }
  return v;
}

// ─── Rule: MAX_STACK_WEIGHT (full-stack, contact-area apportioned) ───────────

/** The full weight resting above each unit (propagated down the whole stack,
 *  apportioned by contact area) must not exceed its maxStackWeight. */
export function ruleMaxStackWeight(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const gapEps = cfg.tolerances.supportGapEpsilonMm;
  for (const support of plan.placed) {
    if (support.maxStackWeight == null) continue;
    const borne = weightBorneBy(support, plan.placed, gapEps);
    if (borne > support.maxStackWeight + 1e-6) {
      v.push({ rule: 'MAX_STACK_WEIGHT', severity: 'error', itemIds: [support.id],
        rationale: `${support.itemId} carries ${Math.round(borne)} kg on top, above its ${Math.round(support.maxStackWeight)} kg limit — the stack above it is too heavy.` });
    }
  }
  return v;
}

/** Total weight resting on `support`, summing everything above it whose footprint
 *  transmits load down through the column, apportioned by contact-area share. */
function weightBorneBy(support: PlacedItem, all: PlacedItem[], gapEps: number): number {
  const sb = boxOf(support);
  let total = 0;
  for (const p of all) {
    if (p.id === support.id) continue;
    const pb = boxOf(p);
    // p sits (directly or higher) above support if it's higher up and overlaps XY.
    if (pb.z0 >= sb.z1 - gapEps && overlapAreaXY(pb, sb) > 0) {
      // Apportion p's weight by the fraction of p's base that sits over support.
      const pArea = (pb.x1 - pb.x0) * (pb.y1 - pb.y0);
      const share = pArea > 0 ? overlapAreaXY(pb, sb) / pArea : 1;
      total += p.weight * share;
    }
  }
  return total;
}

// ─── Rule: STACK_CLASS_COMPATIBILITY (fail-closed) ───────────────────────────

/** A supporter's class must explicitly list the class it carries. Unknown or
 *  missing = error (never a silent pass). */
export function ruleStackClassCompatibility(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const gapEps = cfg.tolerances.supportGapEpsilonMm;
  for (const p of plan.placed) {
    const supporters = supportersOf(p, plan.placed, gapEps);
    for (const s of supporters) {
      if (!classCanCarry(s.stackabilityClass, p.stackabilityClass, cfg.stackCompatibility)) {
        v.push({ rule: 'STACK_CLASS_COMPATIBILITY', severity: 'error', itemIds: [p.id, s.id],
          rationale: `${p.itemId} (${p.stackabilityClass ?? 'unclassified'}) may not rest on ${s.itemId} (${s.stackabilityClass ?? 'unclassified'}) — that material pairing isn't allowed.` });
      }
    }
  }
  return v;
}

// ─── Rule: AXLE_AND_COG + COG_HEIGHT ─────────────────────────────────────────

/** Payload within capacity; longitudinal CoG within window; lateral imbalance
 *  within limit. CoG height above the load is a warning (COG_HEIGHT). */
export function ruleAxleAndCog(plan: RulePlan, cfg: RulesConfig): RuleViolation[] {
  const v: RuleViolation[] = [];
  const placed = plan.placed;
  if (placed.length === 0) return v;

  const totalWeight = placed.reduce((s, p) => s + p.weight, 0);
  if (totalWeight > plan.trailer.maxPayloadWeight + 1e-6) {
    v.push({ rule: 'AXLE_AND_COG', severity: 'error', itemIds: [],
      rationale: `Total load ${Math.round(totalWeight)} kg exceeds the vehicle payload of ${Math.round(plan.trailer.maxPayloadWeight)} kg.` });
  }

  // Weighted centroids.
  let mx = 0, my = 0, mz = 0;
  for (const p of placed) {
    const { dx, dy, dz } = extents(p);
    mx += (p.placedX + dx / 2) * p.weight;
    my += (p.placedY + dy / 2) * p.weight;
    mz += (p.placedZ + dz / 2) * p.weight;
  }
  const cogX = mx / totalWeight;
  const cogY = my / totalWeight;
  const cogZ = mz / totalWeight;

  const longFrac = cogX / plan.trailer.internalLength;
  if (longFrac < cfg.cog.minLongitudinalFraction || longFrac > cfg.cog.maxLongitudinalFraction) {
    v.push({ rule: 'AXLE_AND_COG', severity: 'error', itemIds: [],
      rationale: `Load balance front-to-back is off: centre of gravity at ${Math.round(longFrac * 100)}% of deck length (must be ${Math.round(cfg.cog.minLongitudinalFraction * 100)}–${Math.round(cfg.cog.maxLongitudinalFraction * 100)}%). Re-spread the load lengthwise.` });
  }

  // Lateral imbalance: weight left vs right of centreline (split straddlers).
  const centreline = plan.trailer.internalWidth / 2;
  let leftW = 0, rightW = 0;
  for (const p of placed) {
    const { dy } = extents(p);
    const y0 = p.placedY, y1 = p.placedY + dy;
    const leftPart = Math.max(0, Math.min(y1, centreline) - y0);
    const rightPart = Math.max(0, y1 - Math.max(y0, centreline));
    const span = y1 - y0;
    if (span > 0) {
      leftW += p.weight * (leftPart / span);
      rightW += p.weight * (rightPart / span);
    }
  }
  const imbalance = totalWeight > 0 ? Math.abs(leftW - rightW) / totalWeight : 0;
  if (imbalance > cfg.cog.maxLateralImbalanceFraction) {
    v.push({ rule: 'AXLE_AND_COG', severity: 'error', itemIds: [],
      rationale: `Load is lopsided: ${Math.round(imbalance * 100)}% side-to-side weight difference (limit ${Math.round(cfg.cog.maxLateralImbalanceFraction * 100)}%). Even out the ${leftW > rightW ? 'left' : 'right'}-heavy side.` });
  }

  // CoG height — warning only.
  const loadTop = Math.max(...placed.map((p) => boxOf(p).z1));
  const heightFrac = loadTop > 0 ? cogZ / loadTop : 0;
  if (heightFrac > cfg.cog.maxHeightFractionWarn) {
    v.push({ rule: 'COG_HEIGHT', severity: 'warning', itemIds: [],
      rationale: `Load is top-heavy: centre of gravity at ${Math.round(heightFrac * 100)}% of load height — review securement and drive with care.` });
  }

  void cogY; // reserved for future per-axle lateral modelling
  return v;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/** The full set of no-new-data rules, in evaluation order. */
const RULES: Array<(plan: RulePlan, cfg: RulesConfig) => RuleViolation[]> = [
  ruleCanonicalUnits,
  rulePlacementCompleteness,
  ruleVehicleEnvelope,
  ruleNoOverlap,
  ruleSupportContinuity,
  ruleFloorOnly,
  ruleMaxStackWeight,
  ruleStackClassCompatibility,
  ruleAxleAndCog,
];

/** Runs every rule and partitions results into errors and warnings. */
export function validate(plan: RulePlan, config: RulesConfig = DEFAULT_RULES_CONFIG): ValidationResult {
  const all = RULES.flatMap((rule) => rule(plan, config));
  const errors = all.filter((x) => x.severity === 'error');
  const warnings = all.filter((x) => x.severity === 'warning');
  return { errors, warnings, valid: errors.length === 0 };
}

/** Throws when the plan has any error-severity violation. Warnings never throw. */
export function assertValid(plan: RulePlan, config: RulesConfig = DEFAULT_RULES_CONFIG): void {
  const { errors } = validate(plan, config);
  if (errors.length > 0) {
    throw new LoadRulesError(errors);
  }
}

/** Error carrying the dispatcher-facing violations that blocked the load. */
export class LoadRulesError extends Error {
  constructor(public readonly violations: RuleViolation[]) {
    super(`Load has ${violations.length} blocking violation(s): ${violations.map((x) => x.rationale).join('; ')}`);
    this.name = 'LoadRulesError';
  }
}
