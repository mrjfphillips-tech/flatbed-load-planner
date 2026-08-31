// ─── Drawing Renderer Module ─────────────────────────────────────────────────
// SVG-based load plan visualization with multiple views.

export { DrawingRenderer } from './DrawingRenderer';
export { TopView } from './views/TopView';
export { SideView } from './views/SideView';
export { EndView } from './views/EndView';
export { SecurementOverlay } from './components/SecurementOverlay';
export { DunnageOverlay } from './components/DunnageOverlay';
export { useViewBox } from './hooks/useViewBox';
export { useItemHighlight } from './hooks/useItemHighlight';
export { getStopColor, getProductTypeColor, getWeightColor } from './utils/colors';
export type { DrawingViewType, DrawingOptions, ViewProps } from './types';
