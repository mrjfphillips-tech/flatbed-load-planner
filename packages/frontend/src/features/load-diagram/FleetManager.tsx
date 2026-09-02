// ─── Fleet Manager ───────────────────────────────────────────────────────────
// Feature: load-diagram-generator (Customer Fleet)
//
// Create and manage named fleets of vehicles. A fleet can be built two ways:
//   1. Upload an Excel file of vehicles (metric or imperial columns).
//   2. Create an empty named fleet and add vehicles manually via a form.
// Dimensions/weights are entered in the selected display unit and converted to
// canonical mm/kg before sending to the API.
// _Requirements: Customer Fleet (upload + manual builder, dual units)_

import { useEffect, useState } from 'react';
import { loadDiagram } from '@ptv-discovery-coach/shared';
import { useLoadDiagramStore } from './load-diagram-store';
import { UnitToggle } from './UnitToggle';
import {
  listFleets,
  getFleet,
  createFleet,
  uploadFleet,
  addFleetVehicle,
  deleteFleetVehicle,
  fleetTemplateUrl,
  type FleetSummary,
} from './api';

type UnitSystem = loadDiagram.UnitSystem;
type FleetVehicle = loadDiagram.FleetVehicle;

const {
  formatLength,
  formatWeight,
  lengthToCanonical,
  weightToCanonical,
  lengthUnitLabel,
  weightUnitLabel,
} = loadDiagram;

interface FleetManagerProps {
  /** Called when the user chooses a vehicle to plan a load against. */
  onSelectVehicle?: (vehicle: FleetVehicle & { id: string }, fleetName: string) => void;
}

