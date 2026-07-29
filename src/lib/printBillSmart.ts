import { apiClient } from '../services/api';
import { printBillHtml } from './customerBillFormat';
import {
  getResolvedBrowserPrinter,
  printTextToBrowserPrinter,
  warmBrowserPrinterSession,
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
 * browser has a paired bill thermal printer.
 */
export async function shouldAutoPrintBillOnCheckout(): Promise<boolean> {
  if (getResolvedBrowserPrinter('bill')) return true;
  return resolveBillAutoPrintOnCheckout();
}

export type PrintBillSmartResult = 'browser' | 'agent' | 'system' | 'none';

/**
 * Prefer paired browser bill printer (or shared KOT printer), then print-agent, then system dialog.
 */
export async function printBillSmart(options: {
  html: string;
  text: string;
  orderId?: string;
  /** When false, never open the browser system print dialog. Default true. */
  allowSystemPrint?: boolean;
}): Promise<PrintBillSmartResult> {
  const { html, text, orderId, allowSystemPrint = true } = options;
  const hasBrowserThermal = Boolean(getResolvedBrowserPrinter('bill'));

  if (!hasBrowserThermal && allowSystemPrint) {
    printBillHtml(html);
  }

  try {
    if (hasBrowserThermal) {
      await warmBrowserPrinterSession('bill');
      const sentToBrowser = await printTextToBrowserPrinter('bill', text, {
        allowReconnectPicker: true,
        settleMs: 500,
      });
      if (sentToBrowser) return 'browser';
    }
  } catch (err) {
    console.warn('Browser bill print failed:', err);
  }

  if (orderId) {
    try {
      const r = await apiClient.enqueueBillPrint(orderId);
      if (r.queued) return 'agent';
    } catch {
      // Agent queue is optional when browser/system print already ran.
    }
  }

  if (hasBrowserThermal && allowSystemPrint) {
    printBillHtml(html);
    return 'system';
  }

  if (!hasBrowserThermal && allowSystemPrint) {
    return 'system';
  }

  return 'none';
}
