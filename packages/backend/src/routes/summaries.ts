import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { requireAnyRole } from '../middleware/auth.js';

export async function summaryRoutes(app: FastifyInstance): Promise<void> {
  // GET /summaries?sessionId=xxx
  app.get<{ Querystring: { sessionId?: string } }>('/', { preHandler: [requireAnyRole] }, async (request) => {
    const { sessionId } = request.query;
    let summaries;
    if (sessionId) {
      summaries = await db.select().from(schema.summaries).where(eq(schema.summaries.sessionId, sessionId));
    } else {
      summaries = await db.select().from(schema.summaries);
    }
    return { summaries };
  });

  // GET /summaries/:id
  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const [summary] = await db.select().from(schema.summaries).where(eq(schema.summaries.id, id));
    if (!summary) return reply.status(404).send({ error: 'Summary not found' });
    return summary;
  });
}
