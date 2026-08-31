// ─── Manual Order Entry Form ─────────────────────────────────────────────────
// Allows planners to manually enter steel order line items with the same field set
// and validation rules as file import. Supports adding, editing, and removing items.
// Requirement 2.4

import { useState, useCallback } from 'react';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';
import {
  validateRow,
  VALID_PRODUCT_TYPES,
  VALID_HANDLING_METHODS,
  VALID_STACK_PERMISSIONS,
  VALID_ORIENTATIONS,
} from './validation';
import type { ImportFieldError } from './types';

// ─── Internal Types ──────────────────────────────────────────────────────────

/** The raw form state before validation (all strings for controlled inputs) */
interface LineItemFormState {
  orderNumber: string;
  customerName: string;
  deliveryStop: string;
  productType: string;
  quantity: string;
  pieceWeight: string;
  length: string;
  width: string;
  height: string;
  totalLineWeight: string;
  handlingMethod: string;
  stackPermission: string;
  maxStackHeight: string;
  maxStackWeight: string;
  orientationRequirement: string;
  dunnageRequired: boolean;
  specialNotes: string;
}

const EMPTY_FORM: LineItemFormState = {
  orderNumber: '',
  customerName: '',
  deliveryStop: '',
  productType: '',
  quantity: '',
  pieceWeight: '',
  length: '',
  width: '',
  height: '',
  totalLineWeight: '',
  handlingMethod: '',
  stackPermission: '',
  maxStackHeight: '',
  maxStackWeight: '',
  orientationRequirement: '',
  dunnageRequired: false,
  specialNotes: '',
};

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ManualEntryFormProps {
  /** Current list of line items */
  items: SteelOrderLineItem[];
  /** Callback when the item list changes (add, edit, remove) */
  onItemsChange: (items: SteelOrderLineItem[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ManualEntryForm({ items, onItemsChange }: ManualEntryFormProps) {
  const [form, setForm] = useState<LineItemFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<ImportFieldError[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // ─── Form field change handler ─────────────────────────────────────────────
  const updateField = useCallback(
    <K extends keyof LineItemFormState>(field: K, value: LineItemFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear errors for this field on change
      setFieldErrors((prev) => prev.filter((e) => e.field !== field));
    },
    []
  );

  // ─── Convert form state to row object for validateRow ──────────────────────
  function formToRow(formState: LineItemFormState): Record<string, unknown> {
    return {
      orderNumber: formState.orderNumber,
      customerName: formState.customerName,
      deliveryStop: formState.deliveryStop,
      productType: formState.productType,
      quantity: formState.quantity,
      pieceWeight: formState.pieceWeight,
      length: formState.length,
      width: formState.width,
      height: formState.height,
      totalLineWeight: formState.totalLineWeight || undefined,
      handlingMethod: formState.handlingMethod,
      stackPermission: formState.stackPermission,
      maxStackHeight: formState.maxStackHeight || undefined,
      maxStackWeight: formState.maxStackWeight || undefined,
      orientationRequirement: formState.orientationRequirement,
      dunnageRequired: formState.dunnageRequired,
      specialNotes: formState.specialNotes,
    };
  }

  // ─── Convert a SteelOrderLineItem back to form state (for editing) ─────────
  function itemToForm(item: SteelOrderLineItem): LineItemFormState {
    return {
      orderNumber: item.orderNumber,
      customerName: item.customerName,
      deliveryStop: String(item.deliveryStop),
      productType: item.productType,
      quantity: String(item.quantity),
      pieceWeight: String(item.pieceWeight),
      length: String(item.dimensions.length),
      width: String(item.dimensions.width),
      height: String(item.dimensions.height),
      totalLineWeight: String(item.totalLineWeight),
      handlingMethod: item.handlingMethod,
      stackPermission: item.stackPermission,
      maxStackHeight: item.maxStackHeight ? String(item.maxStackHeight) : '',
      maxStackWeight: item.maxStackWeight ? String(item.maxStackWeight) : '',
      orientationRequirement: item.orientationRequirement,
      dunnageRequired: item.dunnageRequired,
      specialNotes: item.specialNotes,
    };
  }

  // ─── Add or update item ────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const row = formToRow(form);
    const rowIndex = editingIndex !== null ? editingIndex + 1 : items.length + 1;
    const result = validateRow(row, rowIndex);

    if (result.errors.length > 0) {
      setFieldErrors(result.errors);
      return;
    }

    if (!result.item) return;

    const newItems = [...items];
    if (editingIndex !== null) {
      newItems[editingIndex] = result.item;
    } else {
      newItems.push(result.item);
    }

    onItemsChange(newItems);
    setForm(EMPTY_FORM);
    setFieldErrors([]);
    setEditingIndex(null);
  }

  // ─── Edit an existing item ─────────────────────────────────────────────────
  function handleEdit(index: number) {
    const item = items[index];
    setForm(itemToForm(item));
    setEditingIndex(index);
    setFieldErrors([]);
  }

  // ─── Remove an item ────────────────────────────────────────────────────────
  function handleRemove(index: number) {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
    // If we were editing this item, cancel edit
    if (editingIndex === index) {
      setForm(EMPTY_FORM);
      setEditingIndex(null);
      setFieldErrors([]);
    } else if (editingIndex !== null && editingIndex > index) {
      // Adjust editing index if a preceding item was removed
      setEditingIndex(editingIndex - 1);
    }
  }

  // ─── Cancel editing ────────────────────────────────────────────────────────
  function handleCancel() {
    setForm(EMPTY_FORM);
    setEditingIndex(null);
    setFieldErrors([]);
  }

  // ─── Helper: get error for a field ─────────────────────────────────────────
  function getFieldError(field: string): string | undefined {
    return fieldErrors.find((e) => e.field === field)?.message;
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Entry Form ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-4" aria-label="Manual order entry form">
        <h3 className="text-lg font-semibold text-gray-800">
          {editingIndex !== null ? 'Edit Line Item' : 'Add Line Item'}
        </h3>

        {fieldErrors.length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-3" role="alert">
            <p className="text-sm font-medium text-red-800">Please fix the following errors:</p>
            {fieldErrors.map((err, i) => (
              <p key={i} className="text-sm text-red-700">{err.message}</p>
            ))}
          </div>
        )}

        {/* ─── Row 1: Order Info ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <FormInput
            label="Order Number"
            value={form.orderNumber}
            onChange={(v) => updateField('orderNumber', v)}
            error={getFieldError('orderNumber')}
            required
          />
          <FormInput
            label="Customer Name"
            value={form.customerName}
            onChange={(v) => updateField('customerName', v)}
            error={getFieldError('customerName')}
            required
          />
          <FormInput
            label="Delivery Stop"
            type="number"
            value={form.deliveryStop}
            onChange={(v) => updateField('deliveryStop', v)}
            error={getFieldError('deliveryStop')}
            min={1}
            required
          />
          <FormSelect
            label="Product Type"
            value={form.productType}
            onChange={(v) => updateField('productType', v)}
            options={VALID_PRODUCT_TYPES as unknown as string[]}
            error={getFieldError('productType')}
            required
          />
        </div>

        {/* ─── Row 2: Quantity & Weight ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <FormInput
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(v) => updateField('quantity', v)}
            error={getFieldError('quantity')}
            min={1}
            required
          />
          <FormInput
            label="Piece Weight (lbs)"
            type="number"
            value={form.pieceWeight}
            onChange={(v) => updateField('pieceWeight', v)}
            error={getFieldError('pieceWeight')}
            min={0}
            required
          />
          <FormInput
            label="Total Line Weight (lbs)"
            type="number"
            value={form.totalLineWeight}
            onChange={(v) => updateField('totalLineWeight', v)}
            error={getFieldError('totalLineWeight')}
            min={0}
            placeholder="Auto-calculated if empty"
          />
        </div>

        {/* ─── Row 3: Dimensions ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <FormInput
            label="Length (in)"
            type="number"
            value={form.length}
            onChange={(v) => updateField('length', v)}
            error={getFieldError('length')}
            min={0}
            required
          />
          <FormInput
            label="Width (in)"
            type="number"
            value={form.width}
            onChange={(v) => updateField('width', v)}
            error={getFieldError('width')}
            min={0}
            required
          />
          <FormInput
            label="Height/Diameter (in)"
            type="number"
            value={form.height}
            onChange={(v) => updateField('height', v)}
            error={getFieldError('height')}
            min={0}
            required
          />
        </div>

        {/* ─── Row 4: Handling & Stacking ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <FormSelect
            label="Handling Method"
            value={form.handlingMethod}
            onChange={(v) => updateField('handlingMethod', v)}
            options={VALID_HANDLING_METHODS as unknown as string[]}
            error={getFieldError('handlingMethod')}
            required
          />
          <FormSelect
            label="Stack Permission"
            value={form.stackPermission}
            onChange={(v) => updateField('stackPermission', v)}
            options={VALID_STACK_PERMISSIONS as unknown as string[]}
            error={getFieldError('stackPermission')}
            required
          />
          <FormInput
            label="Max Stack Height (in)"
            type="number"
            value={form.maxStackHeight}
            onChange={(v) => updateField('maxStackHeight', v)}
            min={0}
            placeholder="Optional"
          />
          <FormInput
            label="Max Stack Weight (lbs)"
            type="number"
            value={form.maxStackWeight}
            onChange={(v) => updateField('maxStackWeight', v)}
            min={0}
            placeholder="Optional"
          />
        </div>

        {/* ─── Row 5: Orientation & Dunnage ───────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <FormSelect
            label="Orientation"
            value={form.orientationRequirement}
            onChange={(v) => updateField('orientationRequirement', v)}
            options={VALID_ORIENTATIONS as unknown as string[]}
            error={getFieldError('orientationRequirement')}
            required
          />
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={form.dunnageRequired}
              onChange={(e) => updateField('dunnageRequired', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Dunnage Required</span>
          </label>
        </div>

        {/* ─── Row 6: Notes ───────────────────────────────────────────────── */}
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Special Notes</span>
          <textarea
            value={form.specialNotes}
            onChange={(e) => updateField('specialNotes', e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            rows={2}
            placeholder="Optional handling instructions or notes"
          />
        </label>

        {/* ─── Actions ────────────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {editingIndex !== null ? 'Update Item' : 'Add Item'}
          </button>
          {editingIndex !== null && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ─── Items List ───────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-800">
            Line Items ({items.length})
          </h3>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Order</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Customer</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Stop</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Product Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Weight (lbs)</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Dimensions</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr
                    key={`${item.orderNumber}-${idx}`}
                    className={editingIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{item.orderNumber}</td>
                    <td className="px-3 py-2 text-gray-700">{item.customerName}</td>
                    <td className="px-3 py-2 text-gray-700">{item.deliveryStop}</td>
                    <td className="px-3 py-2 text-gray-700">{item.productType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-gray-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-gray-700">{item.totalLineWeight.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {item.dimensions.length}×{item.dimensions.width}×{item.dimensions.height}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(idx)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label={`Edit item ${item.orderNumber}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label={`Remove item ${item.orderNumber}`}
                        >
                          Remove
                        </button>
                      </div>
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

// ─── Reusable Form Sub-Components ────────────────────────────────────────────

interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  error?: string;
  min?: number;
  required?: boolean;
  placeholder?: string;
}

function FormInput({
  label,
  value,
  onChange,
  type = 'text',
  error,
  min,
  required,
  placeholder,
}: FormInputProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 block w-full rounded shadow-sm sm:text-sm ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
        min={min}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${label}-error` : undefined}
      />
      {error && (
        <p id={`${label}-error`} className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </label>
  );
}

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  error?: string;
  required?: boolean;
}

function FormSelect({ label, value, onChange, options, error, required }: FormSelectProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 block w-full rounded shadow-sm sm:text-sm ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
        aria-invalid={!!error}
        aria-describedby={error ? `${label}-error` : undefined}
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${label}-error`} className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </label>
  );
}
