// ─── Tests for the Rules Engine ──────────────────────────────────────────────
// Feature: load-diagram-generator
// Each rule gets a test that PASSES and one that deliberately BREAKS it, plus
// the mostly-side-by-side reference-load case that must NOT throw false
// support/overlap errors.

import { describe, it, expect } from 'vitest';
import {
  validate,
  ruleCanonicalUnits,
  rulePlacementCompleteness,
  ruleVehicleEnvelope,
  ruleNoOverlap,
  ruleSupportContinuity,
  ruleFloorOnly,
  ruleMaxStackWeight,
  ruleStackClassCompatibility,
  ruleAxleAndCog,
  type RulePlan,
} from './rules';
import { DEFAULT_RULES_CONFIG } from './rules-config';
import type { LoadItem, PlacedItem, TrailerProfile } from './types';

const CFG = DEFAULT_RULES_CONFIG;

const TRAILER: TrailerProfile = {
  id: 't',
  name: 'Reference Deck',
  internalLength: 12500,
  internalWidth: 2440,
  internalHeight: 2700,
  maxPayloadWeight: 30000,
  axleCount: 2,
  axleWeightLimits: [15000, 15000],
  displayUnitSystem: 'metric',
  trailerType: 'flatbed',
  doorConfig: { rear: true, sideLeft: true, sideRight: true },
  isTemplate: false,
};

/** Build a placed unit (canonical mm/kg). */
function unit(over: Partial<PlacedItem> & { id: string }): PlacedItem {
  return {
    itemId: over.itemId ?? over.id,
    length: 1000, width: 1000, height: 1000, weight: 100, quantity: 1,
    stackabilityClass: 'sheet_pack', maxStackWeight: 5000,
    floorOnly: false, topLoadProhibited: false,
    placedX: 0, placedY: 0, placedZ: 0, placedOrientation: 'LWH', loadSequence: 1,
    ...over,
  };
}

/** A minimal plan: items derived from placed unless supplied. */
function plan(placed: PlacedItem[], items?: LoadItem[]): RulePlan {
  return { trailer: TRAILER, items: items ?? placed.map((p) => ({ ...p })), placed };
}

// ─── CANONICAL_UNITS ─────────────────────────────────────────────────────────

describe('CANONICAL_UNITS', () => {
  it('passes for well-formed items', () => {
    expect(ruleCanonicalUnits(plan([unit({ id: 'a' })]), CFG)).toEqual([]);
  });
  it('flags a metric-leak (dimension under the floor)', () => {
    const v = ruleCanonicalUnits(plan([unit({ id: 'a', length: 6 })]), CFG);
    expect(v.some((x) => x.rule === 'CANONICAL_UNITS')).toBe(true);
  });
});

// ─── PLACEMENT_COMPLETENESS ──────────────────────────────────────────────────

describe('PLACEMENT_COMPLETENESS', () => {
  it('passes when placed count equals quantity and footprint is preserved', () => {
    const items: LoadItem[] = [{ ...unit({ id: 'a' }), quantity: 2 }];
    const placed = [unit({ id: 'a', itemId: 'a' }), unit({ id: 'a2', itemId: 'a', placedX: 1100 })];
    expect(rulePlacementCompleteness(plan(placed, items), CFG)).toEqual([]);
  });
  it('flags a dropped unit', () => {
    const items: LoadItem[] = [{ ...unit({ id: 'a' }), quantity: 3 }];
    const placed = [unit({ id: 'a', itemId: 'a' })];
    expect(rulePlacementCompleteness(plan(placed, items), CFG).length).toBeGreaterThan(0);
  });
});

// ─── VEHICLE_ENVELOPE ────────────────────────────────────────────────────────

describe('VEHICLE_ENVELOPE', () => {
  it('passes inside the deck', () => {
    expect(ruleVehicleEnvelope(plan([unit({ id: 'a' })]), CFG)).toEqual([]);
  });
  it('flags a unit past the rear of the deck', () => {
    const v = ruleVehicleEnvelope(plan([unit({ id: 'a', placedX: 12000, length: 1000 })]), CFG);
    expect(v.length).toBeGreaterThan(0);
  });
});

