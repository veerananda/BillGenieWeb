import { formatOrderLineDisplayName } from '../../../lib/orderHelpers';
import type { MenuItem } from '../../../store/menuSlice';
import type { Order, OrderItem, RestaurantTable } from '../../../services/api';

export function cartLineKey(menuItemId: string, variantId?: string) {
  return `${menuItemId}::${variantId ?? ''}`;
}

export function cartDisplayName(
  item: MenuItem,
  variantLabel: string | undefined,
  categoryBlocklist: string[] | null | undefined,
) {
  return formatOrderLineDisplayName(item.name, item.category, { categoryBlocklist }, variantLabel);
}

export function fmt(n: number | undefined | null) {
  return `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function resolveItemTotal(item: OrderItem, menuMap: Map<string, MenuItem>): number {
  if (item.total > 0) return item.total;
  const price = item.unit_rate || item.menu_item?.price || menuMap.get(item.menu_id)?.price || 0;
  return price * item.quantity;
}

export function getDerivedItemStatus(order: Order): 'ready' | 'cooking' | null {
  const items = (order.items ?? []).filter((i) => i.status !== 'cancelled');
  if (items.some((i) => i.status === 'ready')) return 'ready';
  if (items.some((i) => i.status === 'cooking')) return 'cooking';
  return null;
}

export function hasUnacknowledgedKitchenCancels(
  order: Order | undefined,
  acknowledgedByOrderId: Record<string, string[]>
): boolean {
  if (!order?.items?.length) return false;
  const acked = new Set(acknowledgedByOrderId[order.id] || []);
  return order.items.some((i) => i.status === 'cancelled' && !acked.has(i.id));
}

export function getUnacknowledgedCancelledCount(
  order: Order | undefined,
  acknowledgedByOrderId: Record<string, string[]>
): number {
  if (!order?.items?.length) return 0;
  const acked = new Set(acknowledgedByOrderId[order.id] || []);
  return order.items.filter((i) => i.status === 'cancelled' && !acked.has(i.id)).length;
}

export function billableItems(order: Order | undefined): OrderItem[] {
  return (order?.items ?? []).filter((i) => i.status !== 'cancelled');
}

export function billSubtotal(order: Order): number {
  const fromItems = billableItems(order).reduce((sum, item) => {
    if (item.total > 0) return sum + item.total;
    return sum + (item.unit_rate || 0) * item.quantity;
  }, 0);
  if (fromItems > 0) return fromItems;
  return order.sub_total > 0 ? order.sub_total : order.total;
}

export function tableNeedsAssistance(table: RestaurantTable): boolean {
  return Boolean(table.assistance_requested_at);
}
