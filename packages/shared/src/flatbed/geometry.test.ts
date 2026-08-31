import { describe, it, expect } from 'vitest';
import {
  assignGeometricType,
  calculateContactFootprint,
  calculateDeckPressure,
  calculateCradleAngle,
  calculateChockDimensions,
} from './geometry';
import type { FreightGeometry, GeometricType, SteelProductType } from './types';

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeGeometry(
  type: GeometricType,
  length: number,
  width: number,
  height: number
): FreightGeometry {
  return {
    type,
    boundingBox: { length, width, height },
    contactFootprint: { area: 0, shape: 'rectangle' },
    centerOfMass: { x: length / 2, y: width / 2, z: height / 2 },
  };
}

// ─── assignGeometricType Tests ───────────────────────────────────────────────

describe('assignGeometricType', () => {
  it('maps coil types to horizontal_coil', () => {
    expect(assignGeometricType('coil_hot_rolled')).toBe('horizontal_coil');
    expect(assignGeometricType('coil_cold_rolled')).toBe('horizontal_coil');
    expect(assignGeometricType('coil_galvanized')).toBe('horizontal_coil');
    expect(assignGeometricType('wire_rod_coil')).toBe('horizontal_coil');
  });

  it('maps structural shapes to long_rectangular_bundle', () => {
    expect(assignGeometricType('beam_i')).toBe('long_rectangular_bundle');
    expect(assignGeometricType('beam_h')).toBe('long_rectangular_bundle');
    expect(assignGeometricType('beam_wide_flange')).toBe('long_rectangular_bundle');
    expect(assignGeometricType('channel')).toBe('long_rectangular_bundle');
    expect(assignGeometricType('angle')).toBe('long_rectangular_bundle');
  });

  it('maps bar stock to long_rectangular_bundle', () => {
    expect(assignGeometricType('flat_bar')).toBe('long_rectangular_bundle');
    expect(assignGeometricType('round_bar')).toBe('long_rectangular_bundle');
  });

  it('maps sheet bundles to long_rectangular_bundle', () => {
    expect(assignGeometricType('sheet_bundle')).toBe('long_rectangular_bundle');
    expect(assignGeometricType('roofing_sheet_bundle')).toBe('long_rectangular_bundle');
  });

  it('maps pipe/tube/HSS to cylindrical_bundle', () => {
    expect(assignGeometricType('pipe')).toBe('cylindrical_bundle');
    expect(assignGeometricType('tube')).toBe('cylindrical_bundle');
    expect(assignGeometricType('hollow_structural_section')).toBe('cylindrical_bundle');
  });

  it('maps rebar_bundle to cylindrical_bundle', () => {
    expect(assignGeometricType('rebar_bundle')).toBe('cylindrical_bundle');
  });

  it('maps plate to plate_stack', () => {
    expect(assignGeometricType('plate')).toBe('plate_stack');
  });

  it('maps wire_mesh_panel to rectangular', () => {
    expect(assignGeometricType('wire_mesh_panel')).toBe('rectangular');
  });

  it('maps palletized to rectangular', () => {
    expect(assignGeometricType('palletized')).toBe('rectangular');
  });

  it('maps fabricated_assembly to irregular', () => {
    expect(assignGeometricType('fabricated_assembly')).toBe('irregular');
  });

  it('maps mixed_bundle to irregular', () => {
    expect(assignGeometricType('mixed_bundle')).toBe('irregular');
  });

  it('is deterministic — same input always gives same output', () => {
    const types: SteelProductType[] = [
      'coil_hot_rolled', 'coil_cold_rolled', 'coil_galvanized',
      'sheet_bundle', 'plate', 'rebar_bundle', 'wire_rod_coil',
      'beam_i', 'beam_h', 'beam_wide_flange', 'channel', 'angle',
      'flat_bar', 'round_bar', 'pipe', 'tube', 'hollow_structural_section',
      'roofing_sheet_bundle', 'wire_mesh_panel', 'fabricated_assembly',
      'palletized', 'mixed_bundle',
    ];

    for (const t of types) {
      expect(assignGeometricType(t)).toBe(assignGeometricType(t));
    }
  });

  it('covers all 22 product types', () => {
    const allTypes: SteelProductType[] = [
      'coil_hot_rolled', 'coil_cold_rolled', 'coil_galvanized',
      'sheet_bundle', 'plate', 'rebar_bundle', 'wire_rod_coil',
      'beam_i', 'beam_h', 'beam_wide_flange', 'channel', 'angle',
      'flat_bar', 'round_bar', 'pipe', 'tube', 'hollow_structural_section',
      'roofing_sheet_bundle', 'wire_mesh_panel', 'fabricated_assembly',
      'palletized', 'mixed_bundle',
    ];

    for (const t of allTypes) {
      const result = assignGeometricType(t);
      expect(result).toBeTruthy();
      expect([
        'rectangular', 'long_rectangular_bundle', 'cylindrical_bundle',
        'horizontal_coil', 'vertical_coil', 'plate_stack', 'irregular',
      ]).toContain(result);
    }
  });
});

