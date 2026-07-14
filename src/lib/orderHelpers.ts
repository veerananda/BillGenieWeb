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

/** Split order line into item name and category for stacked display. */
export function resolveOrderItemParts(
  item: {
    menu_id?: string;
    name?: string;
    menu_item?: { name?: string; category?: string };
    category?: string;
  },
  menuItems?: MenuLookupItem[]
): { name: string; category: string } {
  const menuId = item.menu_id;
  let rawName = String(item.menu_item?.name ?? item.name ?? '').trim();

  let category = String(item.menu_item?.category ?? item.category ?? '').trim();

  if (menuItems?.length) {
    if (menuId) {
      const match = menuItems.find((m) => m.id === menuId);
      if (match) {
        const menuName = String(match.name ?? '').trim();
        const menuCategory = String(match.category ?? '').trim();
        if (menuName) {
          return {
            name: menuName,
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
          name: String(byDisplayName.name ?? '').trim(),
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
            return { name: stripped, category: cat };
          }
        }
      }
    }
  }

  if (!rawName) {
    return { name: category || 'Unknown Item', category: '' };
  }

  if (category) {
    const suffix = ` ${category}`;
    if (
      rawName.toLowerCase().endsWith(suffix.toLowerCase()) &&
      rawName.length > suffix.length
    ) {
      const stripped = rawName.slice(0, -suffix.length).trim();
      if (stripped) {
        return { name: stripped, category };
      }
    } else if (rawName.toLowerCase() === category.toLowerCase()) {
      return { name: rawName, category: '' };
    }
  }

  return { name: rawName, category };
}

export function getOrderItemGroupKey(item: {
  menuId?: string;
  name: string;
  category?: string;
}): string {
  return item.menuId || `${item.name}::${item.category || ''}`;
}

/** Resolve display name from an order line, using menu_item/category or menu cache. */
export function resolveOrderItemName(
  item: {
    menu_id?: string;
    name?: string;
    menu_item?: { name?: string; category?: string };
    category?: string;
  },
  menuItems?: MenuLookupItem[]
): string {
  const menuId = item.menu_id;
  let rawName = String(item.menu_item?.name ?? item.name ?? '').trim();
  let category = item.menu_item?.category ?? item.category;

  if (menuItems?.length && menuId) {
    const match = menuItems.find((m) => m.id === menuId);
    if (match) {
      if (!rawName) rawName = String(match.name ?? '').trim();
      if (!category) category = match.category;
    }
  }

  if (!rawName) return category?.trim() || 'Unknown Item';

  return getOrderItemDisplayName(rawName, category);
}
