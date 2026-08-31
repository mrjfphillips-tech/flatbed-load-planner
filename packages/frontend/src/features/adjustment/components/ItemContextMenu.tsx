// ─── Item Context Menu ───────────────────────────────────────────────────────
// A floating menu that appears when an item is selected, providing actions:
// toggle orientation, initiate swap, remove from load.

import { useAdjustmentStore } from '../adjustment-store';

interface ItemContextMenuProps {
  /** The order number of the selected item */
  itemId: string;
  /** Screen position for the menu */
  position: { x: number; y: number };
  /** Called when the menu should close */
  onClose: () => void;
}

export function ItemContextMenu({ itemId, position, onClose }: ItemContextMenuProps) {
  const { toggleOrientation, removeItem, setMode } = useAdjustmentStore();

  const handleRotate = () => {
    toggleOrientation(itemId);
    onClose();
  };

  const handleSwap = () => {
    setMode('swap');
    useAdjustmentStore.getState().selectForSwap(itemId);
    onClose();
  };

  const handleRemove = () => {
    removeItem(itemId);
    onClose();
  };

  return (
    <div
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Item actions"
      data-testid="item-context-menu"
    >
      <button
        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
        onClick={handleRotate}
        role="menuitem"
        data-testid="action-rotate"
      >
        <span aria-hidden="true">↻</span>
        Toggle Orientation
      </button>
      <button
        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
        onClick={handleSwap}
        role="menuitem"
        data-testid="action-swap"
      >
        <span aria-hidden="true">⇄</span>
        Swap with Another Item
      </button>
      <hr className="my-1 border-gray-100" />
      <button
        className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
        onClick={handleRemove}
        role="menuitem"
        data-testid="action-remove"
      >
        <span aria-hidden="true">✕</span>
        Remove from Load
      </button>
    </div>
  );
}