// ─── calculateContactFootprint Tests ─────────────────────────────────────────

describe('calculateContactFootprint', () => {
  it('returns full bottom face for rectangular items', () => {
    const geom = makeGeometry('rectangular', 120, 48, 24);
    const footprint = calculateContactFootprint(geom);
    expect(footprint).toBe(120 * 48); // 5760 sq in
  });

  it('returns full bottom face for plate_stack items', () => {
    const geom = makeGeometry('plate_stack', 240, 96, 12);
    const footprint = calculateContactFootprint(geom);
    expect(footprint).toBe(240 * 96); // 23040 sq in
  });

  it('returns full bottom face for long_rectangular_bundle items', () => {
    const geom = makeGeometry('long_rectangular_bundle', 480, 12, 12);
    const footprint = calculateContactFootprint(geom);
    expect(footprint).toBe(480 * 12); // 5760 sq in
  });

  it('returns full bounding box footprint for irregular items', () => {
    const geom = makeGeometry('irregular', 100, 60, 40);
    const footprint = calculateContactFootprint(geom);
    expect(footprint).toBe(100 * 60); // 6000 sq in
  });

  it('returns line contact approximation for cylindrical_bundle items', () => {
    const geom = makeGeometry('cylindrical_bundle', 240, 30, 30);
    const footprint = calculateContactFootprint(geom);
    // length × 10% of width = 240 × 3 = 720 sq in
    expect(footprint).toBe(240 * 30 * 0.1);
  });

  it('returns cradle contact for horizontal_coil items', () => {
    const geom = makeGeometry('horizontal_coil', 48, 60, 60);
    const footprint = calculateContactFootprint(geom);
    // length × 10% of width = 48 × 6 = 288 sq in
    expect(footprint).toBe(48 * 60 * 0.1);
  });

  it('returns circular footprint for vertical_coil items', () => {
    const geom = makeGeometry('vertical_coil', 48, 60, 60);
    const footprint = calculateContactFootprint(geom);
    // π × (60/2)² = π × 900 ≈ 2827.43
    const expected = Math.PI * 30 * 30;
    expect(footprint).toBeCloseTo(expected, 2);
  });

  it('produces positive values for all geometry types with positive dimensions', () => {
    const types: GeometricType[] = [
      'rectangular', 'long_rectangular_bundle', 'cylindrical_bundle',
      'horizontal_coil', 'vertical_coil', 'plate_stack', 'irregular',
    ];

    for (const type of types) {
      const geom = makeGeometry(type, 100, 50, 30);
      const footprint = calculateContactFootprint(geom);
      expect(footprint).toBeGreaterThan(0);
      expect(Number.isFinite(footprint)).toBe(true);
    }
  });
});

// ─── calculateDeckPressure Tests ─────────────────────────────────────────────

