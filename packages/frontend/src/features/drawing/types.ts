// ─── Drawing Module Types ────────────────────────────────────────────────────

import type { DunnageInsertion, PlacedFreight, SecurementPlan, TrailerProfile } from '@ptv-discovery-coach/shared';

/** Supported drawing view types */
export type DrawingViewType = 'top' | 'left_side' | 'right_side' | 'front' | 'rear';

/** Options controlling drawing appearance and behavior */
export interface DrawingOptions {
  showSecurement: boolean;
  showDunnage: boolean;
  showWeightAnnotations: boolean;
  showDimensions: boolean;
  highlightedItemId?: string;
  colorBy: 'stop' | 'product_type' | 'weight';
  scale: number;
}

/** SVG viewBox parameters */
export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Props shared by all view components */
export interface ViewProps {
  trailer: TrailerProfile;
  placedFreight: PlacedFreight[];
  options: DrawingOptions;
  viewBox: ViewBox;
  onItemClick?: (itemId: string) => void;
  onItemHover?: (itemId: string | null) => void;
  /** Securement plans for overlay rendering */
  securementPlans?: SecurementPlan[];
  /** Dunnage insertions for overlay rendering */
  dunnageInsertions?: DunnageInsertion[];
}

/** Default drawing options */
export const DEFAULT_DRAWING_OPTIONS: DrawingOptions = {
  showSecurement: false,
  showDunnage: false,
  showWeightAnnotations: true,
  showDimensions: true,
  highlightedItemId: undefined,
  colorBy: 'stop',
  scale: 1,
};
