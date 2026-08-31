/**
 * Auth Routes — Self-managed JWT authentication (Fastify + Drizzle)
 *
 * POST /auth/login          — email + password → JWT
 * POST /auth/change-password — change password
 * GET  /auth/me             — get current user info from JWT
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

// Simple password hashing using crypto (avoids bcryptjs dependency)
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return result === hash;
}

// In-memory user store for development (replace with Drizzle table in production)
interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: 'rep' | 'manager' | 'admin';
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword: boolean;
}

const users: StoredUser[] = [];

// Seed a default admin user
const { hash: defaultHash, salt: defaultSalt } = hashPassword('admin123');
users.push({
  id: crypto.randomUUID(),
  email: 'admin@ptv.com',
  name: 'Admin User',
  role: 'admin',
  passwordHash: defaultHash,
  passwordSalt: defaultSalt,
  mustChangePassword: false,
});

// Seed a demo rep
const { hash: repHash, salt: repSalt } = hashPassword('demo123');
users.push({
  id: crypto.randomUUID(),
  email: 'rep@ptv.com',
  name: 'Demo Rep',
  role: 'rep',
  passwordHash: repHash,
  passwordSalt: repSalt,
  mustChangePassword: false,
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/login
  app.post<{ Body: { email: string; password: string } }>('/login', async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const user = users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = app.jwt.sign(
      { sub: user.id, role: user.role, email: user.email, name: user.name },
      { expiresIn: '7d' }
    );

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      mustChangePassword: user.mustChangePassword,
    };
  });

  // GET /auth/me
  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.jwtPayload;
    if (!payload) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  });

  // POST /auth/change-password
  app.post<{ Body: { currentPassword: string; newPassword: string } }>('/change-password', async (request, reply) => {
    const payload = request.jwtPayload;
    if (!payload) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = request.body;
    const user = users.find((u) => u.id === payload.sub);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (!verifyPassword(currentPassword, user.passwordHash, user.passwordSalt)) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    if (!newPassword || newPassword.length < 8) {
      return reply.status(400).send({ error: 'New password must be at least 8 characters' });
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.mustChangePassword = false;

    return { message: 'Password changed successfully' };
  });

  // POST /auth/users — admin creates user
  app.post<{ Body: { email: string; name: string; role: 'rep' | 'manager' | 'admin' } }>(
    '/users', async (request, reply) => {
      const payload = request.jwtPayload;
      if (!payload || payload.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const { email, name, role } = request.body;
      if (!email || !name || !role) {
        return reply.status(400).send({ error: 'email, name, and role are required' });
      }

      if (users.find((u) => u.email === email)) {
        return reply.status(409).send({ error: 'User with this email already exists' });
      }

      const tempPassword = crypto.randomBytes(8).toString('hex');
      const { hash, salt } = hashPassword(tempPassword);

      const newUser: StoredUser = {
        id: crypto.randomUUID(),
        email,
        name,
        role,
        passwordHash: hash,
        passwordSalt: salt,
        mustChangePassword: true,
      };
      users.push(newUser);

      return reply.status(201).send({
        user: { id: newUser.id, email, name, role },
        temporaryPassword: tempPassword,
      });
    }
  );

  // GET /auth/users — admin lists users
  app.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.jwtPayload;
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }
    return {
      users: users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })),
    };
  });
}
