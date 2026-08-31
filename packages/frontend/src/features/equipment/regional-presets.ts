// ─── Regional Equipment Presets ──────────────────────────────────────────────
// Pre-defined tractor + trailer combinations by region.
// These represent common flatbed steel hauling configurations per market.

import type { TrailerProfile, TractorProfile } from '@ptv-discovery-coach/shared';

export type Region = 'north_america' | 'europe' | 'brazil' | 'peru' | 'australia' | 'custom';

export interface RegionalPreset {
  id: string;
  region: Region;
  regionLabel: string;
  name: string;
  description: string;
  trailer: TrailerProfile;
  tractor: TractorProfile;
}

// ─── North America ───────────────────────────────────────────────────────────

const NA_TRAILER_48: TrailerProfile = {
  id: 'na-48ft-flatbed',
  name: '48-ft US Flatbed',
  lengthFt: 48,
  deckWidthIn: 96,
  deckHeightIn: 60,
  maxGrossWeight: 80000,
  tareWeight: 12500,
  axleCount: 2,
  axlePositions: [432, 480],
  axleWeightRatings: [34000, 34000],
  kingpinPosition: 36,
  rearOverhangLimit: 48,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 48, y: -48 }, { x: 48, y: 48 },
    { x: 144, y: -48 }, { x: 144, y: 48 },
    { x: 240, y: -48 }, { x: 240, y: 48 },
    { x: 336, y: -48 }, { x: 336, y: 48 },
    { x: 432, y: -48 }, { x: 432, y: 48 },
    { x: 528, y: -48 }, { x: 528, y: 48 },
  ],
  anchorPoints: [
    { x: 24, y: -46 }, { x: 24, y: 46 },
    { x: 96, y: -46 }, { x: 96, y: 46 },
    { x: 168, y: -46 }, { x: 168, y: 46 },
    { x: 240, y: -46 }, { x: 240, y: 46 },
    { x: 312, y: -46 }, { x: 312, y: 46 },
    { x: 384, y: -46 }, { x: 384, y: 46 },
    { x: 456, y: -46 }, { x: 456, y: 46 },
    { x: 528, y: -46 }, { x: 528, y: 46 },
  ],
  maxConcentratedLoadPSF: 800,
};

const NA_TRAILER_53: TrailerProfile = {
  id: 'na-53ft-flatbed',
  name: '53-ft US Flatbed',
  lengthFt: 53,
  deckWidthIn: 102,
  deckHeightIn: 60,
  maxGrossWeight: 80000,
  tareWeight: 13500,
  axleCount: 2,
  axlePositions: [492, 540],
  axleWeightRatings: [34000, 34000],
  kingpinPosition: 36,
  rearOverhangLimit: 48,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 48, y: -51 }, { x: 48, y: 51 },
    { x: 144, y: -51 }, { x: 144, y: 51 },
    { x: 240, y: -51 }, { x: 240, y: 51 },
    { x: 336, y: -51 }, { x: 336, y: 51 },
    { x: 432, y: -51 }, { x: 432, y: 51 },
    { x: 528, y: -51 }, { x: 528, y: 51 },
    { x: 588, y: -51 }, { x: 588, y: 51 },
  ],
  anchorPoints: [
    { x: 24, y: -50 }, { x: 24, y: 50 },
    { x: 96, y: -50 }, { x: 96, y: 50 },
    { x: 168, y: -50 }, { x: 168, y: 50 },
    { x: 240, y: -50 }, { x: 240, y: 50 },
    { x: 312, y: -50 }, { x: 312, y: 50 },
    { x: 384, y: -50 }, { x: 384, y: 50 },
    { x: 456, y: -50 }, { x: 456, y: 50 },
    { x: 528, y: -50 }, { x: 528, y: 50 },
    { x: 588, y: -50 }, { x: 588, y: 50 },
  ],
  maxConcentratedLoadPSF: 800,
};

const NA_TRACTOR: TractorProfile = {
  id: 'na-standard-daycab',
  name: 'US Day Cab (Tandem)',
  steerAxleRating: 12000,
  driveAxleRating: 34000,
  fifthWheelPosition: 180,
  tareWeight: 17500,
  driveAxleCount: 2,
};

// ─── Europe ──────────────────────────────────────────────────────────────────

