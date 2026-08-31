/**
 * Unit tests for PdfExportService.
 *
 * Validates: Requirements 15.1, 15.3
 */

import { describe, it, expect } from 'vitest';
import { PdfExportService, PlanExportData } from './PdfExportService.js';
import { buildPdfExportInput } from './buildPdfExportInput.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createTestPlanData(): PlanExportData {
  return {
    planId: 'plan-001',
    version: 1,
    status: 'draft',
    equipment: {
      tractorName: 'Freightliner Cascadia',
      trailerName: 'Wilson 53ft Combo',
      trailerLengthFt: 53,
      maxGrossWeight: 80000,
      availablePayload: 48000,
    },
    freightManifest: [
      {
        orderNumber: 'ORD-100',
        customerName: 'Acme Steel',
        deliveryStop: 1,
        productType: 'coil_hot_rolled',
        quantity: 2,
        weight: 20000,
      },
      {
        orderNumber: 'ORD-101',
        customerName: 'Beta Metals',
        deliveryStop: 2,
        productType: 'beam_i',
        quantity: 5,
        weight: 15000,
      },
    ],
    placedFreight: [
      {
        orderNumber: 'ORD-100',
        productType: 'coil_hot_rolled',
        position: { x: 60, y: 0, z: 0 },
        orientation: 'transverse',
        layer: 0,
        supportMethod: 'on_dunnage',
        weight: 20000,
      },
      {
        orderNumber: 'ORD-101',
        productType: 'beam_i',
        position: { x: 200, y: -20, z: 0 },
        orientation: 'longitudinal',
        layer: 0,
        supportMethod: 'direct_to_deck',
        weight: 15000,
      },
    ],
    weightMetrics: {
      totalGross: 67000,
      steerAxleWeight: 12000,
      driveAxleWeight: 25000,
      trailerAxleWeight: 30000,
      cgLongitudinal: 240,
      cgLateral: 1.2,
      steerAxlePercent: 92.3,
      driveAxlePercent: 73.5,
      trailerAxlePercent: 88.2,
    },
    securementPlan: {
      items: [
        {
          orderNumber: 'ORD-100',
          tieDownCount: 4,
          requiredWLL: 10000,
          aggregateWLL: 18800,
          tieDownTypes: 'chain',
          anchorAssignments: 'A1, A2, A3, A4',
          notes: ['Chain through coil eye', 'Blocking fore and aft'],
        },
        {
          orderNumber: 'ORD-101',
          tieDownCount: 3,
          requiredWLL: 7500,
          aggregateWLL: 16200,
          tieDownTypes: 'strap',
          anchorAssignments: 'B1, B2, B3',
          notes: ['Edge protectors required'],
        },
      ],
      totalTieDowns: 7,
      totalWLL: 35000,
    },
    loadingSequence: [
      {
        stepNumber: 1,
        itemDescription: '2x Hot-Rolled Coils (ORD-100)',
        positionDescription: 'Place at front-center of deck, 5 feet from headboard',
        orientation: 'transverse',
        dunnage: 'Place coil rack cradle on deck first',
        securement: 'Chain through coil eye, blocking fore and aft',
      },
      {
        stepNumber: 2,
        itemDescription: '5x I-Beams (ORD-101)',
        positionDescription: 'Place at mid-deck, left side, 17 feet from headboard',
        orientation: 'longitudinal',
        dunnage: '',
        securement: 'Apply 3 straps with edge protectors',
      },
    ],
    warnings: [
      {
        severity: 'warning',
        message: 'Lateral weight imbalance of 3.2% detected',
        affectedItems: ['ORD-101'],
        suggestedAction: 'Shift beam bundle 6 inches toward centerline',
      },
      {
        severity: 'info',
        message: 'Dunnage recommended between coils and deck for vibration dampening',
        affectedItems: ['ORD-100'],
      },
    ],
  };
}

// ─── PdfExportService Tests ──────────────────────────────────────────────────

