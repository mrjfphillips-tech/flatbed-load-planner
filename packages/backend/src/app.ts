import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebsocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { flatbedPlanRoutes } from './routes/flatbedPlans.js';
import { flatbedAuthRoutes } from './routes/flatbedAuth.js';
import { flatbedRulesRoutes } from './routes/flatbedRules.js';
import { flatbedExportRoutes } from './routes/flatbedExport.js';
import { flatbedShareRoutes } from './routes/flatbedShare.js';
import { flatbedVerificationRoutes } from './routes/flatbedVerification.js';
import { loadDiagramRoutes } from './routes/loadDiagram.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { type FlatbedJwtPayload } from './middleware/flatbed-auth.js';

// Extend Fastify types for JWT
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: FlatbedJwtPayload;
    user: FlatbedJwtPayload;
  }
}

export interface AppOptions {
  jwtSecret?: string;
  corsOrigin?: string | string[] | boolean;
  rateLimitMax?: number;
  logger?: boolean;
}

/**
 * Coerces the CORS_ORIGIN env value into what @fastify/cors expects. Env vars
 * are always strings, so the literal "true"/"false" must be converted to real
 * booleans (otherwise the string "true" is echoed as an invalid
 * Access-Control-Allow-Origin header and browsers block the response). A
 * comma-separated list is treated as an allowlist of origins.
 */
function resolveCorsOrigin(raw: string | undefined): boolean | string | string[] {
  if (raw == null || raw === '') return true;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  if (trimmed === '*') return true;
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return trimmed;
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const {
    jwtSecret = process.env.JWT_SECRET ?? 'dev-secret-change-me',
    corsOrigin = resolveCorsOrigin(process.env.CORS_ORIGIN),
    rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 100),
    logger = process.env.NODE_ENV !== 'test',
  } = opts;

  const app = Fastify({
    logger: logger
      ? {
          level: process.env.LOG_LEVEL ?? 'info',
          transport:
            process.env.NODE_ENV === 'development'
              ? { target: 'pino-pretty' }
              : undefined,
        }
      : false,
  });

  // ─── CORS ─────────────────────────────────────────────────────────────────────
  await app.register(fastifyCors, {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ─── Rate Limiting ────────────────────────────────────────────────────────────
  await app.register(fastifyRateLimit, {
    max: rateLimitMax,
    timeWindow: '1 minute',
  });

  // ─── JWT Authentication ───────────────────────────────────────────────────────
  await app.register(fastifyJwt, {
    secret: jwtSecret,
  });

  // ─── WebSocket ────────────────────────────────────────────────────────────────
  await app.register(fastifyWebsocket);

  // ─── Error Handling ────────────────────────────────────────────────────────
  registerErrorHandler(app);

  // ─── Routes ───────────────────────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(flatbedAuthRoutes, { prefix: '/api/flatbed/auth' });
  await app.register(flatbedPlanRoutes, { prefix: '/api/flatbed/plans' });
  await app.register(flatbedRulesRoutes, { prefix: '/api/flatbed/rules' });
  await app.register(flatbedExportRoutes, { prefix: '/api/flatbed/plans' });
  await app.register(flatbedShareRoutes, { prefix: '/api/flatbed' });
  await app.register(flatbedVerificationRoutes, { prefix: '/api/flatbed/verification' });
  await app.register(loadDiagramRoutes, { prefix: '/api/load-diagram' });

  return app;
}
