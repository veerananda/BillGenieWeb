import { useEffect, useState } from 'react';
import { apiClient, type PrintSettings } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import {
  clearBrowserPrinter,
  cachePrintFeedLines,
  getBrowserPrinter,
  getPaperWidthMm,
  isWebBluetoothSupported,
  pairBluetoothPrinter,
  printTestToBrowserPrinter,
  setPaperWidthMm,
  warmBrowserPrinterSession,
  type BrowserPrinterConfig,
  type BrowserPrinterRole,
  type PaperWidthMm,
} from '../../lib/browserThermalPrinter';
import { cacheBillAutoPrintChannels } from '../../lib/printBillSmart';
import { cacheKotPrintingEnabled } from '../../lib/printKotSmart';

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-400';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-primary' : 'bg-gray-200'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

function isSerialHost(host: string | undefined | null): boolean {
  const h = (host || '').trim();
  if (!h) return false;
  return /^(serial:|bt:|bluetooth:|COM\d+$|\/dev\/|\\\\\.\\)/i.test(h);
}

function BrowserPrinterCard({
  role,
  label,
  canEdit,
}: {
  role: BrowserPrinterRole;
  label: string;
  canEdit: boolean;
}) {
  const [config, setConfig] = useState<BrowserPrinterConfig | null>(() =>
    getBrowserPrinter(role)
  );
  const [paperWidthMm, setPaperWidth] = useState<PaperWidthMm>(() => getPaperWidthMm(role));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const bleOk = isWebBluetoothSupported();

  useEffect(() => {
    const sync = () => {
      setConfig(getBrowserPrinter(role));
      setPaperWidth(getPaperWidthMm(role));
    };
    window.addEventListener('billgenie-printers-changed', sync);
    return () => window.removeEventListener('billgenie-printers-changed', sync);
  }, [role]);

  // Drop unsupported Classic BT / serial browser pairs so users re-pair with BLE.
  useEffect(() => {
    const current = getBrowserPrinter(role);
    if (current?.kind === 'serial') {
      clearBrowserPrinter(role);
      setConfig(null);
      setMsg('Classic Bluetooth / serial pairing was removed. Pair again with Pair BLE.');
    }
  }, [role]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      setConfig(getBrowserPrinter(role));
      setPaperWidth(getPaperWidthMm(role));
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function choosePaper(width: PaperWidthMm) {
    if (!canEdit || busy) return;
    setPaperWidthMm(role, width);
    setPaperWidth(width);
    setConfig(getBrowserPrinter(role));
    setMsg(`Paper size set to ${width}mm (${width === 80 ? 48 : 32} columns).`);
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">
          {config
            ? `${config.name} · BLE · ${paperWidthMm}mm`
            : `Not paired in this browser · ${paperWidthMm}mm layout`}
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-600">Paper width</p>
        <div className="flex flex-wrap gap-2">
          {([58, 80] as PaperWidthMm[]).map((w) => (
            <button
              key={w}
              type="button"
              disabled={!canEdit || busy}
              onClick={() => choosePaper(w)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                paperWidthMm === w
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {w}mm
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          {paperWidthMm === 58
            ? '58mm uses 32 columns — choose this for most portable Bluetooth printers.'
            : '80mm uses 48 columns — choose this for wider kitchen / counter printers.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canEdit || busy || !bleOk}
          onClick={() =>
            void run(async () => {
              await pairBluetoothPrinter(role);
              setMsg(
                `${role === 'kot' ? 'KOT' : 'Bill'} BLE printer paired. Stays after logout/refresh.`
              );
            })
          }
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Pair BLE
        </button>
        <button
          type="button"
          disabled={!canEdit || busy || !config}
          onClick={() =>
            void run(async () => {
              await printTestToBrowserPrinter(role);
              setMsg('Test print sent.');
            })
          }
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Test
        </button>
        {config ? (
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() => {
              clearBrowserPrinter(role);
              setConfig(null);
              setMsg(`Cleared ${role === 'kot' ? 'KOT' : 'bill'} browser printer.`);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
      {!bleOk ? (
        <p className="text-xs text-amber-700">
          This browser does not support Web Bluetooth. Use Chrome or Edge on desktop, or set
          a Wi‑Fi / LAN printer for the print agent below.
        </p>
      ) : null}
      {msg ? <p className="text-xs text-gray-500">{msg}</p> : null}
    </div>
  );
}

/**
 * Shared print enables + Wi‑Fi/LAN agent hosts + this-browser BLE pairing.
 * Admin/manager can toggle enables and always edit.
 * Staff/chef can edit hosts/pairing when the matching enable is on.
 */
export function Printers() {
  const role = useAppSelector(selectAuthRole);
  const canManageEnables = role === 'admin' || role === 'manager';

  const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
  const [hasAgentKey, setHasAgentKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printSaving, setPrintSaving] = useState(false);
  const [agentKeyOnce, setAgentKeyOnce] = useState<string | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const r = await apiClient.getPrintSettings();
        if (cancelled) return;
        setPrintSettings(r.settings);
        setHasAgentKey(r.has_agent_key);
        cachePrintFeedLines(
          r.settings.top_feed_lines ?? 0,
          r.settings.bottom_feed_lines ?? 3
        );
        cacheBillAutoPrintChannels({
          dineIn: Boolean(r.settings.bill_auto_print_dine_in ?? r.settings.bill_auto_print_on_checkout),
          counter: Boolean(
            r.settings.bill_auto_print_counter ?? r.settings.bill_auto_print_on_checkout
          ),
        });
        cacheKotPrintingEnabled(Boolean(r.settings.kot_printing_enabled));
        void warmBrowserPrinterSession();
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load printer settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canEditKot =
    canManageEnables || Boolean(printSettings?.kot_printing_enabled);
  const canEditBill =
    canManageEnables || Boolean(printSettings?.bill_printing_enabled);
  const canSaveHosts = canEditKot || canEditBill;

  const kotIsSerial = isSerialHost(printSettings?.kot_printer_host);
  const billIsSerial = isSerialHost(printSettings?.bill_printer_host);

  async function savePrintSettings(patch: Partial<PrintSettings>) {
    setPrintSaving(true);
    setPrintMsg(null);
    try {
      const r = await apiClient.updatePrintSettings(patch);
      setPrintSettings(r.settings);
      setHasAgentKey(r.has_agent_key);
      cachePrintFeedLines(
        r.settings.top_feed_lines ?? 0,
        r.settings.bottom_feed_lines ?? 3
      );
      cacheBillAutoPrintChannels({
        dineIn: Boolean(r.settings.bill_auto_print_dine_in ?? r.settings.bill_auto_print_on_checkout),
        counter: Boolean(
          r.settings.bill_auto_print_counter ?? r.settings.bill_auto_print_on_checkout
        ),
      });
      cacheKotPrintingEnabled(Boolean(r.settings.kot_printing_enabled));
      setPrintMsg('Printer settings saved.');
    } catch (err: unknown) {
      setPrintMsg(err instanceof Error ? err.message : 'Failed to save printer settings');
    } finally {
      setPrintSaving(false);
    }
  }

  async function rotateAgentKey() {
    setPrintSaving(true);
    setPrintMsg(null);
    try {
      const r = await apiClient.rotatePrintAgentKey();
      setPrintSettings(r.settings);
      setHasAgentKey(true);
      setAgentKeyOnce(r.agent_api_key);
      setPrintMsg(r.message);
    } catch (err: unknown) {
      setPrintMsg(err instanceof Error ? err.message : 'Failed to generate agent key');
    } finally {
      setPrintSaving(false);
    }
  }

  async function removeWifiPrinter(target: 'kot' | 'bill') {
    if (!printSettings) return;
    const label = target === 'kot' ? 'KOT' : 'bill';
    if (!window.confirm(`Remove the Wi‑Fi / LAN ${label} printer IP?`)) return;
    const patch =
      target === 'kot'
        ? { kot_printer_host: '', kot_printer_port: 9100 }
        : { bill_printer_host: '', bill_printer_port: 9100 };
    setPrintSaving(true);
    setPrintMsg(null);
    try {
      const r = await apiClient.updatePrintSettings(patch);
      setPrintSettings(r.settings);
      setHasAgentKey(r.has_agent_key);
      setPrintMsg(`Cleared ${label} Wi‑Fi / LAN printer.`);
    } catch (err: unknown) {
      setPrintMsg(err instanceof Error ? err.message : `Failed to remove ${label} printer`);
    } finally {
      setPrintSaving(false);
    }
  }

  async function testWifiPrinter(target: 'kot' | 'bill') {
    if (!printSettings) return;
    const label = target === 'kot' ? 'KOT' : 'bill';
    setPrintSaving(true);
    setPrintMsg(null);
    try {
      // Persist hosts first so the agent uses the IP shown in the form.
      const hostPatch =
        target === 'kot'
          ? {
              kot_printer_host: printSettings.kot_printer_host,
              kot_printer_port: printSettings.kot_printer_port,
              kot_paper_width_mm: printSettings.kot_paper_width_mm ?? 58,
            }
          : {
              bill_printer_host: printSettings.bill_printer_host,
              bill_printer_port: printSettings.bill_printer_port,
              bill_paper_width_mm: printSettings.bill_paper_width_mm ?? 58,
            };
      const saved = await apiClient.updatePrintSettings(hostPatch);
      setPrintSettings(saved.settings);
      setHasAgentKey(saved.has_agent_key);

      const r = await apiClient.enqueueWifiPrinterTest(target);
      setPrintMsg(
        r.queued
          ? `${label} test print queued. Keep the print agent running.`
          : r.message || `${label} test print was not queued.`
      );
    } catch (err: unknown) {
      setPrintMsg(err instanceof Error ? err.message : `Failed to send ${label} test print`);
    } finally {
      setPrintSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (loadError || !printSettings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Printers"
          subtitle="KOT and bill printers for Wi‑Fi / LAN and Bluetooth"
        />
        <p className="text-sm text-red-600">{loadError || 'Printer settings unavailable.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printers"
        subtitle="Wi‑Fi / LAN via the print agent, Bluetooth (BLE) in this browser on Chrome/Edge."
      />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Print options</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            These apply to all printer types — Wi‑Fi / LAN (print agent) and Bluetooth (this
            browser).
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <ToggleRow
            title="KOT printing"
            description="Kitchen slips for dine-in saves and counter checkout."
            checked={printSettings.kot_printing_enabled}
            disabled={!canManageEnables || printSaving}
            onToggle={() => {
              if (!canManageEnables) return;
              void savePrintSettings({
                kot_printing_enabled: !printSettings.kot_printing_enabled,
              });
            }}
          />
          <ToggleRow
            title="Bill printing"
            description="Allow bill slips via Print bill (browser BLE or print agent)."
            checked={printSettings.bill_printing_enabled}
            disabled={!canManageEnables || printSaving}
            onToggle={() => {
              if (!canManageEnables) return;
              void savePrintSettings({
                bill_printing_enabled: !printSettings.bill_printing_enabled,
              });
            }}
          />
          <ToggleRow
            title="Auto-print bill on dine-in checkout"
            description="After dine-in payment succeeds, print the customer bill automatically. Manual Print bill on the checkout page still works when this is off."
            checked={Boolean(
              printSettings.bill_auto_print_dine_in ?? printSettings.bill_auto_print_on_checkout
            )}
            disabled={!canManageEnables || printSaving}
            onToggle={() => {
              if (!canManageEnables) return;
              const next = !(
                printSettings.bill_auto_print_dine_in ?? printSettings.bill_auto_print_on_checkout
              );
              void savePrintSettings({ bill_auto_print_dine_in: next });
            }}
          />
          <ToggleRow
            title="Auto-print bill on counter checkout"
            description="After counter payment succeeds, print the customer bill (with tracking QR) automatically. Manual Print bill under the post-payment QR still works when this is off."
            checked={Boolean(
              printSettings.bill_auto_print_counter ?? printSettings.bill_auto_print_on_checkout
            )}
            disabled={!canManageEnables || printSaving}
            onToggle={() => {
              if (!canManageEnables) return;
              const next = !(
                printSettings.bill_auto_print_counter ?? printSettings.bill_auto_print_on_checkout
              );
              void savePrintSettings({ bill_auto_print_counter: next });
            }}
          />
          {!canManageEnables &&
          !printSettings.kot_printing_enabled &&
          !printSettings.bill_printing_enabled ? (
            <p className="text-sm text-gray-500">
              Printing is off. Ask an admin or manager to enable KOT and/or Bill printing.
            </p>
          ) : null}
          {printMsg ? <p className="text-xs text-gray-500">{printMsg}</p> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Bluetooth (this browser)</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Pair BLE thermal printers with Chrome or Edge. Pair KOT and bill separately — you
            may choose the same device for both. Stored on this PC across refresh and logout.
          </p>
        </div>
        <div className="space-y-3 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <BrowserPrinterCard
              role="bill"
              label="Bill printer (this browser)"
              canEdit={canEditBill}
            />
            <BrowserPrinterCard
              role="kot"
              label="KOT printer (this browser)"
              canEdit={canEditKot}
            />
          </div>
          <p className="text-xs text-gray-400">
            Pair both slots if you want kitchen and bill slips. Use the same printer twice if
            you only have one BLE device.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Wi‑Fi / LAN (print agent)</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            For restaurant-wide network printers: run the print agent on a PC that can reach
            the printer IP (usually port 9100).
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-800">KOT printer (Wi‑Fi / LAN)</p>
              <p className="text-xs text-gray-500">
                {printSettings.kot_printer_host
                  ? `${printSettings.kot_printer_host}:${printSettings.kot_printer_port || 9100}`
                  : 'Not configured'}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[10.5rem] max-w-full shrink-0">
                <Field label="IP">
                  <input
                    className={inputClass}
                    value={printSettings.kot_printer_host || ''}
                    placeholder="192.168.1.50"
                    disabled={!canEditKot}
                    onChange={(e) =>
                      setPrintSettings((s) =>
                        s ? { ...s, kot_printer_host: e.target.value } : s
                      )
                    }
                  />
                </Field>
              </div>
              <div className="w-[4.75rem] shrink-0">
                <Field label="Port">
                  <input
                    className={inputClass}
                    type="number"
                    value={printSettings.kot_printer_port || 9100}
                    disabled={!canEditKot || kotIsSerial}
                    onChange={(e) =>
                      setPrintSettings((s) =>
                        s
                          ? { ...s, kot_printer_port: Number(e.target.value) || 9100 }
                          : s
                      )
                    }
                  />
                </Field>
              </div>
            </div>
            <Field label="Paper width">
              <div className="flex gap-2">
                {([58, 80] as const).map((w) => (
                  <button
                    key={`kot-paper-${w}`}
                    type="button"
                    disabled={!canEditKot || printSaving}
                    onClick={() =>
                      setPrintSettings((s) => (s ? { ...s, kot_paper_width_mm: w } : s))
                    }
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                      (printSettings.kot_paper_width_mm ?? 58) === w
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canEditKot || printSaving || !String(printSettings.kot_printer_host || '').trim()}
                onClick={() => void testWifiPrinter('kot')}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Test
              </button>
              {String(printSettings.kot_printer_host || '').trim() ? (
                <button
                  type="button"
                  disabled={!canEditKot || printSaving}
                  onClick={() => void removeWifiPrinter('kot')}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Bill printer (Wi‑Fi / LAN)</p>
              <p className="text-xs text-gray-500">
                {printSettings.bill_printer_host
                  ? `${printSettings.bill_printer_host}:${printSettings.bill_printer_port || 9100}`
                  : 'Not configured'}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[10.5rem] max-w-full shrink-0">
                <Field label="IP">
                  <input
                    className={inputClass}
                    value={printSettings.bill_printer_host || ''}
                    placeholder="192.168.1.51"
                    disabled={!canEditBill}
                    onChange={(e) =>
                      setPrintSettings((s) =>
                        s ? { ...s, bill_printer_host: e.target.value } : s
                      )
                    }
                  />
                </Field>
              </div>
              <div className="w-[4.75rem] shrink-0">
                <Field label="Port">
                  <input
                    className={inputClass}
                    type="number"
                    value={printSettings.bill_printer_port || 9100}
                    disabled={!canEditBill || billIsSerial}
                    onChange={(e) =>
                      setPrintSettings((s) =>
                        s
                          ? { ...s, bill_printer_port: Number(e.target.value) || 9100 }
                          : s
                      )
                    }
                  />
                </Field>
              </div>
            </div>
            <Field label="Paper width">
              <div className="flex gap-2">
                {([58, 80] as const).map((w) => (
                  <button
                    key={`bill-paper-${w}`}
                    type="button"
                    disabled={!canEditBill || printSaving}
                    onClick={() =>
                      setPrintSettings((s) => (s ? { ...s, bill_paper_width_mm: w } : s))
                    }
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                      (printSettings.bill_paper_width_mm ?? 58) === w
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  !canEditBill ||
                  printSaving ||
                  (!String(printSettings.bill_printer_host || '').trim() &&
                    !String(printSettings.kot_printer_host || '').trim())
                }
                onClick={() => void testWifiPrinter('bill')}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                title={
                  !String(printSettings.bill_printer_host || '').trim() &&
                  String(printSettings.kot_printer_host || '').trim()
                    ? 'Uses the KOT printer IP when bill IP is empty'
                    : undefined
                }
              >
                Test
              </button>
              {String(printSettings.bill_printer_host || '').trim() ? (
                <button
                  type="button"
                  disabled={!canEditBill || printSaving}
                  onClick={() => void removeWifiPrinter('bill')}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          </div>

          {canManageEnables ? (
            <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <Field label="Top feed lines (before content)">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={20}
                  value={printSettings.top_feed_lines ?? 0}
                  disabled={printSaving}
                  onChange={(e) =>
                    setPrintSettings((s) =>
                      s
                        ? {
                            ...s,
                            top_feed_lines: Math.min(
                              20,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          }
                        : s
                    )
                  }
                />
              </Field>
              <Field label="Bottom feed lines (before cut)">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={20}
                  value={printSettings.bottom_feed_lines ?? 3}
                  disabled={printSaving}
                  onChange={(e) =>
                    setPrintSettings((s) =>
                      s
                        ? {
                            ...s,
                            bottom_feed_lines: Math.min(
                              20,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          }
                        : s
                    )
                  }
                />
              </Field>
              <p className="sm:col-span-2 text-xs text-gray-400">
                Increase bottom feed if the cutter slices through the last lines (typical
                3–6). Applies to the print agent and this browser’s thermal prints.
              </p>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={printSaving}
                  onClick={() =>
                    void savePrintSettings({
                      top_feed_lines: printSettings.top_feed_lines ?? 0,
                      bottom_feed_lines: printSettings.bottom_feed_lines ?? 3,
                    })
                  }
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {printSaving ? 'Saving…' : 'Save feed settings'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={printSaving || !canSaveHosts}
              onClick={() =>
                void savePrintSettings({
                  ...(canEditKot
                    ? {
                        kot_printer_host: printSettings.kot_printer_host,
                        kot_printer_port: printSettings.kot_printer_port,
                        kot_paper_width_mm: printSettings.kot_paper_width_mm ?? 58,
                      }
                    : {}),
                  ...(canEditBill
                    ? {
                        bill_printer_host: printSettings.bill_printer_host,
                        bill_printer_port: printSettings.bill_printer_port,
                        bill_paper_width_mm: printSettings.bill_paper_width_mm ?? 58,
                      }
                    : {}),
                })
              }
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {printSaving ? 'Saving…' : 'Save printer hosts'}
            </button>
            {role === 'admin' ? (
              <button
                type="button"
                disabled={printSaving}
                onClick={() => void rotateAgentKey()}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {hasAgentKey ? 'Rotate agent key' : 'Generate agent key'}
              </button>
            ) : null}
          </div>

          {hasAgentKey && printSettings.agent_api_key_hint ? (
            <p className="text-xs text-gray-400">
              Agent key ends with …{printSettings.agent_api_key_hint}
            </p>
          ) : canManageEnables ? (
            <p className="text-xs text-gray-400">
              Generate an agent key, then run the print agent on a PC that can reach your
              Wi‑Fi / LAN printers.
            </p>
          ) : null}

          {agentKeyOnce ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 break-all">
              <p className="font-semibold">Copy now (shown once):</p>
              <code className="text-xs">{agentKeyOnce}</code>
            </div>
          ) : null}

          {printMsg ? <p className="text-xs text-gray-500">{printMsg}</p> : null}
        </div>
      </div>
    </div>
  );
}
