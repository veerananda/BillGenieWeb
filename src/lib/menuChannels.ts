export const MENU_CHANNELS = [
  { id: 'dine_in', label: 'Dine-in' },
  { id: 'counter_eat_here', label: 'Counter eat here' },
  { id: 'counter_takeaway', label: 'Counter takeaway' },
  { id: 'swiggy', label: 'Swiggy' },
  { id: 'zomato', label: 'Zomato' },
] as const;

export type MenuChannelId = (typeof MENU_CHANNELS)[number]['id'];

export const DEFAULT_MENU_CHANNELS: MenuChannelId[] = MENU_CHANNELS.map((c) => c.id);

export type ChannelPrices = Partial<Record<MenuChannelId, number>>;

export function normalizeMenuChannels(channels?: string[] | null): MenuChannelId[] {
  if (!channels || channels.length === 0) {
    return [...DEFAULT_MENU_CHANNELS];
  }
  const allowed = new Set<string>(DEFAULT_MENU_CHANNELS);
  const seen = new Set<string>();
  const out: MenuChannelId[] = [];
  for (const ch of channels) {
    if (!allowed.has(ch) || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch as MenuChannelId);
  }
  return out.length > 0 ? out : [...DEFAULT_MENU_CHANNELS];
}

export function normalizeChannelPrices(
  channels: MenuChannelId[],
  prices: ChannelPrices | Record<string, number> | null | undefined,
  basePrice: number
): ChannelPrices {
  const out: ChannelPrices = {};
  const safeBase = Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0;
  for (const ch of channels) {
    const raw = prices?.[ch];
    const n = typeof raw === 'number' ? raw : Number(raw);
    out[ch] = Number.isFinite(n) && n >= 0 ? n : safeBase;
  }
  return out;
}

export function itemVisibleForChannel(
  item: { is_available?: boolean; available_channels?: string[] | null },
  channel: MenuChannelId
): boolean {
  if (item.is_available === false) return false;
  return normalizeMenuChannels(item.available_channels).includes(channel);
}

/** Unit price for a channel; falls back to item/variant base price. */
export function resolveChannelUnitPrice(
  item: {
    price?: number;
    channel_prices?: Record<string, number> | null;
    channelPrices?: Record<string, number> | null;
  },
  channel: MenuChannelId,
  fallbackPrice?: number
): number {
  const map = item.channel_prices ?? item.channelPrices ?? undefined;
  const fromChannel = map?.[channel];
  if (typeof fromChannel === 'number' && Number.isFinite(fromChannel) && fromChannel >= 0) {
    return fromChannel;
  }
  if (typeof fallbackPrice === 'number' && Number.isFinite(fallbackPrice) && fallbackPrice >= 0) {
    return fallbackPrice;
  }
  const base = Number(item.price) || 0;
  return base >= 0 ? base : 0;
}

/** Channel price applies to base/Regular; other portions keep their variant price. */
export function resolveMenuUnitPriceForChannel(
  item: {
    price?: number;
    channel_prices?: Record<string, number> | null;
    channelPrices?: Record<string, number> | null;
  },
  variant: { price?: number; is_default?: boolean; label?: string } | undefined,
  channel: MenuChannelId
): number {
  const fallback = variant?.price ?? item.price ?? 0;
  const isDefault =
    !variant ||
    Boolean(variant.is_default) ||
    /^regular$/i.test(String(variant.label || '').trim());
  if (isDefault) {
    return resolveChannelUnitPrice(item, channel, fallback);
  }
  return typeof fallback === 'number' && fallback >= 0 ? fallback : 0;
}

export function toggleMenuChannel(
  current: MenuChannelId[],
  channel: MenuChannelId,
  prices: ChannelPrices,
  basePrice: number
): { channels: MenuChannelId[]; prices: ChannelPrices } {
  if (current.includes(channel)) {
    const nextChannels = current.filter((c) => c !== channel);
    const nextPrices = { ...prices };
    delete nextPrices[channel];
    return { channels: nextChannels, prices: nextPrices };
  }
  return {
    channels: [...current, channel],
    prices: {
      ...prices,
      [channel]:
        typeof prices[channel] === 'number' && Number.isFinite(prices[channel])
          ? prices[channel]!
          : basePrice >= 0
            ? basePrice
            : 0,
    },
  };
}
