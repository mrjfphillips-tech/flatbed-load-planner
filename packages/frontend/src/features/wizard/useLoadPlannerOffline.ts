/**
 * useLoadPlannerOffline
 *
 * Integrates the wizard store with offline persistence and auto-sync.
 * When offline, automatically persists unsaved wizard state to IndexedDB.
 * When connectivity resumes, triggers synchronization of local changes.
 *
 * Validates: Requirements 20.3, 20.4, 20.5, 20.6
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import {
  useOfflinePersistence,
  useAutoSavePlan,
  type OfflineChangeRecord,
} from '../../hooks/useOfflinePersistence';
import { useAutoSync, type UseAutoSyncReturn } from '../../hooks/useAutoSync';
import { useWizardStore } from './wizard-store';

/** Key used for the current wizard session in IndexedDB */
const WIZARD_SESSION_KEY = 'current-wizard-session';

export interface UseLoadPlannerOfflineReturn {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Auto-sync hook state and controls */
  sync: UseAutoSyncReturn;
  /** Manually save current wizard state to IndexedDB */
  saveCurrentState: () => Promise<void>;
  /** Restore wizard state from IndexedDB (e.g., after page reload) */
  restoreState: () => Promise<boolean>;
  /** Clear all locally stored wizard state */
  clearLocalState: () => Promise<void>;
}

/**
 * Serializes the wizard store's plan-related state for offline persistence.
 */
function serializeWizardState() {
  const state = useWizardStore.getState();
  return {
    selectedTractor: state.selectedTractor,
    selectedTrailer: state.selectedTrailer,
    combination: state.combination,
    orderItems: state.orderItems,
    activeRules: state.activeRules,
    ruleAcknowledgements: state.ruleAcknowledgements,
    currentPlan: state.currentPlan,
    planVersion: state.planVersion,
    drawingOptions: state.drawingOptions,
    warnings: state.warnings,
    currentStep: state.currentStep,
    patternOverride: state.patternOverride,
    detectedPattern: state.detectedPattern,
  };
}

/**
 * Hook that wires the load planner wizard to offline persistence and auto-sync.
 * Automatically saves state when changes are detected and the user is offline,
 * and synchronizes when connectivity is restored.
 */
export function useLoadPlannerOffline(
  syncFn?: (record: OfflineChangeRecord) => Promise<boolean>
): UseLoadPlannerOfflineReturn {
  const { isOnline } = useNetworkStatus();
  const { saveLocally, loadLocal, clearLocal } = useOfflinePersistence();
  const hasRestoredRef = useRef(false);

  // Get wizard state for auto-save
  const unsavedChanges = useWizardStore((s) => s.unsavedChanges);

  // Auto-save plan state to IndexedDB when there are unsaved changes
  useAutoSavePlan(
    WIZARD_SESSION_KEY,
    serializeWizardState(),
    unsavedChanges,
    isOnline
  );

  // Auto-sync when connectivity resumes
  const sync = useAutoSync({
    enabled: true,
    syncFn,
    reconnectDelay: 2000,
  });

  // Update the app store's isOnline flag (for the Layout banner)
  useEffect(() => {
    // The useNetworkStatus hook already manages this via events;
    // we don't need to duplicate it here.
  }, [isOnline]);

  const saveCurrentState = useCallback(async (): Promise<void> => {
    const data = serializeWizardState();
    await saveLocally(WIZARD_SESSION_KEY, data);
  }, [saveLocally]);

  const restoreState = useCallback(async (): Promise<boolean> => {
    if (hasRestoredRef.current) return false;

    const record = await loadLocal(WIZARD_SESSION_KEY);
    if (!record || !record.data) return false;

    const data = record.data as ReturnType<typeof serializeWizardState>;
    const store = useWizardStore.getState();

    // Only restore if we have meaningful data
    if (data.orderItems?.length > 0 || data.combination) {
      if (data.selectedTractor && data.selectedTrailer && data.combination) {
        store.setEquipment(data.selectedTractor, data.selectedTrailer, data.combination);
      }
      if (data.orderItems?.length > 0) {
        store.setOrderItems(data.orderItems);
      }
      if (data.activeRules?.length > 0) {
        store.setActiveRules(data.activeRules);
      }
      if (data.currentPlan) {
        store.setCurrentPlan(data.currentPlan);
      }
      if (data.currentStep) {
        store.goToStep(data.currentStep);
      }
      if (data.patternOverride !== undefined) {
        store.setPatternOverride(data.patternOverride);
      }

      hasRestoredRef.current = true;
      return true;
    }

    return false;
  }, [loadLocal]);

  const clearLocalState = useCallback(async (): Promise<void> => {
    await clearLocal(WIZARD_SESSION_KEY);
  }, [clearLocal]);

  return {
    isOnline,
    sync,
    saveCurrentState,
    restoreState,
    clearLocalState,
  };
}
