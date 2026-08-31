/**
 * Flatbed Rules Routes — CRUD operations and audit logging for loading rules.
 *
 * All routes require Administrator role (via requireRulesManagement guard).
 *
 * Requirements: 4.4, 4.5
 */

import { FastifyInstance } from 'fastify';
import {
  flatbedAuthenticate,
  requireRulesManagement,
  getFlatbedUserId,
} from '../middleware/flatbed-auth.js';
import {
  RulesService,
  RuleNotFoundError,
  RuleValidationError,
} from '../services/rules/RulesService.js';
import type { RuleType } from '../services/rules/RulesRepository.js';

const rulesService = new RulesService();

export async function flatbedRulesRoutes(app: FastifyInstance): Promise<void> {
  // Apply flatbed authentication to all routes in this plugin
  app.addHook('onRequest', flatbedAuthenticate);

  // ─── List Rules ─────────────────────────────────────────────────────────────
  // GET /api/flatbed/rules?type=&isActive=&limit=&offset=
  app.get<{
    Querystring: { type?: string; isActive?: string; limit?: string; offset?: string };
  }>('/', { preHandler: [requireRulesManagement] }, async (request, _reply) => {
    const { type, isActive, limit, offset } = request.query;

    const result = await rulesService.listRules({
      type: type as RuleType | undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return result;
  });

  // ─── Create Rule ────────────────────────────────────────────────────────────
  // POST /api/flatbed/rules
  app.post<{
    Body: {
      name: string;
      description?: string;
      type: RuleType;
      conditions?: Record<string, unknown>;
    };
  }>('/', { preHandler: [requireRulesManagement] }, async (request, reply) => {
    const userId = getFlatbedUserId(request);

    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { name, description, type, conditions } = request.body;

    if (!name) {
      return reply.status(400).send({ error: 'Rule name is required' });
    }

    if (!type) {
      return reply.status(400).send({ error: 'Rule type is required' });
    }

    try {
      const rule = await rulesService.createRule({
        name,
        description,
        type,
        conditions,
        createdBy: userId,
      });

      return reply.status(201).send(rule);
    } catch (err) {
      if (err instanceof RuleValidationError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  // ─── Get Rule ───────────────────────────────────────────────────────────────
  // GET /api/flatbed/rules/:id
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRulesManagement] },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const rule = await rulesService.getRule(id);
        return rule;
      } catch (err) {
        if (err instanceof RuleNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Update Rule (including classification change with audit) ───────────────
  // PUT /api/flatbed/rules/:id
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      type?: RuleType;
      conditions?: Record<string, unknown>;
      isActive?: boolean;
    };
  }>('/:id', { preHandler: [requireRulesManagement] }, async (request, reply) => {
    const { id } = request.params;
    const userId = getFlatbedUserId(request);

    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    try {
      const result = await rulesService.updateRule(id, userId, request.body);
      return result;
    } catch (err) {
      if (err instanceof RuleNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof RuleValidationError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  // ─── Delete Rule ────────────────────────────────────────────────────────────
  // DELETE /api/flatbed/rules/:id
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRulesManagement] },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await rulesService.deleteRule(id);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof RuleNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        if (err instanceof RuleValidationError) {
          return reply.status(400).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Get Rule Audit Log ─────────────────────────────────────────────────────
  // GET /api/flatbed/rules/:id/audit
  app.get<{ Params: { id: string } }>(
    '/:id/audit',
    { preHandler: [requireRulesManagement] },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const auditLog = await rulesService.getAuditLog(id);
        return { auditLog };
      } catch (err) {
        if (err instanceof RuleNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );
}
