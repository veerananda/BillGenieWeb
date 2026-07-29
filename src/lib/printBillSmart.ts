import { apiClient } from '../services/api';
import { printBillHtml } from './customerBillFormat';
import {
  getResolvedBrowserPrinter,
  printTextToBrowserPrinter,
  warmBrowserPrinterSession,
  type BrowserPrinterRole,
} from './browserThermalPrinter';

export type BillAutoPrintChannel = 'dine_in' | 'counter';

const AUTO_PRINT_DINE_IN_KEY = 'billgenie_bill_auto_print_dine_in_v1';
const AUTO_PRINT_COUNTER_KEY = 'billgenie_bill_auto_print_counter_v1';
/** Legacy single toggle (migrated / OR of both channels). */
const AUTO_PRINT_LEGACY_KEY = 'billgenie_bill_auto_print_on_checkout_v1';

export function cacheBillAutoPrintChannels(options: {
  dineIn: boolean;
  counter: boolean;
}): void {
  localStorage.setItem(AUTO_PRINT_DINE_IN_KEY, options.dineIn ? '1' : '0');
  localStorage.setItem(AUTO_PRINT_COUNTER_KEY, options.counter ? '1' : '0');
  localStorage.setItem(
    AUTO_PRINT_LEGACY_KEY,
    options.dineIn || options.counter ? '1' : '0'
  );
}

/** @deprecated Prefer cacheBillAutoPrintChannels */
export function cacheBillAutoPrintOnCheckout(enabled: boolean): void {
  cacheBillAutoPrintChannels({ dineIn: enabled, counter: enabled });
}

function getCachedChannel(channel: BillAutoPrintChannel): boolean {
  const key = channel === 'dine_in' ? AUTO_PRINT_DINE_IN_KEY : AUTO_PRINT_COUNTER_KEY;
  const raw = localStorage.getItem(key);
  if (raw === '1' || raw === '0') return raw === '1';
  // Fall back to legacy single toggle for browsers that have not refreshed settings yet.
  return localStorage.getItem(AUTO_PRINT_LEGACY_KEY) === '1';
}

function channelsFromSettings(settings: {
  bill_auto_print_dine_in?: boolean;
  bill_auto_print_counter?: boolean;
  bill_auto_print_on_checkout?: boolean;
}): { dineIn: boolean; counter: boolean } {
  const hasSplit =
    settings.bill_auto_print_dine_in != null || settings.bill_auto_print_counter != null;
  if (hasSplit) {
    return {
      dineIn: Boolean(settings.bill_auto_print_dine_in),
      counter: Boolean(settings.bill_auto_print_counter),
    };
  }
  const legacy = Boolean(settings.bill_auto_print_on_checkout);
  return { dineIn: legacy, counter: legacy };
}

/** Prefer live print settings; fall back to cache if the request fails. */
export async function resolveBillAutoPrintOnCheckout(
  channel: BillAutoPrintChannel = 'dine_in'
): Promise<boolean> {
  try {
    const r = await apiClient.getPrintSettings();
    const channels = channelsFromSettings(r.settings);
    cacheBillAutoPrintChannels(channels);
    return channel === 'dine_in' ? channels.dineIn : channels.counter;
  } catch {
    return getCachedChannel(channel);
  }
}

/**
 * Auto-print only when the restaurant Printers toggle is on for this channel.
 * Manual Print bill still works regardless.
 */
export async function shouldAutoPrintBillOnCheckout(
  channel: BillAutoPrintChannel = 'dine_in'
): Promise<boolean> {
  return resolveBillAutoPrintOnCheckout(channel);
}

export type PrintBillSmartResult = 'browser' | 'agent' | 'system' | 'none';

async function tryBrowserBillPrint(text: string, role: BrowserPrinterRole): Promise<boolean> {
  if (!getResolvedBrowserPrinter(role)) return false;
  await warmBrowserPrinterSession(role);
  return printTextToBrowserPrinter(role, text, {
    allowReconnectPicker: true,
    settleMs: 500,
  });
}

/**
 * Prefer browser thermal (bill slot, then shared KOT slot), then WiFi/LAN print-agent,
 * then system print dialog last. Never open the PDF dialog before trying the agent —
 * otherwise a single WiFi printer setup always shows Save as PDF even when the agent
 * would have printed successfully.
 */
export async function printBillSmart(options: {
  html: string;
  text: string;
  orderId?: string;
  /** When false, never open the browser system print dialog. Default true. */
  allowSystemPrint?: boolean;
}): Promise<PrintBillSmartResult> {
  const { html, text, orderId, allowSystemPrint = true } = options;

  try {
    if (await tryBrowserBillPrint(text, 'bill')) return 'browser';
    // Single physical printer often paired only under KOT
    if (await tryBrowserBillPrint(text, 'kot')) return 'browser';
  } catch (err) {
    console.warn('Browser bill print failed:', err);
  }

  if (orderId) {
    try {
      const r = await apiClient.enqueueBillPrint(orderId);
      if (r.queued) return 'agent';
    } catch {
      // Agent queue is optional; fall through to system print when allowed.
    }
  }

  if (allowSystemPrint) {
    printBillHtml(html);
    return 'system';
  }

  return 'none';
}
