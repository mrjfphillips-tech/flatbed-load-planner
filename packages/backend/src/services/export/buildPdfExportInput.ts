/**
 * Transforms raw plan version data (JSON from database) into the structured
 * PlanExportData format used by PdfExportService.
 *
 * Similar to buildExcelExportInput, this safely extracts and coerces fields
 * from loosely-typed JSON plan version data into the typed PDF export format.
 */

import type {
  PlanExportData,
  EquipmentSummary,
  FreightItem,
  PlacedFreightItem,
  WeightSummary,
  SecurementSummaryData,
  SecurementItemData,
  LoadingStepData,
  WarningData,
} from './PdfExportService.js';

interface RawPlanData {
  planId: string;
  version: number;
  status: string;
  equipment?: Record<string, unknown> | null;
  freightManifest?: Record<string, unknown>[] | null;
  placedFreight?: Record<string, unknown>[] | null;
  weightMetrics?: Record<string, unknown> | null;
  securementPlan?: Record<string, unknown> | null;
  loadingSequence?: Record<string, unknown>[] | null;
  warnings?: Record<string, unknown>[] | null;
}

/**
 * Build the structured PDF export input from raw plan data.
 */
export function buildPdfExportInput(data: RawPlanData): PlanExportData {
  return {
    planId: data.planId,
    version: data.version,
    status: data.status,
    equipment: buildEquipment(data.equipment),
    freightManifest: buildFreightManifest(data.freightManifest),
    placedFreight: buildPlacedFreight(data.placedFreight),
    weightMetrics: buildWeightMetrics(data.weightMetrics),
    securementPlan: buildSecurementPlan(data.securementPlan),
    loadingSequence: buildLoadingSequence(data.loadingSequence),
    warnings: buildWarnings(data.warnings),
  };
}

// ─── Builder Functions ───────────────────────────────────────────────────────

function buildEquipment(raw: Record<string, unknown> | null | undefined): EquipmentSummary {
  if (!raw) {
    return {
      tractorName: 'Unknown',
      trailerName: 'Unknown',
      trailerLengthFt: 0,
      maxGrossWeight: 0,
      availablePayload: 0,
    };
  }
  return {
    tractorName: str(raw.tractorName),
    trailerName: str(raw.trailerName),
    trailerLengthFt: num(raw.trailerLengthFt),
    maxGrossWeight: num(raw.maxGrossWeight),
    availablePayload: num(raw.availablePayload),
  };
}

function buildFreightManifest(
  raw: Record<string, unknown>[] | null | undefined
): FreightItem[] {
  if (!raw) return [];
  return raw.map((item) => ({
    orderNumber: str(item.orderNumber),
    customerName: str(item.customerName),
    deliveryStop: num(item.deliveryStop),
    productType: str(item.productType),
    quantity: num(item.quantity, 1),
    weight: num(item.totalLineWeight ?? item.weight ?? item.pieceWeight),
  }));
}

function buildPlacedFreight(
  raw: Record<string, unknown>[] | null | undefined
): PlacedFreightItem[] {
  if (!raw) return [];
  return raw.map((pf) => {
    const position = pf.position as Record<string, unknown> | undefined;
    const item = pf.item as Record<string, unknown> | undefined;
    return {
      orderNumber: str(item?.orderNumber ?? pf.orderNumber),
      productType: str(item?.productType ?? pf.productType),
      position: {
        x: num(position?.x ?? pf.x),
        y: num(position?.y ?? pf.y),
        z: num(position?.z ?? pf.z),
      },
      orientation: str(pf.orientation),
      layer: num(pf.layer),
      supportMethod: str(pf.supportMethod),
      weight: num(item?.totalLineWeight ?? item?.pieceWeight ?? pf.weight),
    };
  });
}

