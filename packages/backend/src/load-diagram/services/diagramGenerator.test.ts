// ─── Tests for the PDF Diagram Generator ─────────────────────────────────────
// Feature: load-diagram-generator
// Validates: Requirements 4.5, 4.6, 7.1, 7.3, 10.6

import { describe, it, expect } from 'vitest';
import { generatePDF } from './diagramGenerator';
import { loadDiagram } from '@ptv-discovery-coach/shared';

type LoadPlan = loadDiagram.LoadPlan;

const TRAILER: loadDiagram.TrailerProfile = {
  id: 't1',
  name: 'Test Trailer',
  internalLength: 13600,
  internalWidth: 2480,
  internalHeight: 2700,
  maxPayloadWeight: 24000,
  axleCount: 3,
  axleWeightLimits: [8000, 8000, 8000],
  displayUnitSystem: 'metric',
  trailerType: 'enclosed',
  doorConfig: { rear: true, sideLeft: false, sideRight: false },
  isTemplate: false,
};

function placed(
  id: string,
  x: number,
  weight: number,
  stop: number,
  seq: number,
): loadDiagram.PlacedItem {
  return {
    id,
    itemId: id,
    length: 1200,
    width: 800,
    height: 1000,
    weight,
    quantity: 1,
    floorOnly: false,
    topLoadProhibited: false,
    deliveryStop: stop,
    placedX: x,
    placedY: 0,
    placedZ: 0,
    placedOrientation: 'LWH',
    loadSequence: seq,
  };
}

function makePlan(unit: loadDiagram.UnitSystem): LoadPlan {
  return {
    id: 'plan-1',
    trailerProfile: TRAILER,
    items: [placed('A', 0, 400, 2, 1), placed('B', 1300, 250, 1, 2)],
    totalWeight: 650,
    volumeUtilization: 12.3,
    axleWeights: [200, 250, 200],
    sourceUnitSystem: 'metric',
    displayUnitSystem: unit,
    status: 'computed',
  };
}

async function isValidPdf(buf: Buffer): Promise<boolean> {
  // A valid PDF starts with "%PDF-".
  return buf.length > 100 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
}

describe('generatePDF', () => {
  for (const unit of ['metric', 'imperial'] as const) {
    it(`produces a valid PDF buffer for ${unit} units`, async () => {
      const pdf = await generatePDF(makePlan(unit), {
        format: 'pdf',
        paperSize: 'A4',
        unitSystem: unit,
        includeChecklist: true,
        includeSummary: true,
        views: ['topDown', 'sideView'],
      });
      expect(await isValidPdf(pdf)).toBe(true);
    });
  }

  it('supports A3 paper size', async () => {
    const pdf = await generatePDF(makePlan('metric'), {
      format: 'pdf',
      paperSize: 'A3',
      unitSystem: 'metric',
      includeChecklist: false,
      includeSummary: true,
      views: ['topDown'],
    });
    expect(await isValidPdf(pdf)).toBe(true);
  });

  it('handles a plan with overflow items without error', async () => {
    const plan = makePlan('metric');
    plan.overflowItems = [
      {
        id: 'C',
        itemId: 'C',
        length: 5000,
        width: 5000,
        height: 5000,
        weight: 9999,
        quantity: 1,
        floorOnly: false,
        topLoadProhibited: false,
      },
    ];
    const pdf = await generatePDF(plan, {
      format: 'pdf',
      paperSize: 'A4',
      unitSystem: 'metric',
      includeChecklist: true,
      includeSummary: true,
      views: ['topDown', 'sideView'],
    });
    expect(await isValidPdf(pdf)).toBe(true);
  });
});
