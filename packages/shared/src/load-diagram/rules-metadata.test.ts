// ─── Tests for metadata-dependent rules ──────────────────────────────────────
// Feature: load-diagram-generator
// Each rule: a passing case, a deliberate violation, and a data-absent gating
// case (the rule stays silent when its field is missing).

import { describe, it, expect } from 'vitest';
import {
  rulePlanLayerOrder,
  ruleLifoDeliveryOrder,
  ruleLoadSide,
  ruleLongItemOrientation,
  ruleTemperatureZone,
  ruleTripSegregation,
  type RulePlan,
} from './rules';
import { DEFAULT_RULES_CONFIG, resolveRulesConfig } from './rules-config';
import type { PlacedItem, TrailerProfile } from './types';

const CFG = DEFAULT_RULES_CONFIG;

const TRAILER: TrailerProfile = {
  id: 't', name: 'Deck',
  internalLength: 12500, internalWidth: 2440, internalHeight: 2700,
  maxPayloadWeight: 30000, axleCount: 2, axleWeightLimits: [15000, 15000],
  displayUnitSystem: 'metric', trailerType: 'flatbed',
  doorConfig: { rear: true, sideLeft: true, sideRight: true }, isTemplate: false,
};

function unit(over: Partial<PlacedItem> & { id: string }): PlacedItem {
  return {
    itemId: over.itemId ?? over.id,
    length: 1000, width: 1000, height: 1000, weight: 100, quantity: 1,
    floorOnly: false, topLoadProhibited: false,
    placedX: 0, placedY: 0, placedZ: 0, placedOrientation: 'LWH', loadSequence: 1,
    ...over,
  };
}
function plan(placed: PlacedItem[], trailer: TrailerProfile = TRAILER): RulePlan {
  return { trailer, items: placed.map((p) => ({ ...p })), placed };
}

// ─── PLAN_LAYER_ORDER ────────────────────────────────────────────────────────

describe('PLAN_LAYER_ORDER', () => {
  it('passes when higher layer sits on lower', () => {
    const base = unit({ id: 'b', planLayer: 'P0_L2' });
    const top = unit({ id: 't', placedZ: 1000, planLayer: 'P0_L4' });
    expect(rulePlanLayerOrder(plan([base, top]), CFG)).toEqual([]);
  });
  it('flags a lower layer stacked above a higher one', () => {
    const base = unit({ id: 'b', planLayer: 'P0_L4' });
    const top = unit({ id: 't', placedZ: 1000, planLayer: 'P0_L2' });
    expect(rulePlanLayerOrder(plan([base, top]), CFG).length).toBeGreaterThan(0);
  });
  it('is silent when planLayer is absent', () => {
    const base = unit({ id: 'b' });
    const top = unit({ id: 't', placedZ: 1000 });
    expect(rulePlanLayerOrder(plan([base, top]), CFG)).toEqual([]);
  });
  it('fails closed on an unrecognized layer code', () => {
    const base = unit({ id: 'b', planLayer: 'P0_L2' });
    const top = unit({ id: 't', placedZ: 1000, planLayer: 'BOGUS' });
    expect(rulePlanLayerOrder(plan([base, top]), CFG).length).toBeGreaterThan(0);
  });
});

// ─── LIFO_DELIVERY_ORDER ─────────────────────────────────────────────────────

describe('LIFO_DELIVERY_ORDER', () => {
  it('side mode: passes when the earlier-out stop is on top', () => {
    // Stop 1 unloads first, so it must sit on top of a later stop (3).
    const base = unit({ id: 'b', deliveryStop: 3 });
    const top = unit({ id: 't', placedZ: 1000, deliveryStop: 1 });
    expect(ruleLifoDeliveryOrder(plan([base, top]), CFG)).toEqual([]);
  });
  it('side mode: flags an earlier stop trapped under a later stop', () => {
    // Stop 1 (base) unloads first but is trapped under stop 2 (top) — illegal.
    const base = unit({ id: 'b', deliveryStop: 1 });
    const top = unit({ id: 't', placedZ: 1000, deliveryStop: 2 });
    expect(ruleLifoDeliveryOrder(plan([base, top]), CFG).length).toBeGreaterThan(0);
  });
  it('rear mode: flags a later stop not fully forward of an earlier one', () => {
    const rearTrailer: TrailerProfile = { ...TRAILER, unloadMode: 'rear' };
    const early = unit({ id: 'e', deliveryStop: 1, placedX: 0, length: 2000 });
    const late = unit({ id: 'l', deliveryStop: 2, placedX: 1000, length: 2000 }); // overlaps X of early
    expect(ruleLifoDeliveryOrder(plan([early, late], rearTrailer), CFG).length).toBeGreaterThan(0);
  });
  it('is silent when deliveryStop is absent', () => {
    const base = unit({ id: 'b' });
    const top = unit({ id: 't', placedZ: 1000 });
    expect(ruleLifoDeliveryOrder(plan([base, top]), CFG)).toEqual([]);
  });
});

