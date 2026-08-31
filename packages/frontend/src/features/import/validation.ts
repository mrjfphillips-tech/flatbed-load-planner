// ─── Import Validation Logic ─────────────────────────────────────────────────
// Shared validation for CSV and XLSX parsing. Converts raw row objects into
// validated SteelOrderLineItem instances, collecting field-specific errors.

import type {
  SteelOrderLineItem,
  SteelProductType,
  HandlingMethod,
  StackPermission,
  OrientationRequirement,
} from '@ptv-discovery-coach/shared';
import { applyHandlingDefaults } from '@ptv-discovery-coach/shared';
import type { ImportFieldError, DuplicateEntry } from './types';

// ─── Valid Value Sets ────────────────────────────────────────────────────────

export const VALID_PRODUCT_TYPES: readonly SteelProductType[] = [
  'coil_hot_rolled',
  'coil_cold_rolled',
  'coil_galvanized',
  'sheet_bundle',
  'plate',
  'rebar_bundle',
  'wire_rod_coil',
  'beam_i',
  'beam_h',
  'beam_wide_flange',
  'channel',
  'angle',
  'flat_bar',
  'round_bar',
  'pipe',
  'tube',
  'hollow_structural_section',
  'roofing_sheet_bundle',
  'wire_mesh_panel',
  'fabricated_assembly',
  'palletized',
  'mixed_bundle',
] as const;

export const VALID_HANDLING_METHODS: readonly HandlingMethod[] = [
  'crane',
  'forklift',
  'magnet',
  'manual',
] as const;

export const VALID_STACK_PERMISSIONS: readonly StackPermission[] = [
  'yes',
  'no',
  'conditional',
] as const;

export const VALID_ORIENTATIONS: readonly OrientationRequirement[] = [
  'longitudinal',
  'transverse',
  'any',
] as const;

// ─── Product Type Normalization ──────────────────────────────────────────────
// Maps detailed/variant product types to valid system categories.

const PRODUCT_TYPE_ALIASES: Record<string, string> = {
  // Tubes → hollow_structural_section or pipe
  'tube_rectangular': 'hollow_structural_section',
  'tube_square': 'hollow_structural_section',
  'tube_round': 'pipe',
  // Plates
  'plate_hot_rolled': 'plate',
  'checkered_plate': 'plate',
  'structural_plate': 'plate',
  'base_plate': 'plate',
  // Angles/Channels
  'angle_bar': 'angle',
  'channel_bar': 'channel',
  'tee_bar': 'channel',
  'purlin_z': 'channel',
  // Bars
  'round_bar_smooth': 'round_bar',
  'round_bar_polished': 'round_bar',
  'square_bar': 'flat_bar',
  // Rebar variants
  'rebar_corrugated': 'rebar_bundle',
  'rebar_dowel': 'rebar_bundle',
  'rebar_accessory': 'fabricated_assembly',
  // Sheets
  'sheet_galvanized': 'sheet_bundle',
  'sheet_cold_rolled': 'sheet_bundle',
  // Roofing
  'corrugated_roofing_sheet': 'roofing_sheet_bundle',
  // Coils
  'wire_coil': 'wire_rod_coil',
  // Packaged items
  'fastener_box': 'palletized',
  'electrode_box': 'palletized',
  'hardware_misc': 'palletized',
};

function normalizeProductType(raw: string): string {
  if (PRODUCT_TYPE_ALIASES[raw]) return PRODUCT_TYPE_ALIASES[raw];
  return raw;
}

// ─── Orientation Normalization ───────────────────────────────────────────────

const ORIENTATION_ALIASES: Record<string, string> = {
  'flat': 'transverse',
  'n/a': 'any',
  'na': 'any',
  'none': 'any',
  '': 'any',
  'vertical': 'transverse',
  'horizontal': 'longitudinal',
};

function normalizeOrientation(raw: string): string {
  if (ORIENTATION_ALIASES[raw] !== undefined) return ORIENTATION_ALIASES[raw];
  return raw;
}

// ─── Stack Permission Normalization ──────────────────────────────────────────

function normalizeStackPermission(raw: string): string {
  if (raw.includes('limited') || raw.includes('conditional') || raw.includes('max')) return 'conditional';
  if (raw === 'true' || raw === '1' || raw === 'si' || raw === 'sí') return 'yes';
  if (raw === 'false' || raw === '0') return 'no';
  return raw;
}

// ─── Field Mapping ───────────────────────────────────────────────────────────
// Maps common header names (case-insensitive, trimmed) to internal field names.
// This allows flexible CSV/XLSX column naming.

