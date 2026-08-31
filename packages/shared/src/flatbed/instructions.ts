// ─── OptiFlow Flatbed Steel Load Planner — Loading & Unloading Instructions ─
// Pure functions that generate human-readable step-by-step loading and unloading
// instructions from a placed freight configuration and securement plan.
// Supports two formatting modes: warehouse-view (for loaders) and driver-view (for drivers).

import type {
  PlacedFreight,
  Orientation,
  TrailerProfile,
} from './types';
import type { SecurementAssignment, SecurementPlan, SecurementType } from './securement';

// ─── Instruction Types ───────────────────────────────────────────────────────

/** A single step in the loading sequence */
export interface LoadingStep {
  stepNumber: number;
  itemDescription: string;
  position: string; // plain language placement position
  orientation: string;
  dunnageFirst: string | null;
  securementAfter: string;
}

/** Items grouped for a single unloading stop */
export interface UnloadingInstruction {
  stopNumber: number;
  stopItems: { orderNumber: string; description: string }[];
  removalOrder: string[];
  securementRemovalSteps: string[];
}

/** Formatting mode for instruction output */
export type InstructionView = 'warehouse' | 'driver';

/** Complete formatted instruction set */
export interface FormattedInstructions {
  view: InstructionView;
  title: string;
  loadingSteps: string[];
  unloadingStops: string[];
}

// ─── Position Description Helpers ────────────────────────────────────────────

/**
 * Converts a numeric X position (inches from kingpin) to a plain-language
 * longitudinal description relative to the trailer.
 */
function describeLongitudinalPosition(
  xInches: number,
  trailerLengthIn: number
): string {
  const feetFromFront = Math.round(xInches / 12);
  const proportionFromFront = xInches / trailerLengthIn;

  if (proportionFromFront < 0.15) {
    return `at front of deck, ${feetFromFront} feet from headboard`;
  } else if (proportionFromFront < 0.4) {
    return `front-center of deck, ${feetFromFront} feet from headboard`;
  } else if (proportionFromFront < 0.6) {
    return `center of deck, ${feetFromFront} feet from headboard`;
  } else if (proportionFromFront < 0.85) {
    return `rear-center of deck, ${feetFromFront} feet from headboard`;
  } else {
    return `at rear of deck, ${feetFromFront} feet from headboard`;
  }
}

/**
 * Converts a numeric Y position (inches from centerline) to a plain-language
 * lateral description.
 */
function describeLateralPosition(yInches: number, deckWidthIn: number): string {
  const halfWidth = deckWidthIn / 2;
  const proportionFromCenter = Math.abs(yInches) / halfWidth;

  if (proportionFromCenter < 0.2) {
    return 'centered on deck';
  } else if (yInches < 0) {
    return proportionFromCenter > 0.7 ? 'left edge of deck' : 'left side of deck';
  } else {
    return proportionFromCenter > 0.7 ? 'right edge of deck' : 'right side of deck';
  }
}

/**
 * Generates a plain-language placement position string for a placed freight item.
 */
function describePlacementPosition(
  freight: PlacedFreight,
  trailer: TrailerProfile
): string {
  const trailerLengthIn = trailer.lengthFt * 12;
  const longitudinal = describeLongitudinalPosition(freight.position.x, trailerLengthIn);
  const lateral = describeLateralPosition(freight.position.y, trailer.deckWidthIn);

  if (freight.layer > 0) {
    return `Stack on layer ${freight.layer}, ${lateral}, ${longitudinal}`;
  }

  return `Place at ${lateral}, ${longitudinal}`;
}

/**
 * Describes the orientation in plain language.
 */
function describeOrientation(orientation: Orientation): string {
  return orientation === 'longitudinal'
    ? 'lengthwise (front to rear)'
    : 'crosswise (side to side)';
}

/**
 * Describes dunnage requirements for a loading step.
 * Returns null if no dunnage is needed.
 */
function describeDunnage(freight: PlacedFreight): string | null {
  if (freight.supportMethod === 'on_dunnage') {
    if (freight.layer === 0) {
      return 'Place dunnage (4x4 timber) on deck before setting item';
    } else {
      return 'Place dunnage between layers before stacking item';
    }
  }
  return null;
}

/**
 * Describes securement to apply after placement.
 */
function describeSecurement(
  _freight: PlacedFreight,
  securementPlan: SecurementPlan | undefined
): string {
  if (!securementPlan) {
    return 'Apply standard tie-downs per FMCSA requirements';
  }

  const parts: string[] = [];
  const tieDownCount = securementPlan.tieDowns.length;
  const primaryType = securementPlan.tieDowns[0]?.type ?? 'strap';
  const typeLabel = formatSecurementType(primaryType);

  parts.push(`Apply ${tieDownCount} ${typeLabel}${tieDownCount > 1 ? 's' : ''}`);

  if (securementPlan.additionalSecurement.length > 0) {
    const additionalLabels = securementPlan.additionalSecurement
      .map(formatSecurementType)
      .join(', ');
    parts.push(`also install ${additionalLabels}`);
  }

  if (securementPlan.notes.length > 0) {
    parts.push(securementPlan.notes[0]);
  }

  return parts.join('; ');
}

