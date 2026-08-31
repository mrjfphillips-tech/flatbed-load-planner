// ─── Equipment Step (Step 1) ─────────────────────────────────────────────────
// Two modes:
//   1. Quick Select — pick a regional preset (one click → ready to proceed)
//   2. Custom Setup — manual trailer/tractor form entry
//
// Syncs equipment store state to wizard store for step progression.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrailerProfileForm, TractorProfileForm, CombinationDisplay, useEquipmentStore } from '../../equipment';
import { useWizardStore } from '../wizard-store';
import { useUnitsStore } from '../units-store';
import { REGIONAL_PRESETS, REGIONS, type Region, type RegionalPreset } from '../../equipment/regional-presets';
import { calculateEquipmentCombination, isPayloadValid } from '@ptv-discovery-coach/shared';

export function EquipmentStep() {
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<RegionalPreset | null>(null);
  const navigate = useNavigate();

  const selectTrailer = useEquipmentStore((s) => s.selectTrailer);
  const selectTractor = useEquipmentStore((s) => s.selectTractor);
  const combination = useEquipmentStore((s) => s.combination);
  const selectedTractor = useEquipmentStore((s) => s.selectedTractor);
  const selectedTrailer = useEquipmentStore((s) => s.selectedTrailer);
  const payloadError = useEquipmentStore((s) => s.payloadError);

  const setEquipment = useWizardStore((s) => s.setEquipment);
  const clearEquipment = useWizardStore((s) => s.clearEquipment);

  // Sync equipment store → wizard store
  useEffect(() => {
    if (combination && selectedTractor && selectedTrailer && !payloadError) {
      setEquipment(selectedTractor, selectedTrailer, combination);
    } else {
      clearEquipment();
    }
  }, [combination, selectedTractor, selectedTrailer, payloadError, setEquipment, clearEquipment]);

  // Handle preset selection — immediately computes combination
  function handlePresetSelect(preset: RegionalPreset) {
    setSelectedPreset(preset);
    selectTrailer(preset.trailer);
    selectTractor(preset.tractor);

    // Auto-set unit system based on region
    const setUnitSystem = useUnitsStore.getState().setUnitSystem;
    if (preset.region === 'north_america') {
      setUnitSystem('imperial');
    } else {
      setUnitSystem('metric');
    }

    // Also directly set on wizard store for immediate progression
    const combo = calculateEquipmentCombination(preset.tractor, preset.trailer);
    if (isPayloadValid(combo)) {
      setEquipment(preset.tractor, preset.trailer, combo);
    }
  }

  // Filter presets by selected region
  const filteredPresets = selectedRegion
    ? REGIONAL_PRESETS.filter((p) => p.region === selectedRegion)
    : REGIONAL_PRESETS;

  if (mode === 'custom') {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Custom Equipment Setup</h2>
            <p className="mt-1 text-sm text-gray-600">
              Manually configure tractor and trailer specifications.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMode('presets')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to presets
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">Trailer</h3>
            <TrailerProfileForm />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">Tractor</h3>
            <TractorProfileForm />
          </div>
        </div>

        <CombinationDisplay />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Select Equipment</h2>
          <p className="mt-1 text-sm text-gray-600">
            Choose a regional preset or set up custom equipment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/fleet')}
            className="text-sm text-green-700 hover:text-green-900 border border-green-200 bg-green-50 px-3 py-1.5 rounded"
          >
            🚚 Fleet Planning
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded"
          >
            ⚙️ Custom Setup
          </button>
        </div>
      </div>

      {/* Region filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedRegion(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedRegion === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Regions
        </button>
        {REGIONS.filter((r) => r.id !== 'custom').map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={() => setSelectedRegion(region.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedRegion === region.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {region.flag} {region.label}
          </button>
        ))}
      </div>

      {/* Preset cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPresets.map((preset) => {
          const isSelected = selectedPreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {preset.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{preset.description}</p>
                </div>
                {isSelected && (
                  <span className="text-blue-600 text-lg">✓</span>
                )}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span>Trailer: {preset.region === 'north_america' || preset.region === 'australia'
                  ? `${preset.trailer.lengthFt}ft / ${preset.trailer.deckWidthIn}"`
                  : `${(preset.trailer.lengthFt * 0.3048).toFixed(1)}m / ${(preset.trailer.deckWidthIn * 0.0254).toFixed(2)}m`
                }</span>
                <span>GVW: {preset.region === 'north_america' || preset.region === 'australia'
                  ? `${(preset.trailer.maxGrossWeight / 1000).toFixed(0)}k lbs`
                  : `${(preset.trailer.maxGrossWeight * 0.000454).toFixed(0)} t`
                }</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Show combination summary when a preset is selected */}
      {selectedPreset && <CombinationDisplay />}
    </div>
  );
}
