// ─── OptiFlow Flatbed Steel Load Planner — Core Type Definitions ─────────────
// Pure domain types consumed by both frontend and backend packages.

// ─── Primitive Geometry Types ────────────────────────────────────────────────

/** 2D position on the trailer deck (inches) */
export interface Position2D {
  x: number; // longitudinal distance from kingpin (positive = toward rear)
  y: number; // lateral distance from centerline (positive = right)
}

/** 3D position relative to deck origin at kingpin (inches) */
export interface Position3D {
  x: number; // longitudinal distance from kingpin
  y: number; // lateral distance from centerline
  z: number; // height above deck surface
}

/** Dimensions of a freight item (inches) */
export interface FreightDimensions {
  length: number;
  width: number;
  height: number; // or diameter for cylindrical items
}

// ─── Enums and Union Types ───────────────────────────────────────────────────

/** Axle group classification for weight distribution */
export type AxleGroup = 'steer' | 'drive' | 'trailer';

/** Load placement pattern template */
export type LoadPattern =
  | 'layered'
  | 'column_building'
  | 'row_building'
  | 'long_product'
  | 'nested'
  | 'customer_zoning'
  | 'mixed';

/** Rule enforcement level */
export type RuleType = 'hard_constraint' | 'soft_preference' | 'advisory';

/** Method used to handle freight during loading/unloading */
export type HandlingMethod = 'crane' | 'forklift' | 'magnet' | 'manual';

/** Whether an item may be stacked upon */
export type StackPermission = 'yes' | 'no' | 'conditional';

/** Freight orientation on deck */
export type Orientation = 'longitudinal' | 'transverse';

/** Orientation requirement (includes 'any' for items without preference) */
export type OrientationRequirement = 'longitudinal' | 'transverse' | 'any';

/** Deck material type */
export type DeckMaterial = 'steel' | 'aluminum' | 'wood';

// ─── Steel Product Types ─────────────────────────────────────────────────────

/** All recognized steel product type categories */
export type SteelProductType =
  | 'coil_hot_rolled'
  | 'coil_cold_rolled'
  | 'coil_galvanized'
  | 'sheet_bundle'
  | 'plate'
  | 'rebar_bundle'
  | 'wire_rod_coil'
  | 'beam_i'
  | 'beam_h'
  | 'beam_wide_flange'
  | 'channel'
  | 'angle'
  | 'flat_bar'
  | 'round_bar'
  | 'pipe'
  | 'tube'
  | 'hollow_structural_section'
  | 'roofing_sheet_bundle'
  | 'wire_mesh_panel'
  | 'fabricated_assembly'
  | 'palletized'
  | 'mixed_bundle';

// ─── Geometric Modeling Types ────────────────────────────────────────────────

/** Classification of freight shape for placement and stacking calculations */
export type GeometricType =
  | 'rectangular'
  | 'long_rectangular_bundle'
  | 'cylindrical_bundle'
  | 'horizontal_coil'
  | 'vertical_coil'
  | 'plate_stack'
  | 'irregular';

/** Geometric representation of a freight item */
export interface FreightGeometry {
  type: GeometricType;
  boundingBox: { length: number; width: number; height: number }; // inches
  contactFootprint: { area: number; shape: 'rectangle' | 'line' | 'circle' }; // sq inches
  centerOfMass: Position3D; // relative to item origin
  cradleAngle?: number; // for cylindrical items, degrees
  chockDimensions?: { width: number; height: number }; // for horizontal coils
}

// ─── Equipment Types ─────────────────────────────────────────────────────────

/** Complete trailer specification */
export interface TrailerProfile {
  id: string;
  name: string;
  lengthFt: number; // 48 or 53 standard
  deckWidthIn: number;
  deckHeightIn: number; // from ground
  maxGrossWeight: number; // lbs
  tareWeight: number;
  axleCount: number;
  axlePositions: number[]; // distances from kingpin in inches
  axleWeightRatings: number[]; // per axle group
  kingpinPosition: number; // inches from front of trailer
  rearOverhangLimit: number;
  deckMaterial: DeckMaterial;
  stakePockets: Position2D[];
  anchorPoints: Position2D[];
  maxConcentratedLoadPSF: number; // lbs per sq ft
}

/** Tractor specification */
export interface TractorProfile {
  id: string;
  name: string;
  steerAxleRating: number;
  driveAxleRating: number;
  fifthWheelPosition: number; // from front of tractor
  tareWeight: number;
  driveAxleCount: number; // 1 (single) or 2 (tandem)
}

/** Calculated tractor-trailer combination metrics */
export interface EquipmentCombination {
  tractorId: string;
  trailerId: string;
  availablePayload: number; // calculated: totalLegalGross - tractorTare - trailerTare
  totalLegalGross: number; // calculated
  perAxleLimits: Record<AxleGroup, number>;
}

// ─── Steel Order Types ───────────────────────────────────────────────────────

/** A single line item from a steel order manifest */
export interface SteelOrderLineItem {
  orderNumber: string;
  customerName: string;
  deliveryStop: number;
  productType: SteelProductType;
  quantity: number;
  pieceWeight: number; // lbs
  dimensions: FreightDimensions; // length, width, height/diameter in inches
  totalLineWeight: number;
  handlingMethod: HandlingMethod;
  stackPermission: StackPermission;
  maxStackHeight: number; // inches
  maxStackWeight: number; // lbs
  orientationRequirement: OrientationRequirement;
  dunnageRequired: boolean;
  specialNotes: string;
  /** Delivery number linking this order to a vehicle in fleet mode (optional) */
  deliveryNumber?: string;
}

// ─── Placement Types ─────────────────────────────────────────────────────────

/** Support method for an item on deck */
export type SupportMethod = 'direct_to_deck' | 'on_dunnage' | 'on_prior_layer';

/** A freight item that has been assigned a position on the trailer */
export interface PlacedFreight {
  item: SteelOrderLineItem;
  geometry: FreightGeometry;
  position: Position3D; // x, y, z relative to deck origin at kingpin
  orientation: Orientation;
  supportMethod: SupportMethod;
  layer: number; // 0 = deck level, 1 = first stack, etc.
}
