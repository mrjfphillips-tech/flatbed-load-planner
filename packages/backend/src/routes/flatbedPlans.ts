/**
 * Flatbed Load Plan Routes — CRUD, versioning, approval workflow, and comparison.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

import { FastifyInstance } from 'fastify';
import {
  flatbedAuthenticate,
  requireFlatbedPermission,
  getFlatbedUserId,
} from '../middleware/flatbed-auth.js';
import {
  PlanService,
  PlanNotFoundError,
  VersionNotFoundError,
  InvalidStatusTransitionError,
  PlanLockedError,
} from '../services/plan/PlanService.js';

const planService = new PlanService();

export async function flatbedPlanRoutes(app: FastifyInstance): Promise<void> {
  // Apply flatbed authentication to all routes in this plugin
  app.addHook('onRequest', flatbedAuthenticate);

  // ─── List Plans ───────────────────────────────────────────────────────────────
  // GET /api/flatbed/plans?userId=&status=&limit=&offset=
  app.get<{
    Querystring: { userId?: string; status?: string; limit?: string; offset?: string };
  }>('/', { preHandler: [requireFlatbedPermission('plan:view')] }, async (request, _reply) => {
    const { userId, status, limit, offset } = request.query;

    const plans = await planService.listPlans({
      userId,
      status: status as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return plans;
  });

  // ─── Create Plan ──────────────────────────────────────────────────────────────
  // POST /api/flatbed/plans
  app.post<{
    Body: {
      trailerId: string;
      tractorId: string;
      pattern?: string;
      freightManifest?: Record<string, unknown>[];
    };
  }>('/', { preHandler: [requireFlatbedPermission('plan:create')] }, async (request, reply) => {
    const { trailerId, tractorId, pattern, freightManifest } = request.body;
    const userId = getFlatbedUserId(request);

    if (!trailerId || !tractorId) {
      return reply.status(400).send({ error: 'trailerId and tractorId are required' });
    }

    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const result = await planService.createPlan({
      createdBy: userId,
      trailerId,
      tractorId,
      pattern,
      freightManifest,
    });

    return reply.status(201).send(result);
  });

  // ─── Get Plan ─────────────────────────────────────────────────────────────────
  // GET /api/flatbed/plans/:id
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireFlatbedPermission('plan:view')] },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const result = await planService.getPlan(id);
        return result;
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Save Plan (new version) ──────────────────────────────────────────────────
  // PUT /api/flatbed/plans/:id
  // Increments version on every save. If plan is approved, creates new draft version.
  app.put<{
    Params: { id: string };
    Body: {
      placedFreight?: Record<string, unknown>[];
      weightMetrics?: Record<string, unknown>;
      securementPlan?: Record<string, unknown>;
      loadingSequence?: Record<string, unknown>[];
      warnings?: Record<string, unknown>[];
      pattern?: string;
      freightManifest?: Record<string, unknown>[];
    };
  }>('/:id', { preHandler: [requireFlatbedPermission('plan:edit')] }, async (request, reply) => {
    const { id } = request.params;
    const userId = getFlatbedUserId(request);

    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    try {
      const result = await planService.savePlan(id, userId, request.body);
      return result;
    } catch (err) {
      if (err instanceof PlanNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof PlanLockedError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });

  // ─── Get Version History ──────────────────────────────────────────────────────
  // GET /api/flatbed/plans/:id/versions
  app.get<{ Params: { id: string } }>(
    '/:id/versions',
    { preHandler: [requireFlatbedPermission('plan:view')] },
    async (request, _reply) => {
      const { id } = request.params;
      const versions = await planService.getVersionHistory(id);
      return { versions };
    }
  );

  // ─── Get Specific Version ─────────────────────────────────────────────────────
  // GET /api/flatbed/plans/:id/versions/:version
  app.get<{ Params: { id: string; version: string } }>(
    '/:id/versions/:version',
    { preHandler: [requireFlatbedPermission('plan:view')] },
    async (request, reply) => {
      const { id, version } = request.params;
      const versionNumber = parseInt(version, 10);

      if (isNaN(versionNumber)) {
        return reply.status(400).send({ error: 'Version must be a number' });
      }

      try {
        const result = await planService.getVersion(id, versionNumber);
        return result;
      } catch (err) {
        if (err instanceof VersionNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Submit for Approval ──────────────────────────────────────────────────────
  // POST /api/flatbed/plans/:id/submit
  app.post<{ Params: { id: string } }>(
    '/:id/submit',
    { preHandler: [requireFlatbedPermission('plan:submit')] },
    async (request, reply) => {
      const { id } = request.params;
      const userId = getFlatbedUserId(request);

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      try {
        const plan = await planService.submitForApproval(id, userId);
        return plan;
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        if (err instanceof InvalidStatusTransitionError) {
          return reply.status(409).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Approve Plan ─────────────────────────────────────────────────────────────
  // POST /api/flatbed/plans/:id/approve
  app.post<{ Params: { id: string } }>(
    '/:id/approve',
    { preHandler: [requireFlatbedPermission('plan:approve')] },
    async (request, reply) => {
      const { id } = request.params;
      const userId = getFlatbedUserId(request);

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      try {
        const plan = await planService.approvePlan(id, userId);
        return plan;
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        if (err instanceof InvalidStatusTransitionError) {
          return reply.status(409).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Reject Plan ──────────────────────────────────────────────────────────────
  // POST /api/flatbed/plans/:id/reject
  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/:id/reject',
    { preHandler: [requireFlatbedPermission('plan:reject')] },
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body;
      const userId = getFlatbedUserId(request);

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      if (!reason || reason.trim().length === 0) {
        return reply.status(400).send({ error: 'Rejection reason is required' });
      }

      try {
        const plan = await planService.rejectPlan(id, userId, reason);
        return plan;
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        if (err instanceof InvalidStatusTransitionError) {
          return reply.status(409).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Compare Versions ─────────────────────────────────────────────────────────
  // GET /api/flatbed/plans/:id/compare?versionA=1&versionB=2
  app.get<{
    Params: { id: string };
    Querystring: { versionA: string; versionB: string };
  }>(
    '/:id/compare',
    { preHandler: [requireFlatbedPermission('plan:view')] },
    async (request, reply) => {
      const { id } = request.params;
      const { versionA, versionB } = request.query;

      const verA = parseInt(versionA, 10);
      const verB = parseInt(versionB, 10);

      if (isNaN(verA) || isNaN(verB)) {
        return reply.status(400).send({ error: 'versionA and versionB must be valid numbers' });
      }

      if (verA === verB) {
        return reply.status(400).send({ error: 'Cannot compare a version with itself' });
      }

      try {
        const comparison = await planService.compareVersions(id, verA, verB);
        return comparison;
      } catch (err) {
        if (err instanceof VersionNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );
}
