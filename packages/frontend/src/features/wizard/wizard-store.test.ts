// ─── Wizard Store Tests ──────────────────────────────────────────────────────
// Unit tests for the Zustand wizard store: navigation, state management,
// rule acknowledgment, pattern override, and step validation.
// Validates: Requirements 4.6, 19.3, 20.5

import { describe, it, expect, beforeEach } from 'vitest';
import { useWizardStore, WIZARD_STEPS } from './wizard-store';
import type { WizardStep } from './wizard-store';
import type {
  TractorProfile,
  TrailerProfile,
  EquipmentCombination,
  SteelOrderLineItem,
  Rule,
  RuleSummary,
  PlanResult,
  RuleResult,
} from '@ptv-discovery-coach/shared';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const mockTractor: TractorProfile = {
  id: 'tractor-1',
  name: 'Test Tractor',
  steerAxleRating: 12000,
  driveAxleRating: 34000,
  fifthWheelPosition: 180,
  tareWeight: 17500,
  driveAxleCount: 2,
};

const mockTrailer: TrailerProfile = {
  id: 'trailer-1',
  name: 'Test 48ft Trailer',
  lengthFt: 48,
  deckWidthIn: 102,
  deckHeightIn: 60,
  maxGrossWeight: 80000,
  tareWeight: 12500,
  axleCount: 2,
  axlePositions: [360, 408],
  axleWeightRatings: [34000, 34000],
  kingpinPosition: 36,
  rearOverhangLimit: 48,
  deckMaterial: 'steel',
  stakePockets: [],
  anchorPoints: [],
  maxConcentratedLoadPSF: 600,
};

const mockCombination: EquipmentCombination = {
  tractorId: 'tractor-1',
  trailerId: 'trailer-1',
  availablePayload: 50000,
  totalLegalGross: 80000,
  perAxleLimits: { steer: 12000, drive: 34000, trailer: 68000 },
};

const mockOrderItem: SteelOrderLineItem = {
  orderNumber: 'ORD-001',
  customerName: 'Acme Steel',
  deliveryStop: 1,
  productType: 'coil_hot_rolled',
  quantity: 2,
  pieceWeight: 10000,
  dimensions: { length: 60, width: 48, height: 48 },
  totalLineWeight: 20000,
  handlingMethod: 'crane',
  stackPermission: 'no',
  maxStackHeight: 0,
  maxStackWeight: 0,
  orientationRequirement: 'longitudinal',
  dunnageRequired: true,
  specialNotes: '',
};

const mockRule: Rule = {
  id: 'hard_axle_overweight',
  name: 'Axle Overweight',
  description: 'No axle group exceeds its legal weight rating',
  type: 'hard_constraint',
  evaluate: () => ({
    passed: true,
    ruleId: 'hard_axle_overweight',
    ruleType: 'hard_constraint',
    severity: 'error',
    message: 'OK',
    affectedItems: [],
  }),
  isApplicable: () => true,
};

const mockAdvisoryRule: Rule = {
  id: 'advisory_note_1',
  name: 'Load Check Advisory',
  description: 'Consider checking load balance periodically',
  type: 'advisory',
  evaluate: () => ({
    passed: true,
    ruleId: 'advisory_note_1',
    ruleType: 'advisory',
    severity: 'info',
    message: 'Info',
    affectedItems: [],
  }),
  isApplicable: () => true,
};

const mockRuleSummary: RuleSummary = {
  hardConstraints: [{ id: 'hard_axle_overweight', name: 'Axle Overweight', description: 'No axle exceeds rating' }],
  softPreferences: [{ id: 'soft_heavier_lower', name: 'Heavier Lower', description: 'Heavier items on bottom' }],
  advisoryRules: [
    { id: 'advisory_note_1', name: 'Load Check Advisory', description: 'Consider checking balance' },
    { id: 'advisory_note_2', name: 'Weather Advisory', description: 'Check weather conditions' },
  ],
  totalCount: 4,
};