const EU_TRAILER_13M: TrailerProfile = {
  id: 'eu-13m-flatbed',
  name: '13.6m EU Flatbed',
  lengthFt: 45, // 13.6m ≈ 44.6ft
  deckWidthIn: 98, // 2.48m standard EU width
  deckHeightIn: 59, // ~1.5m deck height
  maxGrossWeight: 88000, // 40 tonne GVW (EU standard)
  tareWeight: 15400, // ~7000 kg
  axleCount: 3,
  axlePositions: [380, 430, 480], // tridem spread
  axleWeightRatings: [26000, 26000, 26000], // ~11.5 tonne per axle
  kingpinPosition: 36,
  rearOverhangLimit: 60,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 48, y: -49 }, { x: 48, y: 49 },
    { x: 144, y: -49 }, { x: 144, y: 49 },
    { x: 240, y: -49 }, { x: 240, y: 49 },
    { x: 336, y: -49 }, { x: 336, y: 49 },
    { x: 432, y: -49 }, { x: 432, y: 49 },
    { x: 504, y: -49 }, { x: 504, y: 49 },
  ],
  anchorPoints: [
    { x: 24, y: -47 }, { x: 24, y: 47 },
    { x: 96, y: -47 }, { x: 96, y: 47 },
    { x: 168, y: -47 }, { x: 168, y: 47 },
    { x: 240, y: -47 }, { x: 240, y: 47 },
    { x: 312, y: -47 }, { x: 312, y: 47 },
    { x: 384, y: -47 }, { x: 384, y: 47 },
    { x: 456, y: -47 }, { x: 456, y: 47 },
    { x: 504, y: -47 }, { x: 504, y: 47 },
  ],
  maxConcentratedLoadPSF: 750,
};

const EU_TRACTOR: TractorProfile = {
  id: 'eu-4x2-tractor',
  name: 'EU 4x2 Tractor',
  steerAxleRating: 17600, // 8 tonne
  driveAxleRating: 25300, // 11.5 tonne
  fifthWheelPosition: 140, // shorter EU cabs
  tareWeight: 15400, // ~7000 kg
  driveAxleCount: 1,
};

const EU_TRACTOR_6X2: TractorProfile = {
  id: 'eu-6x2-tractor',
  name: 'EU 6x2 Tractor',
  steerAxleRating: 17600, // 8 tonne
  driveAxleRating: 25300, // 11.5 tonne
  fifthWheelPosition: 160,
  tareWeight: 17600, // ~8000 kg (heavier 3-axle)
  driveAxleCount: 1,
};

// ─── Brazil ──────────────────────────────────────────────────────────────────

const BR_TRAILER_13M: TrailerProfile = {
  id: 'br-13m-plataforma',
  name: '13m Plataforma (T3S3)',
  lengthFt: 43, // 13m ≈ 42.6ft
  deckWidthIn: 102, // 2.6m BR width
  deckHeightIn: 59,
  maxGrossWeight: 87000, // ~39.5 tonne (Brazil PBTC for T3S3)
  tareWeight: 16000, // ~7250 kg
  axleCount: 3,
  axlePositions: [360, 410, 460], // tridem
  axleWeightRatings: [25000, 25000, 25000], // ~11.3 tonne per axle
  kingpinPosition: 36,
  rearOverhangLimit: 60,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 48, y: -51 }, { x: 48, y: 51 },
    { x: 144, y: -51 }, { x: 144, y: 51 },
    { x: 240, y: -51 }, { x: 240, y: 51 },
    { x: 336, y: -51 }, { x: 336, y: 51 },
    { x: 432, y: -51 }, { x: 432, y: 51 },
  ],
  anchorPoints: [
    { x: 24, y: -49 }, { x: 24, y: 49 },
    { x: 120, y: -49 }, { x: 120, y: 49 },
    { x: 216, y: -49 }, { x: 216, y: 49 },
    { x: 312, y: -49 }, { x: 312, y: 49 },
    { x: 408, y: -49 }, { x: 408, y: 49 },
  ],
  maxConcentratedLoadPSF: 700,
};

const BR_TRACTOR_6X4: TractorProfile = {
  id: 'br-6x4-tractor',
  name: 'BR 6x4 Tractor (T3S3)',
  steerAxleRating: 13200, // 6 tonne
  driveAxleRating: 38500, // 17.5 tonne tandem
  fifthWheelPosition: 180,
  tareWeight: 18700, // ~8500 kg
  driveAxleCount: 2,
};

// ─── Australia ───────────────────────────────────────────────────────────────

