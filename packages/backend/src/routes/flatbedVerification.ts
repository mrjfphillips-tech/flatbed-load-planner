/**
 * Flatbed Verification Routes — API endpoints for driver verification checklists
 * and loader progress tracking.
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4
 */

import { FastifyInstance } from 'fastify';
import { VerificationService } from '../services/verification/index.js';
import {
  requireFlatbedPermission,
  requireFlatbedRole,
  getFlatbedUserId,
} from '../middleware/flatbed-auth.js';

const verificationService = new VerificationService();

export async function flatbedVerificationRoutes(app: FastifyInstance) {
  // ─── Checklist Endpoints ────────────────────────────────────────────────────

  /**
   * GET /api/flatbed/verification/checklist/:planVersionId
   * Get or generate a verification checklist for an approved plan version.
   * Roles: Driver, Supervisor, Planner, Administrator
   */
  app.get<{
    Params: { planVersionId: string };
    Querystring: { itemIds?: string; securementIds?: string };
  }>(
    '/checklist/:planVersionId',
    { preHandler: [requireFlatbedPermission('checklist:view')] },
    async (request, reply) => {
      const { planVersionId } = request.params;
      const itemIds = request.query.itemIds?.split(',') ?? [];
      const securementIds = request.query.securementIds?.split(',') ?? [];

      const checklist = await verificationService.getOrGenerateChecklist({
        planVersionId,
        itemIds,
        securementIds,
      });

      return reply.send(checklist);
    }
  );

  /**
   * PATCH /api/flatbed/verification/checklist/:planVersionId
   * Update individual checklist items (item presence, securement, weight, damage).
   * Roles: Driver, Administrator
   */
  app.patch<{
    Params: { planVersionId: string };
    Body: {
      itemPresenceChecks?: { itemId: string; verified: boolean; notes?: string }[];
      securementChecks?: { securementId: string; verified: boolean; notes?: string }[];
      weightCheckVerified?: boolean;
      weightCheckNotes?: string;
      damageCheckVerified?: boolean;
      damageCheckNotes?: string;
    };
  }>(
    '/checklist/:planVersionId',
    { preHandler: [requireFlatbedPermission('checklist:complete')] },
    async (request, reply) => {
      const { planVersionId } = request.params;
      const body = request.body;

      const checklist = await verificationService.updateChecklist(planVersionId, body);
      return reply.send(checklist);
    }
  );

  /**
   * POST /api/flatbed/verification/checklist/:planVersionId/complete
   * Mark the checklist as fully complete. Records timestamp and driver identity.
   * Roles: Driver, Administrator
   */
  app.post<{
    Params: { planVersionId: string };
  }>(
    '/checklist/:planVersionId/complete',
    { preHandler: [requireFlatbedPermission('checklist:complete')] },
    async (request, reply) => {
      const { planVersionId } = request.params;
      const driverId = getFlatbedUserId(request)!;

      const checklist = await verificationService.completeChecklist(planVersionId, {
        driverId,
      });

      return reply.send(checklist);
    }
  );

  /**
   * POST /api/flatbed/verification/checklist/:planVersionId/discrepancy
   * Report a non-conforming item. Requires description, notifies Supervisor.
   * Roles: Driver, Administrator
   */
  app.post<{
    Params: { planVersionId: string };
    Body: { description: string };
  }>(
    '/checklist/:planVersionId/discrepancy',
    { preHandler: [requireFlatbedPermission('checklist:complete')] },
    async (request, reply) => {
      const { planVersionId } = request.params;
      const driverId = getFlatbedUserId(request)!;
      const { description } = request.body;

      const checklist = await verificationService.reportDiscrepancy(planVersionId, {
        driverId,
        description,
      });

      return reply.send(checklist);
    }
  );

  // ─── Loading Progress Endpoints ─────────────────────────────────────────────

  /**
   * GET /api/flatbed/verification/progress/:planId
   * Get loading progress for a plan.
   * Roles: Loader, Planner, Supervisor, Administrator
   */
  app.get<{
    Params: { planId: string };
  }>(
    '/progress/:planId',
    { preHandler: [requireFlatbedPermission('instructions:view')] },
    async (request, reply) => {
      const { planId } = request.params;
      const progress = await verificationService.getLoadingProgress(planId);
      return reply.send(progress);
    }
  );

  /**
   * POST /api/flatbed/verification/progress/:planId/init
   * Initialize loading progress for a plan with step-by-step instructions.
   * Roles: Planner, Supervisor, Administrator
   */
  app.post<{
    Params: { planId: string };
    Body: { steps: { stepNumber: number; description: string }[] };
  }>(
    '/progress/:planId/init',
    { preHandler: [requireFlatbedRole('Planner', 'Supervisor', 'Administrator')] },
    async (request, reply) => {
      const { planId } = request.params;
      const { steps } = request.body;

      const progress = await verificationService.getOrInitLoadingProgress({
        planId,
        steps,
      });

      return reply.status(201).send(progress);
    }
  );

  /**
   * POST /api/flatbed/verification/progress/:planId/step/:stepNumber/complete
   * Mark a loading step as complete. Steps must be completed in sequence.
   * Roles: Loader, Administrator
   */
  app.post<{
    Params: { planId: string; stepNumber: string };
  }>(
    '/progress/:planId/step/:stepNumber/complete',
    { preHandler: [requireFlatbedPermission('instructions:mark_complete')] },
    async (request, reply) => {
      const { planId, stepNumber } = request.params;
      const completedBy = getFlatbedUserId(request)!;

      const progress = await verificationService.markStepComplete(planId, {
        stepNumber: parseInt(stepNumber, 10),
        completedBy,
      });

      return reply.send(progress);
    }
  );
}
