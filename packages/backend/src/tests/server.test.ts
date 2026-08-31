import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import type { JwtPayload } from '../middleware/auth.js';

describe('Fastify Server', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      jwtSecret: 'test-secret',
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('GET /health returns status ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('GET /ready returns readiness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ready');
      expect(body.checks).toBeDefined();
      expect(body.checks.server).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    it('health endpoints do not require authentication', async () => {
      const healthResp = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(healthResp.statusCode).toBe(200);

      const readyResp = await app.inject({
        method: 'GET',
        url: '/ready',
      });
      expect(readyResp.statusCode).toBe(200);
    });
  });

  describe('JWT Authentication', () => {
    function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
      return app.jwt.sign(payload);
    }

    it('returns 401 for protected routes without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 for invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: {
          authorization: 'Bearer invalid-token-here',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('accepts valid JWT token', async () => {
      const token = generateToken({
        sub: 'user-123',
        role: 'rep',
        email: 'rep@ptv.de',
      });

      // This will 404 since /api/sessions route isn't registered in test app,
      // but it should NOT be 401 (proving auth passed)
      const response = await app.inject({
        method: 'GET',
        url: '/api/test-auth',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // 404 means auth passed but route doesn't exist
      expect(response.statusCode).toBe(404);
    });
  });

  describe('CORS', () => {
    it('responds with CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('includes rate limit headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      // Rate limit headers are added by @fastify/rate-limit
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });
});

describe('RBAC Middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      jwtSecret: 'test-secret',
      logger: false,
    });

    // Register test routes with role guards for testing
    const { requireRole, requireAdmin, requireManagerOrAdmin } = await import('../middleware/auth.js');

    app.get('/test/admin-only', {
      preHandler: [requireAdmin],
    }, async () => {
      return { message: 'admin access granted' };
    });

    app.get('/test/manager-or-admin', {
      preHandler: [requireManagerOrAdmin],
    }, async () => {
      return { message: 'manager/admin access granted' };
    });

    app.get('/test/any-role', {
      preHandler: [requireRole('rep', 'manager', 'admin')],
    }, async () => {
      return { message: 'any role access granted' };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return app.jwt.sign(payload);
  }

  it('rejects rep from admin-only route', async () => {
    const token = generateToken({ sub: 'user-rep', role: 'rep' });
    const response = await app.inject({
      method: 'GET',
      url: '/test/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error).toBe('Forbidden');
  });

  it('allows admin to access admin-only route', async () => {
    const token = generateToken({ sub: 'user-admin', role: 'admin' });
    const response = await app.inject({
      method: 'GET',
      url: '/test/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe('admin access granted');
  });

  it('allows manager to access manager-or-admin route', async () => {
    const token = generateToken({ sub: 'user-mgr', role: 'manager' });
    const response = await app.inject({
      method: 'GET',
      url: '/test/manager-or-admin',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe('manager/admin access granted');
  });

  it('rejects rep from manager-or-admin route', async () => {
    const token = generateToken({ sub: 'user-rep', role: 'rep' });
    const response = await app.inject({
      method: 'GET',
      url: '/test/manager-or-admin',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows any authenticated user with valid role to access any-role route', async () => {
    for (const role of ['rep', 'manager', 'admin'] as const) {
      const token = generateToken({ sub: `user-${role}`, role });
      const response = await app.inject({
        method: 'GET',
        url: '/test/any-role',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    }
  });

  it('returns 401 for unauthenticated request to guarded route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/admin-only',
    });

    expect(response.statusCode).toBe(401);
  });
});
