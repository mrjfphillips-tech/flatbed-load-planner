// ─── Equipment Configurator Module ───────────────────────────────────────────
// Barrel export for the equipment configuration feature.

export { useEquipmentStore } from './equipment-store';
export type { EquipmentState } from './equipment-store';

export { TrailerProfileForm } from './TrailerProfileForm';
export { TractorProfileForm } from './TractorProfileForm';
export { CombinationDisplay } from './CombinationDisplay';

export {
  TRAILER_48FT,
  TRAILER_53FT,
  TRACTOR_STANDARD,
  TRAILER_TEMPLATES,
  TRACTOR_TEMPLATES,
} from './templates';

export {
  REGIONAL_PRESETS,
  REGIONS,
} from './regional-presets';
export type { Region, RegionalPreset } from './regional-presets';
