// ─── Load Diagram Zustand Store ──────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Holds wizard state for the load-diagram flow. Item dimensions/weights and the
// computed plan are kept in CANONICAL mm/kg; `displayUnitSystem` only controls
// how those canonical values are formatted for display. Changing the unit
// system re-displays existing values without mutating any canonical data.
// _Requirements: 6.1, 10.1, 10.4_

import { create } from 'zustand';
import type { loadDiagram } from '@ptv-discovery-coach/shared';
import type { CreatePlanResult } from './api';

type UnitSystem = loadDiagram.UnitSystem;
type LoadItem = loadDiagram.LoadItem;
type ValidationError = loadDiagram.ValidationError;
type TrailerProfile = loadDiagram.TrailerProfile;
type PlacedItem = loadDiagram.PlacedItem;

export type LoadDiagramStep = 1 | 2 | 3 | 4;

export interface LoadDiagramState {
  // Wizard navigation
  currentStep: LoadDiagramStep;

  // Unit system for display only (canonical data is always mm/kg)
  displayUnitSystem: UnitSystem;
  /** Unit system detected from the uploaded file (source of the data). */
  sourceUnitSystem: UnitSystem;

  // Upload results (canonical units)
  items: LoadItem[];
  validationErrors: ValidationError[];
  uploadSummary: loadDiagram.ExcelParseResult['summary'] | null;

  // Trailer selection
  trailerProfiles: TrailerProfile[];
  selectedTrailerId: string | null;

  // Fleet vehicle selection (alternative to a trailer profile)
  selectedFleetVehicleId: string | null;
  selectedFleetVehicleLabel: string | null;

  // Plan
  planId: string | null;
  planResult: CreatePlanResult | null;
  placedItems: PlacedItem[];
  overflowItems: LoadItem[];

  // Status
  isUploading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  setCurrentStep: (step: LoadDiagramStep) => void;
  setDisplayUnitSystem: (unit: UnitSystem) => void;
  setUploadResult: (result: loadDiagram.ExcelParseResult) => void;
  setTrailerProfiles: (profiles: TrailerProfile[]) => void;
  selectTrailer: (id: string) => void;
  selectFleetVehicle: (id: string | null, label: string | null) => void;
  setPlanResult: (result: CreatePlanResult) => void;
  setPlacedItems: (items: PlacedItem[]) => void;
  setIsUploading: (v: boolean) => void;
  setIsGenerating: (v: boolean) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1 as LoadDiagramStep,
  displayUnitSystem: 'metric' as UnitSystem,
  sourceUnitSystem: 'metric' as UnitSystem,
  items: [] as LoadItem[],
  validationErrors: [] as ValidationError[],
  uploadSummary: null,
  trailerProfiles: [] as TrailerProfile[],
  selectedTrailerId: null,
  selectedFleetVehicleId: null,
  selectedFleetVehicleLabel: null,
  planId: null,
  planResult: null,
  placedItems: [] as PlacedItem[],
  overflowItems: [] as LoadItem[],
  isUploading: false,
  isGenerating: false,
  error: null,
};

export const useLoadDiagramStore = create<LoadDiagramState>()((set) => ({
  ...initialState,

  setCurrentStep: (step) => set({ currentStep: step }),

  // Re-displays existing values in the new unit system. Canonical item/plan data
  // is untouched — only the display preference changes.
  setDisplayUnitSystem: (unit) => set({ displayUnitSystem: unit }),

  setUploadResult: (result) =>
    set({
      items: result.items,
      validationErrors: result.errors,
      uploadSummary: result.summary,
      sourceUnitSystem: result.detectedUnitSystem,
      // Default the display unit to the source unit on first upload.
      displayUnitSystem: result.detectedUnitSystem,
    }),

  setTrailerProfiles: (profiles) => set({ trailerProfiles: profiles }),

  selectTrailer: (id) => set({ selectedTrailerId: id }),

  selectFleetVehicle: (id, label) =>
    set({ selectedFleetVehicleId: id, selectedFleetVehicleLabel: label }),

  setPlanResult: (result) =>
    set({
      planId: result.planId,
      planResult: result,
      overflowItems: result.overflowItems,
    }),

  setPlacedItems: (items) => set({ placedItems: items }),

  setIsUploading: (v) => set({ isUploading: v }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setError: (message) => set({ error: message }),

  reset: () => set({ ...initialState }),
}));
