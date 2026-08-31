/**
 * Session Routes — CRUD for discovery sessions (Fastify + Drizzle)
 */

import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';
import { requireAnyRole, getUserId } from '../middleware/auth.js';
import { AIEngineService } from '../services/AIEngineService.js';

const aiEngine = new AIEngineService();

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // GET /sessions?accountId=xxx
  app.get<{ Querystring: { accountId?: string } }>('/', { preHandler: [requireAnyRole] }, async (request, _reply) => {
    const { accountId } = request.query;
    let sessions;
    if (accountId) {
      sessions = await db.select().from(schema.sessions)
        .where(eq(schema.sessions.accountId, accountId))
        .orderBy(desc(schema.sessions.startedAt))
        .limit(50);
    } else {
      sessions = await db.select().from(schema.sessions)
        .orderBy(desc(schema.sessions.startedAt))
        .limit(50);
    }
    return { sessions };
  });

  // GET /sessions/:id
  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id));
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return session;
  });

  // POST /sessions
  app.post<{ Body: { accountId: string; repId?: string; durationSeconds?: number } }>(
    '/', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { accountId, repId, durationSeconds } = request.body;
      if (!accountId) {
        return reply.status(400).send({ error: 'accountId is required' });
      }

      const userId = getUserId(request);
      const [session] = await db.insert(schema.sessions).values({
        accountId,
        repId: repId || userId || 'anonymous',
        durationSeconds: durationSeconds ?? null,
        endedAt: durationSeconds ? new Date() : null,
      }).returning();

      return reply.status(201).send(session);
    }
  );

  // PATCH /sessions/:id
  app.patch<{ Params: { id: string }; Body: { endedAt?: string; durationSeconds?: number; status?: string } }>(
    '/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id } = request.params;
      const { endedAt, durationSeconds, status } = request.body;

      const updates: Record<string, unknown> = {};
      if (endedAt) updates.endedAt = new Date(endedAt);
      if (durationSeconds !== undefined) updates.durationSeconds = durationSeconds;
      if (status) updates.status = status;

      const [updated] = await db.update(schema.sessions)
        .set(updates)
        .where(eq(schema.sessions.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      return updated;
    }
  );

  // POST /sessions/:id/answer-summary
  app.post<{ Params: { id: string }; Body: { questionText: string; element: string; recentTranscript?: string } }>(
    '/:id/answer-summary', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { questionText, element, recentTranscript } = request.body;
      if (!questionText || !element) {
        return reply.status(400).send({ error: 'questionText and element are required' });
      }

      try {
        const summary = await aiEngine.generateAnswerSummary(questionText, element, recentTranscript ?? '');
        return { summary };
      } catch (err) {
        return reply.status(500).send({ error: err instanceof Error ? err.message : 'AI summary failed' });
      }
    }
  );
}
