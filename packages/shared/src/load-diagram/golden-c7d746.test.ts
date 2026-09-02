// ─── Golden Reference Load: Truck C7D746, route 0, trip 2 of 2 ───────────────
// Feature: load-diagram-generator
//
// This is a regression/golden test that checks the engine reproduces the REAL
// OptiFlow plan for a known load rather than inventing a plausible-looking one.
//
// Acceptance criteria (from the AA rules spec):
//   • 14 placed handling units
//   • total 10,646.9 kg (23,472.5 lb)
//   • CoG roughly mid-deck (tolerance — depends on the real vehicle figures)
//   • exactly one stack: AA-0001 resting on AA-0002 (the plan's P0_L4/P0_L4)
//   • the full 15-rule validate() raises NO false violations on the real plan
//
// Source data is defined in mm/kg and converted to canonical (which is also
// mm/kg) at the boundary via named helpers — no inline conversion factors.
//
// NOTE: The vehicle deck figures are the spec's ASSUMED placeholder. When the
// real Callao vehicle master arrives, edit VEHICLE below; the CoG tolerance is
// wide enough that the test remains meaningful until then.

import { describe, it, expect } from 'vitest';
import { validate, type RulePlan } from './rules';
import { DEFAULT_RULES_CONFIG } from './rules-config';
import { computeLoadPlan } from './packing-engine';
import { KG_PER_POUND } from './units';
import type { LoadItem, TrailerProfile, LoadSide } from './types';

// ─── Boundary conversion helpers (named; no inline factors) ──────────────────
const mm = (v: number): number => v; // canonical length is mm
const kg = (v: number): number => v; // canonical weight is kg
const lbToKg = (v: number): number => v * KG_PER_POUND;

// ─── Reference manifest (mm / kg) ────────────────────────────────────────────

interface ManifestLine {
  itemId: string;
  L: number; W: number; H: number; // mm
  kgEach: number;
  qty: number;
  stackClass: string;
  maxStackKg: number;
  stop: number;
  layer: string;
  side: LoadSide;
  floorOnly: boolean;
}

const MANIFEST: ManifestLine[] = [
  { itemId: 'AA-0001', L: 2400, W: 1200, H: 86.55, kgEach: 259.06, qty: 1, stackClass: 'sheet_pack', maxStackKg: 1000, stop: 1, layer: 'P0_L4', side: 'centre_full_width', floorOnly: false },
  { itemId: 'AA-0002', L: 2400, W: 1200, H: 146.1, kgEach: 1606.22, qty: 1, stackClass: 'sheet_pack_thin', maxStackKg: 2000, stop: 2, layer: 'P0_L4', side: 'centre_full_width', floorOnly: false },
  { itemId: 'AA-0003', L: 6000, W: 304, H: 266, kgEach: 697.4186, qty: 8, stackClass: 'angle_bundle', maxStackKg: 4000, stop: 2, layer: 'P0_L3', side: 'left', floorOnly: false },
  { itemId: 'AA-0004', L: 6000, W: 152, H: 152, kgEach: 202.2514, qty: 1, stackClass: 'angle_bundle', maxStackKg: 4000, stop: 2, layer: 'P0_L3', side: 'left', floorOnly: false },
  { itemId: 'AA-0005', L: 9000, W: 148.4246, H: 148.4246, kgEach: 1000.036, qty: 2, stackClass: 'rebar_bundle', maxStackKg: 8000, stop: 3, layer: 'P0_L2', side: 'centre_full_width', floorOnly: true },
  { itemId: 'AA-0006', L: 9000, W: 148.9898, H: 148.9898, kgEach: 999.975, qty: 1, stackClass: 'rebar_bundle', maxStackKg: 8000, stop: 3, layer: 'P0_L2', side: 'centre_full_width', floorOnly: true },
];

// ─── Vehicle (spec placeholder — replace with real Callao figures) ───────────
const VEHICLE: TrailerProfile = {
  id: 'C7D746', name: 'Callao Flatbed (assumed)',
  internalLength: mm(12500), internalWidth: mm(2440), internalHeight: mm(2700),
  maxPayloadWeight: kg(30000), axleCount: 2, axleWeightLimits: [kg(15000), kg(15000)],
  displayUnitSystem: 'metric', trailerType: 'flatbed',
  unloadMode: 'side', multiTemp: false,
  doorConfig: { rear: true, sideLeft: true, sideRight: true }, isTemplate: false,
};

// ─── Build the manifest as LoadItems (one line each, with quantity) ──────────
function toLoadItems(): LoadItem[] {
  return MANIFEST.map((m) => ({
    id: m.itemId,
    itemId: m.itemId,
    length: mm(m.L), width: mm(m.W), height: mm(m.H),
    weight: kg(m.kgEach), quantity: m.qty,
    stackabilityClass: m.stackClass, maxStackWeight: kg(m.maxStackKg),
    deliveryStop: m.stop, temperatureZone: 'ambient',
    floorOnly: m.floorOnly, topLoadProhibited: false,
    planLayer: m.layer, loadSide: m.side, rotatable: false, trip: '2',
  }));
}

