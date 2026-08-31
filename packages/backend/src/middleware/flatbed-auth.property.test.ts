// ─── Property-Based Tests for RBAC ───────────────────────────────────────────
// Feature: flatbed-load-planner, Property 16: Role-based access control enforcement
// Validates: Requirements 17.2, 17.4, 17.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  FlatbedRole,
  FlatbedAction,
  ROLE_PERMISSIONS,
  ADMIN_ONLY_ACTIONS,
  getEffectivePermissions,
  hasPermission,
} from './flatbed-auth.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ROLES: FlatbedRole[] = [
  'Planner',
  'Loader',
  'Driver',
  'Supervisor',
  'Administrator',
  'Customer_Viewer',
];

const NON_ADMIN_ROLES: FlatbedRole[] = [
  'Planner',
  'Loader',
  'Driver',
  'Supervisor',
  'Customer_Viewer',
];

const ALL_ACTIONS: FlatbedAction[] = [
  'plan:create',
  'plan:edit',
  'plan:submit',
  'plan:view',
  'plan:approve',
  'plan:reject',
  'plan:override',
  'instructions:view',
  'instructions:mark_complete',
  'checklist:view',
  'checklist:complete',
  'equipment:manage',
  'rules:manage',
  'users:manage',
  'assigned_items:view',
];

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates a non-empty subset of flatbed roles.
 */
function arbitraryRoleSet(): fc.Arbitrary<FlatbedRole[]> {
  return fc
    .subarray(ALL_ROLES, { minLength: 1, maxLength: ALL_ROLES.length })
    .map((roles) => [...new Set(roles)]);
}

/**
 * Generates a non-empty subset of non-admin roles only.
 */
function arbitraryNonAdminRoleSet(): fc.Arbitrary<FlatbedRole[]> {
  return fc
    .subarray(NON_ADMIN_ROLES, { minLength: 1, maxLength: NON_ADMIN_ROLES.length })
    .map((roles) => [...new Set(roles)]);
}

/**
 * Generates a random action from the full action set.
 */
function arbitraryAction(): fc.Arbitrary<FlatbedAction> {
  return fc.constantFrom(...ALL_ACTIONS);
}

/**
 * Generates a random admin-only action.
 */
function arbitraryAdminOnlyAction(): fc.Arbitrary<FlatbedAction> {
  return fc.constantFrom(...ADMIN_ONLY_ACTIONS);
}

// ─── Property 16: Role-based access control enforcement ──────────────────────

describe('Feature: flatbed-load-planner, Property 16: Role-based access control enforcement', () => {
  /**
   * Validates: Requirements 17.2, 17.4
   *
   * Effective permissions = union of all assigned role permissions.
   * For any set of roles, the effective permissions should contain exactly
   * the union of each role's defined permissions — no extras, no missing.
   */
  it('effective permissions equal the exact union of all assigned role permissions', () => {
    fc.assert(
      fc.property(
        arbitraryRoleSet(),
        (roles) => {
          const effective = getEffectivePermissions(roles);
          const effectiveSet = new Set(effective);

          // Compute expected union manually
          const expectedSet = new Set<FlatbedAction>();
          for (const role of roles) {
            for (const perm of ROLE_PERMISSIONS[role]) {
              expectedSet.add(perm);
            }
          }

          // No extras: every effective permission must be in expected
          for (const perm of effectiveSet) {
            expect(expectedSet.has(perm)).toBe(true);
          }

          // No missing: every expected permission must be in effective
          for (const perm of expectedSet) {
            expect(effectiveSet.has(perm)).toBe(true);
          }

          // Sizes must match (no duplicates in effective)
          expect(effectiveSet.size).toBe(expectedSet.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 17.5
   *
   * Non-admin users are ALWAYS denied admin-only actions regardless of
   * how many other roles they hold.
   */
  it('non-admin users are always denied admin-only actions regardless of role combination', () => {
    fc.assert(
      fc.property(
        arbitraryNonAdminRoleSet(),
        arbitraryAdminOnlyAction(),
        (roles, action) => {
          // Ensure Administrator is not in the set
          expect(roles).not.toContain('Administrator');

          // Non-admin users must be denied admin-only actions
          expect(hasPermission(roles, action)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 17.2, 17.5
   *
   * Administrator role can perform all actions — it is a superset of all
   * other roles' permissions.
   */
  it('Administrator can perform all defined actions (superset of all roles)', () => {
    fc.assert(
      fc.property(
        arbitraryAction(),
        (action) => {
          expect(hasPermission(['Administrator'], action)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 17.4
   *
   * Multiple roles produce a union — adding roles never reduces permissions.
   * For any subset of roles A ⊆ B, effective(A) ⊆ effective(B).
   */
  it('multiple roles produce a union — adding roles never reduces permissions', () => {
    fc.assert(
      fc.property(
        arbitraryRoleSet(),
        fc.constantFrom(...ALL_ROLES),
        (baseRoles, additionalRole) => {
          const basePerms = new Set(getEffectivePermissions(baseRoles));
          const extendedRoles = [...new Set([...baseRoles, additionalRole])];
          const extendedPerms = new Set(getEffectivePermissions(extendedRoles));

          // Every permission in base must still exist in extended
          for (const perm of basePerms) {
            expect(extendedPerms.has(perm)).toBe(true);
          }

          // Extended permissions >= base permissions (monotonic growth)
          expect(extendedPerms.size).toBeGreaterThanOrEqual(basePerms.size);
        }
      ),
      { numRuns: 100 }
    );
  });
});
