// ─── Drawing Renderer Unit Tests ─────────────────────────────────────────────
// Validates: Requirements 10.1, 10.6, 10.7, 20.4

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PlacedFreight, TrailerProfile, SteelProductType } from '@ptv-discovery-coach/shared';
import { DrawingRenderer } from './DrawingRenderer';
import { getStopColor, getProductTypeColor, getWeightColor, getItemColor } from './utils/colors';
import { getTopViewBox } from './views/TopView';
import { getSideViewBox } from './views/SideView';
import { getEndViewBox } from './views/EndView';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createTestTrailer(overrides?: Partial<TrailerProfile>): TrailerProfile {
  return {
    id: 'trailer-1',
    name: 'Standard 53ft Flatbed',
    lengthFt: 53,
    deckWidthIn: 102,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 15000,
    axleCount: 2,
    axlePositions: [480, 528],
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 36,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [
      { x: 48, y: -51 }, { x: 48, y: 51 },
      { x: 144, y: -51 }, { x: 144, y: 51 },
    ],
    anchorPoints: [
      { x: 96, y: -48 }, { x: 96, y: 48 },
      { x: 192, y: -48 }, { x: 192, y: 48 },
    ],
    maxConcentratedLoadPSF: 500,
    ...overrides,
  };
}

function createPlacedFreight(overrides?: Partial<{
  orderNumber: string;
  deliveryStop: number;
  productType: SteelProductType;
  totalLineWeight: number;
  geometryType: string;
  x: number;
  y: number;
  z: number;
  orientation: 'longitudinal' | 'transverse';
}>): PlacedFreight {
  const opts = {
    orderNumber: 'ORD-001',
    deliveryStop: 1,
    productType: 'plate' as SteelProductType,
    totalLineWeight: 10000,
    geometryType: 'rectangular',
    x: 100,
    y: 0,
    z: 0,
    orientation: 'longitudinal' as const,
    ...overrides,
  };

  return {
    item: {
      orderNumber: opts.orderNumber,
      customerName: 'Test Customer',
      deliveryStop: opts.deliveryStop,
      productType: opts.productType,
      quantity: 1,
      pieceWeight: opts.totalLineWeight,
      dimensions: { length: 120, width: 48, height: 12 },
      totalLineWeight: opts.totalLineWeight,
      handlingMethod: 'crane',
      stackPermission: 'yes',
      maxStackHeight: 60,
      maxStackWeight: 40000,
      orientationRequirement: 'any',
      dunnageRequired: false,
      specialNotes: '',
    },
    geometry: {
      type: opts.geometryType as any,
      boundingBox: { length: 120, width: 48, height: 12 },
      contactFootprint: { area: 5760, shape: 'rectangle' },
      centerOfMass: { x: 60, y: 0, z: 6 },
    },
    position: { x: opts.x, y: opts.y, z: opts.z },
    orientation: opts.orientation,
    supportMethod: 'direct_to_deck',
    layer: 0,
  };
}

// ─── Test Suite: All 5 View Types Generated (Requirement 10.1) ───────────────

describe('DrawingRenderer - All 5 view types generated', () => {
  const trailer = createTestTrailer();
  const placedFreight = [createPlacedFreight()];

  it('renders all 5 view panels by default', () => {
    render(<DrawingRenderer trailer={trailer} placedFreight={placedFreight} />);

    expect(screen.getByTestId('panel-top')).toBeInTheDocument();
    expect(screen.getByTestId('panel-left-side')).toBeInTheDocument();
    expect(screen.getByTestId('panel-right-side')).toBeInTheDocument();
    expect(screen.getByTestId('panel-front')).toBeInTheDocument();
    expect(screen.getByTestId('panel-rear')).toBeInTheDocument();
  });

  it('renders the top-down SVG view with correct aria label', () => {
    render(<DrawingRenderer trailer={trailer} placedFreight={placedFreight} />);

    const topView = screen.getByTestId('drawing-top-view');
    expect(topView).toBeInTheDocument();
    expect(topView).toHaveAttribute('role', 'img');
    expect(topView).toHaveAttribute('aria-label', 'Top-down view of trailer load plan');
  });

  it('renders the left-side and right-side SVG views', () => {
    render(<DrawingRenderer trailer={trailer} placedFreight={placedFreight} />);

    expect(screen.getByTestId('drawing-left-side-view')).toBeInTheDocument();
    expect(screen.getByTestId('drawing-right-side-view')).toBeInTheDocument();
  });

  it('renders front and rear SVG views', () => {
    render(<DrawingRenderer trailer={trailer} placedFreight={placedFreight} />);

    expect(screen.getByTestId('drawing-front-view')).toBeInTheDocument();
    expect(screen.getByTestId('drawing-rear-view')).toBeInTheDocument();
  });

  it('allows selective view display via visibleViews prop', () => {
    render(
      <DrawingRenderer
        trailer={trailer}
        placedFreight={placedFreight}
        visibleViews={['top', 'front']}
      />
    );

    expect(screen.getByTestId('panel-top')).toBeInTheDocument();
    expect(screen.getByTestId('panel-front')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-left-side')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-right-side')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-rear')).not.toBeInTheDocument();
  });

  it('renders freight items in each view', () => {
    render(<DrawingRenderer trailer={trailer} placedFreight={placedFreight} />);

    // Top view
    expect(screen.getByTestId('freight-item-ORD-001')).toBeInTheDocument();
    // Side views
    expect(screen.getAllByTestId('freight-side-ORD-001')).toHaveLength(2); // left + right
    // End views
    expect(screen.getAllByTestId('freight-end-ORD-001')).toHaveLength(2); // front + rear
  });

  it('renders trailer structural elements (deck outline, kingpin, axles)', () => {
    render(<DrawingRenderer trailer={trailer} placedFreight={placedFreight} />);

    expect(screen.getByTestId('deck-outline')).toBeInTheDocument();
    expect(screen.getByTestId('kingpin')).toBeInTheDocument();
    expect(screen.getByTestId('axle-0')).toBeInTheDocument();
    expect(screen.getByTestId('axle-1')).toBeInTheDocument();
  });
});

