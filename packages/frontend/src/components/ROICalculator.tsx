/**
 * ROICalculator
 *
 * Live ROI calculator populated during discovery sessions.
 * Captures the 7 value streams from the PTV Global Discovery Playbook:
 * distance reduction, planning labor, overtime, fuel/idle, digital POD,
 * credit reduction, and CSR labor savings.
 *
 * Supports miles/km toggle and multi-currency.
 */

import React, { useState, useMemo } from 'react'
import type { IndustrySegment } from '@ptv-discovery-coach/shared'

const INDUSTRY_SEGMENT_LABELS: Record<string, string> = {
  ThirdPartyLogistics: '3PL / Third-Party Logistics',
  BuildingSupply: 'Building Supply / Construction Materials',
  ManufacturingDistribution: 'Manufacturing & Distribution',
  RetailEcommerce: 'Retail & E-commerce',
  FoodBeverageFMCG: 'Food & Beverage / FMCG',
  HealthcarePharma: 'Healthcare & Pharma',
  FieldServices: 'Field Services',
  Other: 'Other',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ROIInputs {
  // Operational baseline
  vehiclesOperatingDaily: number
  averageDistancePerRoute: number
  operatingDaysPerYear: number
  averageStopsPerRoute: number
  numberOfPlanners: number
  planningHoursPerDayPerPlanner: number
  overtimeHoursPerDriverPerWeek: number
  idleHoursPerVehiclePerDay: number
  inboundStatusCallsPerDay: number
  // Cost structure
  fullyLoadedCostPerDistanceUnit: number
  plannerFullyLoadedHourlyRate: number
  driverOvertimeHourlyRate: number
  fuelCostPerGallon: number
  annualCreditWriteoffs: number
  grossMarginPct: number
  // PTV pricing
  ptvPricePerVehiclePerMonth: number
  contractTermMonths: number
}

type DistanceUnit = 'miles' | 'km'
type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD'

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$'
}

const DEFAULT_INPUTS: ROIInputs = {
  vehiclesOperatingDaily: 0,
  averageDistancePerRoute: 0,
  operatingDaysPerYear: 220,
  averageStopsPerRoute: 0,
  numberOfPlanners: 0,
  planningHoursPerDayPerPlanner: 0,
  overtimeHoursPerDriverPerWeek: 0,
  idleHoursPerVehiclePerDay: 0,
  inboundStatusCallsPerDay: 0,
  fullyLoadedCostPerDistanceUnit: 0,
  plannerFullyLoadedHourlyRate: 35,
  driverOvertimeHourlyRate: 30,
  fuelCostPerGallon: 3.80,
  annualCreditWriteoffs: 0,
  grossMarginPct: 5,
  ptvPricePerVehiclePerMonth: 100,
  contractTermMonths: 36,
}

export interface ROICalculatorProps {
  industrySegment?: IndustrySegment
  onROIUpdated?: (summary: ROISummary) => void
}

