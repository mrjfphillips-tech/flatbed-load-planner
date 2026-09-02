// ─── Load Diagram API Client ─────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Thin wrapper over the backend /api/load-diagram endpoints. All values crossing
// this boundary are canonical mm/kg — unit conversion for display happens in the
// UI via the shared units module.

import type { loadDiagram } from '@ptv-discovery-coach/shared';

type UnitSystem = loadDiagram.UnitSystem;
type ExcelParseResult = loadDiagram.ExcelParseResult;
type LoadItem = loadDiagram.LoadItem;
type TrailerProfile = loadDiagram.TrailerProfile;
type DiagramExportOptions = loadDiagram.DiagramExportOptions;

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function url(path: string): string {
  return `${API_BASE}/api/load-diagram${path}`;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/** Reads a File into a base64 string (no data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Uploads and parses an Excel file, returning parsed items in canonical units. */
export async function uploadExcel(file: File): Promise<ExcelParseResult> {
  const fileBase64 = await fileToBase64(file);
  const res = await fetch(url('/upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64 }),
  });
  return jsonOrThrow<ExcelParseResult>(res);
}

/** Returns the download URL for a template variant. */
export function templateUrl(unit: UnitSystem): string {
  return url(`/template?unit=${unit}`);
}

/** Lists all trailer profiles (templates + custom). */
export async function listTrailers(): Promise<(TrailerProfile & { id: string })[]> {
  const res = await fetch(url('/trailers'));
  return jsonOrThrow(res);
}

export interface CreatePlanResult {
  planId: string;
  status: string;
  totalWeight: number;
  volumeUtilization: number;
  axleWeights: number[];
  placedCount: number;
  overflowItems: LoadItem[];
  sourceUnitSystem: UnitSystem;
  displayUnitSystem: UnitSystem;
}

/** Creates and computes a load plan from parsed items. */
export async function createPlan(input: {
  name: string;
  trailerProfileId: string;
  items: LoadItem[];
  sourceUnitSystem: UnitSystem;
  displayUnitSystem: UnitSystem;
}): Promise<CreatePlanResult> {
  const res = await fetch(url('/plans'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<CreatePlanResult>(res);
}

/** Fetches a plan with its placed items. */
export async function getPlan(id: string): Promise<loadDiagram.LoadPlan & { items: loadDiagram.PlacedItem[] }> {
  const res = await fetch(url(`/plans/${id}`));
  return jsonOrThrow(res);
}

/** Requests a PDF export and returns the resulting Blob. */
export async function exportPdf(
  planId: string,
  options: Partial<DiagramExportOptions>,
): Promise<Blob> {
  const res = await fetch(url(`/plans/${planId}/export`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
}

/** Marks a plan finalized. */
export async function finalizePlan(planId: string): Promise<void> {
  const res = await fetch(url(`/plans/${planId}/finalize`), { method: 'POST' });
  await jsonOrThrow(res);
}

// ─── Customer Fleet ─────────────────────────────────────────────────────────

type Fleet = loadDiagram.Fleet;
type FleetVehicle = loadDiagram.FleetVehicle;

export interface FleetSummary {
  id: string;
  name: string;
  displayUnitSystem: UnitSystem;
  vehicleCount: number;
}

/** Returns the download URL for a fleet-vehicle template variant. */
export function fleetTemplateUrl(unit: UnitSystem): string {
  return url(`/fleet-templates?unit=${unit}`);
}

/** Lists all fleets with vehicle counts. */
export async function listFleets(): Promise<FleetSummary[]> {
  const res = await fetch(url('/fleets'));
  return jsonOrThrow<FleetSummary[]>(res);
}

/** Fetches one fleet with its vehicles. */
export async function getFleet(id: string): Promise<Fleet & { id: string }> {
  const res = await fetch(url(`/fleets/${id}`));
  return jsonOrThrow(res);
}

/** Creates a named, empty fleet. */
export async function createFleet(
  name: string,
  displayUnitSystem: UnitSystem,
): Promise<Fleet & { id: string }> {
  const res = await fetch(url('/fleets'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, displayUnitSystem }),
  });
  return jsonOrThrow(res);
}

/** Uploads an Excel file of vehicles as a new named fleet. */
export async function uploadFleet(
  name: string,
  file: File,
): Promise<Fleet & { id: string; detectedUnitSystem: UnitSystem }> {
  const fileBase64 = await fileToBase64(file);
  const res = await fetch(url('/fleets/upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, fileBase64 }),
  });
  return jsonOrThrow(res);
}

/** Adds a single vehicle to a fleet (manual builder). Values are canonical mm/kg. */
export async function addFleetVehicle(
  fleetId: string,
  vehicle: Omit<FleetVehicle, 'id'>,
): Promise<FleetVehicle & { id: string }> {
  const res = await fetch(url(`/fleets/${fleetId}/vehicles`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vehicle),
  });
  return jsonOrThrow(res);
}

/** Deletes a fleet vehicle. */
export async function deleteFleetVehicle(vehicleId: string): Promise<void> {
  const res = await fetch(url(`/fleet-vehicles/${vehicleId}`), { method: 'DELETE' });
  await jsonOrThrow(res);
}

/** Creates and computes a load plan against a specific fleet vehicle. */
export async function createPlanForVehicle(
  vehicleId: string,
  input: {
    name: string;
    items: LoadItem[];
    sourceUnitSystem: UnitSystem;
    displayUnitSystem: UnitSystem;
  },
): Promise<CreatePlanResult & { fleetVehicleId: string }> {
  const res = await fetch(url(`/fleet-vehicles/${vehicleId}/plan`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}
