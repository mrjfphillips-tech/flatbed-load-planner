import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { requireAnyRole } from '../middleware/auth.js';

export async function questionRoutes(app: FastifyInstance): Promise<void> {
  // GET /questions
  app.get('/', { preHandler: [requireAnyRole] }, async () => {
    const questions = await db.select().from(schema.questions);
    return { questions };
  });

  // GET /questions/:id
  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const [question] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
    if (!question) return reply.status(404).send({ error: 'Question not found' });
    return question;
  });

  // POST /questions
  app.post<{ Body: { text: string; framework?: string; canonicalField?: string; buyerPersona?: string } }>(
    '/', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { text, framework, canonicalField, buyerPersona } = request.body;
      if (!text?.trim()) {
        return reply.status(400).send({ error: 'Question text is required' });
      }
      const [question] = await db.insert(schema.questions).values({
        text: text.trim(),
        framework: framework || 'meddic',
        canonicalField: canonicalField || null,
        buyerPersona: buyerPersona || null,
      }).returning();
      return reply.status(201).send(question);
    }
  );

  // DELETE /questions/:id
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const [deleted] = await db.delete(schema.questions).where(eq(schema.questions.id, id)).returning();
    if (!deleted) return reply.status(404).send({ error: 'Question not found' });
    return { message: 'Question deleted' };
  });
}
