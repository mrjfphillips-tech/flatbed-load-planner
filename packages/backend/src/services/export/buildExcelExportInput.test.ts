/**
 * Unit Tests for buildExcelExportInput — Transforms raw plan data to typed export format.
 *
 * Tests data extraction, type coercion, and handling of missing/malformed data.
 *
 * Validates: Requirements 15.2
 */

import { describe, it, expect } from 'vitest';
import { buildExcelExportInput } from './buildExcelExportInput.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function createRawPlanData() {
  return {
    planId: 'plan-xyz',
    freightManifest: [
      {
        orderNumber: 'ORD-200',
        customerName: 'Iron Works Inc',
        deliveryStop: 1,
        productType: 'beam_i',
        quantity: 10,
        totalLineWeight: 35000,
        dimensions: { length: 480, width: 12, height: 24 },
        handlingMethod: 'crane',
        stackPermission: 'conditional',
      },
    ],
    placedFreight: [
      {
        item: {
          orderNumber: 'ORD-200',
          customerName: 'Iron Works Inc',
          deliveryStop: 1,
          productType: 'beam_i',
        },
        position: { x: 60, y: 24, z: 0 },
        orientation: 'longitudinal',
        layer: 0,
        supportMethod: 'direct_to_deck',
      },
    ],
    weightMetrics: {
      steerWeight: 11500,
      driveWeight: 26000,
      trailerWeight: 36000,
      totalGross: 73500,
      cgLongitudinal: 240,
      cgLateral: -0.5,
      axleUtilization: {
        steer: 82.1,
        drive: 76.5,
        trailer: 75.0,
      },
      concentratedLoads: [
        { orderNumber: 'ORD-200', loadPSF: 110, maxAllowedPSF: 200 },
      ],
    },
    securementPlan: {
      plans: [
        {
          itemOrderNumber: 'ORD-200',
          requiredWLL: 17500,
          tieDowns: [
            { type: 'chain_with_binder', anchorPointId: 'AP-1' },
            { type: 'chain_with_binder', anchorPointId: 'AP-2' },
            { type: 'strap', anchorPointId: 'AP-3' },
          ],
          additionalSecurement: ['Blocking fore/aft'],
          notes: ['Check torque on binders'],
        },
      ],
    },
    loadingSequence: [
      {
        stepNumber: 1,
        itemDescription: 'I-Beam Bundle 35,000 lbs (ORD-200)',
        position: 'Place longitudinally at front-center of deck',
        orientation: 'longitudinal',
        dunnageFirst: '4x4 dunnage at 10ft intervals',
        securementAfter: 'Apply 3 tie-downs: 2 chains + 1 strap',
      },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildExcelExportInput', () => {
  it('extracts planId correctly', () => {
    const result = buildExcelExportInput(createRawPlanData());
    expect(result.planId).toBe('plan-xyz');
  });

  // ─── Freight Manifest ─────────────────────────────────────────────────────

  describe('freightManifest', () => {
    it('maps fields from manifest array', () => {
      const result = buildExcelExportInput(createRawPlanData());
      expect(result.freightManifest).toHaveLength(1);

      const row = result.freightManifest[0];
      expect(row.orderNumber).toBe('ORD-200');
      expect(row.customerName).toBe('Iron Works Inc');
      expect(row.deliveryStop).toBe(1);
      expect(row.productType).toBe('beam_i');
      expect(row.quantity).toBe(10);
      expect(row.weight).toBe(35000);
      expect(row.length).toBe(480);
      expect(row.width).toBe(12);
      expect(row.height).toBe(24);
      expect(row.handlingMethod).toBe('crane');
      expect(row.stackPermission).toBe('conditional');
    });

    it('falls back to placedFreight items when manifest is null', () => {
      const data = createRawPlanData();
      data.freightManifest = null as any;

      const result = buildExcelExportInput(data);
      expect(result.freightManifest).toHaveLength(1);
      expect(result.freightManifest[0].orderNumber).toBe('ORD-200');
    });

    it('returns empty array when both manifest and placedFreight are null', () => {
      const data = createRawPlanData();
      data.freightManifest = null as any;
      data.placedFreight = null as any;

      const result = buildExcelExportInput(data);
      expect(result.freightManifest).toEqual([]);
    });
  });

  // ─── Placements ───────────────────────────────────────────────────────────

  describe('placements', () => {
    it('extracts position coordinates from nested position object', () => {
      const result = buildExcelExportInput(createRawPlanData());
      expect(result.placements).toHaveLength(1);

      const row = result.placements[0];
      expect(row.orderNumber).toBe('ORD-200');
      expect(row.x).toBe(60);
      expect(row.y).toBe(24);
      expect(row.z).toBe(0);
      expect(row.orientation).toBe('longitudinal');
      expect(row.layer).toBe(0);
      expect(row.supportMethod).toBe('direct_to_deck');
    });

    it('handles flat position fields (no nested position object)', () => {
      const data = createRawPlanData();
      data.placedFreight = [
        {
          orderNumber: 'ORD-300',
          x: 100,
          y: 50,
          z: 12,
          orientation: 'transverse',
          layer: 1,
          supportMethod: 'on_prior_layer',
        } as any,
      ];

      const result = buildExcelExportInput(data);
      const row = result.placements[0];
      expect(row.orderNumber).toBe('ORD-300');
      expect(row.x).toBe(100);
      expect(row.y).toBe(50);
      expect(row.z).toBe(12);
    });

    it('returns empty array when placedFreight is null', () => {
      const data = createRawPlanData();
      data.placedFreight = null as any;

      const result = buildExcelExportInput(data);
      expect(result.placements).toEqual([]);
    });
  });

  // ─── Weight Calculations ──────────────────────────────────────────────────

  describe('weightCalculations', () => {
    it('extracts axle weights and percentages', () => {
      const result = buildExcelExportInput(createRawPlanData());
      const wc = result.weightCalculations;

      expect(wc.steerAxleWeight).toBe(11500);
      expect(wc.driveAxleWeight).toBe(26000);
      expect(wc.trailerAxleWeight).toBe(36000);
      expect(wc.totalGross).toBe(73500);
      expect(wc.cgLongitudinal).toBe(240);
      expect(wc.cgLateral).toBe(-0.5);
      expect(wc.steerAxlePercent).toBe(82.1);
      expect(wc.driveAxlePercent).toBe(76.5);
      expect(wc.trailerAxlePercent).toBe(75.0);
    });

    it('extracts concentrated loads', () => {
      const result = buildExcelExportInput(createRawPlanData());
      const loads = result.weightCalculations.concentratedLoads;

      expect(loads).toHaveLength(1);
      expect(loads[0].orderNumber).toBe('ORD-200');
      expect(loads[0].loadPSF).toBe(110);
      expect(loads[0].maxAllowedPSF).toBe(200);
    });

    it('returns zeroed metrics when weightMetrics is null', () => {
      const data = createRawPlanData();
      data.weightMetrics = null as any;

      const result = buildExcelExportInput(data);
      const wc = result.weightCalculations;

      expect(wc.steerAxleWeight).toBe(0);
      expect(wc.driveAxleWeight).toBe(0);
      expect(wc.trailerAxleWeight).toBe(0);
      expect(wc.totalGross).toBe(0);
      expect(wc.concentratedLoads).toEqual([]);
    });

    it('handles alternative field names (steerAxleWeight vs steerWeight)', () => {
      const data = createRawPlanData();
      // Use alternative naming
      data.weightMetrics = {
        steerAxleWeight: 12000,
        driveAxleWeight: 27000,
        trailerAxleWeight: 37000,
        totalGrossWeight: 76000,
        cgLongitudinal: 230,
        lateralCGOffset: 2.0,
        steerAxlePercent: 80,
        driveAxlePercent: 79,
        trailerAxlePercent: 77,
      } as any;

      const result = buildExcelExportInput(data);
      const wc = result.weightCalculations;

      expect(wc.steerAxleWeight).toBe(12000);
      expect(wc.driveAxleWeight).toBe(27000);
      expect(wc.trailerAxleWeight).toBe(37000);
      expect(wc.totalGross).toBe(76000);
      expect(wc.cgLateral).toBe(2.0);
    });
  });

  // ─── Securement Requirements ──────────────────────────────────────────────

  describe('securementRequirements', () => {
    it('extracts securement plan data with tie-down details', () => {
      const result = buildExcelExportInput(createRawPlanData());
      expect(result.securementRequirements).toHaveLength(1);

      const row = result.securementRequirements[0];
      expect(row.orderNumber).toBe('ORD-200');
      expect(row.tieDownCount).toBe(3);
      expect(row.requiredWLL).toBe(17500);
      expect(row.tieDownTypes).toBe('chain_with_binder, strap');
      expect(row.anchorAssignments).toBe('AP-1, AP-2, AP-3');
      expect(row.specialSecurement).toContain('Blocking fore/aft');
      expect(row.specialSecurement).toContain('Check torque on binders');
    });

    it('returns empty array when securementPlan is null', () => {
      const data = createRawPlanData();
      data.securementPlan = null as any;

      const result = buildExcelExportInput(data);
      expect(result.securementRequirements).toEqual([]);
    });
  });

  // ─── Loading Sequence ─────────────────────────────────────────────────────

  describe('loadingSequence', () => {
    it('extracts loading step fields', () => {
      const result = buildExcelExportInput(createRawPlanData());
      expect(result.loadingSequence).toHaveLength(1);

      const step = result.loadingSequence[0];
      expect(step.stepNumber).toBe(1);
      expect(step.itemDescription).toBe('I-Beam Bundle 35,000 lbs (ORD-200)');
      expect(step.positionDescription).toBe('Place longitudinally at front-center of deck');
      expect(step.orientation).toBe('longitudinal');
      expect(step.dunnage).toBe('4x4 dunnage at 10ft intervals');
      expect(step.securement).toBe('Apply 3 tie-downs: 2 chains + 1 strap');
    });

    it('assigns step numbers from index when stepNumber missing', () => {
      const data = createRawPlanData();
      data.loadingSequence = [
        {
          itemDescription: 'Item A',
          position: 'Front',
          orientation: 'longitudinal',
          dunnageFirst: 'Wood',
          securementAfter: 'Chain',
        } as any,
        {
          itemDescription: 'Item B',
          position: 'Rear',
          orientation: 'transverse',
          dunnageFirst: 'None',
          securementAfter: 'Strap',
        } as any,
      ];

      const result = buildExcelExportInput(data);
      expect(result.loadingSequence[0].stepNumber).toBe(1);
      expect(result.loadingSequence[1].stepNumber).toBe(2);
    });

    it('returns empty array when loadingSequence is null', () => {
      const data = createRawPlanData();
      data.loadingSequence = null as any;

      const result = buildExcelExportInput(data);
      expect(result.loadingSequence).toEqual([]);
    });
  });
});