const AU_TRAILER_45FT: TrailerProfile = {
  id: 'au-45ft-flatbed',
  name: '45-ft AU Flat Top',
  lengthFt: 45,
  deckWidthIn: 98, // 2.5m
  deckHeightIn: 59,
  maxGrossWeight: 92600, // 42 tonne (AU GML)
  tareWeight: 14300,
  axleCount: 3,
  axlePositions: [390, 440, 490], // triaxle
  axleWeightRatings: [26400, 26400, 26400],
  kingpinPosition: 36,
  rearOverhangLimit: 60,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 48, y: -49 }, { x: 48, y: 49 },
    { x: 144, y: -49 }, { x: 144, y: 49 },
    { x: 240, y: -49 }, { x: 240, y: 49 },
    { x: 336, y: -49 }, { x: 336, y: 49 },
    { x: 432, y: -49 }, { x: 432, y: 49 },
    { x: 504, y: -49 }, { x: 504, y: 49 },
  ],
  anchorPoints: [
    { x: 24, y: -47 }, { x: 24, y: 47 },
    { x: 96, y: -47 }, { x: 96, y: 47 },
    { x: 168, y: -47 }, { x: 168, y: 47 },
    { x: 240, y: -47 }, { x: 240, y: 47 },
    { x: 312, y: -47 }, { x: 312, y: 47 },
    { x: 384, y: -47 }, { x: 384, y: 47 },
    { x: 456, y: -47 }, { x: 456, y: 47 },
    { x: 504, y: -47 }, { x: 504, y: 47 },
  ],
  maxConcentratedLoadPSF: 750,
};

const AU_TRACTOR: TractorProfile = {
  id: 'au-prime-mover',
  name: 'AU Prime Mover (6x4)',
  steerAxleRating: 14300, // 6.5 tonne
  driveAxleRating: 38500, // 17.5 tonne tandem
  fifthWheelPosition: 200,
  tareWeight: 19800, // ~9000 kg
  driveAxleCount: 2,
};

// ─── Peru (Callao Fleet) ─────────────────────────────────────────────────────
// Based on actual fleet catalog: Camión, Camión Grúa, Trailer c/Plataforma, Trailer Grúa
// Dimensions in meters converted to imperial for the engine (lengths in ft, widths in inches)
// Peru GVW limits: Camión ~30t, Trailer articulado ~48t (varies by road class)

/** Peru ZN class — Light Camión (6m platform, ~6 tonne payload) */
const PE_CAMION_ZN: TrailerProfile = {
  id: 'pe-camion-zn-6m',
  name: 'Camión ZN — 6m Platform',
  lengthFt: 20, // 6.0m ≈ 19.7ft
  deckWidthIn: 94, // 2.4m
  deckHeightIn: 55,
  maxGrossWeight: 22000, // ~10 tonne GVW (6t payload + 4t tare)
  tareWeight: 8800, // ~4 tonne vehicle weight
  axleCount: 2,
  axlePositions: [180, 220],
  axleWeightRatings: [15400, 15400], // 7 tonne per axle
  kingpinPosition: 24,
  rearOverhangLimit: 36,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 24, y: -47 }, { x: 24, y: 47 },
    { x: 96, y: -47 }, { x: 96, y: 47 },
    { x: 168, y: -47 }, { x: 168, y: 47 },
    { x: 216, y: -47 }, { x: 216, y: 47 },
  ],
  anchorPoints: [
    { x: 24, y: -45 }, { x: 24, y: 45 },
    { x: 96, y: -45 }, { x: 96, y: 45 },
    { x: 168, y: -45 }, { x: 168, y: 45 },
    { x: 216, y: -45 }, { x: 216, y: 45 },
  ],
  maxConcentratedLoadPSF: 500,
};

/** Peru ZO class — Medium Camión (6.5–8m platform, ~9 tonne payload) */
const PE_CAMION_ZO: TrailerProfile = {
  id: 'pe-camion-zo-7m',
  name: 'Camión ZO — 7m Platform',
  lengthFt: 23, // 7.0m ≈ 23ft
  deckWidthIn: 102, // 2.6m
  deckHeightIn: 57,
  maxGrossWeight: 30800, // ~14 tonne GVW (9t payload + 5t tare)
  tareWeight: 11000, // ~5 tonne
  axleCount: 2,
  axlePositions: [200, 252],
  axleWeightRatings: [17600, 17600], // 8 tonne per axle
  kingpinPosition: 28,
  rearOverhangLimit: 40,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 24, y: -51 }, { x: 24, y: 51 },
    { x: 96, y: -51 }, { x: 96, y: 51 },
    { x: 168, y: -51 }, { x: 168, y: 51 },
    { x: 240, y: -51 }, { x: 240, y: 51 },
  ],
  anchorPoints: [
    { x: 24, y: -49 }, { x: 24, y: 49 },
    { x: 96, y: -49 }, { x: 96, y: 49 },
    { x: 168, y: -49 }, { x: 168, y: 49 },
    { x: 240, y: -49 }, { x: 240, y: 49 },
  ],
  maxConcentratedLoadPSF: 600,
};

