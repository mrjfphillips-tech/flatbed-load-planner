// ─── Smart Column Mapper ─────────────────────────────────────────────────────
// Fuzzy-matches uploaded spreadsheet column headers to the expected field set.
// Supports English, Spanish, and Portuguese column names.

export interface FieldMapping {
  /** The target field in our system */
  targetField: string;
  /** Human-readable label */
  label: string;
  /** Whether this field is required */
  required: boolean;
  /** The detected source column from the uploaded file (null if not matched) */
  sourceColumn: string | null;
  /** Confidence score 0-1 */
  confidence: number;
}

/** All known aliases for each target field (lowercase, normalized) */
const FIELD_ALIASES: Record<string, string[]> = {
  orderNumber: [
    'order number', 'order #', 'order no', 'ordernumber', 'order_number',
    'numero de orden', 'num orden', 'nro orden', 'orden', 'pedido',
    'numero pedido', 'nro pedido', 'oc', 'order id', 'order_id',
  ],
  customerName: [
    'customer name', 'customer', 'client', 'cliente', 'nombre cliente',
    'customer_name', 'buyer', 'comprador', 'destinatario', 'consignee',
  ],
  deliveryStop: [
    'stop', 'delivery stop', 'stop number', 'stop #', 'parada',
    'secuencia', 'sequence', 'delivery_stop', 'stop_number',
    'nro parada', 'punto entrega',
  ],
  productType: [
    'product type', 'product', 'type', 'material', 'producto',
    'tipo producto', 'tipo material', 'product_type', 'item type',
    'descripcion', 'description', 'desc', 'material type',
  ],
  quantity: [
    'quantity', 'qty', 'cantidad', 'qtd', 'units', 'unidades',
    'piezas', 'pieces', 'count', 'num',
  ],
  pieceWeight: [
    'piece weight', 'unit weight', 'weight per piece', 'peso unitario',
    'peso pieza', 'piece_weight', 'unit_weight', 'peso unidad', 'kg/pieza',
  ],
  length: [
    'length', 'largo', 'longitud', 'comprimento', 'len', 'l',
    'length (in)', 'length (mm)', 'length (m)', 'largo (m)', 'largo (mm)',
  ],
  width: [
    'width', 'ancho', 'anchura', 'largura', 'w', 'wid',
    'width (in)', 'width (mm)', 'width (m)', 'ancho (m)', 'ancho (mm)',
  ],
  height: [
    'height', 'alto', 'altura', 'h', 'ht', 'diameter', 'diametro',
    'height (in)', 'height (mm)', 'height (m)', 'alto (m)', 'alto (mm)',
    'espesor', 'thickness', 'gauge',
  ],
  totalLineWeight: [
    'total weight', 'total line weight', 'peso total', 'peso',
    'weight', 'gross weight', 'net weight', 'total_weight',
    'peso neto', 'peso bruto', 'kg', 'lbs', 'tons', 'toneladas',
  ],
  handlingMethod: [
    'handling method', 'handling', 'method', 'manejo', 'metodo manejo',
    'descarga', 'unloading', 'loading method', 'handling_method',
    'tipo descarga', 'forma descarga',
  ],
  stackPermission: [
    'stack permission', 'stackable', 'stacking', 'apilable',
    'puede apilar', 'stack', 'stack_permission', 'stackability',
  ],
  maxStackHeight: [
    'max stack height', 'stack height', 'altura maxima apilado',
    'max_stack_height', 'altura apilado',
  ],
  maxStackWeight: [
    'max stack weight', 'stack weight', 'peso maximo apilado',
    'max_stack_weight', 'peso apilado',
  ],
  orientationRequirement: [
    'orientation', 'orientacion', 'direction', 'sentido',
    'orientation_requirement', 'posicion', 'placement',
  ],
  dunnageRequired: [
    'dunnage', 'dunnage required', 'requires dunnage',
    'tacos', 'separadores', 'dunnage_required', 'calzos',
  ],
  specialNotes: [
    'notes', 'special notes', 'notas', 'observaciones', 'comments',
    'comentarios', 'special_notes', 'remarks', 'obs',
  ],
  unitOfMeasure: [
    'uom', 'unit of measure', 'units', 'unit', 'unidad de medida',
    'unidad', 'medida', 'sistema', 'unit_of_measure', 'measurement',
    'metric/imperial', 'sistema medida', 'um',
  ],
  deliveryNumber: [
    'delivery number', 'delivery_number', 'deliverynumber',
    'numero de entrega', 'n_entrega', 'entrega',
    'delivery #', 'delivery no', 'nro entrega',
  ],
};

const FIELD_LABELS: Record<string, string> = {
  orderNumber: 'Order Number',
  customerName: 'Customer Name',
  deliveryStop: 'Delivery Stop',
  productType: 'Product Type',
  quantity: 'Quantity',
  pieceWeight: 'Piece Weight',
  length: 'Length',
  width: 'Width',
  height: 'Height/Diameter',
  totalLineWeight: 'Total Weight',
  handlingMethod: 'Handling Method',
  stackPermission: 'Stack Permission',
  maxStackHeight: 'Max Stack Height',
  maxStackWeight: 'Max Stack Weight',
  orientationRequirement: 'Orientation',
  dunnageRequired: 'Dunnage Required',
  specialNotes: 'Notes',
  deliveryNumber: 'Delivery Number',
};

