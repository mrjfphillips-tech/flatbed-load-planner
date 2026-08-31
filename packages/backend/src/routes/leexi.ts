import { FastifyInstance } from 'fastify';
import { requireAnyRole } from '../middleware/auth.js';

export async function leexiRoutes(app: FastifyInstance): Promise<void> {
  // POST /leexi/import — import a call from Leexi
  app.post<{ Body: { callId: string; accountId: string } }>(
    '/import', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { callId, accountId } = request.body;
      if (!callId || !accountId) {
        return reply.status(400).send({ error: 'callId and accountId are required' });
      }

      // Leexi integration stub — requires LEEXI_API_KEY
      if (!process.env.LEEXI_API_KEY) {
        return reply.status(503).send({
          error: 'Leexi integration not configured',
          message: 'Set LEEXI_API_KEY in environment variables to enable Leexi imports.',
        });
      }

      // TODO: Implement actual Leexi API call
      return reply.status(501).send({ error: 'Leexi import not yet implemented' });
    }
  );

  // GET /leexi/calls — list available calls from Leexi
  app.get('/calls', { preHandler: [requireAnyRole] }, async (_request, reply) => {
    if (!process.env.LEEXI_API_KEY) {
      return reply.status(503).send({ error: 'Leexi integration not configured' });
    }
    return reply.status(501).send({ error: 'Leexi call listing not yet implemented' });
  });
}
