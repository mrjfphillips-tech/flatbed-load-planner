// ─── Wizard Navigation Zustand Store ─────────────────────────────────────────
// Manages the four-step wizard flow: Equipment → Steel Orders → Rules → Generate.
// Orchestrates state across feature modules and handles pre-generation workflows.

import { create } from 'zustand';
import type {
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
  SteelOrderLineItem,
  Rule,
  PlanResult,
  RuleResult,
  LoadPattern,
  RuleSummary,
} from '@ptv-discovery-coach/shared';
import type { DrawingOptions } from '../drawing';
import type { ImportFieldError } from '../import';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Wizard step identifiers (1-indexed matching spec) */
export type WizardStep = 1 | 2 | 3 | 4;

/** Step metadata for navigation display */
export interface StepInfo {
  step: WizardStep;
  label: string;
  description: string;
}

/** Step completion criteria */
export interface StepValidation {
  step: WizardStep;
  isComplete: boolean;
  reason?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const WIZARD_STEPS: StepInfo[] = [
  { step: 1, label: 'Equipment', description: 'Configure tractor and trailer' },
  { step: 2, label: 'Load Items', description: 'Import or enter freight items' },
  { step: 3, label: 'Rules', description: 'Review and acknowledge rules' },
  { step: 4, label: 'Generate Load Plan', description: 'Generate and review the plan' },
];

// ─── State Interface ─────────────────────────────────────────────────────────

export interface LoadPlannerState {
  // Step 1: Equipment
  selectedTractor: TractorProfile | null;
  selectedTrailer: TrailerProfile | null;
  combination: EquipmentCombination | null;

  // Step 2: Orders
  orderItems: SteelOrderLineItem[];
  importErrors: ImportFieldError[];

  // Step 3: Rules
  activeRules: Rule[];
  ruleAcknowledgements: string[]; // acknowledged advisory rule IDs
  ruleSummary: RuleSummary | null;

  // Step 4: Plan
  currentPlan: PlanResult | null;
  planVersion: number;
  selectedItemId: string | null;
  drawingOptions: DrawingOptions;
  warnings: RuleResult[];

  // UI / Navigation
  currentStep: WizardStep;
  isGenerating: boolean;
  unsavedChanges: boolean;

  // Pattern override
  patternOverride: LoadPattern | null;
  detectedPattern: LoadPattern | null;

  // Actions — Navigation
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;

  // Actions — Equipment (Step 1)
  setEquipment: (tractor: TractorProfile, trailer: TrailerProfile, combination: EquipmentCombination) => void;
  clearEquipment: () => void;

  // Actions — Orders (Step 2)
  setOrderItems: (items: SteelOrderLineItem[]) => void;
  setImportErrors: (errors: ImportFieldError[]) => void;
  addOrderItem: (item: SteelOrderLineItem) => void;
  removeOrderItem: (orderNumber: string) => void;

  // Actions — Rules (Step 3)
  setActiveRules: (rules: Rule[]) => void;
  setRuleSummary: (summary: RuleSummary) => void;
  acknowledgeAdvisoryRule: (ruleId: string) => void;
  acknowledgeAllAdvisoryRules: () => void;
  resetAcknowledgements: () => void;

  // Actions — Pattern Override
  setPatternOverride: (pattern: LoadPattern | null) => void;
  setDetectedPattern: (pattern: LoadPattern | null) => void;

  // Actions — Plan (Step 4)
  setCurrentPlan: (plan: PlanResult) => void;
  setPlanVersion: (version: number) => void;
  setSelectedItemId: (id: string | null) => void;
  setDrawingOptions: (options: Partial<DrawingOptions>) => void;
  setWarnings: (warnings: RuleResult[]) => void;
  setIsGenerating: (generating: boolean) => void;

  // Actions — Unsaved changes
  markUnsavedChanges: () => void;
  clearUnsavedChanges: () => void;

  // Actions — Reset
  resetWizard: () => void;

