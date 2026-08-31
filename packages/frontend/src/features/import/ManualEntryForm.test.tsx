// ─── Manual Entry Form Unit Tests ────────────────────────────────────────────
// Tests for the ManualEntryForm component: adding, editing, removing line items,
// and inline validation matching import validation rules.
// Requirement 2.4

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManualEntryForm } from './ManualEntryForm';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildValidItem(overrides: Partial<SteelOrderLineItem> = {}): SteelOrderLineItem {
  return {
    orderNumber: 'ORD-001',
    customerName: 'Acme Steel Co',
    deliveryStop: 1,
    productType: 'coil_hot_rolled',
    quantity: 3,
    pieceWeight: 5000,
    dimensions: { length: 48, width: 48, height: 36 },
    totalLineWeight: 15000,
    handlingMethod: 'crane',
    stackPermission: 'no',
    maxStackHeight: 72,
    maxStackWeight: 20000,
    orientationRequirement: 'longitudinal',
    dunnageRequired: true,
    specialNotes: 'Handle with care',
    ...overrides,
  };
}

function fillForm(overrides: Record<string, string | boolean> = {}) {
  const defaults: Record<string, string | boolean> = {
    'Order Number': 'ORD-001',
    'Customer Name': 'Acme Steel Co',
    'Delivery Stop': '1',
    'Product Type': 'coil_hot_rolled',
    'Quantity': '3',
    'Piece Weight (lbs)': '5000',
    'Length (in)': '48',
    'Width (in)': '48',
    'Height/Diameter (in)': '36',
    'Total Line Weight (lbs)': '15000',
    'Handling Method': 'crane',
    'Stack Permission': 'no',
    'Orientation': 'longitudinal',
    'Dunnage Required': true,
    'Special Notes': 'Handle with care',
  };

  const merged = { ...defaults, ...overrides };

  for (const [label, value] of Object.entries(merged)) {
    if (label === 'Dunnage Required') {
      const checkbox = screen.getByRole('checkbox');
      if ((value && !checkbox.hasAttribute('checked')) || (!value && checkbox.hasAttribute('checked'))) {
        // Only click if we need to change state
      }
      if (value) {
        if (!(checkbox as HTMLInputElement).checked) {
          fireEvent.click(checkbox);
        }
      } else {
        if ((checkbox as HTMLInputElement).checked) {
          fireEvent.click(checkbox);
        }
      }
      continue;
    }

    if (label === 'Special Notes') {
      const textarea = screen.getByPlaceholderText('Optional handling instructions or notes');
      fireEvent.change(textarea, { target: { value } });
      continue;
    }

    // Select inputs
    if (['Product Type', 'Handling Method', 'Stack Permission', 'Orientation'].includes(label)) {
      const select = screen.getByLabelText(new RegExp(`^${label.replace(/[()]/g, '\\$&')}`));
      fireEvent.change(select, { target: { value } });
      continue;
    }

    // Regular inputs
    const input = screen.getByLabelText(new RegExp(`^${label.replace(/[()]/g, '\\$&')}`));
    fireEvent.change(input, { target: { value } });
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ManualEntryForm: Rendering', () => {
  it('renders the form with all required fields', () => {
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={[]} onItemsChange={onItemsChange} />);

    // Check that all required form fields are present
    expect(screen.getByLabelText(/Order Number/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Customer Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Delivery Stop/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Product Type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantity/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Piece Weight/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Length/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Width/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Height\/Diameter/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Total Line Weight/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Handling Method/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stack Permission/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Orientation/)).toBeInTheDocument();
    expect(screen.getByText('Dunnage Required')).toBeInTheDocument();
    expect(screen.getByText('Special Notes')).toBeInTheDocument();
  });

  it('shows "Add Item" button when not editing', () => {
    render(<ManualEntryForm items={[]} onItemsChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add Item/ })).toBeInTheDocument();
  });

  it('does not show items table when list is empty', () => {
    render(<ManualEntryForm items={[]} onItemsChange={vi.fn()} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('displays existing items in a table', () => {
    const items = [buildValidItem(), buildValidItem({ orderNumber: 'ORD-002' })];
    render(<ManualEntryForm items={items} onItemsChange={vi.fn()} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
    expect(screen.getByText('Line Items (2)')).toBeInTheDocument();
  });
});

describe('ManualEntryForm: Adding Items', () => {
  it('adds a valid item to the list', () => {
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={[]} onItemsChange={onItemsChange} />);

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const newItems = onItemsChange.mock.calls[0][0] as SteelOrderLineItem[];
    expect(newItems).toHaveLength(1);
    expect(newItems[0].orderNumber).toBe('ORD-001');
    expect(newItems[0].customerName).toBe('Acme Steel Co');
    expect(newItems[0].deliveryStop).toBe(1);
    expect(newItems[0].productType).toBe('coil_hot_rolled');
    expect(newItems[0].quantity).toBe(3);
    expect(newItems[0].pieceWeight).toBe(5000);
    expect(newItems[0].dimensions.length).toBe(48);
    expect(newItems[0].dimensions.width).toBe(48);
    expect(newItems[0].dimensions.height).toBe(36);
    expect(newItems[0].totalLineWeight).toBe(15000);
    expect(newItems[0].handlingMethod).toBe('crane');
    expect(newItems[0].stackPermission).toBe('no');
    expect(newItems[0].orientationRequirement).toBe('longitudinal');
    expect(newItems[0].dunnageRequired).toBe(true);
    expect(newItems[0].specialNotes).toBe('Handle with care');
  });

  it('auto-calculates total line weight when not provided', () => {
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={[]} onItemsChange={onItemsChange} />);

    fillForm({ 'Total Line Weight (lbs)': '' });
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const newItems = onItemsChange.mock.calls[0][0] as SteelOrderLineItem[];
    expect(newItems[0].totalLineWeight).toBe(15000); // 3 * 5000
  });
});

