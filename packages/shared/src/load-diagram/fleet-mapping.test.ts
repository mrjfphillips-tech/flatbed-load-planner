// ─── Tests for Fleet Column Mapping & Flexible Units ─────────────────────────
// Feature: load-diagram-generator (Customer Fleet)

import { describe, it, expect } from 'vitest';
import {
  autoMapFleetColumns,
  fleetLengthToCanonical,
  fleetWeightToCanonical,
  guessUnitsFromSamples,
} from './fleet-mapping';

describe('flexible unit conversion', () => {
  it('converts length units to canonical mm', () => {
    expect(fleetLengthToCanonical(1, 'mm')).toBe(1);
    expect(fleetLengthToCanonical(1, 'cm')).toBe(10);
    expect(fleetLengthToCanonical(6, 'm')).toBe(6000);
    expect(fleetLengthToCanonical(1, 'in')).toBeCloseTo(25.4, 6);
    expect(fleetLengthToCanonical(1, 'ft')).toBeCloseTo(304.8, 6);
  });

  it('converts weight units to canonical kg', () => {
    expect(fleetWeightToCanonical(1, 'kg')).toBe(1);
    expect(fleetWeightToCanonical(9, 't')).toBe(9000);
    expect(fleetWeightToCanonical(1, 'lb')).toBeCloseTo(0.45359237, 8);
  });
});

describe('autoMapFleetColumns', () => {
  it('maps the real Callao AA catalog headers', () => {
    const headers = [
      'vehicle id',
      'vehicle name',
      'vehicle account',
      'license plate',
      'weight',
      'Platform Length',
      'Platform Width',
      'Cond. Exped',
      'cost per stop',
      'fixed cost',
      'cost per hour',
      'cost per kilometer',
    ];
    const m = autoMapFleetColumns(headers);
    expect(m.vehicleId).toBe('vehicle id');
    expect(m.vehicleName).toBe('vehicle name');
    expect(m.vehicleAccount).toBe('vehicle account');
    expect(m.licensePlate).toBe('license plate');
    expect(m.maxWeight).toBe('weight');
    expect(m.platformLength).toBe('Platform Length');
    expect(m.platformWidth).toBe('Platform Width');
    expect(m.costPerStop).toBe('cost per stop');
    expect(m.fixedCost).toBe('fixed cost');
    expect(m.costPerHour).toBe('cost per hour');
    expect(m.costPerKm).toBe('cost per kilometer');
  });

  it('maps our own template headers', () => {
    const headers = [
      'Vehicle_ID',
      'Vehicle_Name',
      'License_Plate',
      'Max_Weight_kg',
      'Platform_Length_mm',
      'Platform_Width_mm',
    ];
    const m = autoMapFleetColumns(headers);
    expect(m.vehicleId).toBe('Vehicle_ID');
    expect(m.vehicleName).toBe('Vehicle_Name');
    expect(m.maxWeight).toBe('Max_Weight_kg');
    expect(m.platformLength).toBe('Platform_Length_mm');
    expect(m.platformWidth).toBe('Platform_Width_mm');
  });

  it('does not assign one column to two fields', () => {
    const m = autoMapFleetColumns(['name', 'weight', 'length', 'width']);
    const values = Object.values(m);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('guessUnitsFromSamples', () => {
  it('guesses meters/tonnes for the Callao-style values', () => {
    // Platform lengths ~6-9, weights ~6-16 (m / t).
    const g = guessUnitsFromSamples([6, 9.2, 6], [9, 16, 6]);
    expect(g.lengthUnit).toBe('m');
    expect(g.weightUnit).toBe('t');
    expect(g.lengthConfident).toBe(true);
    expect(g.weightConfident).toBe(true);
  });

  it('guesses mm/kg for large metric values', () => {
    const g = guessUnitsFromSamples([13600, 13600], [24000, 24000]);
    expect(g.lengthUnit).toBe('mm');
    expect(g.weightUnit).toBe('kg');
  });

  it('guesses inches/pounds for imperial-scale values', () => {
    const g = guessUnitsFromSamples([636, 576], [80000, 90000]);
    expect(g.lengthUnit).toBe('in');
    expect(g.weightUnit).toBe('lb');
  });

  it('handles empty/invalid samples without throwing', () => {
    const g = guessUnitsFromSamples([], []);
    expect(g.lengthUnit).toBeDefined();
    expect(g.weightUnit).toBeDefined();
  });
});
