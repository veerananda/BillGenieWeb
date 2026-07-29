import { apiClient } from '../services/api';
import {
  getResolvedBrowserPrinter,
  printTextToBrowserPrinter,
  warmBrowserPrinterSession,
} from './browserThermalPrinter';

const KOT_ENABLED_KEY = 'billgenie_kot_printing_enabled_v1';

export function cacheKotPrintingEnabled(enabled: boolean): void {
  localStorage.setItem(KOT_ENABLED_KEY, enabled ? '1' : '0');
}

export function getCachedKotPrintingEnabled(): boolean {
  return localStorage.getItem(KOT_ENABLED_KEY) === '1';
}

/** Prefer live print settings; fall back to cache if the request fails. */
export async function resolveKotPrintingEnabled(): Promise<boolean> {
  try {
    const r = await apiClient.getPrintSettings();
    const enabled = Boolean(r.settings.kot_printing_enabled);
    cacheKotPrintingEnabled(enabled);
    if (r.settings.bill_auto_print_on_checkout != null) {
      localStorage.setItem(
        'billgenie_bill_auto_print_on_checkout_v1',
        r.settings.bill_auto_print_on_checkout ? '1' : '0'
      );
    }
    return enabled;
  } catch {
    return getCachedKotPrintingEnabled();
  }
}

/**
 * Print KOT to the browser printer when KOT printing is on.
 * Uses the KOT pair, or the bill pair if only one Bluetooth printer is set up.
 */
export async function tryAutoPrintKot(kotText: string): Promise<boolean> {
  try {
    const enabled = await resolveKotPrintingEnabled();
    if (!enabled) return false;
    if (!kotText.trim()) return false;
    if (!getResolvedBrowserPrinter('kot')) return false;

    await warmBrowserPrinterSession('kot');
    return await printTextToBrowserPrinter('kot', kotText, { allowReconnectPicker: true });
  } catch (err) {
    console.warn('Auto-print KOT failed:', err);
    return false;
  }
}
