// ─── Tests for the Load Diagram Store ────────────────────────────────────────
// Feature: load-diagram-generator
// Validates: Requirements 10.1, 10.4 — changing display units must NOT mutate
// canonical item/plan data.

import { describe, it, expect, beforeEach } from 'vitest';
import { useLoadDiagramStore } from './load-diagram-store';
import type { loadDiagram } from '@ptv-discovery-coach/shared';

const parseResult: loadDiagram.ExcelParseResult = {
  items: [
    {
      id: 'a',
      itemId: 'A',
      length: 1200,
      width: 800,
      height: 1000,
      weight: 450,
      quantity: 1,
      floorOnly: false,
      topLoadProhibited: false,
    },
  ],
  detectedUnitSystem: 'imperial',
  errors: [],
  summary: { totalItems: 1, totalWeight: 450, totalVolume: 960_000_000 },
};

describe('load-diagram store', () => {
  beforeEach(() => {
    useLoadDiagramStore.getState().reset();
  });

  it('defaults display unit to the detected source unit on upload', () => {
    useLoadDiagramStore.getState().setUploadResult(parseResult);
    const s = useLoadDiagramStore.getState();
    expect(s.sourceUnitSystem).toBe('imperial');
    expect(s.displayUnitSystem).toBe('imperial');
    expect(s.items).toHaveLength(1);
  });

  it('changing display unit does not mutate canonical item values', () => {
    const store = useLoadDiagramStore.getState();
    store.setUploadResult(parseResult);

    const before = useLoadDiagramStore.getState().items[0];
    const canonicalLength = before.length;
    const canonicalWeight = before.weight;

    store.setDisplayUnitSystem('metric');
    store.setDisplayUnitSystem('imperial');
    store.setDisplayUnitSystem('metric');

    const after = useLoadDiagramStore.getState().items[0];
    expect(after.length).toBe(canonicalLength);
    expect(after.weight).toBe(canonicalWeight);
    expect(useLoadDiagramStore.getState().displayUnitSystem).toBe('metric');
  });

  it('resets to initial state', () => {
    const store = useLoadDiagramStore.getState();
    store.setUploadResult(parseResult);
    store.selectTrailer('t1');
    store.reset();
    const s = useLoadDiagramStore.getState();
    expect(s.items).toHaveLength(0);
    expect(s.selectedTrailerId).toBeNull();
    expect(s.currentStep).toBe(1);
  });
});