const REQUIRED_FIELDS = [
  'orderNumber', 'customerName', 'deliveryStop', 'productType',
  'quantity', 'pieceWeight', 'length', 'width', 'height',
];

// ─── Fuzzy Matching Logic ────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[_\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[()[\]]/g, '');
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  // Simple token overlap
  const tokensA = new Set(na.split(' '));
  const tokensB = new Set(nb.split(' '));
  const intersection = [...tokensA].filter(t => tokensB.has(t));
  const union = new Set([...tokensA, ...tokensB]);
  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

/**
 * Auto-map spreadsheet columns to target fields.
 * Returns a mapping array with confidence scores for each field.
 */
export function autoMapColumns(sourceColumns: string[]): FieldMapping[] {
  const allFields = Object.keys(FIELD_ALIASES);
  const usedSourceColumns = new Set<string>();

  const mappings: FieldMapping[] = allFields.map((field) => {
    const aliases = FIELD_ALIASES[field];
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const srcCol of sourceColumns) {
      if (usedSourceColumns.has(srcCol)) continue;

      for (const alias of aliases) {
        const score = similarity(srcCol, alias);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = srcCol;
        }
      }
    }

    // Only accept matches above threshold
    if (bestScore >= 0.5 && bestMatch) {
      usedSourceColumns.add(bestMatch);
      return {
        targetField: field,
        label: FIELD_LABELS[field] || field,
        required: REQUIRED_FIELDS.includes(field),
        sourceColumn: bestMatch,
        confidence: bestScore,
      };
    }

    return {
      targetField: field,
      label: FIELD_LABELS[field] || field,
      required: REQUIRED_FIELDS.includes(field),
      sourceColumn: null,
      confidence: 0,
    };
  });

  return mappings;
}

// ─── UOM Detection and Conversion ────────────────────────────────────────────

export type LengthUnit = 'in' | 'mm' | 'cm' | 'm' | 'ft';
export type WeightUnit = 'lbs' | 'kg' | 't' | 'ton';

export interface DetectedUOM {
  /** UOM detected from column header, or null if none */
  lengthUnit: LengthUnit | null;
  /** UOM detected for weight columns */
  weightUnit: WeightUnit | null;
}

const LENGTH_UOM_PATTERNS: [RegExp, LengthUnit][] = [
  [/\(mm\)|\bmm\b|milimetros|milímetros/, 'mm'],
  [/\(cm\)|\bcm\b|centimetros|centímetros/, 'cm'],
  [/\(m\)(?!m)|\bmetros?\b|\bmts?\b/, 'm'],
  [/\(ft\)|\bft\b|\bfeet\b|\bpies\b/, 'ft'],
  [/\(in\)|\binch(es)?\b|\bpulgadas?\b/, 'in'],
];

const WEIGHT_UOM_PATTERNS: [RegExp, WeightUnit][] = [
  [/\(kg\)|\bkg\b|kilos?|kilogramos?/, 'kg'],
  [/\(t\)|\btoneladas?\b|\bton(s)?\b|\btn\b/, 't'],
  [/\(lbs?\)|\blbs?\b|\bpounds?\b|\blibras?\b/, 'lbs'],
];

function detectLengthUOM(header: string): LengthUnit | null {
  const h = header.toLowerCase();
  for (const [pattern, unit] of LENGTH_UOM_PATTERNS) {
    if (pattern.test(h)) return unit;
  }
  return null;
}

function detectWeightUOM(header: string): WeightUnit | null {
  const h = header.toLowerCase();
  for (const [pattern, unit] of WEIGHT_UOM_PATTERNS) {
    if (pattern.test(h)) return unit;
  }
  return null;
}

/** Convert a length value to inches (internal unit) */
function convertToInches(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'in': return value;
    case 'mm': return value / 25.4;
    case 'cm': return value / 2.54;
    case 'm': return value / 0.0254;
    case 'ft': return value * 12;
  }
}

/** Convert a weight value to lbs (internal unit) */
function convertToLbs(value: number, unit: WeightUnit): number {
  switch (unit) {
    case 'lbs': return value;
    case 'kg': return value / 0.4536;
    case 't': case 'ton': return value / 0.000454;
  }
}

/**
 * Detect UOM from the matched source columns in the mapping.
 * Scans length and weight column headers for unit indicators.
 */
export function detectUOMFromMappings(mappings: FieldMapping[]): DetectedUOM {
  let lengthUnit: LengthUnit | null = null;
  let weightUnit: WeightUnit | null = null;

  for (const m of mappings) {
    if (!m.sourceColumn) continue;
    // Check length fields
    if (['length', 'width', 'height'].includes(m.targetField)) {
      const detected = detectLengthUOM(m.sourceColumn);
      if (detected) lengthUnit = detected;
    }
    // Check weight fields
    if (['pieceWeight', 'totalLineWeight'].includes(m.targetField)) {
      const detected = detectWeightUOM(m.sourceColumn);
      if (detected) weightUnit = detected;
    }
  }

  return { lengthUnit, weightUnit };
}

