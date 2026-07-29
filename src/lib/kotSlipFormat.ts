import { formatOrderLineDisplayName } from './orderHelpers';

export type KotSlipItem = {
  name: string;
  quantity: number;
  notes?: string;
  variantLabel?: string;
  category?: string;
};

export type KotSlipData = {
  restaurantName?: string;
  /** Table name for dine-in, or "Counter" / takeaway label. */
  tableOrChannel: string;
  ticketOrOrderNumber?: string | number | null;
  isAddOn?: boolean;
  items: KotSlipItem[];
  createdAt?: Date | number | string;
  /** Restaurant category_display_blocklist for smart dish labels. */
  categoryBlocklist?: string[];
};

function formatTime(value?: Date | number | string): string {
  try {
    const d =
      value instanceof Date
        ? value
        : typeof value === 'number'
          ? new Date(value)
          : value
            ? new Date(value)
            : new Date();
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function itemLine(item: KotSlipItem, categoryBlocklist?: string[]): string {
  const label = formatOrderLineDisplayName(
    item.name,
    item.category,
    { categoryBlocklist },
    item.variantLabel
  );
  return `${item.quantity} x ${label}`;
}

/** Plain-text KOT for ESC/POS kitchen printers. */
export function buildKotSlipText(data: KotSlipData): string {
  const lines: string[] = [];
  const divider = '--------------------------------';

  if (data.restaurantName) {
    lines.push(data.restaurantName);
  }
  lines.push(data.isAddOn ? 'KOT (ADD-ON)' : 'KOT');
  lines.push(divider);

  if (data.ticketOrOrderNumber != null && data.ticketOrOrderNumber !== '') {
    lines.push(`#${data.ticketOrOrderNumber}`);
  }
  lines.push(data.tableOrChannel);
  const when = formatTime(data.createdAt);
  if (when) lines.push(when);
  lines.push(divider);

  data.items.forEach((item) => {
    if (!item.name || item.quantity <= 0) return;
    lines.push(itemLine(item, data.categoryBlocklist));
    const notes = item.notes?.trim();
    if (notes) lines.push(`   * ${notes}`);
  });

  lines.push(divider);
  return lines.join('\n');
}