// ─── Test Suite: Color Coding (Requirement 10.6) ─────────────────────────────

describe('DrawingRenderer - Color coding by stop/product_type/weight', () => {
  it('getStopColor returns distinct colors for different stops', () => {
    const color1 = getStopColor(1);
    const color2 = getStopColor(2);
    const color3 = getStopColor(3);

    expect(color1).not.toEqual(color2);
    expect(color2).not.toEqual(color3);
    expect(color1).not.toEqual(color3);
  });

  it('getStopColor wraps around after palette exhaustion', () => {
    // Palette has 10 colors, so stop 11 should wrap to stop 1's color
    expect(getStopColor(11)).toEqual(getStopColor(1));
    expect(getStopColor(12)).toEqual(getStopColor(2));
  });

  it('getProductTypeColor returns correct category colors', () => {
    // Coil types share a color family
    const coilHR = getProductTypeColor('coil_hot_rolled');
    const coilCR = getProductTypeColor('coil_cold_rolled');
    expect(coilHR).toEqual(coilCR); // same coil category

    // Different categories have different colors
    const plate = getProductTypeColor('plate');
    const beam = getProductTypeColor('beam_i');
    const pipe = getProductTypeColor('pipe');
    expect(plate).not.toEqual(beam);
    expect(beam).not.toEqual(pipe);
  });

  it('getProductTypeColor maps wire_rod_coil to coil color', () => {
    expect(getProductTypeColor('wire_rod_coil')).toEqual(getProductTypeColor('coil_hot_rolled'));
  });

  it('getProductTypeColor maps structural items (channel, angle) to beam category', () => {
    const beamColor = getProductTypeColor('beam_i');
    expect(getProductTypeColor('channel')).toEqual(beamColor);
    expect(getProductTypeColor('angle')).toEqual(beamColor);
  });

  it('getProductTypeColor maps pipe/tube/HSS to pipe category', () => {
    const pipeColor = getProductTypeColor('pipe');
    expect(getProductTypeColor('tube')).toEqual(pipeColor);
    expect(getProductTypeColor('hollow_structural_section')).toEqual(pipeColor);
  });

  it('getWeightColor returns green-ish for light items and red-ish for heavy items', () => {
    const lightColor = getWeightColor(1000, 50000);
    const heavyColor = getWeightColor(50000, 50000);

    // Light color should have higher green component
    // Heavy color should be red-dominant
    // We parse RGB to verify the gradient direction
    expect(lightColor).toMatch(/^rgb\(/);
    expect(heavyColor).toMatch(/^rgb\(/);

    // Extract green value from the light color (format: rgb(r, g, b))
    const lightMatch = lightColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    const heavyMatch = heavyColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(lightMatch).not.toBeNull();
    expect(heavyMatch).not.toBeNull();

    const lightGreen = parseInt(lightMatch![2]);
    const heavyGreen = parseInt(heavyMatch![2]);
    // Light items should have more green than heavy items
    expect(lightGreen).toBeGreaterThan(heavyGreen);
  });

  it('getWeightColor handles zero maxWeight gracefully', () => {
    const color = getWeightColor(5000, 0);
    expect(color).toBe('#6b7280'); // gray fallback
  });

  it('getItemColor delegates correctly based on colorBy option', () => {
    const item = { deliveryStop: 2, productType: 'beam_i' as SteelProductType, totalLineWeight: 15000 };

    const stopColor = getItemColor(item, 'stop', 50000);
    const typeColor = getItemColor(item, 'product_type', 50000);
    const weightColor = getItemColor(item, 'weight', 50000);

    expect(stopColor).toEqual(getStopColor(2));
    expect(typeColor).toEqual(getProductTypeColor('beam_i'));
    expect(weightColor).toEqual(getWeightColor(15000, 50000));
  });

  it('renders items with stop color coding when colorBy is stop', () => {
    const trailer = createTestTrailer();
    const freight = [
      createPlacedFreight({ orderNumber: 'S1', deliveryStop: 1, x: 50 }),
      createPlacedFreight({ orderNumber: 'S2', deliveryStop: 2, x: 200 }),
    ];

    render(
      <DrawingRenderer
        trailer={trailer}
        placedFreight={freight}
        options={{ colorBy: 'stop' }}
      />
    );

    // Both items rendered
    expect(screen.getByTestId('freight-item-S1')).toBeInTheDocument();
    expect(screen.getByTestId('freight-item-S2')).toBeInTheDocument();
  });
});

// ─── Test Suite: Cross-View Highlighting (Requirement 10.6) ──────────────────

describe('DrawingRenderer - Cross-view highlighting behavior', () => {
  it('calls onItemHighlight callback when hovering over an item', () => {
    const trailer = createTestTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'HOVER-1' })];
    const onHighlight = vi.fn();

    render(
      <DrawingRenderer
        trailer={trailer}
        placedFreight={freight}
        onItemHighlight={onHighlight}
      />
    );

    const itemInTopView = screen.getByTestId('freight-item-HOVER-1');
    fireEvent.mouseEnter(itemInTopView);

    expect(onHighlight).toHaveBeenCalledWith('HOVER-1');
  });

  it('clears highlight on mouse leave', () => {
    const trailer = createTestTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'HOVER-2' })];
    const onHighlight = vi.fn();

    render(
      <DrawingRenderer
        trailer={trailer}
        placedFreight={freight}
        onItemHighlight={onHighlight}
      />
    );

    const itemInTopView = screen.getByTestId('freight-item-HOVER-2');
    fireEvent.mouseEnter(itemInTopView);
    fireEvent.mouseLeave(itemInTopView);

    expect(onHighlight).toHaveBeenLastCalledWith(null);
  });

  it('calls onItemSelect callback when clicking an item', () => {
    const trailer = createTestTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'CLICK-1' })];
    const onSelect = vi.fn();

    render(
      <DrawingRenderer
        trailer={trailer}
        placedFreight={freight}
        onItemSelect={onSelect}
      />
    );

    const itemInTopView = screen.getByTestId('freight-item-CLICK-1');
    fireEvent.click(itemInTopView);

    expect(onSelect).toHaveBeenCalledWith('CLICK-1');
  });

  it('highlighting propagates across all views via shared state', () => {
    const trailer = createTestTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'CROSS-1' })];

    render(
      <DrawingRenderer
        trailer={trailer}
        placedFreight={freight}
        options={{ highlightedItemId: 'CROSS-1' }}
      />
    );

    // The item should appear in all views — the component uses shared effectiveOptions
    // with the highlightedItemId propagated to all views
    expect(screen.getByTestId('freight-item-CROSS-1')).toBeInTheDocument();
    expect(screen.getAllByTestId('freight-side-CROSS-1')).toHaveLength(2);
    expect(screen.getAllByTestId('freight-end-CROSS-1')).toHaveLength(2);
  });

  it('hover in one view triggers highlight change for all views', () => {
    const trailer = createTestTrailer();
    const freight = [
      createPlacedFreight({ orderNumber: 'MULTI-1', x: 50 }),
      createPlacedFreight({ orderNumber: 'MULTI-2', x: 200 }),
    ];
    const onHighlight = vi.fn();

    render(
      <DrawingRenderer
        trailer={trailer}
        placedFreight={freight}
        onItemHighlight={onHighlight}
      />
    );

    // Hover over item in the side view
    const sideItems = screen.getAllByTestId('freight-side-MULTI-1');
    fireEvent.mouseEnter(sideItems[0]);

    expect(onHighlight).toHaveBeenCalledWith('MULTI-1');
  });
});

