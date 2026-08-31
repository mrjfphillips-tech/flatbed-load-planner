/**
 * Flatbed Shareable Link Routes — Generate and access shared plan views.
 *
 * POST /api/flatbed/plans/:planId/share — Generate a shareable link token
 * GET /api/flatbed/shared/:token — Access a shared plan view (no auth required)
 *
 * Requirements: 15.4, 15.5
 */

import { FastifyInstance } from 'fastify';
import {
  flatbedAuthenticate,
  requireFlatbedPermission,
  getFlatbedUserId,
} from '../middleware/flatbed-auth.js';
import { PlanService, PlanNotFoundError } from '../services/plan/PlanService.js';
import {
  ShareableLinkService,
  InvalidShareTokenError,
  ShareTokenExpiredError,
  isShareableRole,
} from '../services/export/ShareableLinkService.js';
import type { ShareableRole } from '../services/export/ShareableLinkService.js';

const planService = new PlanService();
const shareService = new ShareableLinkService();

export async function flatbedShareRoutes(app: FastifyInstance): Promise<void> {
  // ─── Generate Shareable Link (authenticated) ────────────────────────────────
  // POST /api/flatbed/plans/:planId/share
  app.post<{
    Params: { planId: string };
    Body: {
      role: string;
      customerName?: string;
      expiresInHours?: number;
    };
  }>(
    '/plans/:planId/share',
    {
      onRequest: [flatbedAuthenticate],
      preHandler: [requireFlatbedPermission('plan:view')],
    },
    async (request, reply) => {
      const { planId } = request.params;
      const { role, customerName, expiresInHours } = request.body;
      const userId = getFlatbedUserId(request);

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      // Validate role
      if (!role || !isShareableRole(role)) {
        return reply.status(400).send({
          error: `Invalid role. Must be one of: Planner, Supervisor, Loader, Driver, Customer_Viewer`,
        });
      }

      // Validate Customer_Viewer requires customerName
      if (role === 'Customer_Viewer' && (!customerName || customerName.trim().length === 0)) {
        return reply.status(400).send({
          error: 'customerName is required when role is Customer_Viewer',
        });
      }

      // Verify plan exists
      try {
        await planService.getPlan(planId);
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }

      // Generate the token
      try {
        const token = shareService.generateShareToken({
          planId,
          role: role as ShareableRole,
          createdBy: userId,
          customerName,
          expiresInHours,
        });

        const shareUrl = `/api/flatbed/shared/${token}`;

        return reply.status(201).send({
          token,
          shareUrl,
          role,
          planId,
          customerName: role === 'Customer_Viewer' ? customerName : undefined,
          expiresInHours: expiresInHours ?? null,
        });
      } catch (err) {
        if (err instanceof InvalidShareTokenError) {
          return reply.status(400).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Access Shared Plan View (public — no auth required) ────────────────────
  // GET /api/flatbed/shared/:token
  app.get<{ Params: { token: string } }>(
    '/shared/:token',
    async (request, reply) => {
      const { token } = request.params;

      // Decode and validate the token
      let payload;
      try {
        payload = shareService.decodeShareToken(token);
      } catch (err) {
        if (err instanceof ShareTokenExpiredError) {
          return reply.status(410).send({ error: err.message });
        }
        if (err instanceof InvalidShareTokenError) {
          return reply.status(400).send({ error: err.message });
        }
        throw err;
      }

      // Fetch the plan data
      let planData;
      try {
        planData = await planService.getPlan(payload.planId);
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: 'Plan not found' });
        }
        throw err;
      }

      // Build the role-appropriate view
      const sharedView = shareService.buildSharedView(payload, {
        plan: planData.plan as unknown as Record<string, unknown>,
        currentVersion: planData.currentVersion as unknown as Record<string, unknown>,
      });

      return reply.status(200).send(sharedView);
    }
  );
}
