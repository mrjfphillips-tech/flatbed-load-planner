// ─── Orders File Upload Step (Step 2) ────────────────────────────────────────
// Reuses the existing import pipeline (smartMapper + validation) for orders
// parsing. After parsing, runs delivery number matching against fleet vehicle IDs.
// Displays matched orders grouped by vehicle and unmatched orders with manual
// assignment interface. Allows custom extraction rules.
//
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.2, 8.3, 8.4

import { useCallback, useRef, useState } from 'react';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useFleetStore } from '../fleet-store';
import { autoMapColumns, applyMapping } from '../../import/smartMapper';
import type { FieldMapping } from '../../import/smartMapper';
import { validateRow } from '../../import/validation';
import { groupOrdersByDeliveryNumber, matchDeliveryNumbers } from '../delivery-matcher';
import type { MatchResult } from '../delivery-matcher';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';
import type { UnmatchedOrder, ExtractionRule } from '../types';
import type { ImportFieldError } from '../../import/types';

// ─── State Phases ────────────────────────────────────────────────────────────

type Phase =
  | 'idle'        // No file uploaded yet
  | 'mapping'     // File parsed; reviewing column mapping
  | 'matching'    // Orders validated; showing delivery number match results
  | 'done';       // Matching complete, results stored

// ─── Component ───────────────────────────────────────────────────────────────