/** Peru ZB class — Heavy Camión (9m platform, ~16 tonne payload) */
const PE_CAMION_ZB: TrailerProfile = {
  id: 'pe-camion-zb-9m',
  name: 'Camión ZB — 9.2m Platform',
  lengthFt: 30, // 9.2m ≈ 30ft
  deckWidthIn: 102, // 2.6m
  deckHeightIn: 59,
  maxGrossWeight: 50700, // ~23 tonne GVW (16t payload + 7t tare)
  tareWeight: 15400, // ~7 tonne
  axleCount: 2,
  axlePositions: [270, 330],
  axleWeightRatings: [26400, 26400], // 12 tonne per axle
  kingpinPosition: 32,
  rearOverhangLimit: 48,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 36, y: -51 }, { x: 36, y: 51 },
    { x: 120, y: -51 }, { x: 120, y: 51 },
    { x: 204, y: -51 }, { x: 204, y: 51 },
    { x: 288, y: -51 }, { x: 288, y: 51 },
    { x: 348, y: -51 }, { x: 348, y: 51 },
  ],
  anchorPoints: [
    { x: 36, y: -49 }, { x: 36, y: 49 },
    { x: 108, y: -49 }, { x: 108, y: 49 },
    { x: 180, y: -49 }, { x: 180, y: 49 },
    { x: 252, y: -49 }, { x: 252, y: 49 },
    { x: 324, y: -49 }, { x: 324, y: 49 },
  ],
  maxConcentratedLoadPSF: 700,
};

/** Peru ZB class — Camión Grúa (9m platform with crane, ~20 tonne payload) */
const PE_CAMION_GRUA: TrailerProfile = {
  id: 'pe-camion-grua-9m',
  name: 'Camión Grúa — 9m Platform',
  lengthFt: 30, // 9.0m ≈ 29.5ft
  deckWidthIn: 102, // 2.6m
  deckHeightIn: 59,
  maxGrossWeight: 57200, // ~26 tonne GVW (20t payload + 6t tare + crane)
  tareWeight: 17600, // ~8 tonne (heavier due to crane)
  axleCount: 3,
  axlePositions: [240, 288, 336],
  axleWeightRatings: [20900, 20900, 20900],
  kingpinPosition: 32,
  rearOverhangLimit: 48,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 36, y: -51 }, { x: 36, y: 51 },
    { x: 120, y: -51 }, { x: 120, y: 51 },
    { x: 204, y: -51 }, { x: 204, y: 51 },
    { x: 288, y: -51 }, { x: 288, y: 51 },
    { x: 348, y: -51 }, { x: 348, y: 51 },
  ],
  anchorPoints: [
    { x: 36, y: -49 }, { x: 36, y: 49 },
    { x: 108, y: -49 }, { x: 108, y: 49 },
    { x: 180, y: -49 }, { x: 180, y: 49 },
    { x: 252, y: -49 }, { x: 252, y: 49 },
    { x: 324, y: -49 }, { x: 324, y: 49 },
  ],
  maxConcentratedLoadPSF: 700,
};

