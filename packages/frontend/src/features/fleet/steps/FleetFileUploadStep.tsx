// ─── Fleet File Upload Step (Step 1) ─────────────────────────────────────────
// File upload (CSV/XLSX) with smart column mapping, manual mapping fallback,
// and fleet file validation. Stores validated vehicle records in the fleet store.
//
// Also supports "one-file" manifest format: a multi-sheet XLSX where each sheet
// is a per-truck manifest with vehicle header + orders table. When detected,
// vehicles and orders are extracted simultaneously and Step 2 is pre-populated.
//
// Requirements: 1.1, 1.3, 1.5, 7.1, 7.2, 7.3

import { useCallback, useRef, useState } from 'react';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useFleetStore } from '../fleet-store';
import { autoMapFleetColumns } from '../fleet-smart-mapper';
import { parseFleetFile } from '../fleet-parser';
import { isManifestFormat, parseManifestWorkbook } from '../manifest-parser';
import type { FleetParseResult } from '../fleet-parser';
import type { FieldMapping } from '../../import/smartMapper';
import type { FleetFileValidationError, VehicleRecord } from '../types';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';

// ─── State Phases ────────────────────────────────────────────────────────────

type Phase =
  | 'idle'        // No file uploaded yet
  | 'mapping'     // File parsed; reviewing column mapping
  | 'validated';  // Mapping confirmed; showing parse results

// ─── Component ───────────────────────────────────────────────────────────────

