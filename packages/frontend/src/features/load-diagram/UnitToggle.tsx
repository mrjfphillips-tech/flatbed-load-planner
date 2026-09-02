// ─── Unit System Toggle ──────────────────────────────────────────────────────
// Feature: load-diagram-generator
// A metric/imperial switch. Changing it only affects display formatting; the
// underlying canonical (mm/kg) data is never mutated.
// _Requirements: 10.1, 10.4_

import type { loadDiagram } from '@ptv-discovery-coach/shared';

type UnitSystem = loadDiagram.UnitSystem;

interface UnitToggleProps {
  value: UnitSystem;
  onChange: (unit: UnitSystem) => void;
  className?: string;
}

const OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (mm / kg)' },
  { value: 'imperial', label: 'Imperial (in / lb)' },
];

export function UnitToggle({ value, onChange, className = '' }: UnitToggleProps) {
  return (
    <div
      className={`inline-flex rounded-md border border-gray-300 bg-white p-0.5 ${className}`}
      role="group"
      aria-label="Unit system"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              active
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
