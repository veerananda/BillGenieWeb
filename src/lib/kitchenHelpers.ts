import type { Order } from '../services/api';
import type { RestaurantTable } from '../services/api';
import {
  getCounterTicketNumber,
  isCounterOrder,
  resolveOrderItemParts,
} from './orderHelpers';

export type KitchenItemStatus = 'pending' | 'cooking' | 'ready' | 'served';

export interface KotTicketItem {
  id: string;
  orderId: string;
  name: string;
  category?: string;
  quantity: number;
  notes?: string;
  status: KitchenItemStatus;
  menuId?: string;
  createdAt: number;
}

export interface KotTicket {
  key: string;
  kotNumber: number;
  orderId: string;
  subId: string;
  tableLabel: string;
  customerName: string;
  isSelfService: boolean;
  serviceMode?: string;
  isAddOn: boolean;
  firedAt: number;
  items: KotTicketItem[];
}

export interface PrepSummaryLine {
  menuId: string;
  name: string;
  category?: string;
  totalQty: number;
}

const LEGACY_SUB_PREFIX = '__legacy__';

export function isActiveKitchenItem(status?: string): boolean {
  return status !== 'ready' && status !== 'served';
}

export function isReadilyAvailableMenuItem(
  menuId: string | undefined,
  menuItems: Array<{ id: string; readily_available?: boolean }> = []
): boolean {
  if (!menuId) return false;
  const match = menuItems.find((m) => m.id === menuId);
  return Boolean(match?.readily_available);
}

function resolveTableLabel(order: Order, tables: Pick<RestaurantTable, 'id' | 'name'>[]): string {
  if (isCounterOrder(order)) {
    const ticket = getCounterTicketNumber(order);
    return ticket ? String(ticket) : String(order.table_number ?? '?');
  }
  const tableId = order.table_id;
  if (tableId) {
    const table = tables.find((t) => t.id === tableId);
    if (table?.name) return table.name;
  }
  const label = String(order.table_number ?? '').trim();
  return label || '?';
}

function parseItemCreatedAt(item: Order['items'][number], order: Order): number {
  const raw = item.created_at;
  if (raw) {
    const parsed = new Date(raw).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  const orderCreated = order.created_at ? new Date(order.created_at).getTime() : NaN;
  return Number.isNaN(orderCreated) ? Date.now() : orderCreated;
}

function ticketSubId(item: Order['items'][number], orderId: string): string {
  const raw = String(item.sub_id ?? '').trim();
  if (raw) return raw;
  return `${LEGACY_SUB_PREFIX}${orderId}`;
}

/** Build FIFO KOT tickets grouped by order + sub_id (one ticket per kitchen fire). */
export function buildKotTickets(
  sourceOrders: Order[],
  tables: Pick<RestaurantTable, 'id' | 'name'>[] = [],
  menuItems: Array<{ id: string; name?: string; category?: string; readily_available?: boolean }> = []
): KotTicket[] {
  const ticketMap = new Map<
    string,
    Omit<KotTicket, 'kotNumber' | 'isAddOn'> & { firedAt: number }
  >();

  for (const order of sourceOrders) {
    if (!order?.id) continue;
    if (order.status === 'completed' || order.status === 'cancelled') continue;

    const activeItems = (order.items ?? []).filter(
      (it) =>
        isActiveKitchenItem(it.status) &&
        !isReadilyAvailableMenuItem(it.menu_id, menuItems)
    );
    if (activeItems.length === 0) continue;

    const tableLabel = resolveTableLabel(order, tables);
    const isSelfService = isCounterOrder(order);

    for (const item of activeItems) {
      const subId = ticketSubId(item, order.id);
      const key = `${order.id}:${subId}`;
      const created = parseItemCreatedAt(item, order);
      const parts = resolveOrderItemParts(item, menuItems);

      const kotItem: KotTicketItem = {
        id: item.id,
        orderId: order.id,
        name: parts.name,
        category: parts.category || undefined,
        quantity: item.quantity,
        notes: item.notes?.trim() || undefined,
        status: (item.status || 'pending') as KitchenItemStatus,
        menuId: item.menu_id,
        createdAt: created,
      };

      const existing = ticketMap.get(key);
      if (existing) {
        existing.items.push(kotItem);
        existing.firedAt = Math.min(existing.firedAt, created);
      } else {
        ticketMap.set(key, {
          key,
          orderId: order.id,
          subId,
          tableLabel,
          customerName: order.customer_name || 'Guest',
          isSelfService,
          serviceMode: order.service_mode,
          firedAt: created,
          items: [kotItem],
        });
      }
    }
  }

  const sorted = Array.from(ticketMap.values()).sort((a, b) => {
    if (a.firedAt !== b.firedAt) return a.firedAt - b.firedAt;
    return a.key.localeCompare(b.key);
  });

  const firstSubByOrder = new Map<string, string>();
  for (const ticket of sorted) {
    if (!firstSubByOrder.has(ticket.orderId)) {
      firstSubByOrder.set(ticket.orderId, ticket.subId);
    }
  }

  return sorted.map((ticket, index) => ({
    ...ticket,
    kotNumber: index + 1,
    isAddOn: firstSubByOrder.get(ticket.orderId) !== ticket.subId,
  }));
}

export function buildPrepSummary(tickets: KotTicket[]): PrepSummaryLine[] {
  const totals = new Map<string, PrepSummaryLine>();

  for (const ticket of tickets) {
    for (const item of ticket.items) {
      if (!isActiveKitchenItem(item.status)) continue;
      const menuId = item.menuId || `${item.name}::${item.category || ''}`;
      const existing = totals.get(menuId);
      if (existing) {
        existing.totalQty += item.quantity;
      } else {
        totals.set(menuId, {
          menuId,
          name: item.name,
          category: item.category,
          totalQty: item.quantity,
        });
      }
    }
  }

  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getKotTableLabel(
  ticket: Pick<KotTicket, 'tableLabel' | 'isSelfService' | 'serviceMode'>
): string {
  if (ticket.isSelfService) {
    const suffix =
      ticket.serviceMode === 'takeaway'
        ? ' · Takeaway'
        : ticket.serviceMode === 'eat_here'
          ? ' · Eat here'
          : '';
    return `Order #${ticket.tableLabel}${suffix}`;
  }
  return `Table ${ticket.tableLabel}`;
}

export function formatKitchenTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKitchenElapsed(startTime: number): string {
  const minutes = Math.floor((Date.now() - startTime) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min ago';
  return `${minutes} mins ago`;
}
