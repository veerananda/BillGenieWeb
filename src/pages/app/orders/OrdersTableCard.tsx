import { CheckCircle, QrCode, Leaf, Beef } from 'lucide-react';
import type { RestaurantTable, Order } from '../../../services/api';
import { Badge } from '../../../components/app/Badge';
import {
  billableItems,
  billSubtotal,
  fmt,
  getDerivedItemStatus,
  getUnacknowledgedCancelledCount,
  hasUnacknowledgedKitchenCancels,
  tableNeedsAssistance,
} from './ordersHelpers';

export function VegBadge({ isVeg }: { isVeg: boolean }) {
  return isVeg ? (
    <Leaf className="h-3.5 w-3.5 shrink-0 text-green-600" />
  ) : (
    <Beef className="h-3.5 w-3.5 shrink-0 text-red-600" />
  );
}

export function TableCard({
  table,
  order,
  onClick,
  onOpenQr,
  kitchenEnabled,
  acknowledgedCancelledByOrderId,
}: {
  table: RestaurantTable;
  order: Order | undefined;
  onClick: () => void;
  onOpenQr: () => void;
  kitchenEnabled: boolean;
  acknowledgedCancelledByOrderId: Record<string, string[]>;
}) {
  const occupied = table.is_occupied;
  const needsAssistance = tableNeedsAssistance(table);
  const derived = kitchenEnabled && occupied && order ? getDerivedItemStatus(order) : null;
  const kitchenCancelled =
    kitchenEnabled && occupied && hasUnacknowledgedKitchenCancels(order, acknowledgedCancelledByOrderId);
  const cancelledCount = kitchenEnabled
    ? getUnacknowledgedCancelledCount(order, acknowledgedCancelledByOrderId)
    : 0;

  const readyCount = kitchenEnabled
    ? (order?.items?.filter((i) => i.status === 'ready').length ?? 0)
    : 0;
  const activeItems = billableItems(order);

  // Solid fill: blue = assistance, rose = kitchen cancelled, yellow = ready, green = in use.
  const fill: 'blue' | 'yellow' | 'rose' | 'green' | null = needsAssistance
    ? 'blue'
    : kitchenCancelled
    ? 'rose'
    : derived === 'ready'
    ? 'yellow'
    : occupied
    ? 'green'
    : null;
  const onDarkFill = fill === 'green' || fill === 'blue';
  const nameClass =
    onDarkFill
      ? 'text-white'
      : fill === 'yellow'
        ? 'text-amber-950'
        : fill === 'rose'
          ? 'text-rose-950'
          : 'text-gray-900';
  const chipClass =
    onDarkFill
      ? 'bg-white/25 text-white'
      : fill === 'rose'
        ? 'bg-white/70 text-rose-900'
        : 'bg-white/60 text-amber-900';

  return (
    <div className="relative h-[128px]">
      {needsAssistance && [0, 0.55, 1.1].map((delay) => (
        <span
          key={delay}
          className="ring-pulse pointer-events-none absolute inset-0 rounded-xl border-2 border-blue-300"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    <button
      onClick={onClick}
      className={`group flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-xl border-2 p-3 pr-9 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        fill === 'blue'
          ? 'border-[#3419e2] bg-[#3419e2]'
          : fill === 'yellow'
          ? 'border-amber-300 bg-amber-300'
          : fill === 'rose'
          ? 'border-rose-400 bg-rose-400'
          : fill === 'green'
          ? 'border-primary bg-primary'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Badge row */}
      <div className="flex shrink-0 items-start justify-between gap-2">
        {fill ? (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${chipClass}`}>
            <span className="flex items-center gap-1">
              {fill === 'blue' ? (
                <>Needs attention</>
              ) : fill === 'yellow' ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  Ready to serve
                </>
              ) : fill === 'rose' ? (
                <>{cancelledCount === 1 ? '1 item cancelled' : `${cancelledCount} items cancelled`}</>
              ) : (
                'In use'
              )}
            </span>
          </span>
        ) : (
          <Badge variant="vacant">Vacant</Badge>
        )}
      </div>

      {/* Table name */}
      <span className={`shrink-0 truncate text-sm font-bold ${nameClass}`}>
        {table.name}{table.capacity ? ` (${table.capacity})` : ''}
      </span>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
      {needsAssistance ? (
        <div className="space-y-1">
          <p className="text-xs font-bold text-white">Customer requested assistance</p>
          <p className="text-xs text-white/80">Tap to acknowledge</p>
        </div>
      ) : occupied && order ? (
        <div className="space-y-1">
          {kitchenCancelled ? (
            <>
              <p className="line-clamp-2 text-xs font-bold text-rose-950">
                {cancelledCount === 1 ? '1 item cancelled' : `${cancelledCount} items cancelled`}
              </p>
            </>
          ) : derived === 'ready' ? (
            <>
              <p className="line-clamp-2 text-xs font-bold text-amber-950">
                {readyCount} {readyCount === 1 ? 'item' : 'items'} ready to serve
              </p>
            </>
          ) : (
            <>
              <p className={`text-xs ${onDarkFill ? 'text-white/85' : 'text-gray-500'}`}>
                {activeItems.length > 0
                  ? (() => { const qty = activeItems.reduce((s, i) => s + i.quantity, 0); return `${qty} Item${qty !== 1 ? 's' : ''}`; })()
                  : 'No items yet'}
              </p>
              {activeItems.length > 0 && (
                <p className={`text-sm font-semibold ${onDarkFill ? 'text-white' : 'text-gray-900'}`}>{fmt(billSubtotal(order))}</p>
              )}
              {kitchenEnabled && derived === 'cooking' && (
                <span className="inline-flex items-center rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium text-white">
                  Cooking…
                </span>
              )}
            </>
          )}
        </div>
      ) : occupied ? (
        <p className="text-xs text-white/85">Occupied</p>
      ) : (
        <p className="text-xs text-gray-400">Tap to take an order</p>
      )}
      </div>
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenQr();
      }}
      title="Table QR"
      aria-label={`Table QR for ${table.name}`}
      className={`absolute right-2 top-2 z-10 rounded-lg p-1.5 shadow-sm transition-colors ${
        fill === 'yellow' || fill === 'rose'
          ? 'bg-white/70 text-amber-950 hover:bg-white'
          : fill
            ? 'bg-white/25 text-white hover:bg-white/40'
            : 'border border-gray-200 bg-white text-primary hover:bg-primary/10'
      }`}
    >
      <QrCode className="h-3.5 w-3.5" />
    </button>
    </div>
  );
}