// ─── LOAD_SIDE (warning) ─────────────────────────────────────────────────────

describe('LOAD_SIDE', () => {
  it('passes when a left-hinted item sits left', () => {
    const p = unit({ id: 'a', loadSide: 'left', placedY: 0, width: 800, weight: 500 });
    expect(ruleLoadSide(plan([p]), CFG)).toEqual([]);
  });
  it('warns when a left-hinted item sits right of centre', () => {
    const p = unit({ id: 'a', loadSide: 'left', placedY: 1600, width: 800, weight: 500 });
    const v = ruleLoadSide(plan([p]), CFG);
    expect(v.length).toBe(1);
    expect(v[0].severity).toBe('warning');
  });
  it('is silent when loadSide is absent', () => {
    expect(ruleLoadSide(plan([unit({ id: 'a', placedY: 1600 })]), CFG)).toEqual([]);
  });
});

// ─── LONG_ITEM_ORIENTATION ───────────────────────────────────────────────────

describe('LONG_ITEM_ORIENTATION', () => {
  it('passes a long item lying lengthwise (along X)', () => {
    const p = unit({ id: 'a', length: 9000, width: 150, height: 150, placedOrientation: 'LWH' });
    expect(ruleLongItemOrientation(plan([p]))).toEqual([]);
  });
  it('flags a non-rotatable item turned across the deck', () => {
    // 2000mm long turned so its length runs along Y (WLH puts length on Y).
    const p = unit({ id: 'a', length: 2000, width: 150, height: 150, placedOrientation: 'WLH', rotatable: false });
    expect(ruleLongItemOrientation(plan([p])).length).toBeGreaterThan(0);
  });
  it('flags an item wider than the deck turned across it (can never fit)', () => {
    const p = unit({ id: 'a', length: 9000, width: 150, height: 150, placedOrientation: 'WLH', rotatable: true });
    const v = ruleLongItemOrientation(plan([p]));
    expect(v.length).toBeGreaterThan(0);
  });
  it('allows a rotatable short item across the deck', () => {
    const p = unit({ id: 'a', length: 2000, width: 150, height: 150, placedOrientation: 'WLH', rotatable: true });
    expect(ruleLongItemOrientation(plan([p]))).toEqual([]);
  });
});

// ─── TEMPERATURE_ZONE ────────────────────────────────────────────────────────

describe('TEMPERATURE_ZONE', () => {
  it('passes one zone on a single-temp vehicle', () => {
    const a = unit({ id: 'a', temperatureZone: 'ambient' });
    const b = unit({ id: 'b', placedX: 1100, temperatureZone: 'ambient' });
    expect(ruleTemperatureZone(plan([a, b]))).toEqual([]);
  });
  it('flags mixed zones on a single-temp vehicle', () => {
    const a = unit({ id: 'a', temperatureZone: 'frozen' });
    const b = unit({ id: 'b', placedX: 1100, temperatureZone: 'ambient' });
    expect(ruleTemperatureZone(plan([a, b])).length).toBeGreaterThan(0);
  });
  it('allows mixed zones on a multi-temp vehicle', () => {
    const multi: TrailerProfile = { ...TRAILER, multiTemp: true };
    const a = unit({ id: 'a', temperatureZone: 'frozen' });
    const b = unit({ id: 'b', placedX: 1100, temperatureZone: 'ambient' });
    expect(ruleTemperatureZone(plan([a, b], multi))).toEqual([]);
  });
  it('is silent when no zones are set', () => {
    expect(ruleTemperatureZone(plan([unit({ id: 'a' })]))).toEqual([]);
  });
});

// ─── TRIP_SEGREGATION ────────────────────────────────────────────────────────

describe('TRIP_SEGREGATION', () => {
  it('passes a single trip', () => {
    const a = unit({ id: 'a', trip: '2' });
    const b = unit({ id: 'b', placedX: 1100, trip: '2' });
    expect(ruleTripSegregation(plan([a, b]))).toEqual([]);
  });
  it('flags mixed trips', () => {
    const a = unit({ id: 'a', trip: '1' });
    const b = unit({ id: 'b', placedX: 1100, trip: '2' });
    expect(ruleTripSegregation(plan([a, b])).length).toBeGreaterThan(0);
  });
  it('is silent when trip is absent', () => {
    expect(ruleTripSegregation(plan([unit({ id: 'a' })]))).toEqual([]);
  });
});

// A sanity check that resolveRulesConfig override for unloadMode is honored.
describe('config override', () => {
  it('rear mode via config triggers banding', () => {
    const cfg = resolveRulesConfig({ unloadMode: 'rear' });
    const early = unit({ id: 'e', deliveryStop: 1, placedX: 0, length: 2000 });
    const late = unit({ id: 'l', deliveryStop: 2, placedX: 1000, length: 2000 });
    // Trailer has no unloadMode, so it falls back to config 'rear'.
    expect(ruleLifoDeliveryOrder(plan([early, late]), cfg).length).toBeGreaterThan(0);
  });
});