function buildWeightMetrics(raw: Record<string, unknown> | null | undefined): WeightSummary {
  if (!raw) {
    return {
      totalGross: 0,
      steerAxleWeight: 0,
      driveAxleWeight: 0,
      trailerAxleWeight: 0,
      cgLongitudinal: 0,
      cgLateral: 0,
      steerAxlePercent: 0,
      driveAxlePercent: 0,
      trailerAxlePercent: 0,
    };
  }

  const axleUtilization = raw.axleUtilization as Record<string, unknown> | undefined;

  return {
    totalGross: num(raw.totalGross ?? raw.totalGrossWeight),
    steerAxleWeight: num(raw.steerWeight ?? raw.steerAxleWeight),
    driveAxleWeight: num(raw.driveWeight ?? raw.driveAxleWeight),
    trailerAxleWeight: num(raw.trailerWeight ?? raw.trailerAxleWeight),
    cgLongitudinal: num(raw.cgLongitudinal),
    cgLateral: num(raw.cgLateral ?? raw.lateralCGOffset),
    steerAxlePercent: num(axleUtilization?.steer ?? raw.steerAxlePercent),
    driveAxlePercent: num(axleUtilization?.drive ?? raw.driveAxlePercent),
    trailerAxlePercent: num(axleUtilization?.trailer ?? raw.trailerAxlePercent),
  };
}

function buildSecurementPlan(
  raw: Record<string, unknown> | null | undefined
): SecurementSummaryData {
  if (!raw) {
    return { items: [], totalTieDowns: 0, totalWLL: 0 };
  }

  const plans = (raw.plans ?? raw.items ?? raw.securementPlans) as
    | Record<string, unknown>[]
    | undefined;

  const items: SecurementItemData[] = Array.isArray(plans)
    ? plans.map((sp) => {
        const tieDowns = sp.tieDowns as Record<string, unknown>[] | undefined;
        return {
          orderNumber: str(sp.itemOrderNumber ?? sp.orderNumber),
          tieDownCount: Array.isArray(tieDowns) ? tieDowns.length : num(sp.tieDownCount),
          requiredWLL: num(sp.requiredWLL),
          aggregateWLL: num(sp.aggregateWLL),
          tieDownTypes: extractTieDownTypes(tieDowns),
          anchorAssignments: extractAnchorAssignments(tieDowns),
          notes: extractNotes(sp),
        };
      })
    : [];

  const totalTieDowns = items.reduce((sum, i) => sum + i.tieDownCount, 0);
  const totalWLL = items.reduce((sum, i) => sum + i.aggregateWLL, 0);

  return { items, totalTieDowns, totalWLL };
}

function buildLoadingSequence(
  raw: Record<string, unknown>[] | null | undefined
): LoadingStepData[] {
  if (!raw) return [];
  return raw.map((step, idx) => ({
    stepNumber: num(step.stepNumber, idx + 1),
    itemDescription: str(step.itemDescription),
    positionDescription: str(step.position ?? step.positionDescription),
    orientation: str(step.orientation),
    dunnage: str(step.dunnageFirst ?? step.dunnage ?? ''),
    securement: str(step.securementAfter ?? step.securement ?? ''),
  }));
}

function buildWarnings(raw: Record<string, unknown>[] | null | undefined): WarningData[] {
  if (!raw) return [];
  return raw.map((w) => ({
    severity: normalizeSeverity(str(w.severity ?? w.ruleType)),
    message: str(w.message),
    affectedItems: Array.isArray(w.affectedItems)
      ? w.affectedItems.map(String)
      : [],
    suggestedAction: w.suggestedAction ? str(w.suggestedAction) : undefined,
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

function normalizeSeverity(raw: string): 'error' | 'warning' | 'info' {
  const lower = raw.toLowerCase();
  if (lower === 'error' || lower === 'hard_constraint') return 'error';
  if (lower === 'warning' || lower === 'soft_preference') return 'warning';
  return 'info';
}

function extractTieDownTypes(tieDowns: Record<string, unknown>[] | undefined): string {
  if (!Array.isArray(tieDowns) || tieDowns.length === 0) return '';
  const types = Array.from(new Set(tieDowns.map((td) => str(td.type))));
  return types.join(', ');
}

function extractAnchorAssignments(tieDowns: Record<string, unknown>[] | undefined): string {
  if (!Array.isArray(tieDowns) || tieDowns.length === 0) return '';
  const anchors = tieDowns
    .map((td) => str(td.anchorPointId))
    .filter((a) => a.length > 0);
  return anchors.join(', ');
}

function extractNotes(sp: Record<string, unknown>): string[] {
  const notes = sp.notes as string[] | undefined;
  if (Array.isArray(notes)) return notes;
  return [];
}