/** Peru ZA class — Trailer c/Plataforma (13m platform, ~33 tonne payload) */
const PE_TRAILER_13M: TrailerProfile = {
  id: 'pe-trailer-plataforma-13m',
  name: 'Trailer c/Plataforma — 13m',
  lengthFt: 43, // 13.0m ≈ 42.6ft
  deckWidthIn: 102, // 2.6m
  deckHeightIn: 59,
  maxGrossWeight: 105600, // ~48 tonne GVW (Peru articulated limit)
  tareWeight: 17600, // ~8 tonne trailer tare
  axleCount: 3,
  axlePositions: [380, 430, 480],
  axleWeightRatings: [26400, 26400, 26400], // 12 tonne per axle (tridem)
  kingpinPosition: 36,
  rearOverhangLimit: 60,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 36, y: -51 }, { x: 36, y: 51 },
    { x: 120, y: -51 }, { x: 120, y: 51 },
    { x: 204, y: -51 }, { x: 204, y: 51 },
    { x: 288, y: -51 }, { x: 288, y: 51 },
    { x: 372, y: -51 }, { x: 372, y: 51 },
    { x: 456, y: -51 }, { x: 456, y: 51 },
    { x: 504, y: -51 }, { x: 504, y: 51 },
  ],
  anchorPoints: [
    { x: 36, y: -49 }, { x: 36, y: 49 },
    { x: 108, y: -49 }, { x: 108, y: 49 },
    { x: 180, y: -49 }, { x: 180, y: 49 },
    { x: 252, y: -49 }, { x: 252, y: 49 },
    { x: 324, y: -49 }, { x: 324, y: 49 },
    { x: 396, y: -49 }, { x: 396, y: 49 },
    { x: 468, y: -49 }, { x: 468, y: 49 },
    { x: 504, y: -49 }, { x: 504, y: 49 },
  ],
  maxConcentratedLoadPSF: 700,
};

/** Peru ZA class — Trailer c/Plataforma 12m (shorter variant, ~32 tonne payload) */
const PE_TRAILER_12M: TrailerProfile = {
  id: 'pe-trailer-plataforma-12m',
  name: 'Trailer c/Plataforma — 12m',
  lengthFt: 39, // 12.0m ≈ 39.4ft
  deckWidthIn: 102, // 2.6m
  deckHeightIn: 59,
  maxGrossWeight: 101200, // ~46 tonne GVW
  tareWeight: 15400, // ~7 tonne
  axleCount: 3,
  axlePositions: [340, 390, 440],
  axleWeightRatings: [24200, 24200, 24200],
  kingpinPosition: 36,
  rearOverhangLimit: 56,
  deckMaterial: 'steel',
  stakePockets: [
    { x: 36, y: -51 }, { x: 36, y: 51 },
    { x: 120, y: -51 }, { x: 120, y: 51 },
    { x: 204, y: -51 }, { x: 204, y: 51 },
    { x: 288, y: -51 }, { x: 288, y: 51 },
    { x: 372, y: -51 }, { x: 372, y: 51 },
    { x: 444, y: -51 }, { x: 444, y: 51 },
  ],
  anchorPoints: [
    { x: 36, y: -49 }, { x: 36, y: 49 },
    { x: 108, y: -49 }, { x: 108, y: 49 },
    { x: 180, y: -49 }, { x: 180, y: 49 },
    { x: 252, y: -49 }, { x: 252, y: 49 },
    { x: 324, y: -49 }, { x: 324, y: 49 },
    { x: 396, y: -49 }, { x: 396, y: 49 },
    { x: 444, y: -49 }, { x: 444, y: 49 },
  ],
  maxConcentratedLoadPSF: 700,
};

/** Peru standard tractor for rigid trucks (Camión) — single-unit vehicle, no tractor separation */
const PE_TRACTOR_RIGID: TractorProfile = {
  id: 'pe-rigid-truck-cab',
  name: 'Peru Camión Cab (Rigid)',
  steerAxleRating: 15400, // 7 tonne
  driveAxleRating: 24200, // 11 tonne
  fifthWheelPosition: 120, // cab-over, shorter
  tareWeight: 8800, // ~4 tonne cab+chassis (included in trailer tare for rigids)
  driveAxleCount: 1,
};

/** Peru tractor for articulated trailers (T3S3 class) */
const PE_TRACTOR_T3S3: TractorProfile = {
  id: 'pe-tractor-t3s3',
  name: 'Peru Tracto 6x4 (T3S3)',
  steerAxleRating: 15400, // 7 tonne
  driveAxleRating: 39600, // 18 tonne tandem drive
  fifthWheelPosition: 160,
  tareWeight: 19800, // ~9 tonne
  driveAxleCount: 2,
};

// ─── All Presets ─────────────────────────────────────────────────────────────

