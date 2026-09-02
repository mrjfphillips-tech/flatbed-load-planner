// ─── Tests for the Suggested Cargo Height Heuristic ──────────────────────────
// Feature: load-diagram-generator

import { describe, it, expect } from 'vitest';
import { suggestedCargoHeight } from './suggested-height';

describe('suggestedCargoHeight', () => {
  it('is bounded by the legal ceiling for a light, wide load', () => {
    // Large deck but modest payload keeps the weight bound above the ceiling.
    // area = 13.6*2.48 = 33.7 m^2; volume = 40000/300 = 133 m^3 (very light dense
    // cap) -> weight height ~3956 mm; stability 2976; legal 2700 wins.
    const r = suggestedCargoHeight(13600, 2480, 40000);
    expect(r.boundBy).toBe('legal');
    expect(r.heightMm).toBe(2700);
  });

  it('is bounded by weight for a fully-loaded dense trailer', () => {
    // 13.6 m x 2.48 m at 24 t: weight bound ~2372 mm binds before legal/stability.
    const r = suggestedCargoHeight(13600, 2480, 24000);
    expect(r.boundBy).toBe('weight');
    expect(r.heightMm).toBe(2372);
  });

  it('is bounded by stability for a narrow deck', () => {
    // Narrow 1.5 m deck: stability = 1500*1.2 = 1800 < 2700 legal.
    const r = suggestedCargoHeight(13600, 1500, 24000);
    expect(r.boundBy).toBe('stability');
    expect(r.heightMm).toBe(1800);
  });

  it('is bounded by weight for a low-capacity vehicle', () => {
    // Big deck, tiny payload -> weight bound is the lowest.
    // area = 6*2.3 = 13.8 m^2; volume = 2000/300 = 6.667 m^3;
    // height = 6.667/13.8 = 0.483 m = 483 mm -> floored to 500.
    const r = suggestedCargoHeight(6000, 2300, 2000);
    expect(r.boundBy).toBe('weight');
    expect(r.heightMm).toBe(500); // floor applied
  });

  it('respects tunable options', () => {
    // Light load so the weight bound is high; stability (2976) beats a raised
    // 3000 legal ceiling.
    const r = suggestedCargoHeight(13600, 2480, 60000, { legalCeilingMm: 3000 });
    expect(r.boundBy).toBe('stability');
    expect(r.heightMm).toBe(2976);
  });

  it('never returns below the floor', () => {
    const r = suggestedCargoHeight(1000, 1000, 10, { floorMm: 500 });
    expect(r.heightMm).toBeGreaterThanOrEqual(500);
  });
});
