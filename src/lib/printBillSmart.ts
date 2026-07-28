import { apiClient } from '../services/api';
import { printBillHtml } from './customerBillFormat';
import {
  getBrowserPrinter,
  printTextToBrowserPrinter,
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

export type PrintBillSmartResult = 'browser' | 'agent' | 'system' | 'none';

/**
 * Prefer paired browser bill printer, then print-agent queue, then system dialog.
 * Skips the system dialog when a browser thermal printer is already paired.
 */
export async function printBillSmart(options: {
  html: string;
  text: string;
  orderId?: string;
  /** When false, never open the browser system print dialog. Default true. */
  allowSystemPrint?: boolean;
}): Promise<PrintBillSmartResult> {
  const { html, text, orderId, allowSystemPrint = true } = options;
  const hasBrowserThermal = Boolean(getBrowserPrinter('bill'));

  if (!hasBrowserThermal && allowSystemPrint) {
    printBillHtml(html);
  }

  try {
    const sentToBrowser = await printTextToBrowserPrinter('bill', text);
    if (sentToBrowser) return 'browser';
  } catch {
    // Fall through to agent queue / system.
  }

  if (orderId) {
    try {
      await apiClient.enqueueBillPrint(orderId);
      return 'agent';
    } catch {
      // Agent queue is optional when browser/system print already ran.
    }
  }

  if (hasBrowserThermal && allowSystemPrint) {
    // Browser path failed; offer system print as last resort.
    printBillHtml(html);
    return 'system';
  }

  return hasBrowserThermal || !allowSystemPrint ? 'none' : 'system';
}
