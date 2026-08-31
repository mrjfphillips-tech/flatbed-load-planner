// ─── Equipment Configurator Zustand Store ────────────────────────────────────
// Manages tractor, trailer, and combination state for the equipment step.

import { create } from 'zustand';
import type {
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
  ValidationResult,
} from '@ptv-discovery-coach/shared';
import {
  calculateEquipmentCombination,
  isPayloadValid,
  validateTrailerProfile,
  validateTractorProfile,
} from '@ptv-discovery-coach/shared';
import { TRAILER_TEMPLATES, TRACTOR_TEMPLATES } from './templates';

// ─── State Interface ─────────────────────────────────────────────────────────

export interface EquipmentState {
  // Trailer state
  trailerProfiles: TrailerProfile[];
  selectedTrailer: TrailerProfile | null;
  trailerValidation: ValidationResult | null;

  // Tractor state
  tractorProfiles: TractorProfile[];
  selectedTractor: TractorProfile | null;
  tractorValidation: ValidationResult | null;

  // Combination
  combination: EquipmentCombination | null;
  payloadError: string | null;

  // Actions
  selectTrailer: (trailer: TrailerProfile) => void;
  selectTractor: (tractor: TractorProfile) => void;
  addTrailerProfile: (trailer: TrailerProfile) => void;
  addTractorProfile: (tractor: TractorProfile) => void;
  clearSelection: () => void;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function computeCombination(
  tractor: TractorProfile | null,
  trailer: TrailerProfile | null
): { combination: EquipmentCombination | null; payloadError: string | null } {
  if (!tractor || !trailer) {
    return { combination: null, payloadError: null };
  }

  const combination = calculateEquipmentCombination(tractor, trailer);

  if (!isPayloadValid(combination)) {
    return {
      combination,
      payloadError: `Negative payload (${combination.availablePayload.toLocaleString()} lbs). ` +
        `Tractor tare (${tractor.tareWeight.toLocaleString()} lbs) + ` +
        `trailer tare (${trailer.tareWeight.toLocaleString()} lbs) ` +
        `exceeds total legal gross (${combination.totalLegalGross.toLocaleString()} lbs). ` +
        `This combination cannot carry any freight.`,
    };
  }

  return { combination, payloadError: null };
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useEquipmentStore = create<EquipmentState>()((set, get) => ({
  // Initialize with templates
  trailerProfiles: [...TRAILER_TEMPLATES],
  selectedTrailer: null,
  trailerValidation: null,

  tractorProfiles: [...TRACTOR_TEMPLATES],
  selectedTractor: null,
  tractorValidation: null,

  combination: null,
  payloadError: null,

  selectTrailer: (trailer) => {
    const validation = validateTrailerProfile(trailer);
    const { selectedTractor } = get();
    const { combination, payloadError } = computeCombination(selectedTractor, trailer);

    set({
      selectedTrailer: trailer,
      trailerValidation: validation,
      combination,
      payloadError,
    });
  },

  selectTractor: (tractor) => {
    const validation = validateTractorProfile(tractor);
    const { selectedTrailer } = get();
    const { combination, payloadError } = computeCombination(tractor, selectedTrailer);

    set({
      selectedTractor: tractor,
      tractorValidation: validation,
      combination,
      payloadError,
    });
  },

  addTrailerProfile: (trailer) => {
    set((state) => ({
      trailerProfiles: [...state.trailerProfiles, trailer],
    }));
  },

  addTractorProfile: (tractor) => {
    set((state) => ({
      tractorProfiles: [...state.tractorProfiles, tractor],
    }));
  },

  clearSelection: () => {
    set({
      selectedTrailer: null,
      selectedTractor: null,
      trailerValidation: null,
      tractorValidation: null,
      combination: null,
      payloadError: null,
    });
  },
}));