describe('ManualEntryForm: Inline Validation', () => {
  it('shows validation errors when required fields are empty', () => {
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={[]} onItemsChange={onItemsChange} />);

    // Submit without filling any fields
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));

    // Should not call onItemsChange
    expect(onItemsChange).not.toHaveBeenCalled();

    // Should show error alert
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows error for missing order number', () => {
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={[]} onItemsChange={onItemsChange} />);

    fillForm({ 'Order Number': '' });
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));

    expect(onItemsChange).not.toHaveBeenCalled();
    // Error appears in both summary and inline — use getAllByText
    const errors = screen.getAllByText(/Order number is required/i);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error for invalid delivery stop (zero)', () => {
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={[]} onItemsChange={onItemsChange} />);

    fillForm({ 'Delivery Stop': '0' });
    const form = screen.getByRole('form');
    fireEvent.submit(form);

    expect(onItemsChange).not.toHaveBeenCalled();
    // Error appears in both summary and inline — use getAllByText
    const errors = screen.getAllByText(/Delivery stop must be a positive integer/i);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error for invalid product type', () => {
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={[]} onItemsChange={onItemsChange} />);

    fillForm({ 'Product Type': 'invalid_type' });
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));

    expect(onItemsChange).not.toHaveBeenCalled();
    // Error appears in both summary and inline — use getAllByText
    const errors = screen.getAllByText(/Invalid product type/i);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('clears field error when user corrects the value', () => {
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={[]} onItemsChange={onItemsChange} />);

    // Trigger error by submitting with empty order number
    fillForm({ 'Order Number': '' });
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));

    const errors = screen.getAllByText(/Order number is required/i);
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // Fix the value - error should clear
    const input = screen.getByLabelText(/Order Number/);
    fireEvent.change(input, { target: { value: 'ORD-FIX' } });

    expect(screen.queryByText(/Order number is required/i)).not.toBeInTheDocument();
  });
});

describe('ManualEntryForm: Editing Items', () => {
  it('loads item data into form when Edit is clicked', () => {
    const items = [buildValidItem()];
    render(<ManualEntryForm items={items} onItemsChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Edit item ORD-001/ }));

    // Form should show "Update Item" button instead of "Add Item"
    expect(screen.getByRole('button', { name: /Update Item/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();

    // Form fields should be populated
    expect((screen.getByLabelText(/Order Number/) as HTMLInputElement).value).toBe('ORD-001');
    expect((screen.getByLabelText(/Customer Name/) as HTMLInputElement).value).toBe('Acme Steel Co');
    expect((screen.getByLabelText(/Delivery Stop/) as HTMLInputElement).value).toBe('1');
  });

  it('updates item when form is submitted during edit mode', () => {
    const items = [buildValidItem()];
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={items} onItemsChange={onItemsChange} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit item ORD-001/ }));

    // Change the customer name
    const customerInput = screen.getByLabelText(/Customer Name/);
    fireEvent.change(customerInput, { target: { value: 'New Customer' } });

    // Submit update
    fireEvent.click(screen.getByRole('button', { name: /Update Item/ }));

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const updatedItems = onItemsChange.mock.calls[0][0] as SteelOrderLineItem[];
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].customerName).toBe('New Customer');
  });

  it('cancels editing and resets form', () => {
    const items = [buildValidItem()];
    render(<ManualEntryForm items={items} onItemsChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Edit item ORD-001/ }));
    expect(screen.getByRole('button', { name: /Update Item/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));

    // Should show Add Item again
    expect(screen.getByRole('button', { name: /Add Item/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();

    // Form should be cleared
    expect((screen.getByLabelText(/Order Number/) as HTMLInputElement).value).toBe('');
  });
});

describe('ManualEntryForm: Removing Items', () => {
  it('removes an item from the list', () => {
    const items = [
      buildValidItem({ orderNumber: 'ORD-001' }),
      buildValidItem({ orderNumber: 'ORD-002' }),
    ];
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={items} onItemsChange={onItemsChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Remove item ORD-001/ }));

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const updatedItems = onItemsChange.mock.calls[0][0] as SteelOrderLineItem[];
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].orderNumber).toBe('ORD-002');
  });

  it('cancels edit mode if the edited item is removed', () => {
    const items = [buildValidItem()];
    const onItemsChange = vi.fn();
    render(<ManualEntryForm items={items} onItemsChange={onItemsChange} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit item ORD-001/ }));
    expect(screen.getByRole('button', { name: /Update Item/ })).toBeInTheDocument();

    // Remove the item being edited
    fireEvent.click(screen.getByRole('button', { name: /Remove item ORD-001/ }));

    // Should return to "Add Item" mode
    expect(screen.getByRole('button', { name: /Add Item/ })).toBeInTheDocument();
  });
});

describe('ManualEntryForm: Product Type Coverage', () => {
  it('offers all 22 steel product types in the select dropdown', () => {
    render(<ManualEntryForm items={[]} onItemsChange={vi.fn()} />);

    const productTypeSelect = screen.getByLabelText(/Product Type/) as HTMLSelectElement;
    // 22 product types + 1 empty "— Select —" option
    expect(productTypeSelect.options.length).toBe(23);
  });
});
