// ─── Equipment Store Tests ───────────────────────────────────────────────────
// Unit tests for the Zustand equipment store: selection, validation, and combination calculation.

import { describe, it, expect, beforeEach } from 'vitest';
import { useEquipmentStore } from './equipment-store';
import { TRAILER_48FT, TRAILER_53FT, TRACTOR_STANDARD } from './templates';
import type { TrailerProfile, TractorProfile } from '@ptv-discovery-coach/shared';

function resetStore() {
  useEquipmentStore.setState({
    trailerProfiles: [TRAILER_48FT, TRAILER_53FT],
    selectedTrailer: null,
    trailerValidation: null,
    tractorProfiles: [TRACTOR_STANDARD],
    selectedTractor: null,
    tractorValidation: null,
    combination: null,
    payloadError: null,
  });
}

describe('Equipment Store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Initial state', () => {
    it('should pre-load 48ft and 53ft trailer templates', () => {
      const state = useEquipmentStore.getState();
      expect(state.trailerProfiles).toHaveLength(2);
      expect(state.trailerProfiles[0].lengthFt).toBe(48);
      expect(state.trailerProfiles[1].lengthFt).toBe(53);
    });

    it('should pre-load standard tractor template', () => {
      const state = useEquipmentStore.getState();
      expect(state.tractorProfiles).toHaveLength(1);
      expect(state.tractorProfiles[0].name).toBe('Standard Day Cab (Tandem)');
    });

    it('should have no selection initially', () => {
      const state = useEquipmentStore.getState();
      expect(state.selectedTrailer).toBeNull();
      expect(state.selectedTractor).toBeNull();
      expect(state.combination).toBeNull();
    });
  });

  describe('selectTrailer', () => {
    it('should set selected trailer and validate', () => {
      useEquipmentStore.getState().selectTrailer(TRAILER_48FT);
      const state = useEquipmentStore.getState();
      expect(state.selectedTrailer).toBe(TRAILER_48FT);
      expect(state.trailerValidation?.valid).toBe(true);
    });

    it('should not compute combination without tractor', () => {
      useEquipmentStore.getState().selectTrailer(TRAILER_48FT);
      const state = useEquipmentStore.getState();
      expect(state.combination).toBeNull();
    });
  });

  describe('selectTractor', () => {
    it('should set selected tractor and validate', () => {
      useEquipmentStore.getState().selectTractor(TRACTOR_STANDARD);
      const state = useEquipmentStore.getState();
      expect(state.selectedTractor).toBe(TRACTOR_STANDARD);
      expect(state.tractorValidation?.valid).toBe(true);
    });

    it('should not compute combination without trailer', () => {
      useEquipmentStore.getState().selectTractor(TRACTOR_STANDARD);
      const state = useEquipmentStore.getState();
      expect(state.combination).toBeNull();
    });
  });

  describe('Combination calculation', () => {
    it('should compute combination when both selected', () => {
      const store = useEquipmentStore.getState();
      store.selectTrailer(TRAILER_48FT);
      useEquipmentStore.getState().selectTractor(TRACTOR_STANDARD);
      const state = useEquipmentStore.getState();

      expect(state.combination).not.toBeNull();
      expect(state.payloadError).toBeNull();
      // Payload = min(80000, 12000+34000+68000) - 17500 - 12500 = 80000 - 30000 = 50000
      expect(state.combination!.availablePayload).toBe(50000);
      expect(state.combination!.totalLegalGross).toBe(80000);
    });

    it('should display per-axle limits', () => {
      useEquipmentStore.getState().selectTrailer(TRAILER_48FT);
      useEquipmentStore.getState().selectTractor(TRACTOR_STANDARD);
      const state = useEquipmentStore.getState();

      expect(state.combination!.perAxleLimits.steer).toBe(12000);
      expect(state.combination!.perAxleLimits.drive).toBe(34000);
      expect(state.combination!.perAxleLimits.trailer).toBe(68000);
    });

    it('should produce same result regardless of selection order', () => {
      // Select tractor first, then trailer
      useEquipmentStore.getState().selectTractor(TRACTOR_STANDARD);
      useEquipmentStore.getState().selectTrailer(TRAILER_48FT);
      const state1 = useEquipmentStore.getState();

      resetStore();

      // Select trailer first, then tractor
      useEquipmentStore.getState().selectTrailer(TRAILER_48FT);
      useEquipmentStore.getState().selectTractor(TRACTOR_STANDARD);
      const state2 = useEquipmentStore.getState();

      expect(state1.combination!.availablePayload).toBe(state2.combination!.availablePayload);
      expect(state1.combination!.totalLegalGross).toBe(state2.combination!.totalLegalGross);
    });

    it('should show error and block when payload < 0', () => {
      const heavyTractor: TractorProfile = {
        id: 'heavy-tractor',
        name: 'Very Heavy Tractor',
        steerAxleRating: 12000,
        driveAxleRating: 34000,
        fifthWheelPosition: 180,
        tareWeight: 70000, // extremely heavy — will make payload negative
        driveAxleCount: 2,
      };

      useEquipmentStore.getState().selectTrailer(TRAILER_48FT);
      useEquipmentStore.getState().selectTractor(heavyTractor);
      const state = useEquipmentStore.getState();

      expect(state.payloadError).not.toBeNull();
      expect(state.payloadError).toContain('Negative payload');
      expect(state.combination!.availablePayload).toBeLessThan(0);
    });
  });

  describe('addTrailerProfile', () => {
    it('should add a new trailer profile to the list', () => {
      const custom: TrailerProfile = {
        ...TRAILER_48FT,
        id: 'custom-trailer',
        name: 'Custom 48ft',
      };
      useEquipmentStore.getState().addTrailerProfile(custom);
      const state = useEquipmentStore.getState();
      expect(state.trailerProfiles).toHaveLength(3);
      expect(state.trailerProfiles[2].name).toBe('Custom 48ft');
    });
  });

  describe('addTractorProfile', () => {
    it('should add a new tractor profile to the list', () => {
      const custom: TractorProfile = {
        ...TRACTOR_STANDARD,
        id: 'custom-tractor',
        name: 'Custom Tractor',
      };
      useEquipmentStore.getState().addTractorProfile(custom);
      const state = useEquipmentStore.getState();
      expect(state.tractorProfiles).toHaveLength(2);
      expect(state.tractorProfiles[1].name).toBe('Custom Tractor');
    });
  });

  describe('clearSelection', () => {
    it('should reset all selection state', () => {
      useEquipmentStore.getState().selectTrailer(TRAILER_48FT);
      useEquipmentStore.getState().selectTractor(TRACTOR_STANDARD);
      useEquipmentStore.getState().clearSelection();
      const state = useEquipmentStore.getState();

      expect(state.selectedTrailer).toBeNull();
      expect(state.selectedTractor).toBeNull();
      expect(state.combination).toBeNull();
      expect(state.payloadError).toBeNull();
    });
  });
});