const mockPlanResult: PlanResult = {
  success: true,
  placedFreight: [],
  unplacedItems: [],
  weightMetrics: {
    totalGross: 0, steerWeight: 0, driveWeight: 0, trailerWeight: 0,
    cgLongitudinal: 0, cgLateral: 0, lateralImbalancePercent: 0,
    maxConcentratedLoadPSF: 0, axleUtilization: { steer: 0, drive: 0, trailer: 0 },
  },
  securement: { plans: [], anchorPointsUsed: 0, anchorPointsAvailable: 0, hasOverflow: false },
  loadingSequence: [],
  detectedPattern: 'layered',
  ruleResults: [],
  stackingEvaluation: { violations: [], dunnageInsertions: [], longProductSupports: [], edgeProtections: [], passed: true },
  canApprove: true,
  warnings: [],
};

// ─── Store Reset Helper ──────────────────────────────────────────────────────

function resetStore() {
  useWizardStore.getState().resetWizard();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Wizard Store', () => {
  beforeEach(() => {
    resetStore();
  });

  // ─── Initial State ───────────────────────────────────────────────────────

  describe('Initial state', () => {
    it('starts at step 1', () => {
      expect(useWizardStore.getState().currentStep).toBe(1);
    });

    it('has no equipment selected', () => {
      const state = useWizardStore.getState();
      expect(state.selectedTractor).toBeNull();
      expect(state.selectedTrailer).toBeNull();
      expect(state.combination).toBeNull();
    });

    it('has empty orders', () => {
      expect(useWizardStore.getState().orderItems).toHaveLength(0);
    });

    it('is not generating', () => {
      expect(useWizardStore.getState().isGenerating).toBe(false);
    });

    it('has no unsaved changes', () => {
      expect(useWizardStore.getState().unsavedChanges).toBe(false);
    });

    it('has no pattern override', () => {
      const state = useWizardStore.getState();
      expect(state.patternOverride).toBeNull();
      expect(state.detectedPattern).toBeNull();
    });
  });

  // ─── Step Navigation ─────────────────────────────────────────────────────

  describe('Step navigation', () => {
    it('goToStep navigates to valid step', () => {
      useWizardStore.getState().goToStep(3);
      expect(useWizardStore.getState().currentStep).toBe(3);
    });

    it('goToStep ignores invalid step values', () => {
      useWizardStore.getState().goToStep(0 as WizardStep);
      expect(useWizardStore.getState().currentStep).toBe(1);

      useWizardStore.getState().goToStep(5 as WizardStep);
      expect(useWizardStore.getState().currentStep).toBe(1);
    });

    it('nextStep increments from 1 to 2', () => {
      useWizardStore.getState().nextStep();
      expect(useWizardStore.getState().currentStep).toBe(2);
    });

    it('nextStep does not exceed step 4', () => {
      useWizardStore.getState().goToStep(4);
      useWizardStore.getState().nextStep();
      expect(useWizardStore.getState().currentStep).toBe(4);
    });

    it('previousStep decrements from 3 to 2', () => {
      useWizardStore.getState().goToStep(3);
      useWizardStore.getState().previousStep();
      expect(useWizardStore.getState().currentStep).toBe(2);
    });

    it('previousStep does not go below step 1', () => {
      useWizardStore.getState().previousStep();
      expect(useWizardStore.getState().currentStep).toBe(1);
    });

    it('navigates through all four steps sequentially', () => {
      const store = useWizardStore.getState();
      expect(store.currentStep).toBe(1);

      useWizardStore.getState().nextStep();
      expect(useWizardStore.getState().currentStep).toBe(2);

      useWizardStore.getState().nextStep();
      expect(useWizardStore.getState().currentStep).toBe(3);

      useWizardStore.getState().nextStep();
      expect(useWizardStore.getState().currentStep).toBe(4);
    });
  });

  // ─── Equipment Actions (Step 1) ──────────────────────────────────────────

  describe('Equipment actions', () => {
    it('setEquipment stores tractor, trailer, and combination', () => {
      useWizardStore.getState().setEquipment(mockTractor, mockTrailer, mockCombination);
      const state = useWizardStore.getState();
      expect(state.selectedTractor).toEqual(mockTractor);
      expect(state.selectedTrailer).toEqual(mockTrailer);
      expect(state.combination).toEqual(mockCombination);
    });

    it('setEquipment marks unsaved changes', () => {
      useWizardStore.getState().setEquipment(mockTractor, mockTrailer, mockCombination);
      expect(useWizardStore.getState().unsavedChanges).toBe(true);
    });

    it('clearEquipment resets equipment selection', () => {
      useWizardStore.getState().setEquipment(mockTractor, mockTrailer, mockCombination);
      useWizardStore.getState().clearEquipment();
      const state = useWizardStore.getState();
      expect(state.selectedTractor).toBeNull();
      expect(state.selectedTrailer).toBeNull();
      expect(state.combination).toBeNull();
    });
  });

  // ─── Order Actions (Step 2) ───────────────────────────────────────────────

  describe('Order actions', () => {
    it('setOrderItems sets all items at once', () => {
      useWizardStore.getState().setOrderItems([mockOrderItem]);
      expect(useWizardStore.getState().orderItems).toHaveLength(1);
      expect(useWizardStore.getState().orderItems[0].orderNumber).toBe('ORD-001');
    });

    it('addOrderItem appends to existing items', () => {
      useWizardStore.getState().setOrderItems([mockOrderItem]);
      const secondItem = { ...mockOrderItem, orderNumber: 'ORD-002' };
      useWizardStore.getState().addOrderItem(secondItem);
      expect(useWizardStore.getState().orderItems).toHaveLength(2);
    });

    it('removeOrderItem removes by order number', () => {
      useWizardStore.getState().setOrderItems([
        mockOrderItem,
        { ...mockOrderItem, orderNumber: 'ORD-002' },
      ]);
      useWizardStore.getState().removeOrderItem('ORD-001');
      const state = useWizardStore.getState();
      expect(state.orderItems).toHaveLength(1);
      expect(state.orderItems[0].orderNumber).toBe('ORD-002');
    });

    it('setImportErrors stores validation errors', () => {
      useWizardStore.getState().setImportErrors([
        { row: 1, field: 'pieceWeight', message: 'Invalid number', value: 'abc' },
      ]);
      expect(useWizardStore.getState().importErrors).toHaveLength(1);
    });

    it('order actions mark unsaved changes', () => {
      useWizardStore.getState().setOrderItems([mockOrderItem]);
      expect(useWizardStore.getState().unsavedChanges).toBe(true);
    });
  });

  // ─── Rules Actions (Step 3) ───────────────────────────────────────────────

  describe('Rules actions', () => {
    it('setActiveRules stores rules', () => {
      useWizardStore.getState().setActiveRules([mockRule, mockAdvisoryRule]);
      expect(useWizardStore.getState().activeRules).toHaveLength(2);
    });

    it('setRuleSummary stores summary', () => {
      useWizardStore.getState().setRuleSummary(mockRuleSummary);
      expect(useWizardStore.getState().ruleSummary).toEqual(mockRuleSummary);
    });

    it('acknowledgeAdvisoryRule adds rule ID to acknowledgements', () => {
      useWizardStore.getState().setRuleSummary(mockRuleSummary);
      useWizardStore.getState().acknowledgeAdvisoryRule('advisory_note_1');
      expect(useWizardStore.getState().ruleAcknowledgements).toContain('advisory_note_1');
    });

    it('acknowledgeAdvisoryRule does not duplicate IDs', () => {
      useWizardStore.getState().acknowledgeAdvisoryRule('advisory_note_1');
      useWizardStore.getState().acknowledgeAdvisoryRule('advisory_note_1');
      expect(useWizardStore.getState().ruleAcknowledgements).toHaveLength(1);
    });

    it('acknowledgeAllAdvisoryRules acknowledges all advisory rules from summary', () => {
      useWizardStore.getState().setRuleSummary(mockRuleSummary);
      useWizardStore.getState().acknowledgeAllAdvisoryRules();
      const acks = useWizardStore.getState().ruleAcknowledgements;
      expect(acks).toContain('advisory_note_1');
      expect(acks).toContain('advisory_note_2');
      expect(acks).toHaveLength(2);
    });

    it('resetAcknowledgements clears all acknowledgements', () => {
      useWizardStore.getState().acknowledgeAdvisoryRule('advisory_note_1');
      useWizardStore.getState().resetAcknowledgements();
      expect(useWizardStore.getState().ruleAcknowledgements).toHaveLength(0);
    });
  });

  // ─── Advisory Rule Acknowledgment Check ──────────────────────────────────

  describe('areAdvisoryRulesAcknowledged', () => {
    it('returns true when no rule summary is loaded', () => {
      expect(useWizardStore.getState().areAdvisoryRulesAcknowledged()).toBe(true);
    });

    it('returns true when summary has no advisory rules', () => {
      useWizardStore.getState().setRuleSummary({
        ...mockRuleSummary,
        advisoryRules: [],
      });
      expect(useWizardStore.getState().areAdvisoryRulesAcknowledged()).toBe(true);
    });

    it('returns false when advisory rules are not all acknowledged', () => {
      useWizardStore.getState().setRuleSummary(mockRuleSummary);
      useWizardStore.getState().acknowledgeAdvisoryRule('advisory_note_1');
      // advisory_note_2 is not acknowledged
      expect(useWizardStore.getState().areAdvisoryRulesAcknowledged()).toBe(false);
    });

    it('returns true when all advisory rules are acknowledged', () => {
      useWizardStore.getState().setRuleSummary(mockRuleSummary);
      useWizardStore.getState().acknowledgeAllAdvisoryRules();
      expect(useWizardStore.getState().areAdvisoryRulesAcknowledged()).toBe(true);
    });
  });

  // ─── Pattern Override (Requirement 19.3) ──────────────────────────────────

  describe('Pattern override', () => {
    it('setPatternOverride stores the override pattern', () => {
      useWizardStore.getState().setPatternOverride('layered');
      expect(useWizardStore.getState().patternOverride).toBe('layered');
    });

    it('setPatternOverride with null clears the override', () => {
      useWizardStore.getState().setPatternOverride('nested');
      useWizardStore.getState().setPatternOverride(null);
      expect(useWizardStore.getState().patternOverride).toBeNull();
    });

    it('setDetectedPattern stores the auto-detected pattern', () => {
      useWizardStore.getState().setDetectedPattern('long_product');
      expect(useWizardStore.getState().detectedPattern).toBe('long_product');
    });

    it('pattern override is independent of detected pattern', () => {
      useWizardStore.getState().setDetectedPattern('layered');
      useWizardStore.getState().setPatternOverride('column_building');
      const state = useWizardStore.getState();
      expect(state.detectedPattern).toBe('layered');
      expect(state.patternOverride).toBe('column_building');
    });
  });

  // ─── Plan Actions (Step 4) ────────────────────────────────────────────────

  describe('Plan actions', () => {
    it('setCurrentPlan stores the plan result', () => {
      useWizardStore.getState().setCurrentPlan(mockPlanResult);
      expect(useWizardStore.getState().currentPlan).toEqual(mockPlanResult);
    });

    it('setCurrentPlan marks unsaved changes', () => {
      useWizardStore.getState().setCurrentPlan(mockPlanResult);
      expect(useWizardStore.getState().unsavedChanges).toBe(true);
    });

    it('setIsGenerating updates generating state', () => {
      useWizardStore.getState().setIsGenerating(true);
      expect(useWizardStore.getState().isGenerating).toBe(true);
      useWizardStore.getState().setIsGenerating(false);
      expect(useWizardStore.getState().isGenerating).toBe(false);
    });

    it('setWarnings stores warning results', () => {
      const warnings: RuleResult[] = [{
        passed: false,
        ruleId: 'soft_heavier_lower',
        ruleType: 'soft_preference',
        severity: 'warning',
        message: 'Item ORD-001 is lighter than item below it',
        affectedItems: ['ORD-001'],
      }];
      useWizardStore.getState().setWarnings(warnings);
      expect(useWizardStore.getState().warnings).toHaveLength(1);
    });

    it('setSelectedItemId stores highlighted item', () => {
      useWizardStore.getState().setSelectedItemId('item-123');
      expect(useWizardStore.getState().selectedItemId).toBe('item-123');
    });

    it('setDrawingOptions merges partial options', () => {
      useWizardStore.getState().setDrawingOptions({ showSecurement: true, scale: 2 });
      const opts = useWizardStore.getState().drawingOptions;
      expect(opts.showSecurement).toBe(true);
      expect(opts.scale).toBe(2);
      // Other defaults remain
      expect(opts.showDunnage).toBe(false);
      expect(opts.colorBy).toBe('stop');
    });
  });

  // ─── Step Validation (canProceedFromStep) ─────────────────────────────────

  describe('canProceedFromStep', () => {
    it('step 1: cannot proceed without combination', () => {
      expect(useWizardStore.getState().canProceedFromStep(1)).toBe(false);
    });

    it('step 1: can proceed with combination', () => {
      useWizardStore.getState().setEquipment(mockTractor, mockTrailer, mockCombination);
      expect(useWizardStore.getState().canProceedFromStep(1)).toBe(true);
    });

    it('step 2: cannot proceed without order items', () => {
      expect(useWizardStore.getState().canProceedFromStep(2)).toBe(false);
    });

    it('step 2: cannot proceed with import errors', () => {
      useWizardStore.getState().setOrderItems([mockOrderItem]);
      useWizardStore.getState().setImportErrors([
        { row: 1, field: 'weight', message: 'Invalid', value: '' },
      ]);
      expect(useWizardStore.getState().canProceedFromStep(2)).toBe(false);
    });

    it('step 2: can proceed with items and no errors', () => {
      useWizardStore.getState().setOrderItems([mockOrderItem]);
      expect(useWizardStore.getState().canProceedFromStep(2)).toBe(true);
    });

    it('step 3: cannot proceed without active rules', () => {
      expect(useWizardStore.getState().canProceedFromStep(3)).toBe(false);
    });

    it('step 3: cannot proceed without advisory acknowledgment', () => {
      useWizardStore.getState().setActiveRules([mockRule, mockAdvisoryRule]);
      useWizardStore.getState().setRuleSummary(mockRuleSummary);
      // Advisory rules not acknowledged
      expect(useWizardStore.getState().canProceedFromStep(3)).toBe(false);
    });

    it('step 3: can proceed when all advisory rules acknowledged', () => {
      useWizardStore.getState().setActiveRules([mockRule, mockAdvisoryRule]);
      useWizardStore.getState().setRuleSummary(mockRuleSummary);
      useWizardStore.getState().acknowledgeAllAdvisoryRules();
      expect(useWizardStore.getState().canProceedFromStep(3)).toBe(true);
    });

    it('step 4: cannot proceed without a plan', () => {
      expect(useWizardStore.getState().canProceedFromStep(4)).toBe(false);
    });

    it('step 4: can proceed with a plan', () => {
      useWizardStore.getState().setCurrentPlan(mockPlanResult);
      expect(useWizardStore.getState().canProceedFromStep(4)).toBe(true);
    });
  });

  // ─── getStepValidation ────────────────────────────────────────────────────

  describe('getStepValidation', () => {
    it('step 1: returns reason when no combination selected', () => {
      const validation = useWizardStore.getState().getStepValidation(1);
      expect(validation.isComplete).toBe(false);
      expect(validation.reason).toContain('tractor-trailer combination');
    });

    it('step 1: returns isComplete true when equipment is set', () => {
      useWizardStore.getState().setEquipment(mockTractor, mockTrailer, mockCombination);
      const validation = useWizardStore.getState().getStepValidation(1);
      expect(validation.isComplete).toBe(true);
      expect(validation.reason).toBeUndefined();
    });

    it('step 2: returns reason when no items', () => {
      const validation = useWizardStore.getState().getStepValidation(2);
      expect(validation.isComplete).toBe(false);
      expect(validation.reason).toContain('Import or enter');
    });

    it('step 2: returns reason when errors exist', () => {
      useWizardStore.getState().setOrderItems([mockOrderItem]);
      useWizardStore.getState().setImportErrors([
        { row: 1, field: 'weight', message: 'Invalid', value: '' },
      ]);
      const validation = useWizardStore.getState().getStepValidation(2);
      expect(validation.isComplete).toBe(false);
      expect(validation.reason).toContain('import errors');
    });

    it('step 3: returns reason when advisory rules not acknowledged', () => {
      useWizardStore.getState().setActiveRules([mockRule]);
      useWizardStore.getState().setRuleSummary(mockRuleSummary);
      const validation = useWizardStore.getState().getStepValidation(3);
      expect(validation.isComplete).toBe(false);
      expect(validation.reason).toContain('advisory rules');
    });

    it('step 4: returns reason when no plan generated', () => {
      const validation = useWizardStore.getState().getStepValidation(4);
      expect(validation.isComplete).toBe(false);
      expect(validation.reason).toContain('Generate');
    });
  });

  // ─── Unsaved Changes ─────────────────────────────────────────────────────

  describe('Unsaved changes', () => {
    it('markUnsavedChanges sets flag', () => {
      useWizardStore.getState().markUnsavedChanges();
      expect(useWizardStore.getState().unsavedChanges).toBe(true);
    });

    it('clearUnsavedChanges clears flag', () => {
      useWizardStore.getState().markUnsavedChanges();
      useWizardStore.getState().clearUnsavedChanges();
      expect(useWizardStore.getState().unsavedChanges).toBe(false);
    });
  });

  // ─── Reset Wizard ─────────────────────────────────────────────────────────

  describe('resetWizard', () => {
    it('resets all state to initial values', () => {
      // Set up some state
      useWizardStore.getState().setEquipment(mockTractor, mockTrailer, mockCombination);
      useWizardStore.getState().setOrderItems([mockOrderItem]);
      useWizardStore.getState().setActiveRules([mockRule]);
      useWizardStore.getState().goToStep(3);
      useWizardStore.getState().setPatternOverride('nested');
      useWizardStore.getState().setIsGenerating(true);

      // Reset
      useWizardStore.getState().resetWizard();

      const state = useWizardStore.getState();
      expect(state.currentStep).toBe(1);
      expect(state.selectedTractor).toBeNull();
      expect(state.selectedTrailer).toBeNull();
      expect(state.combination).toBeNull();
      expect(state.orderItems).toHaveLength(0);
      expect(state.activeRules).toHaveLength(0);
      expect(state.ruleAcknowledgements).toHaveLength(0);
      expect(state.currentPlan).toBeNull();
      expect(state.isGenerating).toBe(false);
      expect(state.unsavedChanges).toBe(false);
      expect(state.patternOverride).toBeNull();
      expect(state.detectedPattern).toBeNull();
    });
  });

  // ─── WIZARD_STEPS constant ────────────────────────────────────────────────

  describe('WIZARD_STEPS constant', () => {
    it('defines exactly 4 steps', () => {
      expect(WIZARD_STEPS).toHaveLength(4);
    });

    it('step labels match the four-step workflow', () => {
      expect(WIZARD_STEPS[0].label).toBe('Equipment');
      expect(WIZARD_STEPS[1].label).toBe('Load Items');
      expect(WIZARD_STEPS[2].label).toBe('Rules');
      expect(WIZARD_STEPS[3].label).toBe('Generate Load Plan');
    });

    it('steps are numbered 1 through 4', () => {
      expect(WIZARD_STEPS.map((s) => s.step)).toEqual([1, 2, 3, 4]);
    });
  });
});