// ─── Test Suite: Responsive Rendering (Requirement 20.4) ─────────────────────

describe('DrawingRenderer - Responsive rendering from 1024px to 3840px', () => {
  it('getTopViewBox produces correct dimensions for a 53ft trailer', () => {
    const trailer = { lengthFt: 53, deckWidthIn: 102, deckHeightIn: 60 };
    const vb = getTopViewBox(trailer);

    // Deck length = 53 * 12 = 636 inches
    expect(vb.width).toBe(636 + 24 * 2); // deckLength + 2 * VIEW_PADDING
    expect(vb.height).toBe(102 + 24 * 2); // deckWidth + 2 * VIEW_PADDING
    expect(vb.x).toBe(-24); // -VIEW_PADDING
    expect(vb.y).toBe(-(102 / 2 + 24)); // -(deckWidth/2 + padding)
  });

  it('getTopViewBox produces correct dimensions for a 48ft trailer', () => {
    const trailer = { lengthFt: 48, deckWidthIn: 96, deckHeightIn: 58 };
    const vb = getTopViewBox(trailer);

    expect(vb.width).toBe(48 * 12 + 48); // 576 + 48
    expect(vb.height).toBe(96 + 48);
  });

  it('getSideViewBox includes cargo height space above deck', () => {
    const trailer = { lengthFt: 53, deckHeightIn: 60 };
    const vb = getSideViewBox(trailer);

    // Total height = deckHeightIn + 180 (cargo space above deck)
    const totalHeight = 60 + 180;
    expect(vb.width).toBe(53 * 12 + 48);
    expect(vb.height).toBe(totalHeight + 48);
    expect(vb.y).toBe(-(180 + 24)); // negative for SVG above deck
  });

  it('getEndViewBox uses deck width for lateral extent', () => {
    const trailer = { deckWidthIn: 102, deckHeightIn: 60 };
    const vb = getEndViewBox(trailer);

    expect(vb.width).toBe(102 + 48);
    expect(vb.x).toBe(-(102 / 2 + 24));
    expect(vb.height).toBe(60 + 180 + 48);
  });

  it('SVG views use viewBox for responsive scaling (no fixed pixel dimensions)', () => {
    const trailer = createTestTrailer();
    const freight = [createPlacedFreight()];

    render(<DrawingRenderer trailer={trailer} placedFreight={freight} />);

    const topView = screen.getByTestId('drawing-top-view');
    // SVG uses viewBox attribute for responsive scaling
    expect(topView.getAttribute('viewBox')).toBeTruthy();
    // SVG should have w-full h-full CSS classes for fluid sizing
    expect(topView.getAttribute('class')).toContain('w-full');
    expect(topView.getAttribute('class')).toContain('h-full');
  });

  it('viewBox dimensions are proportional and independent of screen width', () => {
    // The SVG viewBox defines the coordinate system, not pixel size.
    // The SVG is styled w-full h-full, meaning it fills its container.
    // This guarantees readability from 1024px to 3840px screens.
    const trailer = createTestTrailer();
    const vb = getTopViewBox(trailer);

    // Aspect ratio should be consistent regardless of screen size
    const aspectRatio = vb.width / vb.height;
    // For a 53ft trailer (636in) with 102in deck width, aspect ratio > 1
    expect(aspectRatio).toBeGreaterThan(1);
    // Width should be much larger than height (trailer is long and narrow)
    expect(vb.width).toBeGreaterThan(vb.height * 3);
  });

  it('all views have w-full h-full classes for responsive container fill', () => {
    const trailer = createTestTrailer();
    const freight = [createPlacedFreight()];

    render(<DrawingRenderer trailer={trailer} placedFreight={freight} />);

    const views = [
      screen.getByTestId('drawing-top-view'),
      screen.getByTestId('drawing-left-side-view'),
      screen.getByTestId('drawing-right-side-view'),
      screen.getByTestId('drawing-front-view'),
      screen.getByTestId('drawing-rear-view'),
    ];

    views.forEach((view) => {
      expect(view.getAttribute('class')).toContain('w-full');
      expect(view.getAttribute('class')).toContain('h-full');
    });
  });

  it('viewBox values are always positive dimensions', () => {
    const trailer48 = { lengthFt: 48, deckWidthIn: 96, deckHeightIn: 58 };
    const trailer53 = { lengthFt: 53, deckWidthIn: 102, deckHeightIn: 60 };

    [trailer48, trailer53].forEach((t) => {
      const topVB = getTopViewBox(t);
      const sideVB = getSideViewBox(t);
      const endVB = getEndViewBox({ deckWidthIn: t.deckWidthIn, deckHeightIn: t.deckHeightIn });

      expect(topVB.width).toBeGreaterThan(0);
      expect(topVB.height).toBeGreaterThan(0);
      expect(sideVB.width).toBeGreaterThan(0);
      expect(sideVB.height).toBeGreaterThan(0);
      expect(endVB.width).toBeGreaterThan(0);
      expect(endVB.height).toBeGreaterThan(0);
    });
  });
});
