import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebsocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { wsRoutes } from './routes/ws.js';
import { accountRoutes } from './routes/accounts.js';
import { sessionRoutes } from './routes/sessions.js';
import { authRoutes } from './routes/authRoutes.js';
import { contactRoutes } from './routes/contacts.js';
import { questionRoutes } from './routes/questions.js';
import { summaryRoutes } from './routes/summaries.js';
import { aiRoutes } from './routes/ai.js';
import { leexiRoutes } from './routes/leexi.js';
import { offlineRecoveryRoutes } from './routes/offlineRecovery.js';
import { pdifSessionRoutes } from './routes/pdifSessions.js';
import { pdifBriefingRoutes } from './routes/pdifBriefing.js';
import { pdifExportRoutes } from './routes/pdifExport.js';
import { feedbackRoutes } from './routes/feedback.js';
import { flatbedPlanRoutes } from './routes/flatbedPlans.js';
import { flatbedAuthRoutes } from './routes/flatbedAuth.js';
import { flatbedRulesRoutes } from './routes/flatbedRules.js';
import { flatbedExportRoutes } from './routes/flatbedExport.js';
import { flatbedShareRoutes } from './routes/flatbedShare.js';
import { flatbedVerificationRoutes } from './routes/flatbedVerification.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { authenticateHook, type JwtPayload } from './middleware/auth.js';

// Extend Fastify types for JWT
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    jwtPayload?: JwtPayload;
  }
}

export interface AppOptions {
  jwtSecret?: string;
  corsOrigin?: string | string[] | boolean;
  rateLimitMax?: number;
  logger?: boolean;
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const {
    jwtSecret = process.env.JWT_SECRET ?? 'dev-secret-change-me',
    corsOrigin = process.env.CORS_ORIGIN ?? true,
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

  // ─── Global Authentication Hook ───────────────────────────────────────────────
  // Applies to all routes under /api/* — skips /health, /ready, and /ws
  app.addHook('onRequest', authenticateHook);

  // ─── Error Handling ────────────────────────────────────────────────────────
  registerErrorHandler(app);

  // ─── Routes ───────────────────────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(wsRoutes, { prefix: '/ws' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(accountRoutes, { prefix: '/api/accounts' });
  await app.register(sessionRoutes, { prefix: '/api/sessions' });
  await app.register(contactRoutes, { prefix: '/api/contacts' });
  await app.register(questionRoutes, { prefix: '/api/questions' });
  await app.register(summaryRoutes, { prefix: '/api/summaries' });
  await app.register(aiRoutes, { prefix: '/api/ai' });
  await app.register(leexiRoutes, { prefix: '/api/leexi' });
  await app.register(offlineRecoveryRoutes, { prefix: '/api/offline-recovery' });
  await app.register(pdifSessionRoutes, { prefix: '/api/pdif/sessions' });
  await app.register(pdifBriefingRoutes, { prefix: '/api/pdif' });
  await app.register(pdifExportRoutes, { prefix: '/api/pdif' });
  await app.register(feedbackRoutes, { prefix: '/api/feedback' });
  await app.register(flatbedPlanRoutes, { prefix: '/api/flatbed/plans' });
  await app.register(flatbedAuthRoutes, { prefix: '/api/flatbed/auth' });
  await app.register(flatbedRulesRoutes, { prefix: '/api/flatbed/rules' });
  await app.register(flatbedExportRoutes, { prefix: '/api/flatbed/plans' });
  await app.register(flatbedShareRoutes, { prefix: '/api/flatbed' });
  await app.register(flatbedVerificationRoutes, { prefix: '/api/flatbed/verification' });

  return app;
}
