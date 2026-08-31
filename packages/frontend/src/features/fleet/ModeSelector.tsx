// ─── Mode Selector Component ─────────────────────────────────────────────────
// Displays a choice between "Single Truck" and "Fleet Planning" modes at the
// wizard entry point. On selection, updates the fleet store mode and routes
// the user to the appropriate wizard shell.
//
// Requirements: 6.3, 6.4

import { useFleetStore } from './fleet-store';

export interface ModeSelectorProps {
  /** Callback invoked when a mode is selected */
  onSelect: (mode: 'single' | 'fleet') => void;
  /** Optional classname for the container */
  className?: string;
}

export function ModeSelector({ onSelect, className = '' }: ModeSelectorProps) {
  const setMode = useFleetStore((s) => s.setMode);
  const currentMode = useFleetStore((s) => s.mode);

  function handleSelect(mode: 'single' | 'fleet') {
    setMode(mode);
    onSelect(mode);
  }

  return (
    <div className={`flex flex-col items-center gap-8 ${className}`}>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Choose Planning Mode
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Select how you want to plan your load configuration
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Single Truck Mode */}
        <button
          type="button"
          onClick={() => handleSelect('single')}
          aria-pressed={currentMode === 'single'}
          className={`
            flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all
            hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${currentMode === 'single'
              ? 'border-blue-600 bg-blue-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-blue-300'
            }
          `}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 text-3xl">
            🚛
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">Single Truck</h3>
            <p className="mt-1 text-sm text-gray-500">
              Plan a load for one vehicle at a time with full manual control
            </p>
          </div>
        </button>

        {/* Fleet Planning Mode */}
        <button
          type="button"
          onClick={() => handleSelect('fleet')}
          aria-pressed={currentMode === 'fleet'}
          className={`
            flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all
            hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${currentMode === 'fleet'
              ? 'border-blue-600 bg-blue-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-blue-300'
            }
          `}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-3xl">
            🚚
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">Fleet Planning</h3>
            <p className="mt-1 text-sm text-gray-500">
              Upload a fleet manifest and generate plans for multiple vehicles at once
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
