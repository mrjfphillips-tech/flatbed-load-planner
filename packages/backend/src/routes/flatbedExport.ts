/**
 * Flatbed Load Plan Export Routes — PDF and Excel export endpoints.
 *
 * Requirements: 15.1, 15.2, 15.3
 */

import { FastifyInstance } from 'fastify';
import {
  flatbedAuthenticate,
  requireFlatbedPermission,
} from '../middleware/flatbed-auth.js';
import { PlanService, PlanNotFoundError } from '../services/plan/PlanService.js';
import {
  ExcelExportService,
  PdfExportService,
  buildExcelExportInput,
  buildPdfExportInput,
} from '../services/export/index.js';

const planService = new PlanService();
const excelExportService = new ExcelExportService();
const pdfExportService = new PdfExportService();

export async function flatbedExportRoutes(app: FastifyInstance): Promise<void> {
  // Apply flatbed authentication to all routes in this plugin
  app.addHook('onRequest', flatbedAuthenticate);

  // ─── PDF Export (Full Multi-Page) ───────────────────────────────────────────
  // GET /api/flatbed/plans/:planId/export/pdf
  app.get<{ Params: { planId: string }; Querystring: { paperSize?: string } }>(
    '/:planId/export/pdf',
    { preHandler: [requireFlatbedPermission('plan:view')] },
    async (request, reply) => {
      const { planId } = request.params;
      const { paperSize } = request.query;

      try {
        const { plan, currentVersion } = await planService.getPlan(planId);

        if (!currentVersion) {
          return reply.status(404).send({ error: 'No version data found for plan' });
        }

        const exportInput = buildPdfExportInput({
          planId: plan.id,
          version: currentVersion.versionNumber,
          status: plan.status,
          equipment: (plan as any).equipment ?? null,
          freightManifest: plan.freightManifest as Record<string, unknown>[] | null,
          placedFreight: currentVersion.placedFreight as Record<string, unknown>[] | null,
          weightMetrics: currentVersion.weightMetrics as Record<string, unknown> | null,
          securementPlan: currentVersion.securementPlan as Record<string, unknown> | null,
          loadingSequence: currentVersion.loadingSequence as Record<string, unknown>[] | null,
          warnings: currentVersion.warnings as Record<string, unknown>[] | null,
        });

        const pdfOptions = {
          paperSize: paperSize === 'A4' ? 'A4' as const : 'LETTER' as const,
        };

        const buffer = await pdfExportService.generateFullPdf(exportInput, pdfOptions);
        const filename = `load-plan-${planId}.pdf`;

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .header('Content-Length', buffer.length)
          .send(buffer);
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── PDF Export (Single-Page Summary) ──────────────────────────────────────
  // GET /api/flatbed/plans/:planId/export/pdf/summary
  app.get<{ Params: { planId: string } }>(
    '/:planId/export/pdf/summary',
    { preHandler: [requireFlatbedPermission('plan:view')] },
    async (request, reply) => {
      const { planId } = request.params;

      try {
        const { plan, currentVersion } = await planService.getPlan(planId);

        if (!currentVersion) {
          return reply.status(404).send({ error: 'No version data found for plan' });
        }

        const exportInput = buildPdfExportInput({
          planId: plan.id,
          version: currentVersion.versionNumber,
          status: plan.status,
          equipment: (plan as any).equipment ?? null,
          freightManifest: plan.freightManifest as Record<string, unknown>[] | null,
          placedFreight: currentVersion.placedFreight as Record<string, unknown>[] | null,
          weightMetrics: currentVersion.weightMetrics as Record<string, unknown> | null,
          securementPlan: currentVersion.securementPlan as Record<string, unknown> | null,
          loadingSequence: currentVersion.loadingSequence as Record<string, unknown>[] | null,
          warnings: currentVersion.warnings as Record<string, unknown>[] | null,
        });

        const buffer = await pdfExportService.generateSinglePageSummary(exportInput);
        const filename = `loading-summary-${planId}.pdf`;

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .header('Content-Length', buffer.length)
          .send(buffer);
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Excel Export ───────────────────────────────────────────────────────────
  // GET /api/flatbed/plans/:planId/export/excel
  app.get<{ Params: { planId: string } }>(
    '/:planId/export/excel',
    { preHandler: [requireFlatbedPermission('plan:view')] },
    async (request, reply) => {
      const { planId } = request.params;

      try {
        const { plan, currentVersion } = await planService.getPlan(planId);

        if (!currentVersion) {
          return reply.status(404).send({ error: 'No version data found for plan' });
        }

        const exportInput = buildExcelExportInput({
          planId: plan.id,
          freightManifest: plan.freightManifest,
          placedFreight: currentVersion.placedFreight,
          weightMetrics: currentVersion.weightMetrics,
          securementPlan: currentVersion.securementPlan,
          loadingSequence: currentVersion.loadingSequence,
        });

        const buffer = await excelExportService.generateWorkbook(exportInput);

        const filename = `load-plan-${planId}.xlsx`;

        return reply
          .header(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          )
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .header('Content-Length', buffer.length)
          .send(buffer);
      } catch (err) {
        if (err instanceof PlanNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );
}