describe('PdfExportService', () => {
  const service = new PdfExportService();

  describe('generateFullPdf', () => {
    it('generates a valid PDF buffer', async () => {
      const data = createTestPlanData();
      const buffer = await service.generateFullPdf(data);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF magic bytes
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('generates PDF with LETTER paper size by default', async () => {
      const data = createTestPlanData();
      const buffer = await service.generateFullPdf(data);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });

    it('generates PDF with A4 paper size when specified', async () => {
      const data = createTestPlanData();
      const buffer = await service.generateFullPdf(data, { paperSize: 'A4' });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('can generate PDF without drawing views', async () => {
      const data = createTestPlanData();
      const withDrawings = await service.generateFullPdf(data, { includeDrawings: true });
      const withoutDrawings = await service.generateFullPdf(data, { includeDrawings: false });

      // PDF without drawings should be smaller (fewer pages)
      expect(withoutDrawings.length).toBeLessThan(withDrawings.length);
    });

    it('handles empty freight manifest gracefully', async () => {
      const data = createTestPlanData();
      data.freightManifest = [];
      data.placedFreight = [];
      data.loadingSequence = [];
      data.securementPlan = { items: [], totalTieDowns: 0, totalWLL: 0 };
      data.warnings = [];

      const buffer = await service.generateFullPdf(data);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('handles warnings of all severity levels', async () => {
      const data = createTestPlanData();
      data.warnings = [
        { severity: 'error', message: 'Overweight on drive axle', affectedItems: ['ORD-100'] },
        { severity: 'warning', message: 'CG offset high', affectedItems: ['ORD-101'], suggestedAction: 'Reposition' },
        { severity: 'info', message: 'Advisory note', affectedItems: [] },
      ];

      const buffer = await service.generateFullPdf(data);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('contains plan ID in generated PDF', async () => {
      const data = createTestPlanData();
      const buffer = await service.generateFullPdf(data);
      const content = buffer.toString('latin1');

      // The plan ID should appear in the PDF content
      expect(content).toContain('plan-001');
    });
  });

  describe('generateSinglePageSummary', () => {
    it('generates a valid PDF buffer', async () => {
      const data = createTestPlanData();
      const buffer = await service.generateSinglePageSummary(data);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('generates a smaller PDF than the full export', async () => {
      const data = createTestPlanData();
      const fullPdf = await service.generateFullPdf(data);
      const summaryPdf = await service.generateSinglePageSummary(data);

      expect(summaryPdf.length).toBeLessThan(fullPdf.length);
    });

    it('handles empty data gracefully', async () => {
      const data = createTestPlanData();
      data.freightManifest = [];
      data.placedFreight = [];
      data.loadingSequence = [];
      data.securementPlan = { items: [], totalTieDowns: 0, totalWLL: 0 };
      data.warnings = [];

      const buffer = await service.generateSinglePageSummary(data);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('contains plan ID in generated summary PDF', async () => {
      const data = createTestPlanData();
      const buffer = await service.generateSinglePageSummary(data);
      const content = buffer.toString('latin1');

      expect(content).toContain('plan-001');
    });
  });
});

// ─── buildPdfExportInput Tests ───────────────────────────────────────────────

describe('buildPdfExportInput', () => {
  it('transforms raw plan data into structured PlanExportData', () => {
    const raw = {
      planId: 'test-plan-123',
      version: 3,
      status: 'approved',
      equipment: {
        tractorName: 'Kenworth T680',
        trailerName: 'Reitnouer MaxMiser 53ft',
        trailerLengthFt: 53,
        maxGrossWeight: 80000,
        availablePayload: 46000,
      },
      freightManifest: [
        {
          orderNumber: 'ORD-200',
          customerName: 'Steel Corp',
          deliveryStop: 1,
          productType: 'plate',
          quantity: 3,
          totalLineWeight: 18000,
        },
      ],
      placedFreight: [
        {
          item: { orderNumber: 'ORD-200', productType: 'plate', totalLineWeight: 18000 },
          position: { x: 100, y: 5, z: 0 },
          orientation: 'longitudinal',
          layer: 0,
          supportMethod: 'direct_to_deck',
        },
      ],
      weightMetrics: {
        totalGross: 60000,
        steerWeight: 11000,
        driveWeight: 22000,
        trailerWeight: 27000,
        cgLongitudinal: 210,
        cgLateral: 0.5,
        axleUtilization: { steer: 85, drive: 65, trailer: 79 },
      },
      securementPlan: {
        plans: [
          {
            itemOrderNumber: 'ORD-200',
            tieDowns: [
              { type: 'chain', anchorPointId: 'A1' },
              { type: 'chain', anchorPointId: 'A2' },
            ],
            requiredWLL: 9000,
            aggregateWLL: 9400,
            notes: ['Edge protection required'],
          },
        ],
      },
      loadingSequence: [
        {
          stepNumber: 1,
          itemDescription: '3x Steel Plate (ORD-200)',
          position: 'Place at center deck, 8 feet from headboard',
          orientation: 'longitudinal',
          dunnageFirst: 'Place dunnage strips',
          securementAfter: '2 chains with binders',
        },
      ],
      warnings: [
        {
          severity: 'warning',
          message: 'CG slightly forward of ideal range',
          affectedItems: ['ORD-200'],
          suggestedAction: 'Move plate 12 inches toward rear',
        },
      ],
    };

    const result = buildPdfExportInput(raw);

    expect(result.planId).toBe('test-plan-123');
    expect(result.version).toBe(3);
    expect(result.status).toBe('approved');
    expect(result.equipment.tractorName).toBe('Kenworth T680');
    expect(result.equipment.availablePayload).toBe(46000);
    expect(result.freightManifest).toHaveLength(1);
    expect(result.freightManifest[0].orderNumber).toBe('ORD-200');
    expect(result.freightManifest[0].weight).toBe(18000);
    expect(result.placedFreight).toHaveLength(1);
    expect(result.placedFreight[0].position.x).toBe(100);
    expect(result.weightMetrics.totalGross).toBe(60000);
    expect(result.weightMetrics.steerAxlePercent).toBe(85);
    expect(result.securementPlan.items).toHaveLength(1);
    expect(result.securementPlan.totalTieDowns).toBe(2);
    expect(result.loadingSequence).toHaveLength(1);
    expect(result.loadingSequence[0].dunnage).toBe('Place dunnage strips');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].severity).toBe('warning');
  });

  it('handles null/missing fields with defaults', () => {
    const result = buildPdfExportInput({
      planId: 'minimal-plan',
      version: 1,
      status: 'draft',
    });

    expect(result.planId).toBe('minimal-plan');
    expect(result.equipment.tractorName).toBe('Unknown');
    expect(result.freightManifest).toEqual([]);
    expect(result.placedFreight).toEqual([]);
    expect(result.weightMetrics.totalGross).toBe(0);
    expect(result.securementPlan.items).toEqual([]);
    expect(result.securementPlan.totalTieDowns).toBe(0);
    expect(result.loadingSequence).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('normalizes warning severity from rule types', () => {
    const result = buildPdfExportInput({
      planId: 'p1',
      version: 1,
      status: 'draft',
      warnings: [
        { severity: 'hard_constraint', message: 'Overweight', affectedItems: [] },
        { severity: 'soft_preference', message: 'CG off', affectedItems: [] },
        { severity: 'advisory', message: 'Note', affectedItems: [] },
      ],
    });

    expect(result.warnings[0].severity).toBe('error');
    expect(result.warnings[1].severity).toBe('warning');
    expect(result.warnings[2].severity).toBe('info');
  });
});
