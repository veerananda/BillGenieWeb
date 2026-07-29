import { apiClient } from '../services/api';
import { printBillHtml } from './customerBillFormat';
import {
  getResolvedBrowserPrinter,
  printTextToBrowserPrinter,
  warmBrowserPrinterSession,
  type BrowserPrinterRole,
} from './browserThermalPrinter';

const AUTO_PRINT_KEY = 'billgenie_bill_auto_print_on_checkout_v1';

export function cacheBillAutoPrintOnCheckout(enabled: boolean): void {
  localStorage.setItem(AUTO_PRINT_KEY, enabled ? '1' : '0');
}

export function getCachedBillAutoPrintOnCheckout(): boolean {
  return localStorage.getItem(AUTO_PRINT_KEY) === '1';
}

/** Prefer live print settings; fall back to cache if the request fails. */
export async function resolveBillAutoPrintOnCheckout(): Promise<boolean> {
  try {
    const r = await apiClient.getPrintSettings();
    const enabled = Boolean(r.settings.bill_auto_print_on_checkout);
    cacheBillAutoPrintOnCheckout(enabled);
    return enabled;
  } catch {
    return getCachedBillAutoPrintOnCheckout();
  }
}

/**
 * Auto-print bill on checkout when the restaurant toggle is on, OR when this
 * browser has a paired bill (or shared KOT) thermal printer.
 */
export async function shouldAutoPrintBillOnCheckout(): Promise<boolean> {
  if (getResolvedBrowserPrinter('bill') || getResolvedBrowserPrinter('kot')) return true;
  return resolveBillAutoPrintOnCheckout();
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
