// ─── Unassigned Items List ───────────────────────────────────────────────────
// Displays items that have been removed from the load plan and allows
// restoring them back to the deck.

import { useAdjustmentStore } from '../adjustment-store';

export function UnassignedItemsList() {
  const { unassignedItems, restoreItem } = useAdjustmentStore();

  if (unassignedItems.length === 0) return null;

  return (
    <div
      className="border border-amber-200 bg-amber-50 rounded-lg p-3"
      data-testid="unassigned-items-list"
      role="region"
      aria-label="Unassigned items"
    >
      <h3 className="text-sm font-medium text-amber-800 mb-2">
        Unassigned Items ({unassignedItems.length})
      </h3>
      <ul className="space-y-1">
        {unassignedItems.map((placed) => (
          <li
            key={placed.item.orderNumber}
            className="flex items-center justify-between bg-white rounded px-2 py-1.5 border border-amber-100"
            data-testid={`unassigned-item-${placed.item.orderNumber}`}
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate block">
                {placed.item.orderNumber}
              </span>
              <span className="text-xs text-gray-500">
                {placed.item.productType.replace(/_/g, ' ')} —{' '}
                {placed.item.totalLineWeight.toLocaleString()} lbs
              </span>
            </div>
            <button
              className="text-xs text-blue-600 hover:text-blue-800 underline ml-2 whitespace-nowrap"
              onClick={() => restoreItem(placed.item.orderNumber)}
              data-testid={`restore-btn-${placed.item.orderNumber}`}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