export function FleetFileUploadStep() {
  // Fleet store actions
  const setVehicleRecords = useFleetStore((s) => s.setVehicleRecords);
  const setFleetFileErrors = useFleetStore((s) => s.setFleetFileErrors);
  const setFleetFieldMappings = useFleetStore((s) => s.setFleetFieldMappings);
  const setOrdersByDeliveryNumber = useFleetStore((s) => s.setOrdersByDeliveryNumber);
  const vehicleRecords = useFleetStore((s) => s.vehicleRecords);
  const fleetFileErrors = useFleetStore((s) => s.fleetFileErrors);

  // Local UI state
  const [phase, setPhase] = useState<Phase>(vehicleRecords.length > 0 ? 'validated' : 'idle');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [manifestInfo, setManifestInfo] = useState<string | null>(null);

  // Mapping state
  const [pendingMapping, setPendingMapping] = useState<{
    mappings: FieldMapping[];
    rawRows: Record<string, unknown>[];
    sourceColumns: string[];
  } | null>(null);

  // Parse result state (after mapping confirmed)
  const [parseResult, setParseResult] = useState<FleetParseResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File Processing ─────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setErrorMessage(null);
    setPendingMapping(null);
    setParseResult(null);
    setManifestInfo(null);

    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      let rawRows: Record<string, unknown>[] = [];
      let sourceColumns: string[] = [];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        // ─── Detect manifest format (multi-sheet with per-truck headers) ─
        if (isManifestFormat(workbook)) {
          const manifest = parseManifestWorkbook(workbook);

          if (manifest.vehicles.length === 0) {
            setErrorMessage('Manifest file detected but no valid vehicle sheets found.');
            setIsUploading(false);
            return;
          }

          // Store vehicles directly (skip column mapping — already parsed)
          setVehicleRecords(manifest.vehicles);
          setFleetFileErrors([]);
          setFleetFieldMappings([]);

          // If orders were also extracted, pre-populate Step 2
          if (manifest.orderRows.length > 0) {
            // Group orders by license plate (already tagged with __licensePlate)
            const ordersByPlate = new Map<string, SteelOrderLineItem[]>();
            for (const row of manifest.orderRows) {
              const plate = String(row['__licensePlate'] ?? '').toUpperCase();
              if (!plate) continue;

              // Find the vehicle with this license plate to get the vehicleId
              const vehicle = manifest.vehicles.find(
                (v) => v.licensePlate.toUpperCase() === plate
              );
              const key = vehicle?.vehicleId ?? plate;

              // Build a minimal SteelOrderLineItem from the row
              // Support both Format A columns (Order Number, Customer Name...)
              // and Format B columns (Seq, Location, SAP Delivery, Material Code, Description, Weight...)
              const orderNumber = String(row['Order Number'] ?? row['SAP Delivery'] ?? '');
              const customerName = String(row['Customer Name'] ?? row['Location'] ?? '');
              const deliveryStop = Number(row['Delivery Stop'] ?? row['Seq']) || 1;
              const totalWeight = Number(row['Total Weight'] ?? row['Weight (kg)']) || 0;
              const description = String(row['Description'] ?? row['Product Type'] ?? 'unknown');
              const notes = String(row['Notes'] ?? row['Special Instructions'] ?? '');
              const stackingLayer = String(row['Stacking Layer'] ?? '');

              const item: SteelOrderLineItem = {
                orderNumber,
                customerName,
                deliveryStop,
                productType: String(row['Product Type'] ?? 'unknown') as any,
                quantity: Number(row['Quantity']) || 1,
                pieceWeight: totalWeight,
                dimensions: { length: 240, width: 4, height: 4 },
                totalLineWeight: totalWeight,
                handlingMethod: String(row['Handling Method'] ?? 'forklift') as any,
                stackPermission: String(row['Stack Permission'] ?? 'yes') as any,
                maxStackHeight: Number(row['Max Stack Height']) || 48,
                maxStackWeight: 50000,
                orientationRequirement: String(row['Orientation'] ?? 'longitudinal') as any,
                dunnageRequired: String(row['Dunnage Required'] ?? '').toLowerCase() === 'yes',
                specialNotes: [description, notes, stackingLayer].filter(Boolean).join(' | '),
                deliveryNumber: plate,
              };

              const existing = ordersByPlate.get(key) ?? [];
              existing.push(item);
              ordersByPlate.set(key, existing);
            }

            setOrdersByDeliveryNumber(ordersByPlate);
            setManifestInfo(
              `Loaded ${manifest.vehicles.length} vehicles and ${manifest.orderRows.length} orders from manifest (orders pre-matched by sheet).`
            );
          } else {
            setManifestInfo(
              `Loaded ${manifest.vehicles.length} vehicles from manifest. Upload orders in Step 2.`
            );
          }

          setFileName(file.name);
          setPhase('validated');
          setIsUploading(false);
          return;
        }

        // ─── Standard fleet file (single sheet with vehicle list) ─────────
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setErrorMessage('The uploaded file contains no sheets.');
          setIsUploading(false);
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        if (rawRows.length > 0) {
          sourceColumns = Object.keys(rawRows[0]);
        }
      } else {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });
        rawRows = parsed.data as Record<string, unknown>[];
        sourceColumns = parsed.meta.fields ?? [];
      }

      if (rawRows.length === 0) {
        setErrorMessage('File is empty or has no data rows.');
        setIsUploading(false);
        return;
      }

      // Auto-map columns
      const mappings = autoMapFleetColumns(sourceColumns);
      setFileName(file.name);
      setPendingMapping({ mappings, rawRows, sourceColumns });
      setPhase('mapping');
    } catch (err) {
      setErrorMessage(
        `Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ─── File Input Handler ──────────────────────────────────────────────────

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  // ─── Drag & Drop Handlers ───────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      // Validate file type
      const validExts = ['.csv', '.xlsx', '.xls'];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validExts.includes(ext)) {
        setErrorMessage('Invalid file type. Please upload a CSV or XLSX file.');
        return;
      }

      await processFile(file);
    },
    [processFile]
  );

  // ─── Mapping Update ──────────────────────────────────────────────────────

  const handleUpdateMapping = useCallback(
    (index: number, newSourceCol: string | null) => {
      if (!pendingMapping) return;
      const updated = [...pendingMapping.mappings];
      updated[index] = {
        ...updated[index],
        sourceColumn: newSourceCol,
        confidence: newSourceCol ? 0.9 : 0,
      };
      setPendingMapping({ ...pendingMapping, mappings: updated });
    },
    [pendingMapping]
  );

  // ─── Confirm Mapping & Parse ─────────────────────────────────────────────

  const handleConfirmMapping = useCallback(() => {
    if (!pendingMapping) return;

    const { mappings, rawRows } = pendingMapping;

    // Run fleet parser with confirmed mappings
    const result = parseFleetFile(rawRows, mappings);
    setParseResult(result);

    // Update fleet store
    setVehicleRecords(result.records);
    setFleetFileErrors(result.errors);
    setFleetFieldMappings(mappings);

    setPhase('validated');
  }, [pendingMapping, setVehicleRecords, setFleetFileErrors, setFleetFieldMappings]);

  // ─── Reset / Re-upload ───────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPhase('idle');
    setPendingMapping(null);
    setParseResult(null);
    setFileName(null);
    setErrorMessage(null);
    setVehicleRecords([]);
    setFleetFileErrors([]);
    setFleetFieldMappings([]);
  }, [setVehicleRecords, setFleetFileErrors, setFleetFieldMappings]);

  // ─── Computed ────────────────────────────────────────────────────────────

  const unmappedRequired =
    pendingMapping?.mappings.filter((m) => m.required && !m.sourceColumn) ?? [];
  const hasUnmappedRequired = unmappedRequired.length > 0;

  const validCount = parseResult?.records.length ?? vehicleRecords.length;
  const errorCount = parseResult?.errors.length ?? fleetFileErrors.length;
  const duplicateCount = parseResult?.duplicates.length ?? 0;
  const hasZeroValid = phase === 'validated' && validCount === 0;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Upload Fleet File</h2>
        <p className="mt-1 text-sm text-gray-600">
          Upload a CSV or XLSX file describing today's available vehicles and their specifications.
        </p>
      </div>

      {/* Phase: Idle — Drop Zone */}
      {phase === 'idle' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer
            ${isDragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400'
            }
          `}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload fleet file. Click or drag and drop a CSV or XLSX file."
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="text-4xl mb-3">🚚</div>
          <p className="text-sm text-gray-700 font-medium mb-1">
            {isDragOver ? 'Drop your fleet file here' : 'Drag & drop your fleet file here'}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            or click to browse — supports CSV and XLSX
          </p>
          <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            {isUploading ? 'Reading file...' : 'Choose File'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            disabled={isUploading}
            className="hidden"
            aria-hidden="true"
          />
          <p className="text-xs text-gray-500 mt-4">
            Expected columns: Vehicle ID, Vehicle Type, License Plate, Weight Capacity,
            Platform Length, Platform Width, Condition Code, Status (Active/Idle)
          </p>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 rounded text-sm bg-red-50 text-red-800 border border-red-200">
          {errorMessage}
        </div>
      )}

      {/* Phase: Mapping — Column mapping review */}
      {phase === 'mapping' && pendingMapping && (
        <div className="border border-blue-200 rounded-lg p-5 bg-blue-50 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-blue-900">
              Column Mapping — Review & Confirm
            </h3>
            <p className="text-xs text-blue-700 mt-1">
              Detected {pendingMapping.rawRows.length} rows in "{fileName}".
              {hasUnmappedRequired && (
                <span className="text-red-600 font-medium ml-1">
                  {unmappedRequired.length} required field(s) not mapped — please assign them below.
                </span>
              )}
            </p>
          </div>

          {/* Mapping grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingMapping.mappings.map((m, idx) => (
              <div key={m.targetField} className="flex items-center gap-2 text-xs">
                <span className="w-36 font-medium text-gray-900">
                  {m.label}
                  <span className="text-red-500 ml-0.5">*</span>
                </span>
                <span className="text-gray-400">←</span>
                <select
                  value={m.sourceColumn ?? ''}
                  onChange={(e) => handleUpdateMapping(idx, e.target.value || null)}
                  aria-label={`Map source column to ${m.label}`}
                  className={`
                    flex-1 rounded border text-xs py-1.5 px-2
                    ${m.sourceColumn
                      ? m.confidence >= 0.8
                        ? 'border-green-300 bg-green-50'
                        : 'border-amber-300 bg-amber-50'
                      : 'border-red-300 bg-red-50'
                    }
                  `}
                >
                  <option value="">— Not mapped —</option>
                  {pendingMapping.sourceColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                {m.sourceColumn && m.confidence >= 0.8 && (
                  <span className="text-green-600" aria-label="High confidence match">✓</span>
                )}
                {m.sourceColumn && m.confidence > 0 && m.confidence < 0.8 && (
                  <span className="text-amber-500" aria-label="Low confidence match">?</span>
                )}
                {!m.sourceColumn && (
                  <span className="text-red-500" aria-label="Unmapped required field">!</span>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleConfirmMapping}
              disabled={hasUnmappedRequired}
              className={`
                px-4 py-2 text-sm font-medium rounded-md transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${hasUnmappedRequired
                  ? 'bg-blue-300 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              Confirm & Validate
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phase: Validated — Results summary */}
      {phase === 'validated' && (
        <div className="space-y-4">
          {/* Success / zero-valid banner */}
          {hasZeroValid ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <h3 className="text-sm font-semibold text-red-800 mb-1">
                No valid vehicles found
              </h3>
              <p className="text-xs text-red-700">
                All rows in the fleet file had validation errors. Please fix the file and re-upload.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <h3 className="text-sm font-semibold text-green-800 mb-1">
                {manifestInfo ? 'Manifest loaded successfully' : 'Fleet file loaded successfully'}
              </h3>
              <p className="text-xs text-green-700">
                {manifestInfo || (
                  <>
                    {validCount} vehicle{validCount !== 1 ? 's' : ''} ready for planning
                    {errorCount > 0 && ` (${errorCount} row error${errorCount !== 1 ? 's' : ''} skipped)`}
                    {duplicateCount > 0 && ` · ${duplicateCount} duplicate ID${duplicateCount !== 1 ? 's' : ''} detected`}
                  </>
                )}
              </p>
            </div>
          )}

          {/* Vehicle summary table */}
          {validCount > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  Vehicles ({validCount})
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Re-upload
                </button>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Vehicle ID</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Plate</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Weight (t)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">L × W (m)</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Code</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(parseResult?.records ?? vehicleRecords).map((v: VehicleRecord) => (
                      <tr key={v.vehicleId}>
                        <td className="px-3 py-1.5 text-gray-900 font-medium">{v.vehicleId}</td>
                        <td className="px-3 py-1.5 text-gray-700">{v.vehicleType}</td>
                        <td className="px-3 py-1.5 text-gray-700">{v.licensePlate}</td>
                        <td className="px-3 py-1.5 text-right text-gray-900">{v.weightCapacity}</td>
                        <td className="px-3 py-1.5 text-right text-gray-700">
                          {v.platformLength} × {v.platformWidth}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                            {v.conditionCode}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                            v.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {v.status === 'active' ? 'Active' : 'Idle'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Validation errors */}
          {errorCount > 0 && (
            <div className="border border-red-200 rounded-lg p-4 max-h-48 overflow-auto">
              <h4 className="text-sm font-semibold text-red-800 mb-2">
                Validation Errors ({errorCount})
              </h4>
              {(parseResult?.errors ?? fleetFileErrors).map(
                (err: FleetFileValidationError, i: number) => (
                  <p key={i} className="text-xs text-red-700">
                    Row {err.row}, field "{err.field}": {err.message}
                  </p>
                )
              )}
            </div>
          )}

          {/* Duplicate warnings */}
          {duplicateCount > 0 && parseResult?.duplicates && (
            <div className="border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-amber-800 mb-2">
                Duplicate Vehicle IDs ({duplicateCount})
              </h4>
              {parseResult.duplicates.map((dup, i) => (
                <p key={i} className="text-xs text-amber-700">
                  Vehicle ID "{dup.vehicleId}" appears in rows: {dup.rows.join(', ')}
                </p>
              ))}
            </div>
          )}

          {/* Zero valid rows — block progression notice */}
          {hasZeroValid && (
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <strong>Cannot proceed:</strong> Upload a valid fleet file with at least one valid
              vehicle row to continue.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