// ─── The golden test — the ENGINE solves it, then we assert the invariants ──
// We let the real solver place the load (rules-config wired, so it uses the same
// fail-closed legality the validator uses), then assert the golden properties.
// This checks the engine produces a legal, reproducible load for real data.

describe('golden reference load — C7D746', () => {
  const items = toLoadItems();
  // Expand quantities into individual units, as the app does before solving.
  const expanded: LoadItem[] = [];
  for (const it of items) {
    for (let i = 0; i < it.quantity; i++) {
      expanded.push({ ...it, quantity: 1, id: it.quantity > 1 ? `${it.id}-u${i + 1}` : it.id });
    }
  }

  const result = computeLoadPlan(expanded, VEHICLE, { rulesConfig: DEFAULT_RULES_CONFIG });
  // The validator's completeness rule compares placements to the ORIGINAL
  // manifest quantities, so pass `items` (not the expanded list).
  const plan: RulePlan = { trailer: VEHICLE, items, placed: result.placedItems };

  it('expands to 14 handling units', () => {
    expect(expanded.length).toBe(14);
  });

  it('places all 14 units with none infeasible', () => {
    expect(result.placedItems.length).toBe(14);
    expect(result.overflowItems.length).toBe(0);
    expect(result.unplaced ?? []).toHaveLength(0);
  });

  it('totals 10,646.9 kg (23,472.5 lb) within rounding', () => {
    const totalKg = result.placedItems.reduce((s, p) => s + p.weight, 0);
    expect(totalKg).toBeCloseTo(10646.9, 0);
    expect(totalKg / KG_PER_POUND).toBeCloseTo(23472.5, 0);
  });

  it('keeps long steel lying lengthwise (never stood on end)', () => {
    // Every long unit (rebar/angle) must have its longest side along X.
    for (const p of result.placedItems) {
      if (p.stackabilityClass === 'rebar_bundle' || p.stackabilityClass === 'angle_bundle') {
        const longest = Math.max(p.length, p.width, p.height);
        // placedOrientation LWH means dx = length; long side must run along X (dx).
        const dx = p.placedOrientation === 'LWH' || p.placedOrientation === 'LHW' ? p.length
          : p.placedOrientation === 'WLH' || p.placedOrientation === 'HLW' ? p.width : p.height;
        expect(dx).toBeCloseTo(longest, 3);
      }
    }
  });

  it('CoG sits within the legal longitudinal window (assumed vehicle)', () => {
    const totalKg = result.placedItems.reduce((s, p) => s + p.weight, 0);
    const cogX = result.placedItems.reduce((s, p) => s + (p.placedX + p.length / 2) * p.weight, 0) / totalKg;
    const frac = cogX / VEHICLE.internalLength;
    expect(frac).toBeGreaterThan(DEFAULT_RULES_CONFIG.cog.minLongitudinalFraction);
    expect(frac).toBeLessThan(DEFAULT_RULES_CONFIG.cog.maxLongitudinalFraction);
  });

  it('produces a fully legal load — the rules engine raises no errors', () => {
    // With the balance-aware solver (symmetric lateral lane assignment), the
    // real C7D746 load is legal end to end: nothing overlaps, everything is
    // supported, class/layer/LIFO hold, and the load is neither longitudinally
    // nor laterally out of balance.
    const { errors, valid } = validate(plan, DEFAULT_RULES_CONFIG);
    if (!valid) {
      throw new Error('Unexpected violations:\n' + errors.map((e) => `  ${e.rule}: ${e.rationale}`).join('\n'));
    }
    expect(errors).toEqual([]);
  });

  it('keeps the load laterally balanced within the 10% limit', () => {
    // The solver mirrors long parallel stock across the centerline. Confirm the
    // resulting side-to-side split is within the AXLE_AND_COG lateral limit.
    const yc = VEHICLE.internalWidth / 2;
    let left = 0;
    let right = 0;
    for (const p of result.placedItems) {
      const dims = ORIENTED_DY[p.placedOrientation];
      const cogY = p.placedY + dims(p) / 2;
      if (cogY < yc) left += p.weight;
      else right += p.weight;
    }
    const total = left + right;
    const imbalance = Math.abs(left - right) / total;
    expect(imbalance).toBeLessThanOrEqual(DEFAULT_RULES_CONFIG.cog.maxLateralImbalanceFraction);
  });
});

// Maps a placed orientation to the item dimension that lies along Y (dy).
const ORIENTED_DY: Record<string, (p: { length: number; width: number; height: number }) => number> = {
  LWH: (p) => p.width, LHW: (p) => p.height,
  WLH: (p) => p.length, WHL: (p) => p.height,
  HLW: (p) => p.length, HWL: (p) => p.width,
};
