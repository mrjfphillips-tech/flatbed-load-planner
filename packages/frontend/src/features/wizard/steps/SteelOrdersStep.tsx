// ─── Steel Orders Step (Step 2) ──────────────────────────────────────────────
// File upload (CSV/XLSX) with smart column mapping and manual entry.

import { useCallback, useState } from 'react';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ManualEntryForm,
  autoMapColumns,
  applyMapping,
  downloadTemplate,
  validateRow,
  detectUOMFromMappings,
} from '../../import';
import type { ImportFieldError, FieldMapping } from '../../import';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';
import { useWizardStore } from '../wizard-store';
import { useUnitsStore } from '../units-store';

export function SteelOrdersStep() {
  const orderItems = useWizardStore((s) => s.orderItems);
  const importErrors = useWizardStore((s) => s.importErrors);
  const setOrderItems = useWizardStore((s) => s.setOrderItems);
  const setImportErrors = useWizardStore((s) => s.setImportErrors);
  const unitSystem = useUnitsStore((s) => s.unitSystem);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'manual'>('upload');
  const [pendingMapping, setPendingMapping] = useState<{
    mappings: FieldMapping[];
    rawRows: Record<string, unknown>[];
    sourceColumns: string[];
    fileName: string;
  } | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);
    setPendingMapping(null);

    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      let rawRows: Record<string, unknown>[] = [];
      let sourceColumns: string[] = [];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        if (rawRows.length > 0) {
          sourceColumns = Object.keys(rawRows[0]);
        }
      } else {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
        rawRows = parsed.data as Record<string, unknown>[];
        sourceColumns = parsed.meta.fields ?? [];
      }

      if (rawRows.length === 0) {
        setUploadMessage('File is empty or has no data rows.');
        setIsUploading(false);
        e.target.value = '';
        return;
      }

      // Auto-map columns
      const mappings = autoMapColumns(sourceColumns);
      setPendingMapping({ mappings, rawRows, sourceColumns, fileName: file.name });
      setUploadMessage(`Detected ${rawRows.length} rows in "${file.name}". Review the column mapping below.`);
    } catch (err) {
      setUploadMessage(`Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  }, []);

  const handleConfirmMapping = useCallback(() => {
    if (!pendingMapping) return;

    const { mappings, rawRows } = pendingMapping;

    // Pass fallback units based on the selected unit system (metric → mm/kg, imperial → in/lbs)
    const mappedRows = applyMapping(rawRows, mappings, {
      fallbackLengthUnit: unitSystem === 'metric' ? 'mm' : 'in',
      fallbackWeightUnit: unitSystem === 'metric' ? 'kg' : 'lbs',
    });

    // Validate each row
    const items: SteelOrderLineItem[] = [];
    const errors: ImportFieldError[] = [];

    for (let i = 0; i < mappedRows.length; i++) {
      const result = validateRow(mappedRows[i], i + 2);
      if (result.item) {
        items.push(result.item);
      }
      errors.push(...result.errors);
    }

    if (errors.length > 0) {
      setImportErrors(errors);
    } else {
      setImportErrors([]);
    }

    if (items.length > 0) {
      setOrderItems([...orderItems, ...items]);
      setUploadMessage(`Imported ${items.length} items${errors.length > 0 ? ` (${errors.length} errors)` : ''}`);
    } else {
      setUploadMessage('No valid items could be parsed. Check the mapping and try again.');
    }

    setPendingMapping(null);
  }, [pendingMapping, orderItems, setOrderItems, setImportErrors, unitSystem]);

  const handleUpdateMapping = useCallback((index: number, newSourceCol: string | null) => {
    if (!pendingMapping) return;
    const updated = [...pendingMapping.mappings];
    updated[index] = { ...updated[index], sourceColumn: newSourceCol, confidence: newSourceCol ? 0.9 : 0 };
    setPendingMapping({ ...pendingMapping, mappings: updated });
  }, [pendingMapping]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Load Items</h2>
        <p className="mt-1 text-sm text-gray-600">
          Import load items from a file or enter them manually.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`px-4 py-2 text-sm font-medium rounded-t-md ${
            mode === 'upload'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📁 Import File
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`px-4 py-2 text-sm font-medium rounded-t-md ${
            mode === 'manual'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          ✏️ Manual Entry
        </button>
      </div>

      {/* Order count summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-600">
          Items loaded: <span className="font-medium text-gray-900">{orderItems.length}</span>
        </span>
        {importErrors.length > 0 && (
          <span className="text-red-600">
            Errors: <span className="font-medium">{importErrors.length}</span>
          </span>
        )}
      </div>

      {/* File Upload area */}
      {mode === 'upload' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm text-gray-600 mb-3">
              Upload any CSV or Excel file — we'll auto-detect the columns
            </p>
            <label className="inline-block cursor-pointer">
              <span className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
                {isUploading ? 'Reading file...' : 'Choose File'}
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-500 mt-4">
              Supports Spanish, Portuguese, and English column names.{' '}
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Download template CSV
              </button>
            </p>
          </div>

          {uploadMessage && (
            <div className={`p-3 rounded text-sm ${
              importErrors.length > 0
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-green-50 text-green-800 border border-green-200'
            }`}>
              {uploadMessage}
            </div>
          )}

          {/* Column Mapping Confirmation */}
          {pendingMapping && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">
                Column Mapping — Review & Confirm
              </h4>
              <p className="text-xs text-blue-700 mb-2">
                We detected {pendingMapping.rawRows.length} rows. Adjust mappings if needed, then confirm.
              </p>
              {/* UOM Detection Indicator */}
              {(() => {
                const detected = detectUOMFromMappings(pendingMapping.mappings);
                const lengthLabel = detected.lengthUnit ?? (unitSystem === 'metric' ? 'mm' : 'in');
                const weightLabel = detected.weightUnit ?? (unitSystem === 'metric' ? 'kg' : 'lbs');
                return (
                  <p className="text-xs mb-3 px-2 py-1 bg-blue-100 rounded inline-block">
                    📐 Units: lengths → <strong>{lengthLabel}</strong>, weights → <strong>{weightLabel}</strong>
                    {(!detected.lengthUnit || !detected.weightUnit) && (
                      <span className="text-blue-600 ml-1">(from vehicle/region selection)</span>
                    )}
                    {detected.lengthUnit && detected.weightUnit && (
                      <span className="text-green-700 ml-1">(auto-detected from column headers)</span>
                    )}
                  </p>
                );
              })()}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto">
                {pendingMapping.mappings.map((m, idx) => (
                  <div key={m.targetField} className="flex items-center gap-2 text-xs">
                    <span className={`w-32 font-medium ${m.required ? 'text-gray-900' : 'text-gray-600'}`}>
                      {m.label}{m.required && <span className="text-red-500">*</span>}
                    </span>
                    <span className="text-gray-400">←</span>
                    <select
                      value={m.sourceColumn ?? ''}
                      onChange={(e) => handleUpdateMapping(idx, e.target.value || null)}
                      className={`flex-1 rounded border text-xs py-1 px-2 ${
                        m.sourceColumn
                          ? m.confidence >= 0.8 ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'
                          : m.required ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    >
                      <option value="">— Not mapped —</option>
                      {pendingMapping.sourceColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    {m.confidence >= 0.8 && <span className="text-green-600">✓</span>}
                    {m.confidence > 0 && m.confidence < 0.8 && <span className="text-amber-500">?</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleConfirmMapping}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                >
                  Confirm & Import
                </button>
                <button
                  type="button"
                  onClick={() => setPendingMapping(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="border border-red-200 rounded-lg p-4 max-h-48 overflow-auto">
              <h4 className="text-sm font-semibold text-red-800 mb-2">Import Errors:</h4>
              {importErrors.map((err: ImportFieldError, i: number) => (
                <p key={i} className="text-xs text-red-700">
                  Row {err.row}, field "{err.field}": {err.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual entry form */}
      {mode === 'manual' && (
        <ManualEntryForm
          items={orderItems}
          onItemsChange={(items) => {
            setOrderItems(items);
          }}
        />
      )}

      {/* Order items table */}
      {orderItems.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">
              Loaded Items ({orderItems.length})
            </span>
            <button
              type="button"
              onClick={() => { setOrderItems([]); setImportErrors([]); setUploadMessage(null); }}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Order #</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Customer</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Weight</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Stop</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">×</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orderItems.map((item, idx) => (
                  <tr key={`${item.orderNumber}-${idx}`}>
                    <td className="px-3 py-1.5 text-gray-900">{item.orderNumber}</td>
                    <td className="px-3 py-1.5 text-gray-700">{item.customerName}</td>
                    <td className="px-3 py-1.5 text-gray-700">{item.productType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-1.5 text-right text-gray-900">
                      {unitSystem === 'metric'
                        ? `${Math.round(item.totalLineWeight * 0.4536)} kg`
                        : `${item.totalLineWeight.toLocaleString()} lbs`}
                    </td>
                    <td className="px-3 py-1.5 text-center text-gray-700">{item.deliveryStop}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = orderItems.filter((_, i) => i !== idx);
                          setOrderItems(updated);
                        }}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Remove ${item.orderNumber}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
