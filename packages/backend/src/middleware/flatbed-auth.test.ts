/**
 * Tests for Flatbed Load Planner Authentication & RBAC Middleware
 *
 * Validates Requirements 17.1, 17.2, 17.3, 17.4, 17.5
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FlatbedRole,
  FlatbedAction,
  FlatbedJwtPayload,
  ADMIN_ONLY_ACTIONS,
  getEffectivePermissions,
  hasPermission,
  flatbedAuthenticate,
  requireFlatbedRole,
  requireFlatbedPermission,
} from './flatbed-auth.js';

// ─── Mock Fastify Request/Reply ───────────────────────────────────────────────

function createMockRequest(overrides: Partial<{ url: string; flatbedUser: FlatbedJwtPayload; jwtVerify: () => Promise<FlatbedJwtPayload> }> = {}) {
  return {
    url: overrides.url ?? '/api/flatbed/plans',
    flatbedUser: overrides.flatbedUser,
    jwtVerify: overrides.jwtVerify ?? vi.fn(),
  } as any;
}

function createMockReply() {
  const reply: any = {};
  reply.status = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply;
}

// ─── Permission Calculation Tests ─────────────────────────────────────────────

describe('getEffectivePermissions', () => {
  it('returns empty array for empty roles', () => {
    expect(getEffectivePermissions([])).toEqual([]);
  });

  it('returns Planner permissions for single Planner role', () => {
    const perms = getEffectivePermissions(['Planner']);
    expect(perms).toContain('plan:create');
    expect(perms).toContain('plan:edit');
    expect(perms).toContain('plan:submit');
    expect(perms).toContain('plan:view');
    expect(perms).not.toContain('plan:approve');
    expect(perms).not.toContain('equipment:manage');
  });

  it('returns union of permissions for multiple roles', () => {
    const perms = getEffectivePermissions(['Planner', 'Supervisor']);
    // From Planner
    expect(perms).toContain('plan:create');
    expect(perms).toContain('plan:edit');
    expect(perms).toContain('plan:submit');
    // From Supervisor
    expect(perms).toContain('plan:approve');
    expect(perms).toContain('plan:reject');
    expect(perms).toContain('plan:override');
    // Shared
    expect(perms).toContain('plan:view');
  });

  it('deduplicates overlapping permissions', () => {
    const perms = getEffectivePermissions(['Planner', 'Supervisor']);
    const viewCount = perms.filter((p) => p === 'plan:view').length;
    expect(viewCount).toBe(1);
  });

  it('returns all permissions for Administrator', () => {
    const perms = getEffectivePermissions(['Administrator']);
    expect(perms).toContain('equipment:manage');
    expect(perms).toContain('rules:manage');
    expect(perms).toContain('users:manage');
    expect(perms).toContain('plan:create');
    expect(perms).toContain('plan:approve');
  });

  it('Customer_Viewer only gets assigned_items:view', () => {
    const perms = getEffectivePermissions(['Customer_Viewer']);
    expect(perms).toEqual(['assigned_items:view']);
  });
});

describe('hasPermission', () => {
  it('Planner can create plans', () => {
    expect(hasPermission(['Planner'], 'plan:create')).toBe(true);
  });

  it('Planner cannot approve plans', () => {
    expect(hasPermission(['Planner'], 'plan:approve')).toBe(false);
  });

  it('Supervisor can approve plans', () => {
    expect(hasPermission(['Supervisor'], 'plan:approve')).toBe(true);
  });

  it('Loader can mark instructions complete', () => {
    expect(hasPermission(['Loader'], 'instructions:mark_complete')).toBe(true);
  });

  it('Driver can view and complete checklists', () => {
    expect(hasPermission(['Driver'], 'checklist:view')).toBe(true);
    expect(hasPermission(['Driver'], 'checklist:complete')).toBe(true);
  });

  it('Customer_Viewer can only view assigned items', () => {
    expect(hasPermission(['Customer_Viewer'], 'assigned_items:view')).toBe(true);
    expect(hasPermission(['Customer_Viewer'], 'plan:view')).toBe(false);
    expect(hasPermission(['Customer_Viewer'], 'plan:create')).toBe(false);
  });

  // Admin-only actions
  it('non-admin cannot manage equipment even with other roles', () => {
    expect(hasPermission(['Planner', 'Supervisor'], 'equipment:manage')).toBe(false);
  });

  it('non-admin cannot manage rules', () => {
    expect(hasPermission(['Planner', 'Loader', 'Driver', 'Supervisor'], 'rules:manage')).toBe(false);
  });

  it('non-admin cannot manage users', () => {
    expect(hasPermission(['Planner', 'Supervisor'], 'users:manage')).toBe(false);
  });

  it('Administrator can manage equipment', () => {
    expect(hasPermission(['Administrator'], 'equipment:manage')).toBe(true);
  });

  it('Administrator can manage rules', () => {
    expect(hasPermission(['Administrator'], 'rules:manage')).toBe(true);
  });

  it('Administrator can manage users', () => {
    expect(hasPermission(['Administrator'], 'users:manage')).toBe(true);
  });

  // Multi-role union
  it('Planner + Loader union gives both permission sets', () => {
    expect(hasPermission(['Planner', 'Loader'], 'plan:create')).toBe(true);
    expect(hasPermission(['Planner', 'Loader'], 'instructions:mark_complete')).toBe(true);
  });

  it('empty roles deny all actions', () => {
    expect(hasPermission([], 'plan:view')).toBe(false);
    expect(hasPermission([], 'equipment:manage')).toBe(false);
  });
});

// ─── Authentication Middleware Tests ──────────────────────────────────────────

describe('flatbedAuthenticate', () => {
  it('skips auth for login route', async () => {
    const request = createMockRequest({ url: '/api/flatbed/auth/login' });
    const reply = createMockReply();

    await flatbedAuthenticate(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(request.jwtVerify).not.toHaveBeenCalled();
  });

  it('skips auth for register route', async () => {
    const request = createMockRequest({ url: '/api/flatbed/auth/register' });
    const reply = createMockReply();

    await flatbedAuthenticate(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  it('attaches user payload on valid token', async () => {
    const payload: FlatbedJwtPayload = {
      sub: 'user-123',
      roles: ['Planner', 'Loader'],
      email: 'test@example.com',
      name: 'Test User',
    };
    const request = createMockRequest({
      jwtVerify: vi.fn().mockResolvedValue(payload),
    });
    const reply = createMockReply();

    await flatbedAuthenticate(request, reply);

    expect(request.flatbedUser).toEqual(payload);
    expect(reply.status).not.toHaveBeenCalled();
  });

  it('returns 401 on invalid/missing token', async () => {
    const request = createMockRequest({
      jwtVerify: vi.fn().mockRejectedValue(new Error('jwt malformed')),
    });
    const reply = createMockReply();

    await flatbedAuthenticate(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
    });
  });
});

// ─── RBAC Role Guard Tests ────────────────────────────────────────────────────

describe('requireFlatbedRole', () => {
  it('allows access when user has required role', async () => {
    const guard = requireFlatbedRole('Planner');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Planner'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  it('allows access when user has one of multiple required roles', async () => {
    const guard = requireFlatbedRole('Planner', 'Supervisor');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Supervisor'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  it('denies access when user lacks required role', async () => {
    const guard = requireFlatbedRole('Administrator');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Planner', 'Loader'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Forbidden',
        message: expect.stringContaining('Insufficient permissions'),
      })
    );
  });

  it('returns 401 when no user is attached (not authenticated)', async () => {
    const guard = requireFlatbedRole('Planner');
    const request = createMockRequest({});
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
  });
});

// ─── RBAC Permission Guard Tests ──────────────────────────────────────────────

describe('requireFlatbedPermission', () => {
  it('allows action when user role has the permission', async () => {
    const guard = requireFlatbedPermission('plan:create');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Planner'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  it('allows admin-only action for Administrator', async () => {
    const guard = requireFlatbedPermission('equipment:manage');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Administrator'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  it('denies admin-only action for non-admin with many roles', async () => {
    const guard = requireFlatbedPermission('equipment:manage');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Planner', 'Supervisor', 'Driver', 'Loader'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Forbidden',
        message: expect.stringContaining('equipment:manage'),
      })
    );
  });

  it('allows multi-permission check when user has all', async () => {
    const guard = requireFlatbedPermission('plan:create', 'plan:edit');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Planner'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  it('denies when user has one but not all required permissions', async () => {
    const guard = requireFlatbedPermission('plan:create', 'plan:approve');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Planner'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it('returns 401 when no user is attached', async () => {
    const guard = requireFlatbedPermission('plan:view');
    const request = createMockRequest({});
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('multi-role user gets union permissions', async () => {
    // Planner has plan:create, Supervisor has plan:approve
    const guard = requireFlatbedPermission('plan:create', 'plan:approve');
    const request = createMockRequest({
      flatbedUser: { sub: 'u1', roles: ['Planner', 'Supervisor'] },
    });
    const reply = createMockReply();

    await guard(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });
});

// ─── Role Permission Matrix Tests ─────────────────────────────────────────────

describe('Role Permission Matrix (Requirement 17.2)', () => {
  const roleActions: Record<FlatbedRole, { allowed: FlatbedAction[]; denied: FlatbedAction[] }> = {
    Planner: {
      allowed: ['plan:create', 'plan:edit', 'plan:submit', 'plan:view'],
      denied: ['plan:approve', 'equipment:manage', 'users:manage'],
    },
    Loader: {
      allowed: ['instructions:view', 'instructions:mark_complete', 'plan:view'],
      denied: ['plan:create', 'plan:approve', 'equipment:manage'],
    },
    Driver: {
      allowed: ['plan:view', 'checklist:view', 'checklist:complete'],
      denied: ['plan:create', 'plan:approve', 'equipment:manage'],
    },
    Supervisor: {
      allowed: ['plan:approve', 'plan:reject', 'plan:override', 'plan:view'],
      denied: ['plan:create', 'equipment:manage', 'users:manage'],
    },
    Administrator: {
      allowed: ['equipment:manage', 'rules:manage', 'users:manage', 'plan:create', 'plan:approve'],
      denied: [], // Admin can do everything
    },
    Customer_Viewer: {
      allowed: ['assigned_items:view'],
      denied: ['plan:view', 'plan:create', 'plan:approve', 'equipment:manage'],
    },
  };

  for (const [role, { allowed, denied }] of Object.entries(roleActions)) {
    describe(`${role} role`, () => {
      for (const action of allowed) {
        it(`can perform ${action}`, () => {
          expect(hasPermission([role as FlatbedRole], action)).toBe(true);
        });
      }
      for (const action of denied) {
        it(`cannot perform ${action}`, () => {
          expect(hasPermission([role as FlatbedRole], action)).toBe(false);
        });
      }
    });
  }
});

// ─── Admin-Only Restriction Tests (Requirement 17.5) ──────────────────────────

describe('Admin-only actions (Requirement 17.5)', () => {
  const nonAdminRoles: FlatbedRole[] = ['Planner', 'Loader', 'Driver', 'Supervisor', 'Customer_Viewer'];

  for (const action of ADMIN_ONLY_ACTIONS) {
    it(`${action} is denied for all non-admin roles combined`, () => {
      expect(hasPermission(nonAdminRoles, action)).toBe(false);
    });

    it(`${action} is allowed for Administrator`, () => {
      expect(hasPermission(['Administrator'], action)).toBe(true);
    });
  }
});