export const FIELD_ALIASES: Record<string, string> = {
  // orderNumber
  'ordernumber': 'orderNumber',
  'order_number': 'orderNumber',
  'order number': 'orderNumber',
  'order': 'orderNumber',
  'order #': 'orderNumber',
  'order#': 'orderNumber',
  'order_no': 'orderNumber',

  // customerName
  'customername': 'customerName',
  'customer_name': 'customerName',
  'customer name': 'customerName',
  'customer': 'customerName',

  // deliveryStop
  'deliverystop': 'deliveryStop',
  'delivery_stop': 'deliveryStop',
  'delivery stop': 'deliveryStop',
  'stop': 'deliveryStop',
  'stop number': 'deliveryStop',
  'stop_number': 'deliveryStop',

  // productType
  'producttype': 'productType',
  'product_type': 'productType',
  'product type': 'productType',
  'product': 'productType',
  'type': 'productType',

  // quantity
  'quantity': 'quantity',
  'qty': 'quantity',

  // pieceWeight
  'pieceweight': 'pieceWeight',
  'piece_weight': 'pieceWeight',
  'piece weight': 'pieceWeight',
  'weight_per_piece': 'pieceWeight',
  'weight per piece': 'pieceWeight',
  'unit weight': 'pieceWeight',
  'unit_weight': 'pieceWeight',

  // dimensions (individual)
  'length': 'length',
  'width': 'width',
  'height': 'height',
  'diameter': 'height', // diameter maps to height for cylindrical items

  // totalLineWeight
  'totallineweight': 'totalLineWeight',
  'total_line_weight': 'totalLineWeight',
  'total line weight': 'totalLineWeight',
  'total weight': 'totalLineWeight',
  'total_weight': 'totalLineWeight',
  'line weight': 'totalLineWeight',
  'line_weight': 'totalLineWeight',

  // handlingMethod
  'handlingmethod': 'handlingMethod',
  'handling_method': 'handlingMethod',
  'handling method': 'handlingMethod',
  'handling': 'handlingMethod',

  // stackPermission
  'stackpermission': 'stackPermission',
  'stack_permission': 'stackPermission',
  'stack permission': 'stackPermission',
  'stacking': 'stackPermission',
  'stackable': 'stackPermission',

  // maxStackHeight
  'maxstackheight': 'maxStackHeight',
  'max_stack_height': 'maxStackHeight',
  'max stack height': 'maxStackHeight',

  // maxStackWeight
  'maxstackweight': 'maxStackWeight',
  'max_stack_weight': 'maxStackWeight',
  'max stack weight': 'maxStackWeight',

  // orientationRequirement
  'orientationrequirement': 'orientationRequirement',
  'orientation_requirement': 'orientationRequirement',
  'orientation requirement': 'orientationRequirement',
  'orientation': 'orientationRequirement',

  // dunnageRequired
  'dunnagerequired': 'dunnageRequired',
  'dunnage_required': 'dunnageRequired',
  'dunnage required': 'dunnageRequired',
  'dunnage': 'dunnageRequired',

  // specialNotes
  'specialnotes': 'specialNotes',
  'special_notes': 'specialNotes',
  'special notes': 'specialNotes',
  'notes': 'specialNotes',

  // unitOfMeasure
  'uom': 'unitOfMeasure',
  'unit of measure': 'unitOfMeasure',
  'unitofmeasure': 'unitOfMeasure',
  'unit_of_measure': 'unitOfMeasure',
  'units': 'unitOfMeasure',
  'unidad de medida': 'unitOfMeasure',
  'unidad': 'unitOfMeasure',
  'medida': 'unitOfMeasure',
  'sistema': 'unitOfMeasure',
  'metric/imperial': 'unitOfMeasure',
};

// ─── Helper Parsers ──────────────────────────────────────────────────────────

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

/**
 * Maps raw column headers from an imported file to internal field names.
 * Returns a mapping of originalHeader → internalFieldName.
 */
export function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const mapped = FIELD_ALIASES[normalized];
    if (mapped) {
      mapping[header] = mapped;
    }
  }
  return mapping;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(str)) return true;
  if (['false', 'no', '0', 'n'].includes(str)) return false;
  return null;
}

function parseString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// ─── Row Validation ──────────────────────────────────────────────────────────

/**
 * Required fields that must be present and non-empty for a valid line item.
 */
export const REQUIRED_FIELDS = [
  'orderNumber',
  'customerName',
  'deliveryStop',
  'productType',
  'quantity',
  'pieceWeight',
  'length',
  'width',
  'height',
  'handlingMethod',
  'stackPermission',
  'orientationRequirement',
] as const;

export interface RowValidationResult {
  item: SteelOrderLineItem | null;
  errors: ImportFieldError[];
}

/**
 * Validates a single mapped row object and returns either a valid SteelOrderLineItem
 * or a list of field-specific errors.
 */