// ─── NO_OVERLAP ──────────────────────────────────────────────────────────────

describe('NO_OVERLAP', () => {
  it('passes when units are apart', () => {
    expect(ruleNoOverlap(plan([unit({ id: 'a' }), unit({ id: 'b', placedX: 1100 })]), CFG)).toEqual([]);
  });
  it('flags intersecting units', () => {
    const v = ruleNoOverlap(plan([unit({ id: 'a' }), unit({ id: 'b', placedX: 500 })]), CFG);
    expect(v.length).toBeGreaterThan(0);
  });
});

// ─── SUPPORT_CONTINUITY ──────────────────────────────────────────────────────

describe('SUPPORT_CONTINUITY', () => {
  it('passes for a fully-supported stack', () => {
    const base = unit({ id: 'base', stackabilityClass: 'sheet_pack' });
    const top = unit({ id: 'top', placedZ: 1000, stackabilityClass: 'sheet_pack' });
    expect(ruleSupportContinuity(plan([base, top]), CFG)).toEqual([]);
  });
  it('flags a floating unit', () => {
    const v = ruleSupportContinuity(plan([unit({ id: 'a', placedZ: 1000 })]), CFG);
    expect(v.some((x) => x.rule === 'SUPPORT_CONTINUITY')).toBe(true);
  });
  it('flags a unit only partially supported (overhang)', () => {
    const base = unit({ id: 'base' });
    // Top shifted so only ~10% of its base sits over the supporter.
    const top = unit({ id: 'top', placedZ: 1000, placedX: 900 });
    const v = ruleSupportContinuity(plan([base, top]), CFG);
    expect(v.some((x) => x.rule === 'SUPPORT_CONTINUITY')).toBe(true);
  });
});

// ─── FLOOR_ONLY ──────────────────────────────────────────────────────────────

describe('FLOOR_ONLY', () => {
  it('passes when a floor-only item is on the deck', () => {
    expect(ruleFloorOnly(plan([unit({ id: 'a', floorOnly: true })]), CFG)).toEqual([]);
  });
  it('flags a floor-only item stacked up', () => {
    const base = unit({ id: 'base' });
    const v = ruleFloorOnly(plan([base, unit({ id: 'a', floorOnly: true, placedZ: 1000 })]), CFG);
    expect(v.length).toBeGreaterThan(0);
  });
});

// ─── MAX_STACK_WEIGHT ────────────────────────────────────────────────────────

describe('MAX_STACK_WEIGHT', () => {
  it('passes within the limit', () => {
    const base = unit({ id: 'base', maxStackWeight: 500 });
    const top = unit({ id: 'top', placedZ: 1000, weight: 400 });
    expect(ruleMaxStackWeight(plan([base, top]), CFG)).toEqual([]);
  });
  it('flags an over-limit stack (full-stack propagation)', () => {
    const base = unit({ id: 'base', maxStackWeight: 300 });
    const mid = unit({ id: 'mid', placedZ: 1000, weight: 200 });
    const top = unit({ id: 'top', placedZ: 2000, weight: 200 });
    // base bears mid + top = 400 > 300.
    const v = ruleMaxStackWeight(plan([base, mid, top]), CFG);
    expect(v.some((x) => x.itemIds.includes('base'))).toBe(true);
  });
});

// ─── STACK_CLASS_COMPATIBILITY ───────────────────────────────────────────────

