/**
 * Transforms raw plan version data (JSON from database) into the structured
 * ExcelExportInput format used by ExcelExportService.
 *
 * Plan version data is stored as loosely-typed JSON. This module safely extracts
 * and coerces fields into the typed export format.
 */

import type {
  ExcelExportInput,
  FreightManifestRow,
  PlacementRow,
  WeightCalculationsData,
  ConcentratedLoadRow,
  SecurementRow,
  LoadingSequenceRow,
} from './ExcelExportService.js';

interface PlanVersionData {
  planId: string;
  freightManifest: Record<string, unknown>[] | null;
  placedFreight: Record<string, unknown>[] | null;
  weightMetrics: Record<string, unknown> | null;
  securementPlan: Record<string, unknown> | null;
  loadingSequence: Record<string, unknown>[] | null;
}

/**
 * Build the structured export input from raw plan version data.
 */
export function buildExcelExportInput(data: PlanVersionData): ExcelExportInput {
  return {
    planId: data.planId,
    freightManifest: buildFreightManifest(data.freightManifest, data.placedFreight),
    placements: buildPlacements(data.placedFreight),
    weightCalculations: buildWeightCalculations(data.weightMetrics),
    securementRequirements: buildSecurementRequirements(data.securementPlan),
    loadingSequence: buildLoadingSequence(data.loadingSequence),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFreightManifest(
  manifest: Record<string, unknown>[] | null,
  placedFreight: Record<string, unknown>[] | null
): FreightManifestRow[] {
  // Prefer the freight manifest if available; otherwise extract from placedFreight items
  const source = manifest ?? extractItemsFromPlaced(placedFreight);
  if (!source) return [];

  return source.map((item) => ({
    orderNumber: str(item.orderNumber),
    customerName: str(item.customerName),
    deliveryStop: num(item.deliveryStop),
    productType: str(item.productType),
    quantity: num(item.quantity, 1),
    weight: num(item.totalLineWeight ?? item.pieceWeight),
    length: numFromDimensions(item, 'length'),
    width: numFromDimensions(item, 'width'),
    height: numFromDimensions(item, 'height'),
    handlingMethod: str(item.handlingMethod),
    stackPermission: str(item.stackPermission),
  }));
}

function buildPlacements(placedFreight: Record<string, unknown>[] | null): PlacementRow[] {
  if (!placedFreight) return [];

  return placedFreight.map((pf) => {
    const position = pf.position as Record<string, unknown> | undefined;
    const item = pf.item as Record<string, unknown> | undefined;

    return {
      orderNumber: str(item?.orderNumber ?? pf.orderNumber),
      x: num(position?.x ?? pf.x),
      y: num(position?.y ?? pf.y),
      z: num(position?.z ?? pf.z),
      orientation: str(pf.orientation),
      layer: num(pf.layer),
      supportMethod: str(pf.supportMethod),
    };
  });
}

function buildWeightCalculations(
  metrics: Record<string, unknown> | null
): WeightCalculationsData {
  if (!metrics) {
    return {
      steerAxleWeight: 0,
      driveAxleWeight: 0,
      trailerAxleWeight: 0,
      totalGross: 0,
      cgLongitudinal: 0,
      cgLateral: 0,
      steerAxlePercent: 0,
      driveAxlePercent: 0,
      trailerAxlePercent: 0,
      concentratedLoads: [],
    };
  }

  const axleUtilization = metrics.axleUtilization as Record<string, unknown> | undefined;

  return {
    steerAxleWeight: num(metrics.steerWeight ?? metrics.steerAxleWeight),
    driveAxleWeight: num(metrics.driveWeight ?? metrics.driveAxleWeight),
    trailerAxleWeight: num(metrics.trailerWeight ?? metrics.trailerAxleWeight),
    totalGross: num(metrics.totalGross ?? metrics.totalGrossWeight),
    cgLongitudinal: num(metrics.cgLongitudinal),
    cgLateral: num(metrics.cgLateral ?? metrics.lateralCGOffset),
    steerAxlePercent: num(axleUtilization?.steer ?? metrics.steerAxlePercent),
    driveAxlePercent: num(axleUtilization?.drive ?? metrics.driveAxlePercent),
    trailerAxlePercent: num(axleUtilization?.trailer ?? metrics.trailerAxlePercent),
    concentratedLoads: buildConcentratedLoads(metrics.concentratedLoads),
  };
}

function buildConcentratedLoads(
  data: unknown
): ConcentratedLoadRow[] {
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => ({
    orderNumber: str(item.orderNumber),
    loadPSF: num(item.loadPSF ?? item.load),
    maxAllowedPSF: num(item.maxAllowedPSF ?? item.maxAllowed),
  }));
}

function buildSecurementRequirements(
  plan: Record<string, unknown> | null
): SecurementRow[] {
  if (!plan) return [];

  const plans = (plan.plans ?? plan.items ?? plan.securementPlans) as
    | Record<string, unknown>[]
    | undefined;
  if (!Array.isArray(plans)) return [];

  return plans.map((sp) => {
    const tieDowns = sp.tieDowns as Record<string, unknown>[] | undefined;

    return {
      orderNumber: str(sp.itemOrderNumber ?? sp.orderNumber),
      tieDownCount: Array.isArray(tieDowns) ? tieDowns.length : num(sp.tieDownCount),
      requiredWLL: num(sp.requiredWLL),
      tieDownTypes: extractTieDownTypes(tieDowns),
      anchorAssignments: extractAnchorAssignments(tieDowns),
      specialSecurement: extractSpecialSecurement(sp),
    };
  });
}

function buildLoadingSequence(
  sequence: Record<string, unknown>[] | null
): LoadingSequenceRow[] {
  if (!sequence) return [];

  return sequence.map((step, idx) => ({
    stepNumber: num(step.stepNumber, idx + 1),
    itemDescription: str(step.itemDescription),
    positionDescription: str(step.position ?? step.positionDescription),
    orientation: str(step.orientation),
    dunnage: str(step.dunnageFirst ?? step.dunnage ?? ''),
    securement: str(step.securementAfter ?? step.securement ?? ''),
  }));
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function str(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

function num(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function numFromDimensions(item: Record<string, unknown>, field: string): number {
  const dimensions = item.dimensions as Record<string, unknown> | undefined;
  if (dimensions) return num(dimensions[field]);
  return num(item[field]);
}

function extractItemsFromPlaced(
  placedFreight: Record<string, unknown>[] | null
): Record<string, unknown>[] | null {
  if (!placedFreight) return null;
  return placedFreight
    .map((pf) => (pf.item as Record<string, unknown>) ?? pf)
    .filter(Boolean);
}

function extractTieDownTypes(tieDowns: Record<string, unknown>[] | undefined): string {
  if (!Array.isArray(tieDowns) || tieDowns.length === 0) return '';
  const types = [...new Set(tieDowns.map((td) => str(td.type)))];
  return types.join(', ');
}

function extractAnchorAssignments(tieDowns: Record<string, unknown>[] | undefined): string {
  if (!Array.isArray(tieDowns) || tieDowns.length === 0) return '';
  const anchors = tieDowns
    .map((td) => str(td.anchorPointId))
    .filter((a) => a.length > 0);
  return anchors.join(', ');
}

function extractSpecialSecurement(sp: Record<string, unknown>): string {
  const additional = sp.additionalSecurement as string[] | undefined;
  const notes = sp.notes as string[] | undefined;
  const parts: string[] = [];
  if (Array.isArray(additional) && additional.length > 0) {
    parts.push(additional.join(', '));
  }
  if (Array.isArray(notes) && notes.length > 0) {
    parts.push(notes.join('; '));
  }
  return parts.join(' | ');
}
