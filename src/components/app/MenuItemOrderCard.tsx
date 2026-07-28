import { Beef, Leaf, Minus, Plus } from 'lucide-react';
import type { MenuItem, MenuItemVariant } from '../../services/api';
import { availableMenuVariants, formatOrderLineDisplayName } from '../../lib/orderHelpers';

function variantUnitPrice(item: MenuItem, variant?: MenuItemVariant) {
  return variant?.price ?? item.price;
}

export interface MenuItemOrderCardProps {
  item: MenuItem;
  /** Quantity in cart for a specific variant (empty variantId = base/single). */
  getPortionQty: (itemId: string, variantId?: string) => number;
  onAdd: (item: MenuItem, variant?: MenuItemVariant) => void;
  onChangeQty: (item: MenuItem, variant: MenuItemVariant | undefined, delta: number) => void;
  /** Restaurant category_display_blocklist — section labels stay off the dish name. */
  categoryBlocklist?: string[] | null;
}

/**
 * Menu row for counter / take-order — matches app: multi-portion items show
 * inline portion rows with Add or −/qty/+ instead of a choose-portion modal.
 */
export function MenuItemOrderCard({
  item,
  getPortionQty,
  onAdd,
  onChangeQty,
  categoryBlocklist,
}: MenuItemOrderCardProps) {
  const variants = availableMenuVariants(item);
  const multiPortion = variants.length > 1;
  const singleVariant = multiPortion ? undefined : variants[0];
  const singleQty = getPortionQty(item.id, singleVariant?.id);
  const displayName = formatOrderLineDisplayName(item.name, item.category, {
    categoryBlocklist,
  });

  const priceLabel = multiPortion
    ? variants
        .map((v) => `${v.label || 'Regular'} ₹${variantUnitPrice(item, v).toFixed(0)}`)
        .join(' · ')
    : `₹${variantUnitPrice(item, singleVariant).toLocaleString('en-IN')}`;

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.is_veg ? <Leaf size={14} color="#22c55e" className="shrink-0" /> : <Beef size={14} color="#dc2626" className="shrink-0" />}
            <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
          </div>
          <p className="mt-0.5 pl-6 text-xs font-semibold text-gray-700">{priceLabel}</p>
          {multiPortion ? (
            <p className="mt-0.5 pl-6 text-xs text-gray-400">Choose a portion below</p>
          ) : null}
        </div>

        {!multiPortion ? (
          <div className="shrink-0">
            {singleQty === 0 ? (
              <button
                type="button"
                onClick={() => onAdd(item, singleVariant)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Add
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChangeQty(item, singleVariant, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-red-50 hover:text-red-600"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-gray-900">{singleQty}</span>
                <button
                  type="button"
                  onClick={() => onChangeQty(item, singleVariant, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-primary/10 hover:text-primary"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {multiPortion ? (
        <div className="mt-2.5 space-y-2">
          {variants.map((variant) => {
            const portionQty = getPortionQty(item.id, variant.id);
            return (
              <div
                key={variant.id || variant.label}
                className="flex items-center justify-between gap-3 rounded-[10px] bg-gray-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{variant.label || 'Regular'}</p>
                  <p className="text-xs font-semibold text-primary">
                    ₹{variantUnitPrice(item, variant).toFixed(2)}
                  </p>
                </div>
                <div className="shrink-0">
                  {portionQty === 0 ? (
                    <button
                      type="button"
                      onClick={() => onAdd(item, variant)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onChangeQty(item, variant, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Decrease ${variant.label}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-gray-900">{portionQty}</span>
                      <button
                        type="button"
                        onClick={() => onChangeQty(item, variant, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-primary/10 hover:text-primary"
                        aria-label={`Increase ${variant.label}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
