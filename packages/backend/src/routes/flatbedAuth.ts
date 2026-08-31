/**
 * Flatbed Load Planner — Authentication Routes
 *
 * Provides login, registration, and user management endpoints for the
 * flatbed load planner system. Uses the flatbed_users and flatbed_user_roles
 * tables via Drizzle ORM.
 *
 * Requirements: 17.1, 17.2, 17.4, 17.5
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { flatbedUsers, flatbedUserRoles } from '../db/schema/flatbed-users.js';
import {
  FlatbedRole,
  FlatbedJwtPayload,
  flatbedAuthenticate,
  requireFlatbedAdmin,
  getFlatbedUserId,
} from '../middleware/flatbed-auth.js';

// ─── Password Utilities ───────────────────────────────────────────────────────

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 10000, 64, 'sha512').toString('hex');
  return { hash: `${s}:${hash}`, salt: s };
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const result = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return result === hash;
}

// ─── Helper: Load User Roles ──────────────────────────────────────────────────

async function getUserRoles(userId: string): Promise<FlatbedRole[]> {
  const roles = await db
    .select({ role: flatbedUserRoles.role })
    .from(flatbedUserRoles)
    .where(eq(flatbedUserRoles.userId, userId));
  return roles.map((r) => r.role as FlatbedRole);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function flatbedAuthRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /login — Authenticate and return JWT ──────────────────────────────
  app.post<{ Body: { email: string; password: string } }>(
    '/login',
    async (request, reply) => {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({ error: 'Email and password are required' });
      }

      // Look up user by email
      const [user] = await db
        .select()
        .from(flatbedUsers)
        .where(eq(flatbedUsers.email, email.toLowerCase().trim()))
        .limit(1);

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      if (!verifyPassword(password, user.passwordHash)) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Fetch user roles
      const roles = await getUserRoles(user.id);

      // Sign JWT with roles array
      const payload: Omit<FlatbedJwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        roles,
        email: user.email,
        name: user.name,
      };

      const token = app.jwt.sign(payload as any, { expiresIn: '7d' });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles,
        },
      };
    }
  );

  // ─── POST /register — Create a new flatbed user ────────────────────────────
  app.post<{ Body: { email: string; name: string; password: string; roles?: FlatbedRole[] } }>(
    '/register',
    async (request, reply) => {
      const { email, name, password, roles } = request.body;

      if (!email || !name || !password) {
        return reply.status(400).send({ error: 'Email, name, and password are required' });
      }

      if (password.length < 8) {
        return reply.status(400).send({ error: 'Password must be at least 8 characters' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check for existing user
      const [existing] = await db
        .select({ id: flatbedUsers.id })
        .from(flatbedUsers)
        .where(eq(flatbedUsers.email, normalizedEmail))
        .limit(1);

      if (existing) {
        return reply.status(409).send({ error: 'A user with this email already exists' });
      }

      // Hash password and create user
      const { hash } = hashPassword(password);
      const [newUser] = await db
        .insert(flatbedUsers)
        .values({
          email: normalizedEmail,
          name,
          passwordHash: hash,
        })
        .returning();

      // Assign default role (Planner) if none specified
      const assignedRoles: FlatbedRole[] = roles && roles.length > 0 ? roles : ['Planner'];

      for (const role of assignedRoles) {
        await db.insert(flatbedUserRoles).values({
          userId: newUser.id,
          role,
        });
      }

      // Sign JWT
      const payload: Omit<FlatbedJwtPayload, 'iat' | 'exp'> = {
        sub: newUser.id,
        roles: assignedRoles,
        email: newUser.email,
        name: newUser.name,
      };

      const token = app.jwt.sign(payload as any, { expiresIn: '7d' });

      return reply.status(201).send({
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          roles: assignedRoles,
        },
      });
    }
  );

  // ─── GET /me — Get current user info ────────────────────────────────────────
  app.get('/me', { preHandler: [flatbedAuthenticate] }, async (request, reply) => {
    const userId = getFlatbedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const [user] = await db
      .select()
      .from(flatbedUsers)
      .where(eq(flatbedUsers.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const roles = await getUserRoles(user.id);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
    };
  });

  // ─── GET /users — List all flatbed users (Administrator only) ───────────────
  app.get(
    '/users',
    { preHandler: [flatbedAuthenticate, requireFlatbedAdmin] },
    async (_request, _reply) => {
      const allUsers = await db.select().from(flatbedUsers);

      const usersWithRoles = await Promise.all(
        allUsers.map(async (u) => {
          const roles = await getUserRoles(u.id);
          return { id: u.id, email: u.email, name: u.name, roles, createdAt: u.createdAt };
        })
      );

      return { users: usersWithRoles };
    }
  );

  // ─── PUT /users/:id/roles — Update user roles (Administrator only) ──────────
  app.put<{ Params: { id: string }; Body: { roles: FlatbedRole[] } }>(
    '/users/:id/roles',
    { preHandler: [flatbedAuthenticate, requireFlatbedAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { roles } = request.body;

      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        return reply.status(400).send({ error: 'At least one role is required' });
      }

      // Validate roles
      const validRoles: FlatbedRole[] = [
        'Planner', 'Loader', 'Driver', 'Supervisor', 'Administrator', 'Customer_Viewer',
      ];
      for (const role of roles) {
        if (!validRoles.includes(role)) {
          return reply.status(400).send({ error: `Invalid role: ${role}` });
        }
      }

      // Check user exists
      const [user] = await db
        .select({ id: flatbedUsers.id })
        .from(flatbedUsers)
        .where(eq(flatbedUsers.id, id))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Delete existing roles and replace with new ones
      await db.delete(flatbedUserRoles).where(eq(flatbedUserRoles.userId, id));
      for (const role of roles) {
        await db.insert(flatbedUserRoles).values({ userId: id, role });
      }

      return { id, roles };
    }
  );
}