export function OrdersFileUploadStep() {
  // Fleet store state & actions
  const vehicleRecords = useFleetStore((s) => s.vehicleRecords);
  const ordersByDeliveryNumber = useFleetStore((s) => s.ordersByDeliveryNumber);
  const unmatchedOrders = useFleetStore((s) => s.unmatchedOrders);
  const deliveryNumberMatchStrategy = useFleetStore((s) => s.deliveryNumberMatchStrategy);
  const customExtractionRule = useFleetStore((s) => s.customExtractionRule);

  const setOrdersByDeliveryNumber = useFleetStore((s) => s.setOrdersByDeliveryNumber);
  const setUnmatchedOrders = useFleetStore((s) => s.setUnmatchedOrders);
  const setDeliveryNumberMatchStrategy = useFleetStore((s) => s.setDeliveryNumberMatchStrategy);
  const setCustomExtractionRule = useFleetStore((s) => s.setCustomExtractionRule);

  // Local UI state
  const [phase, setPhase] = useState<Phase>(
    ordersByDeliveryNumber.size > 0 ? 'done' : 'idle'
  );
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Mapping state
  const [pendingMapping, setPendingMapping] = useState<{
    mappings: FieldMapping[];
    rawRows: Record<string, unknown>[];
    sourceColumns: string[];
  } | null>(null);

  // Parsed orders (after mapping confirmed)
  const [parsedOrders, setParsedOrders] = useState<SteelOrderLineItem[]>([]);
  const [parseErrors, setParseErrors] = useState<ImportFieldError[]>([]);

  // Match results
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [groupedOrders, setGroupedOrders] = useState<Map<string, SteelOrderLineItem[]>>(
    new Map()
  );

  // Custom extraction rule editor state
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [ruleType, setRuleType] = useState<ExtractionRule['type']>(
    customExtractionRule?.type ?? 'delimiter'
  );
  const [ruleDelimiter, setRuleDelimiter] = useState(customExtractionRule?.delimiter ?? '-');
  const [ruleFieldIndex, setRuleFieldIndex] = useState(customExtractionRule?.fieldIndex ?? 0);
  const [ruleStart, setRuleStart] = useState(customExtractionRule?.startPosition ?? 0);
  const [ruleEnd, setRuleEnd] = useState(customExtractionRule?.endPosition ?? 6);
  const [rulePattern, setRulePattern] = useState(customExtractionRule?.pattern ?? '');
  const [ruleCaptureGroup, setRuleCaptureGroup] = useState(
    customExtractionRule?.captureGroup ?? 1
  );

  // Manual assignment state
  const [manualAssignments, setManualAssignments] = useState<Map<string, string>>(new Map());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File Processing ─────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setErrorMessage(null);
    setPendingMapping(null);
    setParsedOrders([]);
    setParseErrors([]);
    setMatchResult(null);
    setGroupedOrders(new Map());

    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      let rawRows: Record<string, unknown>[] = [];
      let sourceColumns: string[] = [];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        // Detect multi-sheet manifest format:
        // If workbook has multiple sheets, treat each sheet as a per-truck manifest
        // Sheet name = license plate, orders table starts after the header rows
        const sheetNames = workbook.SheetNames.filter(
          (name) => name.toLowerCase() !== 'index' && name.trim() !== ''
        );

        if (workbook.SheetNames.length > 1 && sheetNames.length > 1) {
          // ─── Multi-sheet manifest parsing ──────────────────────────────
          // Each sheet: sheet name is the license plate
          // The orders table has columns: Order Number, Customer Name, etc.
          // Skip header metadata rows (License Plate, Vehicle ID, etc.)
          for (const sheetName of sheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            // Parse all rows from the sheet
            void XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
              defval: '',
              raw: false,
            });

            // Find the orders table: look for a row that has "Order Number" as a value
            // The manifest format has metadata rows first, then a header row, then data
            const sheetJson = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
              header: 1,
              defval: '',
              raw: false,
            });

            // Find the row index where the orders table header is
            let headerRowIdx = -1;
            for (let i = 0; i < sheetJson.length; i++) {
              const row = sheetJson[i] as unknown[];
              if (row && row.some((cell) => String(cell).trim() === 'Order Number')) {
                headerRowIdx = i;
                break;
              }
            }

            if (headerRowIdx === -1) continue; // No orders table found in this sheet

            // Extract header names from the header row
            const headerRow = sheetJson[headerRowIdx] as unknown[];
            const headers = headerRow.map((h) => String(h).trim()).filter((h) => h !== '');

            // Extract data rows after the header
            for (let i = headerRowIdx + 1; i < sheetJson.length; i++) {
              const dataRow = sheetJson[i] as unknown[];
              if (!dataRow || dataRow.every((cell) => String(cell).trim() === '')) continue;

              // Skip non-order rows (e.g., "Driver Name:", "Signature:")
              const firstCell = String(dataRow[0] ?? '').trim();
              if (!firstCell || firstCell.startsWith('Driver') || firstCell.startsWith('Signature') ||
                  firstCell.startsWith('Date') || firstCell.startsWith('Checked')) continue;

              const rowObj: Record<string, unknown> = {};
              for (let col = 0; col < headers.length; col++) {
                if (headers[col]) {
                  rowObj[headers[col]] = dataRow[col] ?? '';
                }
              }

              // Tag each row with the license plate from the sheet name
              // This is used later for vehicle matching
              rowObj['__licensePlate'] = sheetName.trim().toUpperCase();

              rawRows.push(rowObj);
            }
          }

          if (rawRows.length > 0) {
            sourceColumns = Object.keys(rawRows[0]).filter((k) => !k.startsWith('__'));
          }
        } else {
          // ─── Single-sheet parsing (original behavior) ──────────────────
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

      // Auto-map columns using the orders smartMapper
      const mappings = autoMapColumns(sourceColumns);
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

  // ─── Drag & Drop ────────────────────────────────────────────────────────

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

  // ─── Confirm Mapping & Validate Orders ───────────────────────────────────

  const handleConfirmMapping = useCallback(() => {
    if (!pendingMapping) return;

    const { mappings, rawRows } = pendingMapping;

    // Apply mapping with UOM conversion (reuses smartMapper logic)
    const mappedRows = applyMapping(rawRows, mappings);

    // Validate each row through the existing validation pipeline
    const validItems: SteelOrderLineItem[] = [];
    const errors: ImportFieldError[] = [];

    // Regex to extract license plate from notes: "vehicle BMO800" or "vehicle T4G831"
    const vehicleFromNotesRegex = /vehicle\s+([A-Z0-9]+)/i;

    for (let i = 0; i < mappedRows.length; i++) {
      const rowIndex = i + 2; // 1-based, +1 for header
      const { item, errors: rowErrors } = validateRow(mappedRows[i], rowIndex);

      if (item) {
        // Priority 1: Use __licensePlate tag from multi-sheet XLSX parsing
        const sheetPlate = rawRows[i]?.['__licensePlate'];
        if (sheetPlate && String(sheetPlate).trim() !== '') {
          item.deliveryNumber = String(sheetPlate).trim().toUpperCase();
        }

        // Priority 2: Use the deliveryNumber from a mapped column
        if (!item.deliveryNumber || item.deliveryNumber === '') {
          const dn = mappedRows[i]['deliveryNumber'];
          if (dn !== undefined && dn !== null && dn !== '') {
            item.deliveryNumber = String(dn).trim();
          }
        }

        // Priority 3: Extract license plate from notes/specialNotes
        if (!item.deliveryNumber || item.deliveryNumber === '') {
          const notes = item.specialNotes || '';
          const match = vehicleFromNotesRegex.exec(notes);
          if (match && match[1]) {
            item.deliveryNumber = match[1].toUpperCase();
          }
        }

        validItems.push(item);
      }
      errors.push(...rowErrors);
    }

    setParsedOrders(validItems);
    setParseErrors(errors);

    // Run delivery number matching — use 'exact' strategy matching against license plates
    runMatching(validItems, deliveryNumberMatchStrategy, customExtractionRule);
    setPhase('matching');
  }, [pendingMapping, deliveryNumberMatchStrategy, customExtractionRule]);

  // ─── Run Delivery Number Matching ────────────────────────────────────────

  const runMatching = useCallback(
    (
      orders: SteelOrderLineItem[],
      strategy: 'exact' | 'pattern' | 'custom',
      rule?: ExtractionRule
    ) => {
      // Group orders by delivery number (which may be a license plate extracted from notes)
      const grouped = groupOrdersByDeliveryNumber(orders);
      setGroupedOrders(grouped);

      // Get all unique delivery numbers (exclude empty ones)
      const deliveryNumbers = [...grouped.keys()].filter((dn) => dn !== '');

      // Match against BOTH vehicle IDs and license plates for flexibility
      // Build a combined lookup: license plates and vehicle IDs
      const licensePlates = vehicleRecords.map((v) => v.licensePlate);
      const vehicleIds = vehicleRecords.map((v) => v.vehicleId);
      const allIdentifiers = [...new Set([...licensePlates, ...vehicleIds])];

      // Match delivery numbers to vehicle identifiers (license plate or vehicle ID)
      const result = matchDeliveryNumbers(deliveryNumbers, allIdentifiers, strategy, rule);
      setMatchResult(result);

      // Build unmatched orders list
      const unmatched: UnmatchedOrder[] = [];
      for (const dn of result.unmatched) {
        const ordersForDn = grouped.get(dn) ?? [];
        for (const order of ordersForDn) {
          unmatched.push({
            orderNumber: order.orderNumber,
            deliveryNumber: dn,
            reason: 'no_vehicle_match',
          });
        }
      }
      for (const dn of result.ambiguous) {
        const ordersForDn = grouped.get(dn) ?? [];
        for (const order of ordersForDn) {
          unmatched.push({
            orderNumber: order.orderNumber,
            deliveryNumber: dn,
            reason: 'ambiguous_match',
          });
        }
      }

      // Also flag orders with empty delivery number
      const emptyDnOrders = grouped.get('') ?? [];
      for (const order of emptyDnOrders) {
        unmatched.push({
          orderNumber: order.orderNumber,
          deliveryNumber: '',
          reason: 'no_vehicle_match',
        });
      }

      setUnmatchedOrders(unmatched);
    },
    [vehicleRecords, setUnmatchedOrders]
  );

  // ─── Strategy Change Handler ─────────────────────────────────────────────

  const handleStrategyChange = useCallback(
    (newStrategy: 'exact' | 'pattern' | 'custom') => {
      setDeliveryNumberMatchStrategy(newStrategy);
      if (parsedOrders.length > 0) {
        const rule = newStrategy === 'custom' ? buildExtractionRule() : undefined;
        runMatching(parsedOrders, newStrategy, rule);
      }
    },
    [parsedOrders, runMatching, setDeliveryNumberMatchStrategy]
  );

  // ─── Build Extraction Rule from Editor State ─────────────────────────────

  const buildExtractionRule = useCallback((): ExtractionRule => {
    switch (ruleType) {
      case 'delimiter':
        return { type: 'delimiter', delimiter: ruleDelimiter, fieldIndex: ruleFieldIndex };
      case 'substring':
        return { type: 'substring', startPosition: ruleStart, endPosition: ruleEnd };
      case 'regex':
        return { type: 'regex', pattern: rulePattern, captureGroup: ruleCaptureGroup };
    }
  }, [ruleType, ruleDelimiter, ruleFieldIndex, ruleStart, ruleEnd, rulePattern, ruleCaptureGroup]);

  // ─── Apply Custom Rule ───────────────────────────────────────────────────

  const handleApplyCustomRule = useCallback(() => {
    const rule = buildExtractionRule();
    setCustomExtractionRule(rule);
    setDeliveryNumberMatchStrategy('custom');
    if (parsedOrders.length > 0) {
      runMatching(parsedOrders, 'custom', rule);
    }
  }, [
    buildExtractionRule,
    parsedOrders,
    runMatching,
    setCustomExtractionRule,
    setDeliveryNumberMatchStrategy,
  ]);

  // ─── Manual Assignment Handler ───────────────────────────────────────────

  const handleManualAssign = useCallback(
    (deliveryNumber: string, vehicleId: string) => {
      const updated = new Map(manualAssignments);
      if (vehicleId) {
        updated.set(deliveryNumber, vehicleId);
      } else {
        updated.delete(deliveryNumber);
      }
      setManualAssignments(updated);
    },
    [manualAssignments]
  );

  // ─── Confirm Matching & Store Results ────────────────────────────────────

  const handleConfirmMatching = useCallback(() => {
    if (!matchResult) return;

    // Build a lookup: license plate → vehicle ID, and vehicleId → vehicleId (identity)
    const identifierToVehicleId = new Map<string, string>();
    for (const v of vehicleRecords) {
      identifierToVehicleId.set(v.licensePlate, v.vehicleId);
      identifierToVehicleId.set(v.vehicleId, v.vehicleId);
    }

    // Build final orders-by-vehicleId map including manual assignments
    const finalOrders = new Map<string, SteelOrderLineItem[]>();

    // Add automatically matched orders (resolve identifier → vehicleId)
    for (const [dn, matchedIdentifier] of matchResult.matched.entries()) {
      const vehicleId = identifierToVehicleId.get(matchedIdentifier) ?? matchedIdentifier;
      const orders = groupedOrders.get(dn) ?? [];
      const existing = finalOrders.get(vehicleId) ?? [];
      finalOrders.set(vehicleId, [...existing, ...orders]);
    }

    // Add manually assigned orders
    for (const [dn, vehicleId] of manualAssignments.entries()) {
      if (vehicleId) {
        const orders = groupedOrders.get(dn) ?? [];
        const existing = finalOrders.get(vehicleId) ?? [];
        finalOrders.set(vehicleId, [...existing, ...orders]);
      }
    }

    setOrdersByDeliveryNumber(finalOrders);

    // Recalculate unmatched (those not in manual assignments)
    const remainingUnmatched: UnmatchedOrder[] = unmatchedOrders.filter(
      (u) => !manualAssignments.has(u.deliveryNumber)
    );
    setUnmatchedOrders(remainingUnmatched);

    setPhase('done');
  }, [
    matchResult,
    groupedOrders,
    manualAssignments,
    unmatchedOrders,
    setOrdersByDeliveryNumber,
    setUnmatchedOrders,
  ]);

  // ─── Reset / Re-upload ───────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPhase('idle');
    setPendingMapping(null);
    setParsedOrders([]);
    setParseErrors([]);
    setMatchResult(null);
    setGroupedOrders(new Map());
    setFileName(null);
    setErrorMessage(null);
    setManualAssignments(new Map());
    setOrdersByDeliveryNumber(new Map());
    setUnmatchedOrders([]);
  }, [setOrdersByDeliveryNumber, setUnmatchedOrders]);

  // ─── Computed Values ─────────────────────────────────────────────────────

  const matchedCount = matchResult?.matched.size ?? 0;
  const unmatchedCount = (matchResult?.unmatched.length ?? 0) + (matchResult?.ambiguous.length ?? 0);
  const totalDeliveryNumbers = matchedCount + unmatchedCount;

  // Get unique delivery numbers from unmatched/ambiguous that need manual assignment
  const needsManualAssignment = [
    ...(matchResult?.unmatched ?? []),
    ...(matchResult?.ambiguous ?? []),
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Upload Orders File</h2>
        <p className="mt-1 text-sm text-gray-600">
          Upload the orders file (CSV or XLSX). Each order's Delivery Number will be matched
          to a vehicle in the fleet.
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
          aria-label="Upload orders file. Click or drag and drop a CSV or XLSX file."
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="text-4xl mb-3">📦</div>
          <p className="text-sm text-gray-700 font-medium mb-1">
            {isDragOver ? 'Drop your orders file here' : 'Drag & drop your orders file here'}
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
              Ensure the <strong>Delivery Number</strong> column is mapped correctly
              for fleet vehicle matching.
            </p>
          </div>

          {/* Mapping grid — show key fields including deliveryNumber */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-auto">
            {pendingMapping.mappings.map((m, idx) => (
              <div key={m.targetField} className="flex items-center gap-2 text-xs">
                <span className="w-36 font-medium text-gray-900">
                  {m.label}
                  {m.required && <span className="text-red-500 ml-0.5">*</span>}
                  {m.targetField === 'deliveryNumber' && (
                    <span className="text-blue-600 ml-0.5">⚡</span>
                  )}
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
                      : m.required
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-white'
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
              </div>
            ))}
          </div>

          {/* Delivery number mapping warning */}
          {!pendingMapping.mappings.find((m) => m.targetField === 'deliveryNumber')?.sourceColumn && (
            <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
              ⚠️ <strong>Delivery Number</strong> column is not mapped. Orders cannot be matched
              to vehicles without this field.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleConfirmMapping}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Confirm & Match
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

      {/* Phase: Matching — Delivery number match results */}
      {phase === 'matching' && matchResult && (
        <div className="space-y-5">
          {/* Parse summary */}
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Orders Parsed Successfully
            </h3>
            <p className="text-xs text-blue-700">
              {parsedOrders.length} valid order{parsedOrders.length !== 1 ? 's' : ''} from "{fileName}"
              {parseErrors.length > 0 && ` (${parseErrors.length} row error${parseErrors.length !== 1 ? 's' : ''} skipped)`}
            </p>
          </div>

          {/* Match strategy selector */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Delivery Number Matching Strategy
            </h3>
            <div className="flex gap-4">
              {(['exact', 'pattern', 'custom'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="match-strategy"
                    value={s}
                    checked={deliveryNumberMatchStrategy === s}
                    onChange={() => handleStrategyChange(s)}
                    className="text-blue-600"
                  />
                  <span className="capitalize font-medium text-gray-700">
                    {s === 'exact' ? 'Exact Match' : s === 'pattern' ? 'Pattern (Substring)' : 'Custom Rule'}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {deliveryNumberMatchStrategy === 'exact' && 'Delivery number must exactly equal a vehicle ID.'}
              {deliveryNumberMatchStrategy === 'pattern' && 'Vehicle ID appears as a substring within the delivery number.'}
              {deliveryNumberMatchStrategy === 'custom' && 'Extract vehicle ID from delivery number using a custom rule.'}
            </p>
          </div>

          {/* Custom extraction rule editor */}
          {(deliveryNumberMatchStrategy === 'custom' || showRuleEditor) && (
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-purple-900">
                  Custom Extraction Rule
                </h4>
                {deliveryNumberMatchStrategy !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => setShowRuleEditor(false)}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    Close
                  </button>
                )}
              </div>

              {/* Rule type selector */}
              <div className="flex gap-3">
                {(['delimiter', 'substring', 'regex'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="rule-type"
                      value={t}
                      checked={ruleType === t}
                      onChange={() => setRuleType(t)}
                      className="text-purple-600"
                    />
                    <span className="capitalize text-gray-700">{t}</span>
                  </label>
                ))}
              </div>

              {/* Rule-specific fields */}
              {ruleType === 'delimiter' && (
                <div className="flex gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Delimiter</label>
                    <input
                      type="text"
                      value={ruleDelimiter}
                      onChange={(e) => setRuleDelimiter(e.target.value)}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Field Index (0-based)</label>
                    <input
                      type="number"
                      value={ruleFieldIndex}
                      onChange={(e) => setRuleFieldIndex(Number(e.target.value))}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                      min={0}
                    />
                  </div>
                </div>
              )}

              {ruleType === 'substring' && (
                <div className="flex gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Position</label>
                    <input
                      type="number"
                      value={ruleStart}
                      onChange={(e) => setRuleStart(Number(e.target.value))}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Position</label>
                    <input
                      type="number"
                      value={ruleEnd}
                      onChange={(e) => setRuleEnd(Number(e.target.value))}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                      min={1}
                    />
                  </div>
                </div>
              )}

              {ruleType === 'regex' && (
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Regex Pattern</label>
                    <input
                      type="text"
                      value={rulePattern}
                      onChange={(e) => setRulePattern(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                      placeholder="e.g., ^(\w+)-.*"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Capture Group</label>
                    <input
                      type="number"
                      value={ruleCaptureGroup}
                      onChange={(e) => setRuleCaptureGroup(Number(e.target.value))}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                      min={1}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyCustomRule}
                className="px-3 py-1.5 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Apply Rule
              </button>
            </div>
          )}

          {/* Match summary */}
          <div className="p-4 rounded-lg border border-gray-200 space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">
              Match Results
            </h3>
            <div className="flex gap-6 text-xs">
              <div>
                <span className="text-green-700 font-medium">{matchedCount}</span>
                <span className="text-gray-500 ml-1">matched</span>
              </div>
              <div>
                <span className="text-red-700 font-medium">{unmatchedCount}</span>
                <span className="text-gray-500 ml-1">unmatched</span>
              </div>
              <div>
                <span className="text-gray-700 font-medium">{totalDeliveryNumbers}</span>
                <span className="text-gray-500 ml-1">total delivery numbers</span>
              </div>
            </div>
          </div>

          {/* Matched orders grouped by vehicle */}
          {matchedCount > 0 && (
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <div className="bg-green-50 px-3 py-2 border-b border-green-200">
                <span className="text-sm font-medium text-green-800">
                  Matched Orders by Vehicle ({matchedCount} delivery numbers)
                </span>
              </div>
              <div className="max-h-48 overflow-auto divide-y divide-gray-100">
                {vehicleRecords
                  .filter((v) => {
                    // Show vehicles that have matched orders
                    for (const [, vehicleId] of matchResult.matched.entries()) {
                      if (vehicleId === v.vehicleId) return true;
                    }
                    return false;
                  })
                  .map((vehicle) => {
                    // Get delivery numbers matched to this vehicle
                    const dns = [...matchResult.matched.entries()]
                      .filter(([, vid]) => vid === vehicle.vehicleId)
                      .map(([dn]) => dn);
                    const orderCount = dns.reduce(
                      (sum, dn) => sum + (groupedOrders.get(dn)?.length ?? 0),
                      0
                    );
                    return (
                      <div key={vehicle.vehicleId} className="px-3 py-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium text-gray-900">{vehicle.vehicleId}</span>
                          <span className="text-gray-500 ml-2">{vehicle.licensePlate}</span>
                        </div>
                        <div className="text-gray-600">
                          {dns.length} delivery number{dns.length !== 1 ? 's' : ''} · {orderCount} order{orderCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Unmatched orders — manual assignment interface */}
          {needsManualAssignment.length > 0 && (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <div className="bg-red-50 px-3 py-2 border-b border-red-200 flex items-center justify-between">
                <span className="text-sm font-medium text-red-800">
                  Unmatched Orders ({needsManualAssignment.length} delivery numbers)
                </span>
                {deliveryNumberMatchStrategy !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => setShowRuleEditor(true)}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                  >
                    Try custom rule
                  </button>
                )}
              </div>
              <div className="max-h-56 overflow-auto divide-y divide-gray-100">
                {needsManualAssignment.map((dn) => {
                  const orderCount = groupedOrders.get(dn)?.length ?? 0;
                  const isAmbiguous = matchResult.ambiguous.includes(dn);
                  return (
                    <div key={dn} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900 font-mono">{dn || '(empty)'}</span>
                        <span className="text-gray-500 ml-2">
                          {orderCount} order{orderCount !== 1 ? 's' : ''}
                        </span>
                        {isAmbiguous && (
                          <span className="ml-2 text-amber-600 font-medium">ambiguous</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="sr-only" htmlFor={`assign-${dn}`}>
                          Assign to vehicle
                        </label>
                        <select
                          id={`assign-${dn}`}
                          value={manualAssignments.get(dn) ?? ''}
                          onChange={(e) => handleManualAssign(dn, e.target.value)}
                          className="rounded border border-gray-300 text-xs py-1 px-2 min-w-[140px]"
                        >
                          <option value="">— Assign vehicle —</option>
                          {vehicleRecords.map((v) => (
                            <option key={v.vehicleId} value={v.vehicleId}>
                              {v.vehicleId} ({v.licensePlate})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Parse errors (collapsible) */}
          {parseErrors.length > 0 && (
            <details className="border border-amber-200 rounded-lg p-3">
              <summary className="text-sm font-medium text-amber-800 cursor-pointer">
                Validation Errors ({parseErrors.length})
              </summary>
              <div className="mt-2 max-h-32 overflow-auto space-y-1">
                {parseErrors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    Row {err.row}, field "{err.field}": {err.message}
                  </p>
                ))}
              </div>
            </details>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleConfirmMatching}
              disabled={matchedCount === 0 && manualAssignments.size === 0}
              className={`
                px-4 py-2 text-sm font-medium rounded-md transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${matchedCount > 0 || manualAssignments.size > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-300 text-white cursor-not-allowed'
                }
              `}
            >
              Confirm Matching
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
            >
              Re-upload
            </button>
          </div>
        </div>
      )}

      {/* Phase: Done — Summary of stored results */}
      {phase === 'done' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <h3 className="text-sm font-semibold text-green-800 mb-1">
              Orders matched and ready
            </h3>
            <p className="text-xs text-green-700">
              {ordersByDeliveryNumber.size} vehicle{ordersByDeliveryNumber.size !== 1 ? 's' : ''} have assigned orders.
              {unmatchedOrders.length > 0 && (
                <span className="text-amber-700 ml-1">
                  {unmatchedOrders.length} order{unmatchedOrders.length !== 1 ? 's' : ''} remain unmatched.
                </span>
              )}
            </p>
          </div>

          {/* Summary table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                Vehicle Order Assignments
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Re-upload
              </button>
            </div>
            <div className="max-h-48 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Vehicle ID</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Plate</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Orders</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Total Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicleRecords
                    .filter((v) => ordersByDeliveryNumber.has(v.vehicleId))
                    .map((v) => {
                      const orders = ordersByDeliveryNumber.get(v.vehicleId) ?? [];
                      const totalWeight = orders.reduce((sum, o) => sum + o.totalLineWeight, 0);
                      return (
                        <tr key={v.vehicleId}>
                          <td className="px-3 py-1.5 text-gray-900 font-medium">{v.vehicleId}</td>
                          <td className="px-3 py-1.5 text-gray-700">{v.licensePlate}</td>
                          <td className="px-3 py-1.5 text-right text-gray-900">{orders.length}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700">
                            {totalWeight.toLocaleString()} lbs
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
