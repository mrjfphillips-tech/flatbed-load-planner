import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { requireAnyRole, getUserId } from '../middleware/auth.js';

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  // GET /accounts — list all accounts
  app.get('/', { preHandler: [requireAnyRole] }, async (_request, _reply) => {
    const accounts = await db.select().from(schema.accounts).orderBy(schema.accounts.createdAt);
    return { accounts };
  });

  // GET /accounts/:id — get single account
  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, id));
    if (!account) {
      return reply.status(404).send({ error: 'Account not found' });
    }
    return account;
  });

  // POST /accounts — create account
  app.post<{ Body: { name: string; organizationId?: string } }>('/', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { name, organizationId } = request.body;
    if (!name?.trim()) {
      return reply.status(400).send({ error: 'Account name is required' });
    }

    const userId = getUserId(request);
    const [account] = await db.insert(schema.accounts).values({
      name: name.trim(),
      organizationId: organizationId || userId || 'default',
    }).returning();

    return reply.status(201).send(account);
  });

  // PUT /accounts/:id — update account
  app.put<{ Params: { id: string }; Body: { name?: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const { name } = request.body;

    const updates: Record<string, unknown> = {};
    if (name?.trim()) updates.name = name.trim();
    updates.updatedAt = new Date();

    const [updated] = await db.update(schema.accounts)
      .set(updates)
      .where(eq(schema.accounts.id, id))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: 'Account not found' });
    }
    return updated;
  });

  // DELETE /accounts/:id
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const [deleted] = await db.delete(schema.accounts).where(eq(schema.accounts.id, id)).returning();
    if (!deleted) {
      return reply.status(404).send({ error: 'Account not found' });
    }
    return { message: 'Account deleted' };
  });
}
