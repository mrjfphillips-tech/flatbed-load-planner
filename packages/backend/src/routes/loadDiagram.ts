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
import { fleets, fleetVehicles } from '../db/schema/fleet.js';
import { parseExcelFile } from '../load-diagram/services/excelParser.js';
import {
  generateTemplate,
  templateFilename,
} from '../load-diagram/services/excelTemplate.js';
import {
  parseFleetVehicleFile,
  inspectFleetFile,
} from '../load-diagram/services/fleetVehicleParser.js';
import {
  generateFleetTemplate,
  fleetTemplateFilename,
} from '../load-diagram/services/fleetTemplate.js';
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

    // Embed the effective trailer profile (from a trailer profile OR a fleet
    // vehicle's platform) so the frontend viewers/editor/export can read its
    // dimensions directly.
    const trailerProfile = await resolvePlanTrailer(plan);
    if (!trailerProfile) {
      return reply.status(404).send({ error: 'Trailer profile or fleet vehicle not found.' });
    }

    const items = await db
      .select()
      .from(ldLoadItems)
      .where(eq(ldLoadItems.loadPlanId, plan.id));

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
      trailerRowToProfile(trailer),
      b.items,
      isUnitSystem(b.sourceUnitSystem) ? b.sourceUnitSystem : 'metric',
      isUnitSystem(b.displayUnitSystem)
        ? b.displayUnitSystem
        : (trailer.displayUnitSystem as UnitSystem),
      undefined,
      undefined,
      trailer.id,
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

    // Resolve the "trailer" from whichever the plan is tied to: a trailer
    // profile or a fleet vehicle's platform.
    let profile: loadDiagram.TrailerProfile | null = null;
    if (plan.trailerProfileId) {
      const [trailer] = await db
        .select()
        .from(trailerProfiles)
        .where(eq(trailerProfiles.id, plan.trailerProfileId))
        .limit(1);
      if (trailer) profile = trailerRowToProfile(trailer);
    } else if (plan.fleetVehicleId) {
      const [vehicle] = await db
        .select()
        .from(fleetVehicles)
        .where(eq(fleetVehicles.id, plan.fleetVehicleId))
        .limit(1);
      if (vehicle) profile = trailerFromVehicle(vehicle);
    }
    if (!profile) {
      return reply.status(404).send({ error: 'Trailer profile or fleet vehicle not found.' });
    }

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
      profile,
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

    const profile = await resolvePlanTrailer(plan);
    if (!profile) {
      return reply.status(404).send({ error: 'Trailer profile or fleet vehicle not found.' });
    }

    const itemRows = await db
      .select()
      .from(ldLoadItems)
      .where(eq(ldLoadItems.loadPlanId, plan.id));

    const opts = request.body ?? {};
    const displayUnit = isUnitSystem(opts.unitSystem)
      ? opts.unitSystem
      : (plan.displayUnitSystem as UnitSystem);

    const loadPlan = toLoadPlan(plan, profile, itemRows, displayUnit);
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

  // ─── Customer Fleet ─────────────────────────────────────────────────────────

  // GET /api/load-diagram/fleet-templates?unit=metric|imperial
  app.get<{ Querystring: { unit?: string } }>('/fleet-templates', async (request, reply) => {
    const unit: UnitSystem = isUnitSystem(request.query.unit) ? request.query.unit : 'metric';
    const buffer = await generateFleetTemplate(unit);
    return reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header('Content-Disposition', `attachment; filename="${fleetTemplateFilename(unit)}"`)
      .send(buffer);
  });

  // GET /api/load-diagram/fleets  (fleets with vehicle counts)
  app.get('/fleets', async () => {
    const rows = await db.select().from(fleets);
    const withCounts = await Promise.all(
      rows.map(async (f) => {
        const vs = await db.select().from(fleetVehicles).where(eq(fleetVehicles.fleetId, f.id));
        return { ...f, vehicleCount: vs.length };
      }),
    );
    return withCounts;
  });

  // GET /api/load-diagram/fleets/:id  (fleet + vehicles)
  app.get<{ Params: { id: string } }>('/fleets/:id', async (request, reply) => {
    const [fleet] = await db
      .select()
      .from(fleets)
      .where(eq(fleets.id, request.params.id))
      .limit(1);
    if (!fleet) return reply.status(404).send({ error: 'Fleet not found.' });
    const vehicles = await db
      .select()
      .from(fleetVehicles)
      .where(eq(fleetVehicles.fleetId, fleet.id));
    return { ...fleet, vehicles };
  });

  // POST /api/load-diagram/fleets  (create a named, empty fleet)
  app.post<{ Body: { name?: string; displayUnitSystem?: string } }>(
    '/fleets',
    async (request, reply) => {
      const b = request.body ?? {};
      if (!b.name || !b.name.trim()) {
        return reply.status(400).send({ error: 'Fleet name is required.' });
      }
      const [row] = await db
        .insert(fleets)
        .values({
          name: b.name.trim(),
          displayUnitSystem: isUnitSystem(b.displayUnitSystem) ? b.displayUnitSystem : 'metric',
        })
        .returning();
      return reply.status(201).send({ ...row, vehicles: [] });
    },
  );

  // POST /api/load-diagram/fleets/inspect  { fileBase64 }
  // Returns the file's columns + sample rows + a suggested column mapping so the
  // user can confirm/adjust the mapping before importing.
  app.post<{ Body: { fileBase64?: string } }>('/fleets/inspect', async (request, reply) => {
    const b = request.body ?? {};
    if (!b.fileBase64) {
      return reply.status(400).send({ error: 'fileBase64 (base64-encoded .xlsx) is required.' });
    }
    const result = await inspectFleetFile(Buffer.from(b.fileBase64, 'base64'));
    if (result.error) return reply.status(400).send({ error: result.error });
    return result;
  });

  // POST /api/load-diagram/fleets/upload
  // { name, fileBase64, mapping, lengthUnit, weightUnit }
  // Parses an Excel file of vehicles using the confirmed column mapping + units
  // and creates a named fleet from it.
  app.post<{
    Body: {
      name?: string;
      fileBase64?: string;
      mapping?: loadDiagram.FleetColumnMapping;
      lengthUnit?: string;
      weightUnit?: string;
    };
  }>('/fleets/upload', async (request, reply) => {
    const b = request.body ?? {};
    if (!b.name || !b.name.trim()) {
      return reply.status(400).send({ error: 'Fleet name is required.' });
    }
    if (!b.fileBase64) {
      return reply.status(400).send({ error: 'fileBase64 (base64-encoded .xlsx) is required.' });
    }
    if (!b.mapping || typeof b.mapping !== 'object') {
      return reply.status(400).send({ error: 'A column mapping is required.' });
    }

    const lengthUnit = (loadDiagram.FLEET_LENGTH_UNITS as string[]).includes(b.lengthUnit ?? '')
      ? (b.lengthUnit as loadDiagram.FleetLengthUnit)
      : 'mm';
    const weightUnit = (loadDiagram.FLEET_WEIGHT_UNITS as string[]).includes(b.weightUnit ?? '')
      ? (b.weightUnit as loadDiagram.FleetWeightUnit)
      : 'kg';

    const buffer = Buffer.from(b.fileBase64, 'base64');
    const parsed = await parseFleetVehicleFile(buffer, {
      mapping: b.mapping,
      lengthUnit,
      weightUnit,
    });
    if (parsed.errors.length > 0 || parsed.vehicles.length === 0) {
      return reply.status(400).send(parsed);
    }

    // Display unit follows the chosen input units (imperial in/ft or lb -> imperial).
    const displayUnitSystem: UnitSystem =
      lengthUnit === 'in' || lengthUnit === 'ft' || weightUnit === 'lb' ? 'imperial' : 'metric';

    const [fleet] = await db
      .insert(fleets)
      .values({ name: b.name.trim(), displayUnitSystem })
      .returning();

      await db.insert(fleetVehicles).values(
        parsed.vehicles.map((v) => ({
          fleetId: fleet.id,
          vehicleId: v.vehicleId,
          vehicleName: v.vehicleName,
          trailerType: v.trailerType,
          vehicleAccount: v.vehicleAccount ?? null,
          licensePlate: v.licensePlate ?? null,
          maxWeight: v.maxWeight,
          platformLength: v.platformLength,
          platformWidth: v.platformWidth,
          platformHeight: v.platformHeight ?? null,
          costPerStop: v.costPerStop ?? null,
          fixedCost: v.fixedCost ?? null,
          costPerHour: v.costPerHour ?? null,
          costPerKm: v.costPerKm ?? null,
        })),
      );

    const vehicles = await db
      .select()
      .from(fleetVehicles)
      .where(eq(fleetVehicles.fleetId, fleet.id));
    return reply.status(201).send({ ...fleet, vehicles });
  });

  // POST /api/load-diagram/fleets/:id/vehicles  (manually add one vehicle)
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/fleets/:id/vehicles',
    async (request, reply) => {
      const [fleet] = await db
        .select()
        .from(fleets)
        .where(eq(fleets.id, request.params.id))
        .limit(1);
      if (!fleet) return reply.status(404).send({ error: 'Fleet not found.' });

      const err = validateVehicleBody(request.body ?? {});
      if (err) return reply.status(400).send({ error: err });

      const [row] = await db
        .insert(fleetVehicles)
        .values(vehicleValuesFromBody(fleet.id, request.body ?? {}))
        .returning();
      return reply.status(201).send(row);
    },
  );

  // GET /api/load-diagram/fleet-vehicles/find?ref=...
  // Finds a fleet vehicle across all fleets matching the reference by vehicleId,
  // then license plate, then vehicle name (case-insensitive). Used to
  // auto-assign a vehicle from a load sheet's Vehicle_ID column.
  app.get<{ Querystring: { ref?: string } }>('/fleet-vehicles/find', async (request, reply) => {
    const ref = (request.query.ref ?? '').trim();
    if (!ref) return reply.status(400).send({ error: 'ref query parameter is required.' });

    const all = await db.select().from(fleetVehicles);
    const norm = (s: string | null) => (s ?? '').trim().toLowerCase();
    const target = ref.toLowerCase();

    const byId = all.find((v) => norm(v.vehicleId) === target);
    const byPlate = byId ?? all.find((v) => norm(v.licensePlate) === target);
    const match = byPlate ?? all.find((v) => norm(v.vehicleName) === target);

    if (!match) return reply.status(404).send({ error: 'No matching fleet vehicle.' });

    // Include the owning fleet name for display.
    const [fleet] = await db.select().from(fleets).where(eq(fleets.id, match.fleetId)).limit(1);
    return { vehicle: match, fleetId: match.fleetId, fleetName: fleet?.name ?? '' };
  });

  // PUT /api/load-diagram/fleet-vehicles/:id  (edit a vehicle)
  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/fleet-vehicles/:id',
    async (request, reply) => {
      const b = request.body ?? {};
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const strFields = ['vehicleId', 'vehicleName', 'vehicleAccount', 'licensePlate'];
      for (const f of strFields) if (b[f] != null) updates[f] = String(b[f]);
      const numFields = [
        'maxWeight',
        'platformLength',
        'platformWidth',
        'platformHeight',
        'costPerStop',
        'fixedCost',
        'costPerHour',
        'costPerKm',
      ];
      for (const f of numFields) if (b[f] != null) updates[f] = Number(b[f]);

      const [row] = await db
        .update(fleetVehicles)
        .set(updates)
        .where(eq(fleetVehicles.id, request.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Fleet vehicle not found.' });
      return row;
    },
  );

  // DELETE /api/load-diagram/fleet-vehicles/:id
  app.delete<{ Params: { id: string } }>('/fleet-vehicles/:id', async (request, reply) => {
    const [row] = await db
      .delete(fleetVehicles)
      .where(eq(fleetVehicles.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Fleet vehicle not found.' });
    return { deleted: true, id: row.id };
  });

  // POST /api/load-diagram/fleet-vehicles/:id/plan  { name, items[], sourceUnitSystem?, displayUnitSystem? }
  // Creates and computes a load plan using a fleet vehicle's platform as the
  // trailer footprint. The plan records the assigned fleetVehicleId.
  app.post<{
    Params: { id: string };
    Body: {
      name?: string;
      items?: loadDiagram.LoadItem[];
      sourceUnitSystem?: string;
      displayUnitSystem?: string;
    };
  }>('/fleet-vehicles/:id/plan', async (request, reply) => {
    const b = request.body ?? {};
    if (!b.name) return reply.status(400).send({ error: 'name is required.' });
    if (!Array.isArray(b.items) || b.items.length === 0) {
      return reply.status(400).send({ error: 'items must be a non-empty array.' });
    }

    const [vehicle] = await db
      .select()
      .from(fleetVehicles)
      .where(eq(fleetVehicles.id, request.params.id))
      .limit(1);
    if (!vehicle) return reply.status(404).send({ error: 'Fleet vehicle not found.' });

    const trailer = trailerFromVehicle(vehicle);
    const result = await computeAndPersistPlan(
      b.name,
      trailer,
      b.items,
      isUnitSystem(b.sourceUnitSystem) ? b.sourceUnitSystem : 'metric',
      isUnitSystem(b.displayUnitSystem) ? b.displayUnitSystem : 'metric',
      undefined,
      vehicle.id,
    );
    return reply.status(201).send({ ...result, fleetVehicleId: vehicle.id });
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
  trailerProfile: loadDiagram.TrailerProfile,
  items: loadDiagram.LoadItem[],
  sourceUnitSystem: UnitSystem,
  displayUnitSystem: UnitSystem,
  existingPlanId?: string,
  fleetVehicleId?: string,
  trailerProfileId?: string,
) {
  // Expand quantities into individual physical units for packing.
  const expanded: loadDiagram.LoadItem[] = [];
  for (const it of items) {
    const qty = Math.max(1, it.quantity ?? 1);
    for (let i = 0; i < qty; i++) {
      expanded.push({ ...it, quantity: 1, id: qty > 1 ? `${it.id}-u${i + 1}` : it.id });
    }
  }

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
        trailerProfileId: trailerProfileId ?? null,
        fleetVehicleId: fleetVehicleId ?? null,
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
    warnings: packing.warnings,
    sourceUnitSystem,
    displayUnitSystem,
  };
}

async function recordHistory(loadPlanId: string, action: string) {
  await db.insert(ldPlanHistory).values({ loadPlanId, action });
}

type PlanRow = typeof ldLoadPlans.$inferSelect;
type ItemRow = typeof ldLoadItems.$inferSelect;
type FleetVehicleRow = typeof fleetVehicles.$inferSelect;

/** Shapes a persisted trailer row into the shared TrailerProfile type. */
function trailerRowToProfile(trailer: TrailerRow): loadDiagram.TrailerProfile {
  return {
    id: trailer.id,
    name: trailer.name,
    internalLength: trailer.internalLength,
    internalWidth: trailer.internalWidth,
    internalHeight: trailer.internalHeight,
    maxPayloadWeight: trailer.maxPayloadWeight,
    axleCount: trailer.axleCount,
    axleWeightLimits: trailer.axleWeightLimits,
    displayUnitSystem: trailer.displayUnitSystem as UnitSystem,
    trailerType: (trailer.trailerType as loadDiagram.TrailerType) ?? 'flatbed',
    doorConfig: (trailer.doorConfig as unknown as loadDiagram.DoorConfig) ?? {
      rear: true,
      sideLeft: false,
      sideRight: false,
    },
    isTemplate: trailer.isTemplate,
  };
}

/**
 * Builds a TrailerProfile from a fleet vehicle's platform so the packing engine
 * can treat the vehicle as a single-axle open flatbed. Missing platform height
 * defaults to an open-flatbed bound.
 */
function trailerFromVehicle(v: FleetVehicleRow): loadDiagram.TrailerProfile {
  const trailerType = (v.trailerType as loadDiagram.TrailerType) ?? 'flatbed';
  const isOpen = loadDiagram.OPEN_TRAILER_TYPES.includes(trailerType);
  // Height bound: an explicit platform height wins; otherwise for open trailers
  // use the suggested cargo-height (soft cap), and for enclosed fall back to the
  // default open-platform height.
  const internalHeight =
    v.platformHeight ??
    (isOpen
      ? loadDiagram.suggestedCargoHeight(v.platformLength, v.platformWidth, v.maxWeight).heightMm
      : loadDiagram.DEFAULT_OPEN_PLATFORM_HEIGHT_MM);
  return {
    id: v.id,
    name: v.vehicleName,
    internalLength: v.platformLength,
    internalWidth: v.platformWidth,
    internalHeight,
    maxPayloadWeight: v.maxWeight,
    axleCount: 1,
    axleWeightLimits: [v.maxWeight],
    displayUnitSystem: 'metric',
    trailerType,
    doorConfig: { rear: true, sideLeft: true, sideRight: true },
    isTemplate: false,
  };
}

const VALID_TRAILER_TYPES = ['flatbed', 'curtainsider', 'enclosed'] as const;

/** Validates a manual fleet-vehicle create body. Returns an error string or null. */
function validateVehicleBody(b: Record<string, unknown>): string | null {
  if (!b.vehicleId || !String(b.vehicleId).trim()) return 'vehicleId is required.';
  if (!b.vehicleName || !String(b.vehicleName).trim()) return 'vehicleName is required.';
  if (!VALID_TRAILER_TYPES.includes(b.trailerType as (typeof VALID_TRAILER_TYPES)[number])) {
    return 'trailerType is required (flatbed, curtainsider, or enclosed).';
  }
  for (const f of ['maxWeight', 'platformLength', 'platformWidth']) {
    const n = Number(b[f]);
    if (!Number.isFinite(n) || n <= 0) return `${f} must be a positive number.`;
  }
  return null;
}

/** Maps a manual fleet-vehicle body to a fleet_vehicles insert row (canonical). */
function vehicleValuesFromBody(fleetId: string, b: Record<string, unknown>) {
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    fleetId,
    vehicleId: String(b.vehicleId),
    vehicleName: String(b.vehicleName),
    trailerType: b.trailerType as (typeof VALID_TRAILER_TYPES)[number],
    vehicleAccount: b.vehicleAccount ? String(b.vehicleAccount) : null,
    licensePlate: b.licensePlate ? String(b.licensePlate) : null,
    maxWeight: Number(b.maxWeight),
    platformLength: Number(b.platformLength),
    platformWidth: Number(b.platformWidth),
    platformHeight: num(b.platformHeight),
    costPerStop: num(b.costPerStop),
    fixedCost: num(b.fixedCost),
    costPerHour: num(b.costPerHour),
    costPerKm: num(b.costPerKm),
  };
}

/**
 * Resolves the effective trailer profile for a plan — from its trailer profile
 * or, for a fleet-vehicle plan, from the vehicle's platform. Returns null if
 * neither can be found.
 */
async function resolvePlanTrailer(plan: PlanRow): Promise<loadDiagram.TrailerProfile | null> {
  if (plan.trailerProfileId) {
    const [trailer] = await db
      .select()
      .from(trailerProfiles)
      .where(eq(trailerProfiles.id, plan.trailerProfileId))
      .limit(1);
    return trailer ? trailerRowToProfile(trailer) : null;
  }
  if (plan.fleetVehicleId) {
    const [vehicle] = await db
      .select()
      .from(fleetVehicles)
      .where(eq(fleetVehicles.id, plan.fleetVehicleId))
      .limit(1);
    return vehicle ? trailerFromVehicle(vehicle) : null;
  }
  return null;
}

/** Reconstructs a shared LoadPlan (with placed items) from persisted rows. */
function toLoadPlan(
  plan: PlanRow,
  trailerProfile: loadDiagram.TrailerProfile,
  itemRows: ItemRow[],
  displayUnitSystem: UnitSystem,
): loadDiagram.LoadPlan {
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
    // Derived from placement + trailer type (deterministic; not persisted).
    warnings: loadDiagram.generateWarnings(items, trailerProfile),
  };
}
