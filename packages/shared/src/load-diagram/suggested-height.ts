// ─── Suggested Cargo Height Heuristic ────────────────────────────────────────
// Feature: load-diagram-generator (trailer-type aware packing)
//
// For an open trailer (flatbed / curtainsider) there is no physical roof, so a
// "height cap" is a planning judgement, not a hard measurement. This heuristic
// derives a SUGGESTED cargo-height cap from the deck length, width, and max
// payload. It is used only as an advisory flag threshold — never to reject a
// plan — so a stack taller than the suggestion is flagged for review, not
// blocked.
//
// The suggestion is the smallest of three sensible bounds:
//   1. legalCeiling        — a practical/legal cargo-height ceiling above the deck.
//   2. stability bound      — height should stay within a factor of the deck width
//                             (narrow-and-tall loads are the rollover risk).
//   3. weight-density bound — the height at which a typical cargo would hit the
//                             weight limit: maxLoad / (deckArea × cargoDensity).
//
// All lengths in canonical mm, weight in canonical kg. The factors are tunable
// so they can be calibrated to a customer's freight rather than baked in.

/** Tunable inputs for the suggested-height heuristic. */
export interface SuggestedHeightOptions {
  /** Practical/legal cargo-height ceiling above the deck, in mm. Default 2700. */
  legalCeilingMm?: number;
  /** Max height as a multiple of deck width (stability). Default 1.2. */
  stabilityFactor?: number;
  /** Assumed average cargo density in kg per cubic meter. Default 300. */
  cargoDensityKgPerM3?: number;
  /** Never suggest below this many mm (avoids absurdly low caps). Default 500. */
  floorMm?: number;
}

const DEFAULTS: Required<SuggestedHeightOptions> = {
  legalCeilingMm: 2700,
  stabilityFactor: 1.2,
  cargoDensityKgPerM3: 300,
  floorMm: 500,
};

export interface SuggestedHeightResult {
  /** The suggested cargo-height cap, in canonical mm. */
  heightMm: number;
  /** Which bound was binding: 'legal' | 'stability' | 'weight'. */
  boundBy: 'legal' | 'stability' | 'weight';
}

/**
 * Computes a suggested cargo-height cap (mm) for an open trailer from its deck
 * length, width (mm) and max payload (kg). Returns the value and which bound
 * was binding, so the UI can explain the suggestion.
 */
export function suggestedCargoHeight(
  deckLengthMm: number,
  deckWidthMm: number,
  maxLoadKg: number,
  options: SuggestedHeightOptions = {},
): SuggestedHeightResult {
  const { legalCeilingMm, stabilityFactor, cargoDensityKgPerM3, floorMm } = {
    ...DEFAULTS,
    ...options,
  };

  const legal = legalCeilingMm;
  const stability = deckWidthMm * stabilityFactor;

  // Weight-density bound: height at which typical cargo hits the weight limit.
  //   deckArea(m^2) = (L/1000) * (W/1000); volumeAtLimit(m^3) = maxLoad / density;
  //   heightAtLimit(m) = volume / area; convert to mm.
  const deckAreaM2 = (deckLengthMm / 1000) * (deckWidthMm / 1000);
  const weightBoundMm =
    deckAreaM2 > 0 && cargoDensityKgPerM3 > 0
      ? (maxLoadKg / cargoDensityKgPerM3 / deckAreaM2) * 1000
      : Infinity;

  const candidates: { value: number; bound: SuggestedHeightResult['boundBy'] }[] = [
    { value: legal, bound: 'legal' },
    { value: stability, bound: 'stability' },
    { value: weightBoundMm, bound: 'weight' },
  ];

  let best = candidates[0];
  for (const c of candidates) if (c.value < best.value) best = c;

  return {
    heightMm: Math.max(floorMm, Math.round(best.value)),
    boundBy: best.bound,
  };
}
