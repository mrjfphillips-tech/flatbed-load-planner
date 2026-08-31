// ─── Standard Flatbed Trailer & Tractor Templates ────────────────────────────
// Pre-loaded configurations for common equipment.

import type { TrailerProfile, TractorProfile } from '@ptv-discovery-coach/shared';

/** Standard 48-foot flatbed trailer template */
export const TRAILER_48FT: TrailerProfile = {
  id: 'template-48ft',
  name: '48-ft Standard Flatbed',
  lengthFt: 48,
  deckWidthIn: 96,
  deckHeightIn: 60,
  maxGrossWeight: 80000,
  tareWeight: 12500,
  axleCount: 2,
  axlePositions: [432, 480], // inches from kingpin
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

/** Standard 53-foot flatbed trailer template */
export const TRAILER_53FT: TrailerProfile = {
  id: 'template-53ft',
  name: '53-ft Standard Flatbed',
  lengthFt: 53,
  deckWidthIn: 102,
  deckHeightIn: 60,
  maxGrossWeight: 80000,
  tareWeight: 13500,
  axleCount: 2,
  axlePositions: [492, 540], // inches from kingpin
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

/** Standard tractor template (tandem drive) */
export const TRACTOR_STANDARD: TractorProfile = {
  id: 'template-standard-tractor',
  name: 'Standard Day Cab (Tandem)',
  steerAxleRating: 12000,
  driveAxleRating: 34000,
  fifthWheelPosition: 180,
  tareWeight: 17500,
  driveAxleCount: 2,
};

/** All available trailer templates */
export const TRAILER_TEMPLATES: TrailerProfile[] = [TRAILER_48FT, TRAILER_53FT];

/** All available tractor templates */
export const TRACTOR_TEMPLATES: TractorProfile[] = [TRACTOR_STANDARD];