export function validateRow(
  row: Record<string, unknown>,
  rowIndex: number
): RowValidationResult {
  const errors: ImportFieldError[] = [];

  // ─── String fields ─────────────────────────────────────────────────────────
  const orderNumber = parseString(row['orderNumber']);
  if (!orderNumber) {
    errors.push({
      row: rowIndex,
      field: 'orderNumber',
      value: row['orderNumber'],
      message: `Row ${rowIndex}: Order number is required`,
    });
  }

  const customerName = parseString(row['customerName']);
  if (!customerName) {
    errors.push({
      row: rowIndex,
      field: 'customerName',
      value: row['customerName'],
      message: `Row ${rowIndex}: Customer name is required`,
    });
  }

  // ─── Delivery stop ─────────────────────────────────────────────────────────
  const deliveryStopRaw = parseNumber(row['deliveryStop']);
  if (deliveryStopRaw === null || deliveryStopRaw < 1 || !Number.isInteger(deliveryStopRaw)) {
    errors.push({
      row: rowIndex,
      field: 'deliveryStop',
      value: row['deliveryStop'],
      message: `Row ${rowIndex}: Delivery stop must be a positive integer`,
    });
  }
  const deliveryStop = deliveryStopRaw ?? 0;

  // ─── Product type ──────────────────────────────────────────────────────────
  const productTypeRaw = parseString(row['productType']).toLowerCase().replace(/[\s-]/g, '_');
  const productTypeNormalized = normalizeProductType(productTypeRaw);
  const productType = VALID_PRODUCT_TYPES.includes(productTypeNormalized as SteelProductType)
    ? (productTypeNormalized as SteelProductType)
    : null;
  if (!productType) {
    errors.push({
      row: rowIndex,
      field: 'productType',
      value: row['productType'],
      message: `Row ${rowIndex}: Invalid product type "${row['productType']}". Must be one of: ${VALID_PRODUCT_TYPES.join(', ')}`,
    });
  }

  // ─── Quantity ──────────────────────────────────────────────────────────────
  // Apply handling defaults for the detected product type (fills missing fields)
  if (productType) {
    applyHandlingDefaults(row, productType);
  }

  const quantity = parseNumber(row['quantity']);
  if (quantity === null || quantity <= 0 || !Number.isInteger(quantity)) {
    errors.push({
      row: rowIndex,
      field: 'quantity',
      value: row['quantity'],
      message: `Row ${rowIndex}: Quantity must be a positive integer`,
    });
  }

  // ─── Piece weight ──────────────────────────────────────────────────────────
  const pieceWeight = parseNumber(row['pieceWeight']);
  if (pieceWeight === null || pieceWeight <= 0) {
    errors.push({
      row: rowIndex,
      field: 'pieceWeight',
      value: row['pieceWeight'],
      message: `Row ${rowIndex}: Piece weight must be a positive number (lbs)`,
    });
  }

  // ─── Dimensions ────────────────────────────────────────────────────────────
  const length = parseNumber(row['length']);
  // Length is optional for packaged goods, wire coils, and fabricated assemblies
  const isLengthOptional = productType && ['palletized', 'wire_rod_coil', 'fabricated_assembly'].includes(productType);
  if (!isLengthOptional && (length === null || length <= 0)) {
    errors.push({
      row: rowIndex,
      field: 'length',
      value: row['length'],
      message: `Row ${rowIndex}: Length must be a positive number (inches)`,
    });
  }

  const width = parseNumber(row['width']);
  // Width is optional for cylindrical items (round bar, rebar, pipe, wire coil) and packaged goods
  const isWidthOptional = productType && ['pipe', 'round_bar', 'rebar_bundle', 'wire_rod_coil', 'palletized', 'channel', 'fabricated_assembly'].includes(productType);
  if (!isWidthOptional && (width === null || width <= 0)) {
    errors.push({
      row: rowIndex,
      field: 'width',
      value: row['width'],
      message: `Row ${rowIndex}: Width must be a positive number (inches)`,
    });
  }

  const height = parseNumber(row['height']);
  // Height is optional for packaged goods (palletized, fastener boxes, etc.)
  const isHeightOptional = productType && ['palletized', 'wire_rod_coil'].includes(productType);
  if (!isHeightOptional && (height === null || height <= 0)) {
    errors.push({
      row: rowIndex,
      field: 'height',
      value: row['height'],
      message: `Row ${rowIndex}: Height/diameter must be a positive number (inches)`,
    });
  }

  // ─── Total line weight (optional — calculated if missing) ──────────────────
  let totalLineWeight = parseNumber(row['totalLineWeight']);
  if (totalLineWeight === null && pieceWeight !== null && quantity !== null) {
    totalLineWeight = pieceWeight * (quantity ?? 0);
  }
  if (totalLineWeight === null || totalLineWeight <= 0) {
    // Only error if we couldn't calculate it
    if (pieceWeight === null || quantity === null) {
      errors.push({
        row: rowIndex,
        field: 'totalLineWeight',
        value: row['totalLineWeight'],
        message: `Row ${rowIndex}: Total line weight must be a positive number, or provide valid piece weight and quantity`,
      });
    }
  }

  // ─── Handling method ───────────────────────────────────────────────────────
  const handlingRaw = parseString(row['handlingMethod']).toLowerCase();
  const handlingMethod = VALID_HANDLING_METHODS.includes(handlingRaw as HandlingMethod)
    ? (handlingRaw as HandlingMethod)
    : null;
  if (!handlingMethod) {
    errors.push({
      row: rowIndex,
      field: 'handlingMethod',
      value: row['handlingMethod'],
      message: `Row ${rowIndex}: Handling method must be one of: ${VALID_HANDLING_METHODS.join(', ')}`,
    });
  }

  // ─── Stack permission ──────────────────────────────────────────────────────
  const stackRaw = parseString(row['stackPermission']).toLowerCase();
  const stackNormalized = normalizeStackPermission(stackRaw);
  const stackPermission = VALID_STACK_PERMISSIONS.includes(stackNormalized as StackPermission)
    ? (stackNormalized as StackPermission)
    : null;
  if (!stackPermission) {
    errors.push({
      row: rowIndex,
      field: 'stackPermission',
      value: row['stackPermission'],
      message: `Row ${rowIndex}: Stack permission must be one of: ${VALID_STACK_PERMISSIONS.join(', ')}`,
    });
  }

  // ─── Max stack height (default to 0 if not provided) ───────────────────────
  const maxStackHeight = parseNumber(row['maxStackHeight']) ?? 0;

  // ─── Max stack weight (default to 0 if not provided) ───────────────────────
  const maxStackWeight = parseNumber(row['maxStackWeight']) ?? 0;

  // ─── Orientation requirement ───────────────────────────────────────────────
  const orientationRaw = parseString(row['orientationRequirement']).toLowerCase();
  const orientationNormalized = normalizeOrientation(orientationRaw);
  const orientationRequirement = VALID_ORIENTATIONS.includes(orientationNormalized as OrientationRequirement)
    ? (orientationNormalized as OrientationRequirement)
    : null;
  if (!orientationRequirement) {
    errors.push({
      row: rowIndex,
      field: 'orientationRequirement',
      value: row['orientationRequirement'],
      message: `Row ${rowIndex}: Orientation must be one of: ${VALID_ORIENTATIONS.join(', ')}`,
    });
  }

  // ─── Dunnage required (default to false) ───────────────────────────────────
  const dunnageRequired = parseBoolean(row['dunnageRequired']) ?? false;

  // ─── Special notes (optional) ──────────────────────────────────────────────
  const specialNotes = parseString(row['specialNotes']);

  // ─── Build item if no errors ───────────────────────────────────────────────
  if (errors.length > 0) {
    return { item: null, errors };
  }

  const item: SteelOrderLineItem = {
    orderNumber,
    customerName,
    deliveryStop,
    productType: productType!,
    quantity: quantity!,
    pieceWeight: pieceWeight!,
    dimensions: {
      length: length ?? 0,
      width: width ?? 0,
      height: height ?? 0,
    },
    totalLineWeight: totalLineWeight ?? pieceWeight! * quantity!,
    handlingMethod: handlingMethod!,
    stackPermission: stackPermission!,
    maxStackHeight,
    maxStackWeight,
    orientationRequirement: orientationRequirement!,
    dunnageRequired,
    specialNotes,
  };

  return { item, errors: [] };
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

/**
 * Detects duplicate order-line combinations in a list of items.
 * A duplicate is identified by the same orderNumber appearing more than once.
 */
export function detectDuplicates(
  items: SteelOrderLineItem[],
  rowIndices: number[]
): DuplicateEntry[] {
  const orderMap = new Map<string, number[]>();

  items.forEach((item, idx) => {
    const key = item.orderNumber;
    const existing = orderMap.get(key);
    if (existing) {
      existing.push(rowIndices[idx]);
    } else {
      orderMap.set(key, [rowIndices[idx]]);
    }
  });

  const duplicates: DuplicateEntry[] = [];
  for (const [orderNumber, indices] of orderMap.entries()) {
    if (indices.length > 1) {
      duplicates.push({
        orderNumber,
        rowIndices: indices,
        message: `Order "${orderNumber}" appears in rows ${indices.join(', ')} — duplicate entries detected`,
      });
    }
  }

  return duplicates;
}