  // Computed helpers
  canProceedFromStep: (step: WizardStep) => boolean;
  getStepValidation: (step: WizardStep) => StepValidation;
  areAdvisoryRulesAcknowledged: () => boolean;
}

// ─── Default Values ──────────────────────────────────────────────────────────

const DEFAULT_DRAWING_OPTIONS: DrawingOptions = {
  showSecurement: false,
  showDunnage: false,
  showWeightAnnotations: true,
  showDimensions: true,
  highlightedItemId: undefined,
  colorBy: 'stop',
  scale: 1,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWizardStore = create<LoadPlannerState>()((set, get) => ({
  // Step 1: Equipment
  selectedTractor: null,
  selectedTrailer: null,
  combination: null,

  // Step 2: Orders
  orderItems: [],
  importErrors: [],

  // Step 3: Rules
  activeRules: [],
  ruleAcknowledgements: [],
  ruleSummary: null,

  // Step 4: Plan
  currentPlan: null,
  planVersion: 1,
  selectedItemId: null,
  drawingOptions: DEFAULT_DRAWING_OPTIONS,
  warnings: [],

  // UI / Navigation
  currentStep: 1,
  isGenerating: false,
  unsavedChanges: false,

  // Pattern override
  patternOverride: null,
  detectedPattern: null,

  // ─── Navigation Actions ──────────────────────────────────────────────────

  goToStep: (step) => {
    if (step >= 1 && step <= 4) {
      set({ currentStep: step });
    }
  },

  nextStep: () => {
    const { currentStep } = get();
    if (currentStep < 4) {
      set({ currentStep: (currentStep + 1) as WizardStep });
    }
  },

  previousStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      set({ currentStep: (currentStep - 1) as WizardStep });
    }
  },

  // ─── Equipment Actions ───────────────────────────────────────────────────

  setEquipment: (tractor, trailer, combination) => {
    set({
      selectedTractor: tractor,
      selectedTrailer: trailer,
      combination,
      unsavedChanges: true,
    });
  },

  clearEquipment: () => {
    set({
      selectedTractor: null,
      selectedTrailer: null,
      combination: null,
      unsavedChanges: true,
    });
  },

  // ─── Order Actions ───────────────────────────────────────────────────────

  setOrderItems: (items) => {
    set({ orderItems: items, unsavedChanges: true });
  },

  setImportErrors: (errors) => {
    set({ importErrors: errors });
  },

  addOrderItem: (item) => {
    set((state) => ({
      orderItems: [...state.orderItems, item],
      unsavedChanges: true,
    }));
  },

  removeOrderItem: (orderNumber) => {
    set((state) => ({
      orderItems: state.orderItems.filter((i) => i.orderNumber !== orderNumber),
      unsavedChanges: true,
    }));
  },

  // ─── Rules Actions ───────────────────────────────────────────────────────

  setActiveRules: (rules) => {
    set({ activeRules: rules });
  },

  setRuleSummary: (summary) => {
    set({ ruleSummary: summary });
  },

  acknowledgeAdvisoryRule: (ruleId) => {
    set((state) => {
      if (state.ruleAcknowledgements.includes(ruleId)) {
        return state;
      }
      return { ruleAcknowledgements: [...state.ruleAcknowledgements, ruleId] };
    });
  },

  acknowledgeAllAdvisoryRules: () => {
    const { ruleSummary } = get();
    if (!ruleSummary) return;
    const advisoryIds = ruleSummary.advisoryRules.map((r) => r.id);
    set({ ruleAcknowledgements: advisoryIds });
  },

  resetAcknowledgements: () => {
    set({ ruleAcknowledgements: [] });
  },

  // ─── Pattern Override Actions ────────────────────────────────────────────

  setPatternOverride: (pattern) => {
    set({ patternOverride: pattern });
  },

  setDetectedPattern: (pattern) => {
    set({ detectedPattern: pattern });
  },

  // ─── Plan Actions ────────────────────────────────────────────────────────

  setCurrentPlan: (plan) => {
    set({ currentPlan: plan, unsavedChanges: true });
  },

  setPlanVersion: (version) => {
    set({ planVersion: version });
  },

  setSelectedItemId: (id) => {
    set({ selectedItemId: id });
  },

  setDrawingOptions: (options) => {
    set((state) => ({
      drawingOptions: { ...state.drawingOptions, ...options },
    }));
  },

  setWarnings: (warnings) => {
    set({ warnings });
  },

  setIsGenerating: (generating) => {
    set({ isGenerating: generating });
  },

  // ─── Unsaved Changes ────────────────────────────────────────────────────

  markUnsavedChanges: () => {
    set({ unsavedChanges: true });
  },

  clearUnsavedChanges: () => {
    set({ unsavedChanges: false });
  },

  // ─── Reset ──────────────────────────────────────────────────────────────

  resetWizard: () => {
    set({
      selectedTractor: null,
      selectedTrailer: null,
      combination: null,
      orderItems: [],
      importErrors: [],
      activeRules: [],
      ruleAcknowledgements: [],
      ruleSummary: null,
      currentPlan: null,
      planVersion: 1,
      selectedItemId: null,
      drawingOptions: DEFAULT_DRAWING_OPTIONS,
      warnings: [],
      currentStep: 1,
      isGenerating: false,
      unsavedChanges: false,
      patternOverride: null,
      detectedPattern: null,
    });
  },

  // ─── Computed Helpers ───────────────────────────────────────────────────

  canProceedFromStep: (step) => {
    const state = get();
    switch (step) {
      case 1:
        return state.combination !== null;
      case 2:
        return state.orderItems.length > 0 && state.importErrors.length === 0;
      case 3:
        return state.activeRules.length > 0 && state.areAdvisoryRulesAcknowledged();
      case 4:
        return state.currentPlan !== null;
      default:
        return false;
    }
  },

  getStepValidation: (step) => {
    const state = get();
    switch (step) {
      case 1:
        if (!state.combination) {
          return { step, isComplete: false, reason: 'Select a tractor-trailer combination' };
        }
        return { step, isComplete: true };
      case 2:
        if (state.orderItems.length === 0) {
          return { step, isComplete: false, reason: 'Import or enter at least one load item' };
        }
        if (state.importErrors.length > 0) {
          return { step, isComplete: false, reason: 'Fix import errors before proceeding' };
        }
        return { step, isComplete: true };
      case 3:
        if (state.activeRules.length === 0) {
          return { step, isComplete: false, reason: 'No active rules loaded' };
        }
        if (!state.areAdvisoryRulesAcknowledged()) {
          return { step, isComplete: false, reason: 'Acknowledge all advisory rules before generation' };
        }
        return { step, isComplete: true };
      case 4:
        if (!state.currentPlan) {
          return { step, isComplete: false, reason: 'Generate a load plan' };
        }
        return { step, isComplete: true };
      default:
        return { step: step as WizardStep, isComplete: false, reason: 'Invalid step' };
    }
  },

  areAdvisoryRulesAcknowledged: () => {
    const { ruleSummary, ruleAcknowledgements } = get();
    if (!ruleSummary) return true; // No summary means no advisory rules to acknowledge
    if (ruleSummary.advisoryRules.length === 0) return true;
    return ruleSummary.advisoryRules.every((r) => ruleAcknowledgements.includes(r.id));
  },
}));
