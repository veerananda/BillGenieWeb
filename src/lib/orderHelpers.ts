import type { Order } from '../services/api';

/** Counter/takeaway order — not tied to a restaurant table. */
export function isCounterOrder(order: Order | null | undefined): boolean {
  if (!order) return false;
  if (order.order_type === 'counter') return true;
  if (order.order_type === 'dine_in') return false;

  const tableId = order.table_id;
  if (tableId && String(tableId).startsWith('self-service')) return true;

  const customerName = order.customer_name ?? '';
  return ['Self Service', 'Takeaway', 'Counter'].includes(customerName);
}

/** Daily ticket number shown on counter orders and kitchen display. */
export function getCounterTicketNumber(order: Order | null | undefined): number | undefined {
  if (!order) return undefined;
  const ticket = order.ticket_number;
  if (ticket && ticket > 0) return ticket;
  if (isCounterOrder(order)) {
    const num = order.order_number;
    if (num && num > 0) return num;
  }
  return undefined;
}

/** Prepared progress for counter/kitchen lists (matches scanner: ready|served). */
export function getOrderItemPrepProgress(
  items?: Array<{ status?: string }> | null
): { prepared: number; total: number } {
  const active = (items || []).filter((item) => item?.status !== 'cancelled');
  const prepared = active.filter(
    (item) => item.status === 'ready' || item.status === 'served'
  ).length;
  return { prepared, total: active.length };
}

/** Small status hint, e.g. "1 of 2 items prepared". Empty when none/all done or no items. */
export function formatOrderItemPrepProgress(
  items?: Array<{ status?: string }> | null
): string {
  const { prepared, total } = getOrderItemPrepProgress(items);
  if (total <= 0 || prepared >= total) return '';
  return `${prepared} of ${total} item${total === 1 ? '' : 's'} prepared`;
}

type MenuLookupItem = { id: string; name?: string; category?: string };

/**
 * Build a readable line-item label, e.g. "Veg" under category "Biryani" → "Veg Biryani".
 */
export function getOrderItemDisplayName(
  itemName?: string | null,
  categoryName?: string | null
): string {
  const name = String(itemName ?? '').trim();
  const category = String(categoryName ?? '').trim();

  if (!name) return category || 'Unknown Item';
  if (!category) return name;

  const nameLower = name.toLowerCase();
  const categoryLower = category.toLowerCase();

  if (nameLower === categoryLower) return name;
  if (nameLower.includes(categoryLower)) return name;

  if (!/\s/.test(name)) {
    return `${name} ${category}`;
  }

  return name;
}

/** Append `(Half)` etc. when variant is present and not Regular. */
export function formatVariantLabelSuffix(variantLabel?: string | null): string {
  const label = String(variantLabel ?? '').trim();
  if (!label || label.toLowerCase() === 'regular') return '';
  return ` (${label})`;
}

function withVariantLabel(name: string, variantLabel?: string | null): string {
  return `${name}${formatVariantLabelSuffix(variantLabel)}`;
}