export interface ROISummary {
  annualDistanceSpend: number
  totalAnnualSavings: number
  annualSubscriptionCost: number
  netAnnualBenefit: number
  roi: number
  paybackMonths: number
  revenueEquivalent: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ROICalculator({ industrySegment, onROIUpdated }: ROICalculatorProps): React.ReactElement {
  const [inputs, setInputs] = useState<ROIInputs>(DEFAULT_INPUTS)
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [savingsPct, setSavingsPct] = useState<0.08 | 0.10 | 0.15>(0.10)
  const [expanded, setExpanded] = useState(false)

  const sym = CURRENCY_SYMBOLS[currency]
  const distLabel = distanceUnit === 'miles' ? 'mi' : 'km'

  const calc = useMemo(() => {
    const annualDistance = inputs.vehiclesOperatingDaily * inputs.averageDistancePerRoute * inputs.operatingDaysPerYear
    const annualDistanceSpend = annualDistance * inputs.fullyLoadedCostPerDistanceUnit

    // Value stream 1: distance reduction
    const distanceSavings = annualDistanceSpend * savingsPct

    // Value stream 2: planning labor
    const planningHoursSaved = Math.max(0, inputs.planningHoursPerDayPerPlanner - 0.25)
    const planningLaborSavings = inputs.numberOfPlanners * planningHoursSaved * inputs.plannerFullyLoadedHourlyRate * inputs.operatingDaysPerYear

    // Value stream 3: overtime reduction (25% reduction)
    const overtimeSavings = inputs.vehiclesOperatingDaily * inputs.overtimeHoursPerDriverPerWeek * 0.25 * inputs.driverOvertimeHourlyRate * 52

    // Value stream 4: fuel/idle savings
    const fuelSavings = inputs.vehiclesOperatingDaily * inputs.idleHoursPerVehiclePerDay * inputs.fuelCostPerGallon * inputs.operatingDaysPerYear

    // Value stream 5: digital POD ($0.75/stop)
    const totalAnnualStops = inputs.vehiclesOperatingDaily * inputs.averageStopsPerRoute * inputs.operatingDaysPerYear
    const podSavings = totalAnnualStops * 0.75

    // Value stream 6: credit reduction (60% of write-offs)
    const creditSavings = inputs.annualCreditWriteoffs * 0.60

    // Value stream 7: CSR labor (5 min/call, $25/hr CSR, 75% call reduction)
    const csrSavings = inputs.inboundStatusCallsPerDay * (5 / 60) * 25 * 0.75 * inputs.operatingDaysPerYear

    const totalAnnualSavings = distanceSavings + planningLaborSavings + overtimeSavings + fuelSavings + podSavings + creditSavings + csrSavings
    const annualSubscriptionCost = inputs.ptvPricePerVehiclePerMonth * inputs.vehiclesOperatingDaily * 12
    const netAnnualBenefit = totalAnnualSavings - annualSubscriptionCost
    const roi = annualSubscriptionCost > 0 ? (netAnnualBenefit / annualSubscriptionCost) * 100 : 0
    const paybackMonths = totalAnnualSavings > 0 ? annualSubscriptionCost / (totalAnnualSavings / 12) : 0
    const revenueEquivalent = inputs.grossMarginPct > 0 ? totalAnnualSavings / (inputs.grossMarginPct / 100) : 0

    const summary: ROISummary = { annualDistanceSpend, totalAnnualSavings, annualSubscriptionCost, netAnnualBenefit, roi, paybackMonths, revenueEquivalent }
    onROIUpdated?.(summary)

    return { annualDistance, annualDistanceSpend, distanceSavings, planningLaborSavings, overtimeSavings, fuelSavings, podSavings, creditSavings, csrSavings, totalAnnualSavings, annualSubscriptionCost, netAnnualBenefit, roi, paybackMonths, revenueEquivalent }
  }, [inputs, savingsPct, onROIUpdated])

  const fmt = (n: number) => n > 0 ? `${sym}${Math.round(n).toLocaleString()}` : '—'
  const fmtPct = (n: number) => n > 0 ? `${Math.round(n)}%` : '—'

  const set = (key: keyof ROIInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))

