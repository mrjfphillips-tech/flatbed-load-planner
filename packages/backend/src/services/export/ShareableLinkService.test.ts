/**
 * Unit Tests for ShareableLinkService — Token generation, decoding, validation,
 * and role-appropriate view building.
 *
 * Validates: Requirements 15.4, 15.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShareableLinkService,
  InvalidShareTokenError,
  ShareTokenExpiredError,
  isShareableRole,
} from './ShareableLinkService.js';
import type {
  GenerateShareLinkInput,
  ShareTokenPayload,
} from './ShareableLinkService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createDefaultInput(overrides?: Partial<GenerateShareLinkInput>): GenerateShareLinkInput {
  return {
    planId: 'plan-001',
    role: 'Planner',
    createdBy: 'user-123',
    ...overrides,
  };
}

function createMockPlanData(overrides?: Partial<{ plan: Record<string, unknown>; currentVersion: Record<string, unknown> }>) {
  return {
    plan: {
      id: 'plan-001',
      status: 'approved',
      freightManifest: [
        { orderNumber: 'ORD-001', customerName: 'Acme Steel', deliveryStop: 1, productType: 'plate', weight: 5000 },
        { orderNumber: 'ORD-002', customerName: 'Acme Steel', deliveryStop: 1, productType: 'beam_i', weight: 8000 },
        { orderNumber: 'ORD-003', customerName: 'Global Metals', deliveryStop: 2, productType: 'coil_hot_rolled', weight: 12000 },
        { orderNumber: 'ORD-004', customerName: 'Pacific Iron', deliveryStop: 3, productType: 'pipe', weight: 6000 },
      ],
      ...overrides?.plan,
    },
    currentVersion: {
      versionNumber: 2,
      placedFreight: [
        { item: { orderNumber: 'ORD-001', customerName: 'Acme Steel', deliveryStop: 1, productType: 'plate' }, position: { x: 10, y: 20, z: 0 } },
        { item: { orderNumber: 'ORD-002', customerName: 'Acme Steel', deliveryStop: 1, productType: 'beam_i' }, position: { x: 100, y: 20, z: 0 } },
        { item: { orderNumber: 'ORD-003', customerName: 'Global Metals', deliveryStop: 2, productType: 'coil_hot_rolled' }, position: { x: 200, y: 30, z: 0 } },
        { item: { orderNumber: 'ORD-004', customerName: 'Pacific Iron', deliveryStop: 3, productType: 'pipe' }, position: { x: 300, y: 10, z: 0 } },
      ],
      weightMetrics: { totalGross: 60000, steerAxle: 12000, driveAxle: 20000, trailerAxle: 28000 },
      securementPlan: { tieDowns: [{ id: 'td-1', type: 'chain' }], totalWLL: 25000 },
      loadingSequence: [
        { stepNumber: 1, itemDescription: 'ORD-001 - plate' },
        { stepNumber: 2, itemDescription: 'ORD-002 - beam_i' },
        { stepNumber: 3, itemDescription: 'ORD-003 - coil_hot_rolled' },
        { stepNumber: 4, itemDescription: 'ORD-004 - pipe' },
      ],
      warnings: [{ ruleId: 'cg-position', message: 'CG slightly forward' }],
      ...overrides?.currentVersion,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShareableLinkService', () => {
  let service: ShareableLinkService;

  beforeEach(() => {
    service = new ShareableLinkService();
  });

  // ─── Token Generation ─────────────────────────────────────────────────────

  describe('generateShareToken', () => {
    it('generates a non-empty base64url token for valid input', () => {
      const token = service.generateShareToken(createDefaultInput());

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
      // base64url: alphanumeric + _ and -
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates tokens for all shareable roles', () => {
      const roles = ['Planner', 'Supervisor', 'Loader', 'Driver'] as const;

      for (const role of roles) {
        const token = service.generateShareToken(createDefaultInput({ role }));
        expect(token.length).toBeGreaterThan(0);
      }
    });

    it('generates token for Customer_Viewer with customerName', () => {
      const token = service.generateShareToken(
        createDefaultInput({ role: 'Customer_Viewer', customerName: 'Acme Steel' })
      );

      expect(token.length).toBeGreaterThan(0);
    });

    it('throws InvalidShareTokenError when planId is empty', () => {
      expect(() =>
        service.generateShareToken(createDefaultInput({ planId: '' }))
      ).toThrow(InvalidShareTokenError);
    });

    it('throws InvalidShareTokenError when role is invalid', () => {
      expect(() =>
        service.generateShareToken(createDefaultInput({ role: 'InvalidRole' as any }))
      ).toThrow(InvalidShareTokenError);
    });

    it('throws InvalidShareTokenError when Customer_Viewer missing customerName', () => {
      expect(() =>
        service.generateShareToken(createDefaultInput({ role: 'Customer_Viewer' }))
      ).toThrow(InvalidShareTokenError);
    });

    it('throws InvalidShareTokenError when Customer_Viewer has empty customerName', () => {
      expect(() =>
        service.generateShareToken(createDefaultInput({ role: 'Customer_Viewer', customerName: '   ' }))
      ).toThrow(InvalidShareTokenError);
    });

    it('includes expiration when expiresInHours is provided', () => {
      const token = service.generateShareToken(
        createDefaultInput({ expiresInHours: 24 })
      );

      const payload = service.decodeShareToken(token);
      expect(payload.expiresAt).toBeDefined();

      const expiresAt = new Date(payload.expiresAt!);
      const now = Date.now();
      // Should expire roughly 24 hours from now (within 1 minute tolerance)
      const expectedMs = 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime() - now).toBeGreaterThan(expectedMs - 60000);
      expect(expiresAt.getTime() - now).toBeLessThan(expectedMs + 60000);
    });

    it('does not include expiresAt when expiresInHours is not provided', () => {
      const token = service.generateShareToken(createDefaultInput());
      const payload = service.decodeShareToken(token);
      expect(payload.expiresAt).toBeUndefined();
    });
  });

  // ─── Token Decoding ───────────────────────────────────────────────────────

  describe('decodeShareToken', () => {
    it('round-trips: decode(generate(input)) recovers planId and role', () => {
      const input = createDefaultInput({ role: 'Loader' });
      const token = service.generateShareToken(input);
      const payload = service.decodeShareToken(token);

      expect(payload.planId).toBe('plan-001');
      expect(payload.role).toBe('Loader');
      expect(payload.createdBy).toBe('user-123');
      expect(payload.createdAt).toBeDefined();
    });

    it('round-trips customerName for Customer_Viewer tokens', () => {
      const input = createDefaultInput({ role: 'Customer_Viewer', customerName: 'Acme Steel' });
      const token = service.generateShareToken(input);
      const payload = service.decodeShareToken(token);

      expect(payload.customerName).toBe('Acme Steel');
      expect(payload.role).toBe('Customer_Viewer');
    });

    it('throws InvalidShareTokenError for empty token', () => {
      expect(() => service.decodeShareToken('')).toThrow(InvalidShareTokenError);
    });

    it('throws InvalidShareTokenError for malformed base64', () => {
      expect(() => service.decodeShareToken('not-valid-json!!!')).toThrow(InvalidShareTokenError);
    });

    it('throws InvalidShareTokenError when decoded payload missing planId', () => {
      const payload = { role: 'Planner', createdAt: new Date().toISOString(), createdBy: 'u1' };
      const token = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
      expect(() => service.decodeShareToken(token)).toThrow(InvalidShareTokenError);
    });

    it('throws InvalidShareTokenError when decoded payload has invalid role', () => {
      const payload = { planId: 'p1', role: 'Hacker', createdAt: new Date().toISOString(), createdBy: 'u1' };
      const token = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
      expect(() => service.decodeShareToken(token)).toThrow(InvalidShareTokenError);
    });

    it('throws InvalidShareTokenError for Customer_Viewer token without customerName', () => {
      const payload = { planId: 'p1', role: 'Customer_Viewer', createdAt: new Date().toISOString(), createdBy: 'u1' };
      const token = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
      expect(() => service.decodeShareToken(token)).toThrow(InvalidShareTokenError);
    });

    it('throws ShareTokenExpiredError for expired token', () => {
      const payload: ShareTokenPayload = {
        planId: 'plan-001',
        role: 'Planner',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        createdBy: 'user-1',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
      };
      const token = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');

      expect(() => service.decodeShareToken(token)).toThrow(ShareTokenExpiredError);
    });

    it('does not throw for non-expired token with expiresAt in the future', () => {
      const payload: ShareTokenPayload = {
        planId: 'plan-001',
        role: 'Planner',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      };
      const token = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');

      const decoded = service.decodeShareToken(token);
      expect(decoded.planId).toBe('plan-001');
    });
  });

  // ─── Role Validation Helper ───────────────────────────────────────────────

  describe('isShareableRole', () => {
    it('returns true for all valid shareable roles', () => {
      expect(isShareableRole('Planner')).toBe(true);
      expect(isShareableRole('Supervisor')).toBe(true);
      expect(isShareableRole('Loader')).toBe(true);
      expect(isShareableRole('Driver')).toBe(true);
      expect(isShareableRole('Customer_Viewer')).toBe(true);
    });

    it('returns false for invalid roles', () => {
      expect(isShareableRole('Admin')).toBe(false);
      expect(isShareableRole('Administrator')).toBe(false);
      expect(isShareableRole('')).toBe(false);
      expect(isShareableRole('planner')).toBe(false); // case-sensitive
    });
  });

  // ─── Shared View Building ─────────────────────────────────────────────────

  describe('buildSharedView', () => {
    describe('Planner/Supervisor role — full plan view (Req 15.4)', () => {
      it('returns full_plan type with all plan data for Planner', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Planner',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);

        expect(view.planId).toBe('plan-001');
        expect(view.role).toBe('Planner');
        expect(view.data.type).toBe('full_plan');

        const data = view.data as any;
        expect(data.plan).toBeDefined();
        expect(data.currentVersion).toBeDefined();
        expect(data.weightMetrics).toBeDefined();
        expect(data.securementPlan).toBeDefined();
        expect(data.loadingSequence).toBeDefined();
        expect(data.warnings).toBeDefined();
        expect(data.placedFreight).toBeDefined();
        expect(data.freightManifest).toBeDefined();
      });

      it('returns full_plan type with all plan data for Supervisor', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Supervisor',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);

        expect(view.role).toBe('Supervisor');
        expect(view.data.type).toBe('full_plan');
      });
    });

    describe('Loader role — loading instructions view (Req 15.4)', () => {
      it('returns loading_instructions type with sequence and securement only', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Loader',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);

        expect(view.planId).toBe('plan-001');
        expect(view.role).toBe('Loader');
        expect(view.data.type).toBe('loading_instructions');

        const data = view.data as any;
        expect(data.loadingSequence).toBeDefined();
        expect(data.securementPlan).toBeDefined();
        expect(data.version).toBe(2);
        // Should NOT have full plan data
        expect(data.plan).toBeUndefined();
        expect(data.weightMetrics).toBeUndefined();
        expect(data.warnings).toBeUndefined();
      });
    });

    describe('Driver role — verification checklist view (Req 15.4)', () => {
      it('returns verification_checklist type with item checks', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Driver',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);

        expect(view.planId).toBe('plan-001');
        expect(view.role).toBe('Driver');
        expect(view.data.type).toBe('verification_checklist');

        const data = view.data as any;
        expect(data.checklist).toBeDefined();
        expect(Array.isArray(data.checklist)).toBe(true);
        expect(data.checklist.length).toBe(4); // 4 placed freight items
        expect(data.version).toBe(2);
      });

      it('checklist items include required verification checks', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Driver',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);
        const data = view.data as any;

        for (const item of data.checklist) {
          expect(item.itemId).toBeDefined();
          expect(item.description).toBeDefined();
          expect(item.checks).toBeDefined();
          expect(item.checks.length).toBeGreaterThan(0);
          // Verify standard checklist items are present
          expect(item.checks).toContain('Item present on trailer and matches plan position');
          expect(item.checks).toContain('Securement applied and tensioned correctly');
          expect(item.checks).toContain('No visible freight damage');
        }
      });
    });

    describe('Customer_Viewer role — customer items view (Req 15.5)', () => {
      it('returns customer_items type with only that customer items', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Customer_Viewer',
          customerName: 'Acme Steel',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);

        expect(view.planId).toBe('plan-001');
        expect(view.role).toBe('Customer_Viewer');
        expect(view.customerName).toBe('Acme Steel');
        expect(view.data.type).toBe('customer_items');

        const data = view.data as any;
        expect(data.customerName).toBe('Acme Steel');
        expect(data.items.length).toBe(2); // ORD-001 and ORD-002

        // Verify all items belong to Acme Steel
        for (const item of data.items) {
          const itemData = item.item ?? item;
          expect(itemData.customerName).toBe('Acme Steel');
        }
      });

      it('does not include items from other customers', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Customer_Viewer',
          customerName: 'Acme Steel',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);
        const data = view.data as any;

        // No items from Global Metals or Pacific Iron should appear
        for (const item of data.items) {
          const itemData = item.item ?? item;
          expect(itemData.customerName).not.toBe('Global Metals');
          expect(itemData.customerName).not.toBe('Pacific Iron');
        }
      });

      it('returns correct delivery stops for the customer', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Customer_Viewer',
          customerName: 'Acme Steel',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);
        const data = view.data as any;

        expect(data.deliveryStops).toEqual([1]); // Acme Steel is on stop 1
      });

      it('returns empty items for a customer not in the plan', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Customer_Viewer',
          customerName: 'NonExistent Corp',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);
        const data = view.data as any;

        expect(data.items).toHaveLength(0);
        expect(data.deliveryStops).toHaveLength(0);
      });

      it('customer filter is case-insensitive', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Customer_Viewer',
          customerName: 'acme steel', // lowercase
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = createMockPlanData();

        const view = service.buildSharedView(payload, planData);
        const data = view.data as any;

        // Should still match Acme Steel (case-insensitive)
        expect(data.items.length).toBe(2);
      });
    });

    describe('handles missing version data gracefully', () => {
      it('returns null fields when version data is empty', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Planner',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = { plan: { id: 'plan-001' }, currentVersion: {} };

        const view = service.buildSharedView(payload, planData);
        const data = view.data as any;

        expect(data.type).toBe('full_plan');
        expect(data.weightMetrics).toBeNull();
        expect(data.securementPlan).toBeNull();
        expect(data.loadingSequence).toBeNull();
        expect(data.placedFreight).toBeNull();
      });

      it('Driver view returns empty checklist when no placed freight', () => {
        const payload: ShareTokenPayload = {
          planId: 'plan-001',
          role: 'Driver',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        };
        const planData = { plan: { id: 'plan-001' }, currentVersion: {} };

        const view = service.buildSharedView(payload, planData);
        const data = view.data as any;

        expect(data.type).toBe('verification_checklist');
        expect(data.checklist).toHaveLength(0);
      });
    });
  });

  // ─── End-to-end Token Flow ────────────────────────────────────────────────

  describe('end-to-end token flow', () => {
    it('generate → decode → buildSharedView produces correct Loader view', () => {
      const token = service.generateShareToken({
        planId: 'plan-001',
        role: 'Loader',
        createdBy: 'supervisor-1',
        expiresInHours: 48,
      });

      const payload = service.decodeShareToken(token);
      const planData = createMockPlanData();
      const view = service.buildSharedView(payload, planData);

      expect(view.role).toBe('Loader');
      expect(view.data.type).toBe('loading_instructions');
      const data = view.data as any;
      expect(data.loadingSequence.length).toBe(4);
    });

    it('generate → decode → buildSharedView produces correct Customer_Viewer view', () => {
      const token = service.generateShareToken({
        planId: 'plan-001',
        role: 'Customer_Viewer',
        createdBy: 'planner-1',
        customerName: 'Global Metals',
      });

      const payload = service.decodeShareToken(token);
      const planData = createMockPlanData();
      const view = service.buildSharedView(payload, planData);

      expect(view.role).toBe('Customer_Viewer');
      expect(view.data.type).toBe('customer_items');
      const data = view.data as any;
      expect(data.customerName).toBe('Global Metals');
      expect(data.items.length).toBe(1); // Only ORD-003
      expect(data.deliveryStops).toEqual([2]);
    });
  });
});