/**
 * Formats a SecurementType enum into a human-readable label.
 */
function formatSecurementType(type: SecurementType): string {
  switch (type) {
    case 'chain': return 'chain with binder';
    case 'strap': return 'ratchet strap';
    case 'binder': return 'binder';
    case 'edge_protector': return 'edge protector';
    case 'coil_rack': return 'coil rack';
    case 'chock': return 'chock';
    case 'blocking': return 'blocking';
  }
}

/**
 * Builds a human-readable item description from a placed freight item.
 */
function buildItemDescription(freight: PlacedFreight): string {
  const item = freight.item;
  const typeLabel = item.productType.replace(/_/g, ' ');
  const weightLbs = item.totalLineWeight;
  return `${item.orderNumber} — ${typeLabel} (${weightLbs} lbs)`;
}

// ─── Loading Sequence Generation ─────────────────────────────────────────────

/**
 * Generates a numbered loading sequence from placed freight.
 *
 * The loading sequence is derived from the placement order: items placed first
 * during planning should be loaded first (step 1). The sequence is determined by:
 * 1. Layer (lower layers first — they must be placed before upper layers)
 * 2. Position X descending (items at the rear of the trailer first — loaded from rear forward)
 * 3. Position Y ascending (left to right for determinism)
 *
 * @param placedFreight - Array of all placed freight items
 * @param trailer - The trailer profile for position descriptions
 * @param securement - The securement assignment for securement details
 * @returns Array of LoadingStep objects in loading order
 */
export function generateLoadingSequence(
  placedFreight: PlacedFreight[],
  trailer: TrailerProfile,
  securement: SecurementAssignment
): LoadingStep[] {
  if (placedFreight.length === 0) return [];

  // Build securement plan lookup by order number
  const securementByOrder = new Map<string, SecurementPlan>();
  for (const plan of securement.plans) {
    securementByOrder.set(plan.itemOrderNumber, plan);
  }

  // Sort items to determine loading order:
  // Layer ASC (deck level first), then X DESC (rear first), then Y ASC (left to right)
  const sorted = [...placedFreight].sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    if (b.position.x !== a.position.x) return b.position.x - a.position.x;
    return a.position.y - b.position.y;
  });

  return sorted.map((freight, index) => {
    const plan = securementByOrder.get(freight.item.orderNumber);

    return {
      stepNumber: index + 1,
      itemDescription: buildItemDescription(freight),
      position: describePlacementPosition(freight, trailer),
      orientation: describeOrientation(freight.orientation),
      dunnageFirst: describeDunnage(freight),
      securementAfter: describeSecurement(freight, plan),
    };
  });
}

// ─── Unloading Instructions Generation ───────────────────────────────────────

/**
 * Generates unloading instructions grouped by delivery stop.
 *
 * Items are grouped by their delivery stop number and listed in removal order
 * (reverse of loading order — top items removed first, then lower layers).
 * Securement removal steps are included before item removal.
 *
 * @param placedFreight - Array of all placed freight items
 * @param securement - The securement assignment for securement details
 * @returns Array of UnloadingInstruction objects, one per delivery stop
 */
export function generateUnloadingInstructions(
  placedFreight: PlacedFreight[],
  securement: SecurementAssignment
): UnloadingInstruction[] {
  if (placedFreight.length === 0) return [];

  // Build securement plan lookup
  const securementByOrder = new Map<string, SecurementPlan>();
  for (const plan of securement.plans) {
    securementByOrder.set(plan.itemOrderNumber, plan);
  }

  // Group items by delivery stop
  const stopMap = new Map<number, PlacedFreight[]>();
  for (const freight of placedFreight) {
    const stop = freight.item.deliveryStop;
    if (!stopMap.has(stop)) {
      stopMap.set(stop, []);
    }
    stopMap.get(stop)!.push(freight);
  }

  // Sort stops in delivery order (ascending stop number)
  const sortedStops = [...stopMap.keys()].sort((a, b) => a - b);

  return sortedStops.map((stopNumber) => {
    const stopFreight = stopMap.get(stopNumber)!;

    // Removal order: reverse of loading order (higher layers first, then front-to-rear)
    const removalSorted = [...stopFreight].sort((a, b) => {
      if (b.layer !== a.layer) return b.layer - a.layer;
      if (a.position.x !== b.position.x) return a.position.x - b.position.x;
      return b.position.y - a.position.y;
    });

    const stopItems = removalSorted.map((freight) => ({
      orderNumber: freight.item.orderNumber,
      description: buildItemDescription(freight),
    }));

    const removalOrder = removalSorted.map((freight) => {
      const typeLabel = freight.item.productType.replace(/_/g, ' ');
      return `Remove ${freight.item.orderNumber} (${typeLabel})`;
    });

    // Generate securement removal steps — these happen BEFORE item removal
    const securementRemovalSteps: string[] = [];
    for (const freight of removalSorted) {
      const plan = securementByOrder.get(freight.item.orderNumber);
      if (plan) {
        const tieDownCount = plan.tieDowns.length;
        const primaryType = plan.tieDowns[0]?.type ?? 'strap';
        const typeLabel = formatSecurementType(primaryType);

        securementRemovalSteps.push(
          `Remove ${tieDownCount} ${typeLabel}${tieDownCount > 1 ? 's' : ''} from ${freight.item.orderNumber} before lifting`
        );

        // If additional securement exists, add removal steps for those too
        if (plan.additionalSecurement.length > 0) {
          const additionalLabels = plan.additionalSecurement
            .map(formatSecurementType)
            .join(', ');
          securementRemovalSteps.push(
            `Remove ${additionalLabels} from ${freight.item.orderNumber}`
          );
        }
      }
    }

    return {
      stopNumber,
      stopItems,
      removalOrder,
      securementRemovalSteps,
    };
  });
}

