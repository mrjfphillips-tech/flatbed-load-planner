/**
 * Flatbed Load Planner — Authentication & Role-Based Access Control (RBAC)
 *
 * Implements JWT-based authentication and multi-role RBAC for the flatbed load planner.
 * Users may hold multiple roles simultaneously; effective permissions are the union of
 * all assigned role permissions.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

import { FastifyRequest, FastifyReply } from 'fastify';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The six roles defined in the flatbed load planner system.
 */
export type FlatbedRole =
  | 'Planner'
  | 'Loader'
  | 'Driver'
  | 'Supervisor'
  | 'Administrator'
  | 'Customer_Viewer';

/**
 * Actions that can be performed in the flatbed system.
 */
export type FlatbedAction =
  | 'plan:create'
  | 'plan:edit'
  | 'plan:submit'
  | 'plan:view'
  | 'plan:approve'
  | 'plan:reject'
  | 'plan:override'
  | 'instructions:view'
  | 'instructions:mark_complete'
  | 'checklist:view'
  | 'checklist:complete'
  | 'equipment:manage'
  | 'rules:manage'
  | 'users:manage'
  | 'assigned_items:view';

/**
 * JWT payload for flatbed load planner tokens.
 * Includes an array of roles rather than a single role.
 */
export interface FlatbedJwtPayload {
  /** User ID */
  sub: string;
  /** User's assigned roles */
  roles: FlatbedRole[];
  /** User email */
  email?: string;
  /** User display name */
  name?: string;
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
}

// ─── Role → Permission Mapping ────────────────────────────────────────────────

/**
 * Defines which actions each role is permitted to perform.
 * A user's effective permissions are the union of all their assigned role permissions.
 */
export const ROLE_PERMISSIONS: Record<FlatbedRole, FlatbedAction[]> = {
  Planner: [
    'plan:create',
    'plan:edit',
    'plan:submit',
    'plan:view',
    'instructions:view',
    'checklist:view',
  ],
  Loader: [
    'plan:view',
    'instructions:view',
    'instructions:mark_complete',
  ],
  Driver: [
    'plan:view',
    'checklist:view',
    'checklist:complete',
  ],
  Supervisor: [
    'plan:view',
    'plan:approve',
    'plan:reject',
    'plan:override',
    'instructions:view',
    'checklist:view',
  ],
  Administrator: [
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
  ],
  Customer_Viewer: [
    'assigned_items:view',
  ],
};

/**
 * Actions that are exclusively reserved for the Administrator role.
 * Non-admin users are always denied these regardless of other roles held.
 */
export const ADMIN_ONLY_ACTIONS: FlatbedAction[] = [
  'equipment:manage',
  'rules:manage',
  'users:manage',
];

// ─── Permission Calculation ───────────────────────────────────────────────────

/**
 * Computes the effective permissions for a set of roles.
 * Returns the union (deduplicated) of all permissions across all assigned roles.
 */
export function getEffectivePermissions(roles: FlatbedRole[]): FlatbedAction[] {
  const permissionSet = new Set<FlatbedAction>();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role];
    if (perms) {
      for (const p of perms) {
        permissionSet.add(p);
      }
    }
  }
  return Array.from(permissionSet);
}

/**
 * Checks whether a set of roles has permission to perform a given action.
 */
export function hasPermission(roles: FlatbedRole[], action: FlatbedAction): boolean {
  // Admin-only actions require the Administrator role explicitly
  if (ADMIN_ONLY_ACTIONS.includes(action)) {
    return roles.includes('Administrator');
  }
  const effective = getEffectivePermissions(roles);
  return effective.includes(action);
}

// ─── Fastify Request Extension ────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    flatbedUser?: FlatbedJwtPayload;
  }
}

// ─── Authentication Middleware ────────────────────────────────────────────────

/**
 * Routes in the flatbed namespace that are public (no auth required).
 */
const FLATBED_PUBLIC_PREFIXES = [
  '/api/flatbed/auth/login',
  '/api/flatbed/auth/register',
];

/**
 * Authentication hook for flatbed routes.
 * Verifies the JWT token and attaches the decoded payload (with roles) to `request.flatbedUser`.
 *
 * Use this as a preHandler or onRequest hook for flatbed route groups.
 */
export async function flatbedAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { url } = request;

  // Skip authentication for public flatbed routes
  for (const prefix of FLATBED_PUBLIC_PREFIXES) {
    if (url.startsWith(prefix)) {
      return;
    }
  }

  try {
    const payload = await request.jwtVerify<FlatbedJwtPayload>();
    request.flatbedUser = payload;
  } catch (err) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
    });
  }
}

// ─── RBAC Middleware ──────────────────────────────────────────────────────────

/**
 * Creates a preHandler that requires the authenticated user to have at least
 * one of the specified roles.
 *
 * @example
 * app.get('/plans', { preHandler: [requireFlatbedRole('Planner', 'Supervisor')] }, handler)
 */
export function requireFlatbedRole(...requiredRoles: FlatbedRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.flatbedUser;

    if (!user) {
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Check if user has at least one of the required roles
    const hasRole = user.roles.some((r) => requiredRoles.includes(r));
    if (!hasRole) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `Insufficient permissions. This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      });
      return;
    }
  };
}

/**
 * Creates a preHandler that requires the authenticated user to have permission
 * for a specific action. This checks the union of permissions across all user roles.
 *
 * @example
 * app.post('/equipment', { preHandler: [requireFlatbedPermission('equipment:manage')] }, handler)
 */
export function requireFlatbedPermission(...actions: FlatbedAction[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.flatbedUser;

    if (!user) {
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Check that user has permission for ALL requested actions
    for (const action of actions) {
      if (!hasPermission(user.roles, action)) {
        reply.status(403).send({
          error: 'Forbidden',
          message: `Insufficient permissions. You do not have permission to perform: ${action}`,
        });
        return;
      }
    }
  };
}

// ─── Pre-built Guards ─────────────────────────────────────────────────────────

/** Requires Administrator role */
export const requireFlatbedAdmin = requireFlatbedRole('Administrator');

/** Requires Planner or Administrator role */
export const requireFlatbedPlanner = requireFlatbedRole('Planner', 'Administrator');

/** Requires Supervisor or Administrator role */
export const requireFlatbedSupervisor = requireFlatbedRole('Supervisor', 'Administrator');

/** Requires permission to manage equipment (Administrator only) */
export const requireEquipmentManagement = requireFlatbedPermission('equipment:manage');

/** Requires permission to manage rules (Administrator only) */
export const requireRulesManagement = requireFlatbedPermission('rules:manage');

/** Requires permission to manage users (Administrator only) */
export const requireUserManagement = requireFlatbedPermission('users:manage');

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Extracts the flatbed user ID from the request.
 */
export function getFlatbedUserId(request: FastifyRequest): string | undefined {
  return request.flatbedUser?.sub;
}

/**
 * Extracts the flatbed user roles from the request.
 */
export function getFlatbedUserRoles(request: FastifyRequest): FlatbedRole[] {
  return request.flatbedUser?.roles ?? [];
}

/**
 * Checks whether the current user holds the Administrator role.
 */
export function isFlatbedAdmin(request: FastifyRequest): boolean {
  return request.flatbedUser?.roles.includes('Administrator') ?? false;
}
