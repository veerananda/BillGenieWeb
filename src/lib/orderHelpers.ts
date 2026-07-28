import type { Order, MenuItem, MenuItemVariant } from '../services/api';

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

export type ItemDisplayNameOptions = {
  /** Extra restaurant-defined section labels that must not append into the dish name. */
  categoryBlocklist?: string[] | null;
};

const BUILTIN_CATEGORY_DISPLAY_BLOCKLIST = new Set([
  'main course',
  'main courses',
  'mains',
  'starter',
  'starters',
  'appetizer',
  'appetizers',
  'starter/appetizer',
  'beverage',
  'beverages',
  'drink',
  'drinks',
  'dessert',
  'desserts',
  'sweet',
  'sweets',
  'snack',
  'snacks',
  'bread',
  'breads',
  'roti',
  'rotis',
  'combo',
  'combos',
  'special',
  'specials',
  'other',
  'others',
  'miscellaneous',
  'misc',
  'addon',
  'add-on',
  'add ons',
  'add-ons',
  'side',
  'sides',
  'accompaniment',
  'accompaniments',
]);

function normalizeCategoryKey(category: string): string {
  return category.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** True when category is a menu section label (built-in or restaurant custom). */
export function isBlockedDisplayCategory(
  categoryName?: string | null,
  extraBlocklist?: string[] | null
): boolean {
  const key = normalizeCategoryKey(String(categoryName ?? ''));
  if (!key) return false;
  if (BUILTIN_CATEGORY_DISPLAY_BLOCKLIST.has(key)) return true;
  return (extraBlocklist ?? []).some((item) => normalizeCategoryKey(item) === key);
}

/**
 * Build a readable line-item label once (smart rules).
 * - "Veg" + "Biryani" → "Veg Biryani"
 * - "chitti mutyalu chicken" + "Pulao" → "chitti mutyalu chicken Pulao"
 * - "Paneer Butter Masala" + "Main Course" → "Paneer Butter Masala"
 */
export function getOrderItemDisplayName(
  itemName?: string | null,
  categoryName?: string | null,
  options?: ItemDisplayNameOptions
): string {
  const name = String(itemName ?? '').trim();
  const category = String(categoryName ?? '').trim();

  if (!name) return category || 'Unknown Item';
  if (!category) return name;

  const nameLower = name.toLowerCase();
  const categoryLower = category.toLowerCase();

  if (nameLower === categoryLower) return name;
  if (nameLower.includes(categoryLower)) return name;
  if (isBlockedDisplayCategory(category, options?.categoryBlocklist)) return name;

  return `${name} ${category}`;
}

/** Append `(Half)` etc. when variant is present and not Regular. */
export function formatVariantLabelSuffix(variantLabel?: string | null): string {
  const label = String(variantLabel ?? '').trim();
  if (!label || label.toLowerCase() === 'regular') return '';
  return ` (${label})`;
}

/** Available portion options for ordering (excludes unavailable variants). */
export function availableMenuVariants(item: MenuItem | null | undefined): MenuItemVariant[] {
  return (item?.variants ?? []).filter((v) => v.is_available !== false);
}

function withVariantLabel(name: string, variantLabel?: string | null): string {
  return `${name}${formatVariantLabelSuffix(variantLabel)}`;
}

/**
 * Final label for bills/print. Prefer calling once and reusing the result
 * (e.g. store as `displayName` on grouped order lines).
 */
export function formatOrderLineDisplayName(
  itemName?: string | null,
  categoryName?: string | null,
  options?: ItemDisplayNameOptions | null,
  variantLabel?: string | null
): string {
  const raw = String(itemName ?? '').trim();
  let base = raw;
  let label = String(variantLabel ?? '').trim();

  if (!label) {
    const match = raw.match(/^(.*) \(([^)]+)\)\s*$/);
    if (match) {
      base = match[1].trim();
      label = match[2].trim();
    }
  }

  const combined = getOrderItemDisplayName(base || raw, categoryName, options ?? undefined);
  if (!label || label.toLowerCase() === 'regular') return combined;
  return withVariantLabel(combined, label);
}

/** Split order line into item name, category, and a once-derived displayName. */
export function resolveOrderItemParts(
  item: {
    menu_id?: string;
    name?: string;
    menu_item?: { name?: string; category?: string };
    category?: string;
    variant_label?: string;
  },
  menuItems?: MenuLookupItem[],
  options?: ItemDisplayNameOptions
): { name: string; category: string; displayName: string } {
  const finish = (name: string, category: string) => ({
    name,
    category,
    displayName: formatOrderLineDisplayName(name, category, options),
  });

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
            return finish(rawName, menuCategory || category);
          }
          return finish(withVariantLabel(menuName, variantLabel), menuCategory || category);
        }
      }
    }

    if (!category) {
      const byDisplayName = menuItems.find(
        (m) =>
          getOrderItemDisplayName(m.name, m.category, options).toLowerCase() ===
          rawName.toLowerCase()
      );
      if (byDisplayName) {
        return finish(
          withVariantLabel(String(byDisplayName.name ?? '').trim(), variantLabel),
          String(byDisplayName.category ?? '').trim(),
        );
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
            return finish(withVariantLabel(stripped, variantLabel), cat);
          }
        }
      }
    }
  }

  if (!rawName) {
    return finish(withVariantLabel(category || 'Unknown Item', variantLabel), '');
  }

  if (category) {
    const suffix = ` ${category}`;
    if (
      rawName.toLowerCase().endsWith(suffix.toLowerCase()) &&
      rawName.length > suffix.length
    ) {
      const stripped = rawName.slice(0, -suffix.length).trim();
      if (stripped) {
        return finish(withVariantLabel(stripped, variantLabel), category);
      }
    } else if (rawName.toLowerCase() === category.toLowerCase()) {
      return finish(withVariantLabel(rawName, variantLabel), '');
    }
  }

  return finish(withVariantLabel(rawName, variantLabel), category);
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

/** Resolve display name from an order line (derived once via resolveOrderItemParts). */
export function resolveOrderItemName(
  item: {
    menu_id?: string;
    name?: string;
    menu_item?: { name?: string; category?: string };
    category?: string;
    variant_label?: string;
  },
  menuItems?: MenuLookupItem[],
  options?: ItemDisplayNameOptions
): string {
  return resolveOrderItemParts(item, menuItems, options).displayName;
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