  const hasBaseline = inputs.vehiclesOperatingDaily > 0 && inputs.averageDistancePerRoute > 0 && inputs.fullyLoadedCostPerDistanceUnit > 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="roi-calculator">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">ROI Calculator</span>
          {industrySegment && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              {INDUSTRY_SEGMENT_LABELS[industrySegment]}
            </span>
          )}
          {hasBaseline && calc.totalAnnualSavings > 0 && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">
              {fmt(calc.totalAnnualSavings)}/yr
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 space-y-4">

          {/* Unit toggles */}
          <div className="flex gap-3 pt-3">
            <div className="flex gap-1">
              {(['miles', 'km'] as DistanceUnit[]).map(u => (
                <button key={u} onClick={() => setDistanceUnit(u)}
                  className={`px-2 py-1 rounded text-xs font-medium border ${distanceUnit === u ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                  {u}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as Currency[]).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`px-2 py-1 rounded text-xs font-medium border ${currency === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Savings scenario */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Savings Scenario</p>
            <div className="flex gap-2">
              {([
                { pct: 0.08, label: '8% Conservative' },
                { pct: 0.10, label: '10% Moderate' },
                { pct: 0.15, label: '15% Aggressive' },
              ] as const).map(s => (
                <button key={s.pct} onClick={() => setSavingsPct(s.pct)}
                  className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium ${savingsPct === s.pct ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Operational baseline inputs */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Operational Baseline</p>
            <div className="grid grid-cols-2 gap-2">
              <InputField label="Vehicles/day" value={inputs.vehiclesOperatingDaily} onChange={set('vehiclesOperatingDaily')} unit="vehicles" />
              <InputField label={`Avg distance/route`} value={inputs.averageDistancePerRoute} onChange={set('averageDistancePerRoute')} unit={distLabel} />
              <InputField label="Operating days/yr" value={inputs.operatingDaysPerYear} onChange={set('operatingDaysPerYear')} unit="days" />
              <InputField label="Stops/route" value={inputs.averageStopsPerRoute} onChange={set('averageStopsPerRoute')} unit="stops" />
              <InputField label={`Cost/${distLabel}`} value={inputs.fullyLoadedCostPerDistanceUnit} onChange={set('fullyLoadedCostPerDistanceUnit')} unit={`${sym}/${distLabel}`} />
              <InputField label="Planners" value={inputs.numberOfPlanners} onChange={set('numberOfPlanners')} unit="people" />
              <InputField label="Planning hrs/day" value={inputs.planningHoursPerDayPerPlanner} onChange={set('planningHoursPerDayPerPlanner')} unit="hrs" />
              <InputField label="OT hrs/driver/wk" value={inputs.overtimeHoursPerDriverPerWeek} onChange={set('overtimeHoursPerDriverPerWeek')} unit="hrs" />
              <InputField label="Idle hrs/vehicle/day" value={inputs.idleHoursPerVehiclePerDay} onChange={set('idleHoursPerVehiclePerDay')} unit="hrs" />
              <InputField label="Status calls/day" value={inputs.inboundStatusCallsPerDay} onChange={set('inboundStatusCallsPerDay')} unit="calls" />
              <InputField label="Annual credits" value={inputs.annualCreditWriteoffs} onChange={set('annualCreditWriteoffs')} unit={sym} />
              <InputField label="Gross margin %" value={inputs.grossMarginPct} onChange={set('grossMarginPct')} unit="%" />
            </div>
          </div>

          {/* Value streams breakdown */}
          {hasBaseline && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Annual Savings by Value Stream</p>
              <div className="space-y-1">
                <ValueRow label={`Distance reduction (${Math.round(savingsPct * 100)}%)`} value={calc.distanceSavings} sym={sym} />
                <ValueRow label="Planning labor savings" value={calc.planningLaborSavings} sym={sym} />
                <ValueRow label="Overtime reduction (25%)" value={calc.overtimeSavings} sym={sym} />
                <ValueRow label="Fuel / idle reduction" value={calc.fuelSavings} sym={sym} />
                <ValueRow label="Digital POD ($0.75/stop)" value={calc.podSavings} sym={sym} />
                <ValueRow label="Credit write-off reduction" value={calc.creditSavings} sym={sym} />
                <ValueRow label="CSR status call reduction" value={calc.csrSavings} sym={sym} />
                <div className="border-t border-gray-200 pt-1 mt-1">
                  <ValueRow label="Total Annual Savings" value={calc.totalAnnualSavings} sym={sym} bold />
                  <ValueRow label="Annual Subscription Cost" value={-calc.annualSubscriptionCost} sym={sym} />
                  <ValueRow label="Net Annual Benefit" value={calc.netAnnualBenefit} sym={sym} bold />
                </div>
              </div>
            </div>
          )}

          {/* ROI summary */}
          {hasBaseline && calc.totalAnnualSavings > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-blue-700">{fmtPct(calc.roi)}</div>
                  <div className="text-xs text-blue-600">ROI</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-700">{calc.paybackMonths > 0 ? `${Math.round(calc.paybackMonths)}mo` : '—'}</div>
                  <div className="text-xs text-blue-600">Payback</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-700">{fmt(calc.totalAnnualSavings)}</div>
                  <div className="text-xs text-blue-600">Annual savings</div>
                </div>
              </div>
              {inputs.grossMarginPct > 0 && calc.revenueEquivalent > 0 && (
                <p className="text-xs text-blue-700 text-center border-t border-blue-200 pt-2">
                  Revenue equivalent: <strong>{fmt(calc.revenueEquivalent)}</strong> at {inputs.grossMarginPct}% margin
                </p>
              )}
            </div>
          )}

          {!hasBaseline && (
            <p className="text-xs text-gray-400 text-center py-2">
              Enter vehicles, distance per route, and cost per {distLabel} to see ROI
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InputField({ label, value, onChange, unit }: {
  label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; unit: string
}): React.ReactElement {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-0.5">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          value={value || ''}
          onChange={onChange}
          placeholder="0"
          className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
        />
        <span className="text-xs text-gray-400 whitespace-nowrap">{unit}</span>
      </div>
    </div>
  )
}

function ValueRow({ label, value, sym, bold }: {
  label: string; value: number; sym: string; bold?: boolean
}): React.ReactElement {
  const isNeg = value < 0
  const display = value !== 0 ? `${isNeg ? '-' : ''}${sym}${Math.abs(Math.round(value)).toLocaleString()}` : '—'
  return (
    <div className={`flex items-center justify-between text-xs ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span className={value > 0 ? 'text-green-700' : value < 0 ? 'text-red-600' : 'text-gray-400'}>{display}</span>
    </div>
  )
}
