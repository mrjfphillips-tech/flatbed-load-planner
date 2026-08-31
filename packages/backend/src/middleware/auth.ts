import { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@ptv-discovery-coach/shared';

/**
 * JWT token payload shape for PTV Discovery Coach.
 */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

/**
 * Routes that skip authentication.
 */
const PUBLIC_ROUTES = ['/health', '/ready'];

/**
 * Prefixes that skip authentication (e.g., WebSocket upgrades handle their own auth).
 */
const PUBLIC_PREFIXES = ['/ws', '/api/auth/login', '/api/flatbed/auth/login', '/api/flatbed/auth/register'];

/**
 * Global authentication hook.
 * Validates JWT token for protected routes and attaches user payload to the request.
 */
export async function authenticateHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { url } = request;

  // Skip authentication for public routes
  if (PUBLIC_ROUTES.includes(url)) {
    return;
  }

  // Skip authentication for public prefixes
  for (const prefix of PUBLIC_PREFIXES) {
    if (url.startsWith(prefix)) {
      return;
    }
  }

  try {
    const payload = await request.jwtVerify<JwtPayload>();
    request.jwtPayload = payload;
  } catch (err) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
    });
  }
}

/**
 * RBAC guard: creates a preHandler that restricts access to specific roles.
 * Use as a route-level preHandler to enforce role-based access control.
 *
 * @example
 * fastify.get('/admin-only', { preHandler: [requireRole('admin')] }, handler)
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const payload = request.jwtPayload;

    if (!payload) {
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(payload.role)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${roles.join(', ')}`,
      });
      return;
    }
  };
}

/**
 * Pre-built role guard: require admin role.
 */
export const requireAdmin = requireRole('admin');

/**
 * Pre-built role guard: require rep or admin role.
 */
export const requireRepOrAdmin = requireRole('rep', 'admin');

/**
 * Pre-built role guard: require manager or admin role.
 */
export const requireManagerOrAdmin = requireRole('manager', 'admin');

/**
 * Pre-built role guard: allow any authenticated user with a valid role.
 */
export const requireAnyRole = requireRole('rep', 'manager', 'admin');

/**
 * Extracts the user ID from the request JWT payload.
 */
export function getUserId(request: FastifyRequest): string | undefined {
  return request.jwtPayload?.sub;
}

/**
 * Extracts the user role from the request JWT payload.
 */
export function getUserRole(request: FastifyRequest): UserRole | undefined {
  return request.jwtPayload?.role;
}
