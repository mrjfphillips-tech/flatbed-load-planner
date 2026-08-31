// ─── Fleet Planner Zustand Store ─────────────────────────────────────────────
// Manages the fleet planning wizard flow: Fleet File → Orders → Rules → Generate.
// Separate from the existing per-vehicle wizard store (wizard-store.ts).

import { create } from 'zustand';
import type { SteelOrderLineItem, Rule } from '@ptv-discovery-coach/shared';
import type { FieldMapping } from '../import';
import type {
  VehicleRecord,
  FleetFileValidationError,
  UnmatchedOrder,
  FleetPlanResult,
  FleetWizardStep,
  ExtractionRule,
} from './types';

// ─── State Interface ─────────────────────────────────────────────────────────

export interface FleetPlannerState {
  // Mode
  mode: 'fleet' | 'single';

  // Step 1: Fleet File
  vehicleRecords: VehicleRecord[];
  fleetFileErrors: FleetFileValidationError[];
  fleetFieldMappings: FieldMapping[];

  // Step 2: Orders (grouped by delivery number)
  ordersByDeliveryNumber: Map<string, SteelOrderLineItem[]>;
  unmatchedOrders: UnmatchedOrder[];
  deliveryNumberMatchStrategy: 'exact' | 'pattern' | 'custom';
  customExtractionRule: ExtractionRule | undefined;

  // Step 3: Rules (shared with existing rule system)
  activeRules: Rule[];

  // Step 4: Results
  fleetPlanResult: FleetPlanResult | null;
  selectedVehicleId: string | null;
  isGenerating: boolean;
  generationProgress: { completed: number; total: number };

  // Navigation
  currentStep: FleetWizardStep;

  // Actions
  setMode: (mode: 'fleet' | 'single') => void;
  setVehicleRecords: (records: VehicleRecord[]) => void;
  setFleetFileErrors: (errors: FleetFileValidationError[]) => void;
  setFleetFieldMappings: (mappings: FieldMapping[]) => void;
  setOrdersByDeliveryNumber: (orders: Map<string, SteelOrderLineItem[]>) => void;
  setUnmatchedOrders: (orders: UnmatchedOrder[]) => void;
  setDeliveryNumberMatchStrategy: (strategy: 'exact' | 'pattern' | 'custom') => void;
  setCustomExtractionRule: (rule: ExtractionRule) => void;
  setActiveRules: (rules: Rule[]) => void;
  setIsGenerating: (generating: boolean) => void;
  setGenerationProgress: (progress: { completed: number; total: number }) => void;
  setFleetPlanResult: (result: FleetPlanResult) => void;
  selectVehicle: (vehicleId: string) => void;
  goToStep: (step: FleetWizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetFleetWizard: () => void;
  canProceedFromStep: (step: FleetWizardStep) => boolean;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useFleetStore = create<FleetPlannerState>()((set, get) => ({
  // Mode
  mode: 'single',

  // Step 1: Fleet File
  vehicleRecords: [],
  fleetFileErrors: [],
  fleetFieldMappings: [],

  // Step 2: Orders
  ordersByDeliveryNumber: new Map(),
  unmatchedOrders: [],
  deliveryNumberMatchStrategy: 'exact',
  customExtractionRule: undefined,

  // Step 3: Rules
  activeRules: [],

  // Step 4: Results
  fleetPlanResult: null,
  selectedVehicleId: null,
  isGenerating: false,
  generationProgress: { completed: 0, total: 0 },

  // Navigation
  currentStep: 1,

  // ─── Actions ─────────────────────────────────────────────────────────────

  setMode: (mode) => {
    set({ mode });
  },

  setVehicleRecords: (records) => {
    set({ vehicleRecords: records });
  },

  setFleetFileErrors: (errors) => {
    set({ fleetFileErrors: errors });
  },

  setFleetFieldMappings: (mappings) => {
    set({ fleetFieldMappings: mappings });
  },

  setOrdersByDeliveryNumber: (orders) => {
    set({ ordersByDeliveryNumber: orders });
  },

  setUnmatchedOrders: (orders) => {
    set({ unmatchedOrders: orders });
  },

  setDeliveryNumberMatchStrategy: (strategy) => {
    set({ deliveryNumberMatchStrategy: strategy });
  },

  setCustomExtractionRule: (rule) => {
    set({ customExtractionRule: rule });
  },

  setActiveRules: (rules) => {
    set({ activeRules: rules });
  },

  setIsGenerating: (generating) => {
    set({ isGenerating: generating });
  },

  setGenerationProgress: (progress) => {
    set({ generationProgress: progress });
  },

  setFleetPlanResult: (result) => {
    set({ fleetPlanResult: result, isGenerating: false });
  },

  selectVehicle: (vehicleId) => {
    set({ selectedVehicleId: vehicleId });
  },

  // ─── Navigation Actions ──────────────────────────────────────────────────

  goToStep: (step) => {
    if (step >= 1 && step <= 4) {
      set({ currentStep: step });
    }
  },

  nextStep: () => {
    const { currentStep } = get();
    if (currentStep < 4) {
      set({ currentStep: (currentStep + 1) as FleetWizardStep });
    }
  },

  previousStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      set({ currentStep: (currentStep - 1) as FleetWizardStep });
    }
  },

  // ─── Reset ──────────────────────────────────────────────────────────────

  resetFleetWizard: () => {
    set({
      vehicleRecords: [],
      fleetFileErrors: [],
      fleetFieldMappings: [],
      ordersByDeliveryNumber: new Map(),
      unmatchedOrders: [],
      deliveryNumberMatchStrategy: 'exact',
      customExtractionRule: undefined,
      activeRules: [],
      fleetPlanResult: null,
      selectedVehicleId: null,
      isGenerating: false,
      generationProgress: { completed: 0, total: 0 },
      currentStep: 1,
    });
  },

  // ─── Computed Helpers ───────────────────────────────────────────────────

  canProceedFromStep: (step) => {
    const state = get();
    switch (step) {
      case 1:
        // Must have at least one valid vehicle record
        return state.vehicleRecords.length > 0;
      case 2:
        // Must have orders grouped by delivery number
        return state.ordersByDeliveryNumber.size > 0;
      case 3:
        // Must have active rules loaded
        return state.activeRules.length > 0;
      case 4:
        // Plan result generated
        return state.fleetPlanResult !== null;
      default:
        return false;
    }
  },
}));