describe('calculateDeckPressure', () => {
  it('calculates PSF correctly for a known case', () => {
    // 10000 lbs over 1440 sq in = 1440/144 = 10 sq ft → 10000/10 = 1000 PSF
    const psf = calculateDeckPressure(10000, 1440);
    expect(psf).toBe(1000);
  });

  it('converts square inches to square feet correctly', () => {
    // 144 sq in = 1 sq ft → 5000 lbs / 1 sq ft = 5000 PSF
    const psf = calculateDeckPressure(5000, 144);
    expect(psf).toBe(5000);
  });

  it('returns Infinity for zero footprint', () => {
    const psf = calculateDeckPressure(5000, 0);
    expect(psf).toBe(Infinity);
  });

  it('returns Infinity for negative footprint', () => {
    const psf = calculateDeckPressure(5000, -100);
    expect(psf).toBe(Infinity);
  });

  it('returns 0 for zero weight', () => {
    const psf = calculateDeckPressure(0, 1000);
    expect(psf).toBe(0);
  });

  it('scales linearly with weight', () => {
    const psf1 = calculateDeckPressure(5000, 720);
    const psf2 = calculateDeckPressure(10000, 720);
    expect(psf2).toBeCloseTo(psf1 * 2);
  });

  it('scales inversely with footprint area', () => {
    const psf1 = calculateDeckPressure(5000, 720);
    const psf2 = calculateDeckPressure(5000, 1440);
    expect(psf2).toBeCloseTo(psf1 / 2);
  });
});

// ─── calculateCradleAngle Tests ──────────────────────────────────────────────

describe('calculateCradleAngle', () => {
  it('calculates correct angle for a known case', () => {
    // diameter=60, cradleWidth=30 → arcsin(0.5) = 30°
    const angle = calculateCradleAngle(60, 30);
    expect(angle).toBeCloseTo(30, 5);
  });

  it('returns 45° when cradleWidth = diameter × sin(45°)', () => {
    const diameter = 48;
    const cradleWidth = diameter * Math.sin(Math.PI / 4); // ≈ 33.94
    const angle = calculateCradleAngle(diameter, cradleWidth);
    expect(angle).toBeCloseTo(45, 5);
  });

  it('produces angle between 0 and 90 for valid inputs', () => {
    const angle = calculateCradleAngle(60, 20);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(90);
  });

  it('approaches 90° as cradleWidth approaches diameter', () => {
    const angle = calculateCradleAngle(60, 59.99);
    expect(angle).toBeGreaterThan(85);
    expect(angle).toBeLessThan(90);
  });

  it('produces small angles for narrow cradles', () => {
    const angle = calculateCradleAngle(60, 1);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(5);
  });

  it('returns NaN when cradleWidth >= diameter', () => {
    expect(Number.isNaN(calculateCradleAngle(60, 60))).toBe(true);
    expect(Number.isNaN(calculateCradleAngle(60, 70))).toBe(true);
  });

  it('returns NaN for zero diameter', () => {
    expect(Number.isNaN(calculateCradleAngle(0, 30))).toBe(true);
  });

  it('returns NaN for negative inputs', () => {
    expect(Number.isNaN(calculateCradleAngle(-10, 5))).toBe(true);
    expect(Number.isNaN(calculateCradleAngle(60, -10))).toBe(true);
  });
});

// ─── calculateChockDimensions Tests ──────────────────────────────────────────

describe('calculateChockDimensions', () => {
  it('calculates chock width as 1/3 of diameter', () => {
    const chock = calculateChockDimensions(60);
    expect(chock.width).toBe(20);
  });

  it('calculates chock height as 1/4 of diameter', () => {
    const chock = calculateChockDimensions(60);
    expect(chock.height).toBe(15);
  });

  it('scales proportionally with diameter', () => {
    const chock36 = calculateChockDimensions(36);
    const chock72 = calculateChockDimensions(72);
    expect(chock72.width).toBeCloseTo(chock36.width * 2);
    expect(chock72.height).toBeCloseTo(chock36.height * 2);
  });

  it('returns zero dimensions for zero diameter', () => {
    const chock = calculateChockDimensions(0);
    expect(chock.width).toBe(0);
    expect(chock.height).toBe(0);
  });

  it('returns zero dimensions for negative diameter', () => {
    const chock = calculateChockDimensions(-48);
    expect(chock.width).toBe(0);
    expect(chock.height).toBe(0);
  });

  it('handles small diameters', () => {
    const chock = calculateChockDimensions(6);
    expect(chock.width).toBe(2);
    expect(chock.height).toBe(1.5);
  });

  it('handles large diameters', () => {
    const chock = calculateChockDimensions(120);
    expect(chock.width).toBe(40);
    expect(chock.height).toBe(30);
  });
});