export interface ApplyMappingOptions {
  /** Fallback length unit if not detected from headers. Default: 'mm' for metric regions */
  fallbackLengthUnit?: LengthUnit;
  /** Fallback weight unit if not detected from headers. Default: 'kg' for metric regions */
  fallbackWeightUnit?: WeightUnit;
}

/**
 * Apply a confirmed mapping to raw row data, producing mapped rows
 * suitable for the existing validation pipeline.
 * Automatically detects UOM from column headers and converts to internal units (inches/lbs).
 * If a per-row 'unitOfMeasure' column is present, it takes precedence over header/fallback UOM.
 */
export function applyMapping(
  rawRows: Record<string, unknown>[],
  mappings: FieldMapping[],
  options?: ApplyMappingOptions
): Record<string, unknown>[] {
  const detected = detectUOMFromMappings(mappings);
  const headerLengthUnit = detected.lengthUnit ?? options?.fallbackLengthUnit ?? 'mm';
  const headerWeightUnit = detected.weightUnit ?? options?.fallbackWeightUnit ?? 'kg';

  const lengthFields = new Set(['length', 'width', 'height', 'maxStackHeight']);
  const weightFields = new Set(['pieceWeight', 'totalLineWeight', 'maxStackWeight']);

  // Find the UOM source column (if mapped)
  const uomMapping = mappings.find(m => m.targetField === 'unitOfMeasure');
  const uomSourceCol = uomMapping?.sourceColumn ?? null;

  return rawRows.map((row) => {
    const mapped: Record<string, unknown> = {};

    // Determine per-row UOM if column is present
    let rowLengthUnit = headerLengthUnit;
    let rowWeightUnit = headerWeightUnit;
    if (uomSourceCol && row[uomSourceCol] !== undefined) {
      const uomVal = String(row[uomSourceCol]).trim().toLowerCase();
      const resolved = resolveRowUOM(uomVal);
      if (resolved) {
        rowLengthUnit = resolved.lengthUnit;
        rowWeightUnit = resolved.weightUnit;
      }
    }

    for (const m of mappings) {
      if (m.targetField === 'unitOfMeasure') continue; // Don't pass UOM to validation
      if (m.sourceColumn && row[m.sourceColumn] !== undefined) {
        let value = row[m.sourceColumn];

        // Convert numeric length/weight fields to internal units
        if (lengthFields.has(m.targetField)) {
          const num = Number(value);
          if (!isNaN(num) && num !== 0) {
            value = convertToInches(num, rowLengthUnit);
          }
        } else if (weightFields.has(m.targetField)) {
          const num = Number(value);
          if (!isNaN(num) && num !== 0) {
            value = convertToLbs(num, rowWeightUnit);
          }
        }

        mapped[m.targetField] = value;
      }
    }
    return mapped;
  });
}

/**
 * Resolve a per-row UOM value to length/weight units.
 * Accepts: 'metric', 'imperial', 'kg/mm', 'lbs/in', 'kg/m', etc.
 */
function resolveRowUOM(uomValue: string): { lengthUnit: LengthUnit; weightUnit: WeightUnit } | null {
  // Common system names
  if (uomValue === 'metric' || uomValue === 'métrico' || uomValue === 'metrico' || uomValue === 'si') {
    return { lengthUnit: 'mm', weightUnit: 'kg' };
  }
  if (uomValue === 'imperial' || uomValue === 'us' || uomValue === 'english' || uomValue === 'imperial/us') {
    return { lengthUnit: 'in', weightUnit: 'lbs' };
  }
  // Compound formats like "kg/mm", "lbs/in", "kg/m"
  const compoundMatch = uomValue.match(/^(kg|lbs?|t|ton)\s*[\/,]\s*(mm|cm|m|in|ft)$/);
  if (compoundMatch) {
    const w = compoundMatch[1] as WeightUnit;
    const l = compoundMatch[2] as LengthUnit;
    return { lengthUnit: l, weightUnit: w === ('lb' as string) ? 'lbs' : w };
  }
  // Just weight
  if (['kg', 'kilogramos', 'kilos'].includes(uomValue)) {
    return { lengthUnit: 'mm', weightUnit: 'kg' };
  }
  if (['lbs', 'lb', 'libras', 'pounds'].includes(uomValue)) {
    return { lengthUnit: 'in', weightUnit: 'lbs' };
  }
  return null;
}

/**
 * Generate a downloadable CSV template with the expected columns.
 */
export function generateTemplate(): string {
  const headers = Object.values(FIELD_LABELS);
  const exampleRow = [
    'ORD-001', 'Acme Steel', '1', 'coil_hot_rolled', '2',
    '2268', '1219', '1219', '914', '4536',
    'crane', 'no', '1829', '9072', 'longitudinal', 'yes', 'Handle with care',
  ];
  return [headers.join(','), exampleRow.join(',')].join('\n');
}

export function downloadTemplate(): void {
  const csv = generateTemplate();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'steel-orders-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
