/**
 * Feedback Routes — Capture pilot user feedback and V2 feature requests
 *
 *   POST /api/feedback          — Submit feedback after a session
 *   GET  /api/feedback          — List all feedback (admin only)
 *
 * PDIF V1 Tasks 5.3 + 5.4
 */

import { FastifyInstance } from 'fastify';
import { requireAnyRole, getUserId, requireAdmin } from '../middleware/auth.js';

// In-memory storage for V1 (move to DB in V2)
const feedbackStore: Array<{
  id: string;
  userId: string;
  sessionId: string | null;
  type: 'bug' | 'feature_request' | 'suggestion' | 'praise' | 'issue';
  message: string;
  context: string;
  timestamp: string;
}> = [];

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {

  // POST /feedback — Submit feedback
  app.post<{ Body: { sessionId?: string; type: string; message: string; context?: string } }>(
    '/', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { sessionId, type, message, context } = request.body;
      const userId = getUserId(request) || 'unknown';

      if (!message?.trim()) {
        return reply.status(400).send({ error: 'message is required' });
      }

      const feedback = {
        id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        sessionId: sessionId || null,
        type: (type || 'suggestion') as 'bug' | 'feature_request' | 'suggestion' | 'praise' | 'issue',
        message: message.trim(),
        context: context || '',
        timestamp: new Date().toISOString(),
      };

      feedbackStore.push(feedback);
      console.log(`[Feedback] ${type}: "${message.substring(0, 80)}" from ${userId}`);

      return reply.status(201).send({ id: feedback.id, message: 'Thank you for your feedback!' });
    }
  );

  // GET /feedback — List all (admin only)
  app.get('/', { preHandler: [requireAdmin] }, async () => {
    return {
      total: feedbackStore.length,
      feedback: feedbackStore.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    };
  });

  // GET /feedback/stats — Quick stats
  app.get('/stats', { preHandler: [requireAnyRole] }, async () => {
    const types: Record<string, number> = {};
    for (const f of feedbackStore) {
      types[f.type] = (types[f.type] || 0) + 1;
    }
    return { total: feedbackStore.length, byType: types };
  });
}
