/**
 * Load Diagram Generator Routes.
 *
 * Endpoints for Excel upload/parse, template download, trailer profile CRUD,
 * load plan CRUD with computation, recompute, finalize, and PDF export.
 *
 * All persisted dimensions/weights are canonical mm/kg. The upload endpoint
 * accepts the Excel file as a base64-encoded body field (no multipart plugin
 * dependency); the parser detects and converts the unit system.
 *
 * _Requirements: 1.1, 6.1, 7.1_
 */

import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  trailerProfiles,
  ldLoadPlans,
  ldLoadItems,
  ldPlanHistory,
} from '../db/schema/load-diagram.js';
import { parseExcelFile } from '../load-diagram/services/excelParser.js';
import {
  generateTemplate,
  templateFilename,
} from '../load-diagram/services/excelTemplate.js';
import { generatePDF } from '../load-diagram/services/diagramGenerator.js';
import { loadDiagram } from '@ptv-discovery-coach/shared';

type UnitSystem = loadDiagram.UnitSystem;

const isUnitSystem = (v: unknown): v is UnitSystem =>
  v === 'metric' || v === 'imperial';

export async function loadDiagramRoutes(app: FastifyInstance): Promise<void> {
  // ─── Excel Upload & Parse ─────────────────────────────────────────────────────
  // POST /api/load-diagram/upload  { fileBase64: string }
  app.post<{ Body: { fileBase64?: string } }>('/upload', async (request, reply) => {
    const { fileBase64 } = request.body ?? {};
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return reply.status(400).send({ error: 'fileBase64 (base64-encoded .xlsx) is required.' });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, 'base64');
    } catch {
      return reply.status(400).send({ error: 'Invalid base64 file content.' });
    }

    const result = await parseExcelFile(buffer);
    return result;
  });

  // ─── Template Download ────────────────────────────────────────────────────────
  // GET /api/load-diagram/template?unit=metric|imperial
  app.get<{ Querystring: { unit?: string } }>('/template', async (request, reply) => {
    const unit: UnitSystem = isUnitSystem(request.query.unit) ? request.query.unit : 'metric';
    const buffer = await generateTemplate(unit);
    return reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header('Content-Disposition', `attachment; filename="${templateFilename(unit)}"`)
      .send(buffer);
  });

  // ─── Trailer Profile CRUD ─────────────────────────────────────────────────────
  // GET /api/load-diagram/trailers
  app.get('/trailers', async () => {
    return db.select().from(trailerProfiles);
  });

  // GET /api/load-diagram/trailers/:id
  app.get<{ Params: { id: string } }>('/trailers/:id', async (request, reply) => {
    const rows = await db
      .select()
      .from(trailerProfiles)
      .where(eq(trailerProfiles.id, request.params.id))
      .limit(1);
    if (rows.length === 0) return reply.status(404).send({ error: 'Trailer profile not found.' });
    return rows[0];
  });

  // POST /api/load-diagram/trailers
  app.post<{ Body: Record<string, unknown> }>('/trailers', async (request, reply) => {
    const b = request.body ?? {};
    const required = [
      'name',
      'internalLength',
      'internalWidth',
      'internalHeight',
      'maxPayloadWeight',
      'axleCount',
      'axleWeightLimits',
    ];
    for (const key of required) {
      if (b[key] == null) return reply.status(400).send({ error: `Missing field "${key}".` });
    }
    const [row] = await db
      .insert(trailerProfiles)
      .values({
        name: String(b.name),
        internalLength: Number(b.internalLength),
        internalWidth: Number(b.internalWidth),
        internalHeight: Number(b.internalHeight),
        maxPayloadWeight: Number(b.maxPayloadWeight),
        axleCount: Number(b.axleCount),
        axleWeightLimits: b.axleWeightLimits as number[],
        displayUnitSystem: isUnitSystem(b.displayUnitSystem) ? b.displayUnitSystem : 'metric',
        doorConfig: (b.doorConfig as Record<string, unknown>) ?? undefined,
        isTemplate: Boolean(b.isTemplate ?? false),
        createdBy: b.createdBy ? String(b.createdBy) : undefined,
      })
      .returning();
    return reply.status(201).send(row);
  });

  // PUT /api/load-diagram/trailers/:id
  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/trailers/:id',
    async (request, reply) => {
      const b = request.body ?? {};
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const numericFields = [
        'internalLength',
        'internalWidth',
        'internalHeight',
        'maxPayloadWeight',
        'axleCount',
      ];
      for (const f of numericFields) if (b[f] != null) updates[f] = Number(b[f]);
      if (b.name != null) updates.name = String(b.name);
      if (b.axleWeightLimits != null) updates.axleWeightLimits = b.axleWeightLimits;
      if (isUnitSystem(b.displayUnitSystem)) updates.displayUnitSystem = b.displayUnitSystem;
      if (b.doorConfig != null) updates.doorConfig = b.doorConfig;

      const [row] = await db
        .update(trailerProfiles)
        .set(updates)
        .where(eq(trailerProfiles.id, request.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Trailer profile not found.' });
      return row;
    },
  );

  // DELETE /api/load-diagram/trailers/:id
  app.delete<{ Params: { id: string } }>('/trailers/:id', async (request, reply) => {
    const [row] = await db
      .delete(trailerProfiles)
      .where(eq(trailerProfiles.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Trailer profile not found.' });
    return { deleted: true, id: row.id };
  });

  // ─── Load Plan CRUD ───────────────────────────────────────────────────────────
  // GET /api/load-diagram/plans
  app.get('/plans', async () => {
    return db.select().from(ldLoadPlans);
  });

  // GET /api/load-diagram/plans/:id  (plan + placed items)
  app.get<{ Params: { id: string } }>('/plans/:id', async (request, reply) => {
    const [plan] = await db
      .select()
      .from(ldLoadPlans)
      .where(eq(ldLoadPlans.id, request.params.id))
      .limit(1);
    if (!plan) return reply.status(404).send({ error: 'Load plan not found.' });

    const [trailer] = await db
      .select()
      .from(trailerProfiles)
      .where(eq(trailerProfiles.id, plan.trailerProfileId))
      .limit(1);
    if (!trailer) return reply.status(404).send({ error: 'Trailer profile not found.' });

    const items = await db
      .select()
      .from(ldLoadItems)
      .where(eq(ldLoadItems.loadPlanId, plan.id));

    // Embed the full trailer profile (shaped to the shared TrailerProfile type)
    // so the frontend viewers/editor/export can read its dimensions directly.
    const trailerProfile: loadDiagram.TrailerProfile = {
      id: trailer.id,
      name: trailer.name,
      internalLength: trailer.internalLength,
      internalWidth: trailer.internalWidth,
      internalHeight: trailer.internalHeight,
      maxPayloadWeight: trailer.maxPayloadWeight,
      axleCount: trailer.axleCount,
      axleWeightLimits: trailer.axleWeightLimits,
      displayUnitSystem: trailer.displayUnitSystem as UnitSystem,
      doorConfig: (trailer.doorConfig as unknown as loadDiagram.DoorConfig) ?? {
        rear: true,
        sideLeft: false,
        sideRight: false,
      },
      isTemplate: trailer.isTemplate,
    };

    return { ...plan, trailerProfile, items };
  });

  // POST /api/load-diagram/plans  (create + compute)
  app.post<{
    Body: {
      name?: string;
      trailerProfileId?: string;
      items?: loadDiagram.LoadItem[];
      sourceUnitSystem?: string;
      displayUnitSystem?: string;
    };
  }>('/plans', async (request, reply) => {
    const b = request.body ?? {};
    if (!b.trailerProfileId || !b.name) {
      return reply.status(400).send({ error: 'name and trailerProfileId are required.' });
    }
    if (!Array.isArray(b.items) || b.items.length === 0) {
      return reply.status(400).send({ error: 'items must be a non-empty array.' });
    }

    const [trailer] = await db
      .select()
      .from(trailerProfiles)
      .where(eq(trailerProfiles.id, b.trailerProfileId))
      .limit(1);
    if (!trailer) return reply.status(404).send({ error: 'Trailer profile not found.' });

    const result = await computeAndPersistPlan(
      b.name,
      trailer,
      b.items,
      isUnitSystem(b.sourceUnitSystem) ? b.sourceUnitSystem : 'metric',
      isUnitSystem(b.displayUnitSystem)
        ? b.displayUnitSystem
        : (trailer.displayUnitSystem as UnitSystem),
    );
    return reply.status(201).send(result);
  });

  // POST /api/load-diagram/plans/:id/recompute
  app.post<{ Params: { id: string } }>('/plans/:id/recompute', async (request, reply) => {
    const [plan] = await db
      .select()
      .from(ldLoadPlans)
      .where(eq(ldLoadPlans.id, request.params.id))
      .limit(1);
    if (!plan) return reply.status(404).send({ error: 'Load plan not found.' });

    const [trailer] = await db
      .select()
      .from(trailerProfiles)
      .where(eq(trailerProfiles.id, plan.trailerProfileId))
      .limit(1);
    if (!trailer) return reply.status(404).send({ error: 'Trailer profile not found.' });

    const items = await db
      .select()
      .from(ldLoadItems)
      .where(eq(ldLoadItems.loadPlanId, plan.id));

    const loadItems: loadDiagram.LoadItem[] = items.map((it) => ({
      id: it.id,
      itemId: it.itemId,
      description: it.description ?? undefined,
      length: it.length,
      width: it.width,
      height: it.height,
      weight: it.weight,
      quantity: it.quantity,
      stackabilityClass: it.stackabilityClass ?? undefined,
      maxStackWeight: it.maxStackWeight ?? undefined,
      deliveryStop: it.deliveryStop ?? undefined,
      temperatureZone: it.temperatureZone ?? undefined,
      floorOnly: it.floorOnly,
      topLoadProhibited: it.topLoadProhibited,
    }));

    // Clear existing items and recompute fresh.
    await db.delete(ldLoadItems).where(eq(ldLoadItems.loadPlanId, plan.id));
    const result = await computeAndPersistPlan(
      plan.name,
      trailer,
      loadItems,
      plan.sourceUnitSystem as UnitSystem,
      plan.displayUnitSystem as UnitSystem,
      plan.id,
    );
    await recordHistory(plan.id, 'computed');
    return result;
  });

  // POST /api/load-diagram/plans/:id/finalize
  app.post<{ Params: { id: string } }>('/plans/:id/finalize', async (request, reply) => {
    const [row] = await db
      .update(ldLoadPlans)
      .set({ status: 'finalized', finalizedAt: new Date(), updatedAt: new Date() })
      .where(eq(ldLoadPlans.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Load plan not found.' });
    await recordHistory(row.id, 'finalized');
    return row;
  });

  // POST /api/load-diagram/plans/:id/export  (PDF)
  app.post<{
    Params: { id: string };
    Body: Partial<loadDiagram.DiagramExportOptions>;
  }>('/plans/:id/export', async (request, reply) => {
    const [plan] = await db
      .select()
      .from(ldLoadPlans)
      .where(eq(ldLoadPlans.id, request.params.id))
      .limit(1);
    if (!plan) return reply.status(404).send({ error: 'Load plan not found.' });

    const [trailer] = await db
      .select()
      .from(trailerProfiles)
      .where(eq(trailerProfiles.id, plan.trailerProfileId))
      .limit(1);
    if (!trailer) return reply.status(404).send({ error: 'Trailer profile not found.' });

    const itemRows = await db
      .select()
      .from(ldLoadItems)
      .where(eq(ldLoadItems.loadPlanId, plan.id));

    const opts = request.body ?? {};
    const displayUnit = isUnitSystem(opts.unitSystem)
      ? opts.unitSystem
      : (plan.displayUnitSystem as UnitSystem);

    const loadPlan = toLoadPlan(plan, trailer, itemRows, displayUnit);
    const pdf = await generatePDF(loadPlan, {
      format: 'pdf',
      paperSize: opts.paperSize === 'A3' ? 'A3' : 'A4',
      unitSystem: displayUnit,
      includeChecklist: opts.includeChecklist ?? true,
      includeSummary: opts.includeSummary ?? true,
      views: opts.views ?? ['topDown', 'sideView'],
    });

    return reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="load-diagram-${plan.id}.pdf"`,
      )
      .send(pdf);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TrailerRow = typeof trailerProfiles.$inferSelect;

/**
 * Computes a load plan with the shared engine and persists the plan + placed
 * items. When `existingPlanId` is provided, updates that plan in place.
 */
async function computeAndPersistPlan(
  name: string,
  trailer: TrailerRow,
  items: loadDiagram.LoadItem[],
  sourceUnitSystem: UnitSystem,
  displayUnitSystem: UnitSystem,
  existingPlanId?: string,
) {
  // Expand quantities into individual physical units for packing.
  const expanded: loadDiagram.LoadItem[] = [];
  for (const it of items) {
    const qty = Math.max(1, it.quantity ?? 1);
    for (let i = 0; i < qty; i++) {
      expanded.push({ ...it, quantity: 1, id: qty > 1 ? `${it.id}-u${i + 1}` : it.id });
    }
  }

  const trailerProfile: loadDiagram.TrailerProfile = {
    id: trailer.id,
    name: trailer.name,
    internalLength: trailer.internalLength,
    internalWidth: trailer.internalWidth,
    internalHeight: trailer.internalHeight,
    maxPayloadWeight: trailer.maxPayloadWeight,
    axleCount: trailer.axleCount,
    axleWeightLimits: trailer.axleWeightLimits,
    displayUnitSystem: trailer.displayUnitSystem as UnitSystem,
    doorConfig: (trailer.doorConfig as unknown as loadDiagram.DoorConfig) ?? {
      rear: true,
      sideLeft: false,
      sideRight: false,
    },
    isTemplate: trailer.isTemplate,
  };

  const packing = loadDiagram.computeLoadPlan(expanded, trailerProfile);

  // Upsert the plan row.
  let planId = existingPlanId;
  if (planId) {
    await db
      .update(ldLoadPlans)
      .set({
        status: 'computed',
        totalWeight: packing.totalWeight,
        volumeUtilization: packing.volumeUtilization,
        axleWeights: packing.axleWeights,
        itemCount: packing.placedItems.length,
        computedAt: new Date(),
        updatedAt: new Date(),
        sourceUnitSystem,
        displayUnitSystem,
      })
      .where(eq(ldLoadPlans.id, planId));
  } else {
    const [row] = await db
      .insert(ldLoadPlans)
      .values({
        trailerProfileId: trailer.id,
        name,
        status: 'computed',
        sourceUnitSystem,
        displayUnitSystem,
        totalWeight: packing.totalWeight,
        volumeUtilization: packing.volumeUtilization,
        axleWeights: packing.axleWeights,
        itemCount: packing.placedItems.length,
        computedAt: new Date(),
      })
      .returning();
    planId = row.id;
  }

  // Persist placed items.
  if (packing.placedItems.length > 0) {
    await db.insert(ldLoadItems).values(
      packing.placedItems.map((p) => ({
        loadPlanId: planId!,
        itemId: p.itemId,
        description: p.description ?? null,
        length: p.length,
        width: p.width,
        height: p.height,
        weight: p.weight,
        quantity: 1,
        stackabilityClass: p.stackabilityClass ?? null,
        maxStackWeight: p.maxStackWeight ?? null,
        deliveryStop: p.deliveryStop ?? null,
        temperatureZone: p.temperatureZone ?? null,
        floorOnly: p.floorOnly,
        topLoadProhibited: p.topLoadProhibited,
        placedX: p.placedX,
        placedY: p.placedY,
        placedZ: p.placedZ,
        placedOrientation: p.placedOrientation,
        loadSequence: p.loadSequence,
      })),
    );
  }

  return {
    planId,
    status: 'computed',
    totalWeight: packing.totalWeight,
    volumeUtilization: packing.volumeUtilization,
    axleWeights: packing.axleWeights,
    placedCount: packing.placedItems.length,
    overflowItems: packing.overflowItems,
    sourceUnitSystem,
    displayUnitSystem,
  };
}

async function recordHistory(loadPlanId: string, action: string) {
  await db.insert(ldPlanHistory).values({ loadPlanId, action });
}

type PlanRow = typeof ldLoadPlans.$inferSelect;
type ItemRow = typeof ldLoadItems.$inferSelect;

/** Reconstructs a shared LoadPlan (with placed items) from persisted rows. */
function toLoadPlan(
  plan: PlanRow,
  trailer: TrailerRow,
  itemRows: ItemRow[],
  displayUnitSystem: UnitSystem,
): loadDiagram.LoadPlan {
  const trailerProfile: loadDiagram.TrailerProfile = {
    id: trailer.id,
    name: trailer.name,
    internalLength: trailer.internalLength,
    internalWidth: trailer.internalWidth,
    internalHeight: trailer.internalHeight,
    maxPayloadWeight: trailer.maxPayloadWeight,
    axleCount: trailer.axleCount,
    axleWeightLimits: trailer.axleWeightLimits,
    displayUnitSystem: trailer.displayUnitSystem as UnitSystem,
    doorConfig: (trailer.doorConfig as unknown as loadDiagram.DoorConfig) ?? {
      rear: true,
      sideLeft: false,
      sideRight: false,
    },
    isTemplate: trailer.isTemplate,
  };

  const items: loadDiagram.PlacedItem[] = itemRows
    .filter((it) => it.placedOrientation != null)
    .map((it) => ({
      id: it.id,
      itemId: it.itemId,
      description: it.description ?? undefined,
      length: it.length,
      width: it.width,
      height: it.height,
      weight: it.weight,
      quantity: it.quantity,
      stackabilityClass: it.stackabilityClass ?? undefined,
      maxStackWeight: it.maxStackWeight ?? undefined,
      deliveryStop: it.deliveryStop ?? undefined,
      temperatureZone: it.temperatureZone ?? undefined,
      floorOnly: it.floorOnly,
      topLoadProhibited: it.topLoadProhibited,
      placedX: it.placedX ?? 0,
      placedY: it.placedY ?? 0,
      placedZ: it.placedZ ?? 0,
      placedOrientation: (it.placedOrientation as loadDiagram.ItemOrientation) ?? 'LWH',
      loadSequence: it.loadSequence ?? 0,
    }));

  return {
    id: plan.id,
    trailerProfile,
    items,
    totalWeight: plan.totalWeight ?? 0,
    volumeUtilization: plan.volumeUtilization ?? 0,
    axleWeights: plan.axleWeights ?? [],
    sourceUnitSystem: plan.sourceUnitSystem as UnitSystem,
    displayUnitSystem,
    status: plan.status as loadDiagram.LoadPlanStatus,
  };
}