export const REGIONAL_PRESETS: RegionalPreset[] = [
  {
    id: 'na-48ft',
    region: 'north_america',
    regionLabel: 'North America',
    name: '48-ft Flatbed + Day Cab',
    description: 'US/Canada standard — 80,000 lbs GVW, tandem axle trailer, 96" deck',
    trailer: NA_TRAILER_48,
    tractor: NA_TRACTOR,
  },
  {
    id: 'na-53ft',
    region: 'north_america',
    regionLabel: 'North America',
    name: '53-ft Flatbed + Day Cab',
    description: 'US/Canada long — 80,000 lbs GVW, tandem axle trailer, 102" deck',
    trailer: NA_TRAILER_53,
    tractor: NA_TRACTOR,
  },
  {
    id: 'eu-13m-4x2',
    region: 'europe',
    regionLabel: 'Europe',
    name: '13.6m Flatbed + 4x2 Tractor',
    description: 'EU standard — 40 tonne GVW, tridem trailer, 2.48m deck width',
    trailer: EU_TRAILER_13M,
    tractor: EU_TRACTOR,
  },
  {
    id: 'eu-13m-6x2',
    region: 'europe',
    regionLabel: 'Europe',
    name: '13.6m Flatbed + 6x2 Tractor',
    description: 'EU heavy — 40 tonne GVW, tridem trailer, 3-axle tractor',
    trailer: EU_TRAILER_13M,
    tractor: EU_TRACTOR_6X2,
  },
  {
    id: 'br-13m-t3s3',
    region: 'brazil',
    regionLabel: 'Brazil',
    name: '13m Plataforma + 6x4 (T3S3)',
    description: 'Brazil T3S3 — ~39.5 tonne PBTC, tridem trailer, 2.6m deck',
    trailer: BR_TRAILER_13M,
    tractor: BR_TRACTOR_6X4,
  },
  {
    id: 'au-45ft',
    region: 'australia',
    regionLabel: 'Australia',
    name: '45-ft Flat Top + Prime Mover',
    description: 'Australia GML — 42 tonne, triaxle trailer, 6x4 prime mover',
    trailer: AU_TRAILER_45FT,
    tractor: AU_TRACTOR,
  },
  // ─── Peru (Callao Fleet) ───────────────────────────────────────────────────
  {
    id: 'pe-camion-zn',
    region: 'peru',
    regionLabel: 'Peru',
    name: 'Camión ZN — 6m Liviano',
    description: 'Peru light truck — 6m platform, 6t payload, zona norte (e.g. BWA729, CLY881)',
    trailer: PE_CAMION_ZN,
    tractor: PE_TRACTOR_RIGID,
  },
  {
    id: 'pe-camion-zo',
    region: 'peru',
    regionLabel: 'Peru',
    name: 'Camión ZO — 7m Mediano',
    description: 'Peru medium truck — 7m platform, 9t payload, zona oeste (e.g. APZ939, A1T924)',
    trailer: PE_CAMION_ZO,
    tractor: PE_TRACTOR_RIGID,
  },
  {
    id: 'pe-camion-zb',
    region: 'peru',
    regionLabel: 'Peru',
    name: 'Camión ZB — 9.2m Pesado',
    description: 'Peru heavy truck — 9.2m platform, 16t payload, zona base (e.g. BJD850, CAA787)',
    trailer: PE_CAMION_ZB,
    tractor: PE_TRACTOR_RIGID,
  },
  {
    id: 'pe-camion-grua',
    region: 'peru',
    regionLabel: 'Peru',
    name: 'Camión Grúa — 9m con Grúa',
    description: 'Peru crane truck — 9m platform, 20t payload, self-loading (e.g. CJG718, CJK716)',
    trailer: PE_CAMION_GRUA,
    tractor: PE_TRACTOR_RIGID,
  },
  {
    id: 'pe-trailer-13m',
    region: 'peru',
    regionLabel: 'Peru',
    name: 'Trailer c/Plataforma — 13m',
    description: 'Peru full trailer — 13m platform, 33t payload, T3S3 (e.g. B4U827, ADM761)',
    trailer: PE_TRAILER_13M,
    tractor: PE_TRACTOR_T3S3,
  },
  {
    id: 'pe-trailer-12m',
    region: 'peru',
    regionLabel: 'Peru',
    name: 'Trailer c/Plataforma — 12m',
    description: 'Peru full trailer — 12m platform, 30t payload, T3S3 (e.g. D4C933, BZI779)',
    trailer: PE_TRAILER_12M,
    tractor: PE_TRACTOR_T3S3,
  },
];

export const REGIONS: { id: Region; label: string; flag: string }[] = [
  { id: 'north_america', label: 'North America', flag: '🇺🇸' },
  { id: 'europe', label: 'Europe', flag: '🇪🇺' },
  { id: 'peru', label: 'Peru', flag: '🇵🇪' },
  { id: 'brazil', label: 'Brazil', flag: '🇧🇷' },
  { id: 'australia', label: 'Australia', flag: '🇦🇺' },
  { id: 'custom', label: 'Custom Setup', flag: '⚙️' },
];
