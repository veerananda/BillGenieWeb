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
  isWebSerialSupported,
  pairBluetoothPrinter,
  pairSerialPrinter,
  printTestToBrowserPrinter,
  setPaperWidthMm,
  type BrowserPrinterConfig,
  type BrowserPrinterRole,
  type PaperWidthMm,
} from '../../lib/browserThermalPrinter';

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
  const serialOk = isWebSerialSupported();
  const bleOk = isWebBluetoothSupported();

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
            ? `${config.name} · ${config.kind === 'serial' ? 'Serial / Classic Bluetooth' : 'BLE'} · ${paperWidthMm}mm`
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
          disabled={!canEdit || busy || !serialOk}
          onClick={() =>
            void run(async () => {
              await pairSerialPrinter(role);
              setMsg('Serial / Classic Bluetooth printer paired for this browser.');
            })
          }
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Pair serial / Classic BT
        </button>
        <button
          type="button"
          disabled={!canEdit || busy || !bleOk}
          onClick={() =>
            void run(async () => {
              await pairBluetoothPrinter(role);
              setMsg('BLE printer paired for this browser.');
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
              setMsg('Cleared browser printer.');
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
      {!serialOk && !bleOk ? (
        <p className="text-xs text-amber-700">
          This browser does not support Web Serial or Web Bluetooth. Use Chrome/Edge on
          desktop, or configure a COM port for the print agent below.
        </p>
      ) : null}
      {msg ? <p className="text-xs text-gray-500">{msg}</p> : null}
    </div>
  );
}

/**
 * Cloud print-agent hosts + this-browser Bluetooth/serial pairing.
 * Admin/manager can toggle enables and always edit.
 * Staff/chef can edit when the matching enable is on.
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
        if (r.settings.bill_paper_width_mm === 58 || r.settings.bill_paper_width_mm === 80) {
          setPaperWidthMm('bill', r.settings.bill_paper_width_mm);
        }
        if (r.settings.kot_paper_width_mm === 58 || r.settings.kot_paper_width_mm === 80) {
          setPaperWidthMm('kot', r.settings.kot_paper_width_mm);
        }
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
      if (r.settings.bill_paper_width_mm === 58 || r.settings.bill_paper_width_mm === 80) {
        setPaperWidthMm('bill', r.settings.bill_paper_width_mm);
      }
      if (r.settings.kot_paper_width_mm === 58 || r.settings.kot_paper_width_mm === 80) {
        setPaperWidthMm('kot', r.settings.kot_paper_width_mm);
      }
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
          subtitle="KOT and bill printers for LAN, Wi-Fi, and Bluetooth"
        />
        <p className="text-sm text-red-600">{loadError || 'Printer settings unavailable.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printers"
        subtitle="LAN/Wi-Fi via the print agent, Bluetooth via this browser (Chrome/Edge) or a COM port on the agent PC."
      />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">This browser (Bluetooth)</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Pair a printer to print bills directly from Chrome/Edge. Classic Bluetooth: pair in
            Windows first, then use “Pair serial / Classic BT”. BLE printers can use “Pair BLE”.
            Stored only in this browser — not shared with other PCs.
          </p>
        </div>
        <div className="space-y-3 px-6 py-5">
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
          <p className="text-xs text-gray-400">
            Note: automatic KOT from order save still uses the print agent below. Browser KOT
            pairing is for test prints and future browser-triggered kitchen slips.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Print agent (LAN / Wi-Fi / COM)</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            For restaurant-wide printing: run the print agent on a PC. Use a printer IP for
            network printers, or a Windows COM port (e.g. COM5) after pairing a Classic Bluetooth
            printer to that PC.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">KOT printing</p>
              <p className="text-xs text-gray-400">
                Kitchen slips for dine-in saves and counter orders.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={printSettings.kot_printing_enabled}
              disabled={!canManageEnables || printSaving}
              onClick={() => {
                if (!canManageEnables) return;
                void savePrintSettings({
                  kot_printing_enabled: !printSettings.kot_printing_enabled,
                });
              }}
              className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                printSettings.kot_printing_enabled ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  printSettings.kot_printing_enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Bill printing</p>
              <p className="text-xs text-gray-400">
                When on, Print bill queues a slip. Checkout does not auto-print.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={printSettings.bill_printing_enabled}
              disabled={!canManageEnables || printSaving}
              onClick={() => {
                if (!canManageEnables) return;
                void savePrintSettings({
                  bill_printing_enabled: !printSettings.bill_printing_enabled,
                });
              }}
              className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                printSettings.bill_printing_enabled ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  printSettings.bill_printing_enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {!canManageEnables &&
          !printSettings.kot_printing_enabled &&
          !printSettings.bill_printing_enabled ? (
            <p className="text-sm text-gray-500">
              Printing is off. Ask an admin or manager to enable KOT and/or Bill printing.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="KOT printer (IP or COM)">
              <input
                className={inputClass}
                value={printSettings.kot_printer_host || ''}
                placeholder="192.168.1.50 or COM5"
                disabled={!canEditKot}
                onChange={(e) =>
                  setPrintSettings((s) =>
                    s ? { ...s, kot_printer_host: e.target.value } : s
                  )
                }
              />
            </Field>
            <Field label={kotIsSerial ? 'KOT port (ignored for COM)' : 'KOT TCP port'}>
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
            <Field label="Bill printer (IP or COM)">
              <input
                className={inputClass}
                value={printSettings.bill_printer_host || ''}
                placeholder="192.168.1.51 or COM6"
                disabled={!canEditBill}
                onChange={(e) =>
                  setPrintSettings((s) =>
                    s ? { ...s, bill_printer_host: e.target.value } : s
                  )
                }
              />
            </Field>
            <Field label={billIsSerial ? 'Bill port (ignored for COM)' : 'Bill TCP port'}>
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
            <Field label="KOT paper width">
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
            <Field label="Bill paper width">
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
              printers (or has the Bluetooth printer paired as a COM port).
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