export function FleetManager({ onSelectVehicle }: FleetManagerProps) {
  const { displayUnitSystem, setDisplayUnitSystem } = useLoadDiagramStore();

  const [fleets, setFleets] = useState<FleetSummary[]>([]);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<(FleetVehicle & { id: string })[]>([]);
  const [selectedFleetName, setSelectedFleetName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshFleets() {
    try {
      setFleets(await listFleets());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void refreshFleets();
  }, []);

  async function openFleet(id: string) {
    setError(null);
    setSelectedFleetId(id);
    try {
      const fleet = await getFleet(id);
      setVehicles(fleet.vehicles as (FleetVehicle & { id: string })[]);
      setSelectedFleetName(fleet.name);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Customer Fleet</h2>
        <UnitToggle value={displayUnitSystem} onChange={setDisplayUnitSystem} />
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <CreateFleetPanel unit={displayUnitSystem} busy={busy} setBusy={setBusy} setError={setError} onCreated={refreshFleets} />
        <FleetListPanel fleets={fleets} selectedFleetId={selectedFleetId} onOpen={openFleet} />
      </div>

      {selectedFleetId && (
        <VehiclePanel
          fleetId={selectedFleetId}
          fleetName={selectedFleetName}
          vehicles={vehicles}
          unit={displayUnitSystem}
          onChanged={() => openFleet(selectedFleetId)}
          onSelectVehicle={onSelectVehicle}
          setError={setError}
        />
      )}
    </div>
  );
}

// ─── Create fleet (upload or empty) ──────────────────────────────────────────

function CreateFleetPanel({
  unit,
  busy,
  setBusy,
  setError,
  onCreated,
}: {
  unit: UnitSystem;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (m: string | null) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('Customer Fleet');
  const [file, setFile] = useState<File | null>(null);

  async function handleUpload() {
    if (!name.trim() || !file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadFleet(name.trim(), file);
      setFile(null);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateEmpty() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createFleet(name.trim(), unit);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Create a fleet</h3>

      <label className="block text-sm">
        <span className="text-gray-700">Fleet name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Customer Fleet"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500">Template:</span>
        <a href={fleetTemplateUrl('metric')} className="text-blue-600 hover:underline" download>Metric</a>
        <a href={fleetTemplateUrl('imperial')} className="text-blue-600 hover:underline" download>Imperial</a>
      </div>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700"
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !name.trim() || !file}
          onClick={() => void handleUpload()}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          Upload fleet
        </button>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void handleCreateEmpty()}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Create empty (add manually)
        </button>
      </div>
    </div>
  );
}

// ─── Fleet list ──────────────────────────────────────────────────────────────

function FleetListPanel({
  fleets,
  selectedFleetId,
  onOpen,
}: {
  fleets: FleetSummary[];
  selectedFleetId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">Fleets</h3>
      {fleets.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No fleets yet. Create one to get started.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {fleets.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onOpen(f.id)}
                className={`flex w-full items-center justify-between py-2 text-left text-sm ${
                  selectedFleetId === f.id ? 'font-semibold text-blue-700' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>{f.name}</span>
                <span className="text-xs text-gray-400">
                  {f.vehicleCount} vehicle{f.vehicleCount === 1 ? '' : 's'} · {f.displayUnitSystem}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Vehicles + manual builder ───────────────────────────────────────────────

const EMPTY_FORM = {
  vehicleId: '',
  vehicleName: '',
  vehicleAccount: '',
  licensePlate: '',
  maxWeight: '',
  platformLength: '',
  platformWidth: '',
  platformHeight: '',
  costPerStop: '',
  fixedCost: '',
  costPerHour: '',
  costPerKm: '',
};

function VehiclePanel({
  fleetId,
  fleetName,
  vehicles,
  unit,
  onChanged,
  onSelectVehicle,
  setError,
}: {
  fleetId: string;
  fleetName: string;
  vehicles: (FleetVehicle & { id: string })[];
  unit: UnitSystem;
  onChanged: () => void;
  onSelectVehicle?: (vehicle: FleetVehicle & { id: string }, fleetName: string) => void;
  setError: (m: string | null) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [adding, setAdding] = useState(false);

  const len = lengthUnitLabel(unit);
  const wt = weightUnitLabel(unit);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAdd() {
    const requiredOk =
      form.vehicleId.trim() &&
      form.vehicleName.trim() &&
      Number(form.maxWeight) > 0 &&
      Number(form.platformLength) > 0 &&
      Number(form.platformWidth) > 0;
    if (!requiredOk) {
      setError('Vehicle ID, name, max weight, platform length and width are required.');
      return;
    }
    setAdding(true);
    setError(null);
    const num = (s: string): number | undefined => {
      const n = Number(s);
      return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
    };
    try {
      // Convert entered dimensions/weights from the display unit to canonical.
      await addFleetVehicle(fleetId, {
        vehicleId: form.vehicleId.trim(),
        vehicleName: form.vehicleName.trim(),
        vehicleAccount: form.vehicleAccount.trim() || undefined,
        licensePlate: form.licensePlate.trim() || undefined,
        maxWeight: weightToCanonical(Number(form.maxWeight), unit),
        platformLength: lengthToCanonical(Number(form.platformLength), unit),
        platformWidth: lengthToCanonical(Number(form.platformWidth), unit),
        platformHeight:
          num(form.platformHeight) != null
            ? lengthToCanonical(Number(form.platformHeight), unit)
            : undefined,
        costPerStop: num(form.costPerStop),
        fixedCost: num(form.fixedCost),
        costPerHour: num(form.costPerHour),
        costPerKm: num(form.costPerKm),
      });
      setForm({ ...EMPTY_FORM });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteFleetVehicle(id);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {fleetName} — vehicles ({vehicles.length})
      </h3>

      {/* Vehicle list */}
      {vehicles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3">Vehicle</th>
                <th className="py-1 pr-3">Plate</th>
                <th className="py-1 pr-3">Max wt</th>
                <th className="py-1 pr-3">Platform (L × W)</th>
                <th className="py-1 pr-3" />
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {vehicles.map((v) => (
                <tr key={v.id} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3">
                    {v.vehicleName}
                    <span className="text-gray-400"> ({v.vehicleId})</span>
                  </td>
                  <td className="py-1.5 pr-3">{v.licensePlate ?? '—'}</td>
                  <td className="py-1.5 pr-3">{formatWeight(v.maxWeight, unit)}</td>
                  <td className="py-1.5 pr-3">
                    {formatLength(v.platformLength, unit)} × {formatLength(v.platformWidth, unit)}
                  </td>
                  <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                    {onSelectVehicle && (
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(v, fleetName)}
                        className="mr-2 text-blue-600 hover:underline"
                      >
                        Plan load
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(v.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual builder */}
      <details className="rounded border border-gray-200">
        <summary className="cursor-pointer bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
          Add a vehicle manually
        </summary>
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          <Field label="Vehicle ID *" value={form.vehicleId} onChange={(v) => set('vehicleId', v)} />
          <Field label="Vehicle name *" value={form.vehicleName} onChange={(v) => set('vehicleName', v)} />
          <Field label="Vehicle account" value={form.vehicleAccount} onChange={(v) => set('vehicleAccount', v)} />
          <Field label="License plate" value={form.licensePlate} onChange={(v) => set('licensePlate', v)} />
          <Field label={`Max weight (${wt}) *`} value={form.maxWeight} onChange={(v) => set('maxWeight', v)} numeric />
          <Field label={`Platform length (${len}) *`} value={form.platformLength} onChange={(v) => set('platformLength', v)} numeric />
          <Field label={`Platform width (${len}) *`} value={form.platformWidth} onChange={(v) => set('platformWidth', v)} numeric />
          <Field label={`Platform height (${len})`} value={form.platformHeight} onChange={(v) => set('platformHeight', v)} numeric />
          <Field label="Cost per stop" value={form.costPerStop} onChange={(v) => set('costPerStop', v)} numeric />
          <Field label="Fixed cost" value={form.fixedCost} onChange={(v) => set('fixedCost', v)} numeric />
          <Field label="Cost per hour" value={form.costPerHour} onChange={(v) => set('costPerHour', v)} numeric />
          <Field label="Cost per km" value={form.costPerKm} onChange={(v) => set('costPerKm', v)} numeric />
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={adding}
              onClick={() => void handleAdd()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {adding ? 'Adding…' : 'Add vehicle'}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">{label}</span>
      <input
        type={numeric ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