/** Split order line into item name and category for stacked display. */
export function resolveOrderItemParts(
  item: {
    menu_id?: string;
    name?: string;
    menu_item?: { name?: string; category?: string };
    category?: string;
    variant_label?: string;
  },
  menuItems?: MenuLookupItem[]
): { name: string; category: string } {
  const menuId = item.menu_id;
  let rawName = String(item.menu_item?.name ?? item.name ?? '').trim();

  let category = String(item.menu_item?.category ?? item.category ?? '').trim();
  const variantLabel = item.variant_label;

  if (menuItems?.length) {
    if (menuId) {
      const match = menuItems.find((m) => m.id === menuId);
      if (match) {
        const menuName = String(match.name ?? '').trim();
        const menuCategory = String(match.category ?? '').trim();
        if (menuName) {
          // Keep server display names like "Biryani (Half)" when variant_label is missing.
          if (
            !variantLabel &&
            rawName &&
            rawName !== menuName &&
            /\(.+\)\s*$/.test(rawName)
          ) {
            return {
              name: rawName,
              category: menuCategory || category,
            };
          }
          return {
            name: withVariantLabel(menuName, variantLabel),
            category: menuCategory || category,
          };
        }
      }
    }

    if (!category) {
      const byDisplayName = menuItems.find(
        (m) =>
          getOrderItemDisplayName(m.name, m.category).toLowerCase() ===
          rawName.toLowerCase()
      );
      if (byDisplayName) {
        return {
          name: withVariantLabel(String(byDisplayName.name ?? '').trim(), variantLabel),
          category: String(byDisplayName.category ?? '').trim(),
        };
      }
    }

    if (!category && rawName.includes(' ')) {
      const categories = [
        ...new Set(
          menuItems
            .map((m) => String(m.category ?? '').trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => b.length - a.length);

      for (const cat of categories) {
        const suffix = ` ${cat}`;
        if (
          rawName.toLowerCase().endsWith(suffix.toLowerCase()) &&
          rawName.length > suffix.length
        ) {
          const stripped = rawName.slice(0, -suffix.length).trim();
          if (stripped) {
            return { name: withVariantLabel(stripped, variantLabel), category: cat };
          }
        }
      }
    }
  }

  if (!rawName) {
    return { name: withVariantLabel(category || 'Unknown Item', variantLabel), category: '' };
  }

  if (category) {
    const suffix = ` ${category}`;
    if (
      rawName.toLowerCase().endsWith(suffix.toLowerCase()) &&
      rawName.length > suffix.length
    ) {
      const stripped = rawName.slice(0, -suffix.length).trim();
      if (stripped) {
        return { name: withVariantLabel(stripped, variantLabel), category };
      }
    } else if (rawName.toLowerCase() === category.toLowerCase()) {
      return { name: withVariantLabel(rawName, variantLabel), category: '' };
    }
  }

  return { name: withVariantLabel(rawName, variantLabel), category };
}

export function getOrderItemGroupKey(item: {
  menuId?: string;
  name: string;
  category?: string;
  variantId?: string | null;
  variantLabel?: string | null;
}): string {
  const base = item.menuId || `${item.name}::${item.category || ''}`;
  const variantKey = item.variantId || item.variantLabel || '';
  return variantKey ? `${base}::${variantKey}` : base;
}

/** Resolve display name from an order line, using menu_item/category or menu cache. */
export function resolveOrderItemName(
  item: {
    menu_id?: string;
    name?: string;
    menu_item?: { name?: string; category?: string };
    category?: string;
    variant_label?: string;
  },
  menuItems?: MenuLookupItem[]
): string {
  const menuId = item.menu_id;
  let rawName = String(item.menu_item?.name ?? item.name ?? '').trim();
  let category = item.menu_item?.category ?? item.category;

  if (menuItems?.length && menuId) {
    const match = menuItems.find((m) => m.id === menuId);
    if (match) {
      const menuName = String(match.name ?? '').trim();
      if (!rawName) rawName = menuName;
      if (!category) category = match.category;
      // Prefer server name that already encodes a portion when label is missing.
      if (
        !item.variant_label &&
        rawName &&
        menuName &&
        rawName !== menuName &&
        /\(.+\)\s*$/.test(rawName)
      ) {
        return rawName;
      }
    }
  }

  if (!rawName) {
    return withVariantLabel(category?.trim() || 'Unknown Item', item.variant_label);
  }

  return withVariantLabel(getOrderItemDisplayName(rawName, category), item.variant_label);
}

type OrderItemLike = { status?: string };

export function isBillableOrderItem(item: OrderItemLike | null | undefined): boolean {
  return Boolean(item) && item!.status !== 'cancelled';
}

export function isServedOrderItem(
  item: OrderItemLike | null | undefined,
  kitchenEnabled: boolean
): boolean {
  return Boolean(kitchenEnabled && item && item.status === 'served');
}

export function isAdjustableOrderItem(
  item: OrderItemLike | null | undefined,
  kitchenEnabled: boolean
): boolean {
  return isBillableOrderItem(item) && !isServedOrderItem(item, kitchenEnabled);
}

export function orderHasServedItems(
  order: { items?: OrderItemLike[] } | null | undefined,
  kitchenEnabled: boolean
): boolean {
  if (!kitchenEnabled || !order?.items?.length) return false;
  return order.items.some((item) => isServedOrderItem(item, kitchenEnabled));
}
