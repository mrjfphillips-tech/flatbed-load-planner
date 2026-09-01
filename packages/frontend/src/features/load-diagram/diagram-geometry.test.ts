// ─── Tests for Diagram Geometry Helpers ──────────────────────────────────────
// Feature: load-diagram-generator

import { describe, it, expect } from 'vitest';
import { extents, stopColor, distinctStops, STOP_PALETTE } from './diagram-geometry';
import type { loadDiagram } from '@ptv-discovery-coach/shared';

function placed(overrides: Partial<loadDiagram.PlacedItem>): loadDiagram.PlacedItem {
  return {
    id: 'x',
    itemId: 'X',
    length: 1200,
    width: 800,
    height: 500,
    weight: 100,
    quantity: 1,
    floorOnly: false,
    topLoadProhibited: false,
    placedX: 0,
    placedY: 0,
    placedZ: 0,
    placedOrientation: 'LWH',
    loadSequence: 1,
    ...overrides,
  };
}

describe('extents', () => {
  it('maps LWH to (length, width, height)', () => {
    const e = extents(placed({ placedOrientation: 'LWH' }));
    expect(e).toEqual({ dx: 1200, dy: 800, dz: 500 });
  });

  it('maps WHL to (width, height, length)', () => {
    const e = extents(placed({ placedOrientation: 'WHL' }));
    expect(e).toEqual({ dx: 800, dy: 500, dz: 1200 });
  });

  it('maps HLW to (height, length, width)', () => {
    const e = extents(placed({ placedOrientation: 'HLW' }));
    expect(e).toEqual({ dx: 500, dy: 1200, dz: 800 });
  });
});

describe('stopColor', () => {
  it('is deterministic and cycles the palette', () => {
    expect(stopColor(0)).toBe(STOP_PALETTE[0]);
    expect(stopColor(STOP_PALETTE.length)).toBe(STOP_PALETTE[0]);
    expect(stopColor(undefined)).toBe(STOP_PALETTE[0]);
  });
});

describe('distinctStops', () => {
  it('returns sorted unique stops, ignoring undefined', () => {
    const items = [
      placed({ deliveryStop: 3 }),
      placed({ deliveryStop: 1 }),
      placed({ deliveryStop: 3 }),
      placed({ deliveryStop: undefined }),
    ];
    expect(distinctStops(items)).toEqual([1, 3]);
  });
});
