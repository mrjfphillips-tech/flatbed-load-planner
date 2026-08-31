// ─── Pattern Override Selection ──────────────────────────────────────────────
// Allows the planner to choose an alternative load pattern before generation.
// Displays the auto-detected pattern and provides overrides.

import { useWizardStore } from './wizard-store';
import type { LoadPattern } from '@ptv-discovery-coach/shared';

export interface PatternOverrideSelectProps {
  /** Optional classname for container */
  className?: string;
}

/** Human-readable labels for each load pattern */
const PATTERN_LABELS: Record<LoadPattern, string> = {
  layered: 'Layered — Uniform items stacked in flat layers',
  column_building: 'Column Building — Items stacked vertically in columns',
  row_building: 'Row Building — Items placed side-by-side across deck width',
  long_product: 'Long Product — Beams/bars/pipe placed longitudinally',
  nested: 'Nested — Items nested for stability (channels, angles)',
  customer_zoning: 'Customer Zoning — Deck divided into zones by delivery stop',
  mixed: 'Mixed — Combination of patterns for varied freight',
};

const ALL_PATTERNS: LoadPattern[] = [
  'layered',
  'column_building',
  'row_building',
  'long_product',
  'nested',
  'customer_zoning',
  'mixed',
];

export function PatternOverrideSelect({ className = '' }: PatternOverrideSelectProps) {
  const detectedPattern = useWizardStore((s) => s.detectedPattern);
  const patternOverride = useWizardStore((s) => s.patternOverride);
  const setPatternOverride = useWizardStore((s) => s.setPatternOverride);

  const effectivePattern = patternOverride ?? detectedPattern;

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <h4 className="text-sm font-medium text-gray-900">Load Pattern</h4>
        <p className="text-xs text-gray-500">
          The planning engine auto-detects the best pattern. You can override it below.
        </p>
      </div>

      {/* Detected pattern display */}
      {detectedPattern && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Detected:</span>
          <span className="font-medium text-gray-900">
            {PATTERN_LABELS[detectedPattern]?.split('—')[0]?.trim() ?? detectedPattern}
          </span>
          {patternOverride && patternOverride !== detectedPattern && (
            <span className="text-xs text-amber-600 font-medium">(overridden)</span>
          )}
        </div>
      )}

      {/* Pattern select */}
      <div className="flex items-center gap-2">
        <label htmlFor="pattern-override" className="text-sm text-gray-700">
          Pattern:
        </label>
        <select
          id="pattern-override"
          value={effectivePattern ?? ''}
          onChange={(e) => {
            const value = e.target.value as LoadPattern | '';
            if (value === '' || value === detectedPattern) {
              setPatternOverride(null);
            } else {
              setPatternOverride(value as LoadPattern);
            }
          }}
          className="block w-full max-w-xs px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          aria-label="Select load pattern override"
        >
          <option value="">Auto-detect</option>
          {ALL_PATTERNS.map((pattern) => (
            <option key={pattern} value={pattern}>
              {PATTERN_LABELS[pattern]}
            </option>
          ))}
        </select>

        {patternOverride && (
          <button
            type="button"
            onClick={() => setPatternOverride(null)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Reset to auto
          </button>
        )}
      </div>
    </div>
  );
}