describe('STACK_CLASS_COMPATIBILITY', () => {
  it('passes an allowed pairing (angle on rebar)', () => {
    const base = unit({ id: 'base', stackabilityClass: 'rebar_bundle' });
    const top = unit({ id: 'top', placedZ: 1000, stackabilityClass: 'angle_bundle' });
    expect(ruleStackClassCompatibility(plan([base, top]), CFG)).toEqual([]);
  });
  it('flags a disallowed pairing (sheet on rebar) — fail-closed', () => {
    const base = unit({ id: 'base', stackabilityClass: 'rebar_bundle' });
    const top = unit({ id: 'top', placedZ: 1000, stackabilityClass: 'sheet_pack' });
    const v = ruleStackClassCompatibility(plan([base, top]), CFG);
    expect(v.length).toBeGreaterThan(0);
  });
  it('flags an unknown supporting class — fail-closed, never a pass', () => {
    const base = unit({ id: 'base', stackabilityClass: 'mystery' });
    const top = unit({ id: 'top', placedZ: 1000, stackabilityClass: 'sheet_pack' });
    const v = ruleStackClassCompatibility(plan([base, top]), CFG);
    expect(v.length).toBeGreaterThan(0);
  });
});

// ─── AXLE_AND_COG ────────────────────────────────────────────────────────────

describe('AXLE_AND_COG', () => {
  it('passes for a centred, balanced load', () => {
    // Two equal units straddling mid-deck and centreline.
    const a = unit({ id: 'a', placedX: 5500, placedY: 600, weight: 500, length: 1000, width: 1000 });
    const b = unit({ id: 'b', placedX: 5500, placedY: 900, weight: 500, length: 1000, width: 1000 });
    const errs = ruleAxleAndCog(plan([a, b]), CFG).filter((x) => x.severity === 'error');
    expect(errs).toEqual([]);
  });
  it('flags a rear-biased CoG', () => {
    const a = unit({ id: 'a', placedX: 11000, weight: 1000, length: 1000 });
    const v = ruleAxleAndCog(plan([a]), CFG);
    expect(v.some((x) => x.rule === 'AXLE_AND_COG')).toBe(true);
  });
  it('flags exceeding payload capacity', () => {
    const a = unit({ id: 'a', placedX: 5500, weight: 40000 });
    const v = ruleAxleAndCog(plan([a]), CFG);
    expect(v.some((x) => x.rule === 'AXLE_AND_COG')).toBe(true);
  });
});

// ─── Reference-load shape: mostly side-by-side on the floor ──────────────────

describe('side-by-side on the floor (reference-load shape)', () => {
  it('does not raise false support/overlap errors for floor-level neighbors', () => {
    // Rebar (floor), angle (floor) side by side; only a sheet pair stacks.
    const rebar = unit({ id: 'rebar', stackabilityClass: 'rebar_bundle', floorOnly: true,
      placedX: 0, placedY: 0, placedZ: 0, length: 9000, width: 150, height: 150, weight: 1000 });
    const angle = unit({ id: 'angle', stackabilityClass: 'angle_bundle',
      placedX: 0, placedY: 400, placedZ: 0, length: 6000, width: 300, height: 266, weight: 700 });
    const sheetBottom = unit({ id: 'sb', stackabilityClass: 'sheet_pack_thin',
      placedX: 0, placedY: 1000, placedZ: 0, length: 2400, width: 1200, height: 146, weight: 1600, maxStackWeight: 2000 });
    const sheetTop = unit({ id: 'st', stackabilityClass: 'sheet_pack',
      placedX: 0, placedY: 1000, placedZ: 146, length: 2400, width: 1200, height: 87, weight: 260, maxStackWeight: 1000 });

    const { errors } = validate(plan([rebar, angle, sheetBottom, sheetTop]), CFG);
    // No support/overlap/floor errors: floor items are fully supported, the one
    // real stack (sheet on sheet_thin) is an allowed pairing and within weight.
    const relevant = errors.filter((e) =>
      ['SUPPORT_CONTINUITY', 'NO_OVERLAP', 'FLOOR_ONLY', 'STACK_CLASS_COMPATIBILITY', 'MAX_STACK_WEIGHT'].includes(e.rule),
    );
    expect(relevant).toEqual([]);
  });
});
