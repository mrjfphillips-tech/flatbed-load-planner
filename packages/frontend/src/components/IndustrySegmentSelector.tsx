/**
 * IndustrySegmentSelector
 *
 * Shown at session start to identify the customer's industry segment.
 * Drives question filtering and terminology throughout the session.
 */

import React from 'react'
import { INDUSTRY_SEGMENTS, INDUSTRY_SEGMENT_LABELS, type IndustrySegment } from '@ptv-discovery-coach/shared'

const SEGMENT_ICONS: Record<IndustrySegment, string> = {
  ThirdPartyLogistics: '🏭',
  BuildingSupply: '🏗️',
  ManufacturingDistribution: '⚙️',
  RetailEcommerce: '🛒',
  FoodBeverageFMCG: '🥤',
  HealthcarePharma: '💊',
  FieldServices: '🔧',
  Other: '📦',
}

export interface IndustrySegmentSelectorProps {
  selected?: IndustrySegment
  onSelect: (segment: IndustrySegment) => void
  onSkip?: () => void
}

export function IndustrySegmentSelector({
  selected,
  onSelect,
  onSkip,
}: IndustrySegmentSelectorProps): React.ReactElement {
  return (
    <div className="space-y-3" data-testid="industry-segment-selector">
      <div>
        <p className="text-sm font-semibold text-gray-800">What industry is this customer in?</p>
        <p className="text-xs text-gray-500 mt-0.5">
          This tailors the questions and terminology for the rest of the session.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {INDUSTRY_SEGMENTS.map((segment) => (
          <button
            key={segment}
            onClick={() => onSelect(segment)}
            data-testid={`segment-${segment}`}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
              selected === segment
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <span className="text-base">{SEGMENT_ICONS[segment]}</span>
            <span className="text-xs font-medium leading-tight">
              {INDUSTRY_SEGMENT_LABELS[segment]}
            </span>
          </button>
        ))}
      </div>

      {onSkip && (
        <button
          onClick={onSkip}
          className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
          data-testid="skip-segment"
        >
          Skip — use general questions
        </button>
      )}
    </div>
  )
}
