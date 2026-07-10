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

  if (!category) return rawName;

  const nameLower = rawName.toLowerCase();
  const categoryLower = category.toLowerCase();
  if (nameLower === categoryLower) return rawName;
  if (nameLower.includes(categoryLower)) return rawName;
  if (!/\s/.test(rawName)) return `${rawName} ${category}`;
  return rawName;
}