// ─── Formatted Instruction Views ─────────────────────────────────────────────

/**
 * Formats loading steps for warehouse view (for loaders with crane/forklift context).
 * Includes full dunnage instructions, detailed securement steps, and position descriptions
 * with specific measurements.
 */
function formatLoadingStepWarehouse(step: LoadingStep): string {
  const lines: string[] = [];
  lines.push(`Step ${step.stepNumber}: ${step.itemDescription}`);
  if (step.dunnageFirst) {
    lines.push(`  ⬡ DUNNAGE: ${step.dunnageFirst}`);
  }
  lines.push(`  ▶ POSITION: ${step.position}`);
  lines.push(`  ↻ ORIENTATION: ${step.orientation}`);
  lines.push(`  🔗 SECURE: ${step.securementAfter}`);
  return lines.join('\n');
}

/**
 * Formats loading steps for driver view (for pre-trip verification).
 * Concise format focused on verifying the load matches the plan.
 */
function formatLoadingStepDriver(step: LoadingStep): string {
  const lines: string[] = [];
  lines.push(`${step.stepNumber}. ${step.itemDescription}`);
  lines.push(`   Position: ${step.position} | ${step.orientation}`);
  if (step.dunnageFirst) {
    lines.push(`   Dunnage: Yes`);
  }
  lines.push(`   Secured: ${step.securementAfter}`);
  return lines.join('\n');
}

/**
 * Formats unloading instructions for warehouse view (for loaders).
 * Includes detailed securement removal steps and removal order.
 */
function formatUnloadingStopWarehouse(instruction: UnloadingInstruction): string {
  const lines: string[] = [];
  lines.push(`═══ STOP ${instruction.stopNumber} ═══`);
  lines.push(`Items to unload (${instruction.stopItems.length}):`);
  for (const item of instruction.stopItems) {
    lines.push(`  • ${item.description}`);
  }
  if (instruction.securementRemovalSteps.length > 0) {
    lines.push('');
    lines.push('Securement removal:');
    instruction.securementRemovalSteps.forEach((step, i) => {
      lines.push(`  ${i + 1}. ${step}`);
    });
  }
  lines.push('');
  lines.push('Removal order:');
  instruction.removalOrder.forEach((step, i) => {
    lines.push(`  ${i + 1}. ${step}`);
  });
  return lines.join('\n');
}

/**
 * Formats unloading instructions for driver view (for pre-trip and delivery awareness).
 * More concise, focused on what to expect at each stop.
 */
function formatUnloadingStopDriver(instruction: UnloadingInstruction): string {
  const lines: string[] = [];
  lines.push(`--- Stop ${instruction.stopNumber} ---`);
  lines.push(`Deliver ${instruction.stopItems.length} item(s):`);
  for (const item of instruction.stopItems) {
    lines.push(`  - ${item.orderNumber}: ${item.description}`);
  }
  if (instruction.securementRemovalSteps.length > 0) {
    lines.push(`  Note: Remove securement before unloading`);
  }
  return lines.join('\n');
}

// ─── Main Formatting Entry Points ────────────────────────────────────────────

/**
 * Generates fully formatted instructions for a given view mode.
 *
 * @param loadingSteps - The loading steps to format
 * @param unloadingInstructions - The unloading instructions to format
 * @param view - The view mode ('warehouse' or 'driver')
 * @returns FormattedInstructions with all sections rendered as strings
 */
export function formatInstructions(
  loadingSteps: LoadingStep[],
  unloadingInstructions: UnloadingInstruction[],
  view: InstructionView
): FormattedInstructions {
  const isWarehouse = view === 'warehouse';

  const title = isWarehouse
    ? 'LOADING INSTRUCTIONS — WAREHOUSE COPY'
    : 'LOAD PLAN SUMMARY — DRIVER COPY';

  const formattedLoadingSteps = loadingSteps.map((step) =>
    isWarehouse ? formatLoadingStepWarehouse(step) : formatLoadingStepDriver(step)
  );

  const formattedUnloadingStops = unloadingInstructions.map((instruction) =>
    isWarehouse ? formatUnloadingStopWarehouse(instruction) : formatUnloadingStopDriver(instruction)
  );

  return {
    view,
    title,
    loadingSteps: formattedLoadingSteps,
    unloadingStops: formattedUnloadingStops,
  };
}
