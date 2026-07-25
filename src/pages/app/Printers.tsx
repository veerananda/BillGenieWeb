import { useEffect, useState } from 'react';
import { apiClient, type PrintSettings } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';

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

/**
 * Cloud print-agent hosts — all roles can view.
 * Admin/manager can toggle enables and always edit hosts.
 * Staff/chef can edit hosts only when the matching enable is on.
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

  async function savePrintSettings(patch: Partial<PrintSettings>) {
    setPrintSaving(true);
    setPrintMsg(null);
    try {
      const r = await apiClient.updatePrintSettings(patch);
      setPrintSettings(r.settings);
      setHasAgentKey(r.has_agent_key);
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
          subtitle="KOT and bill printers for the on-site print agent"
        />
        <p className="text-sm text-red-600">{loadError || 'Printer settings unavailable.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printers"
        subtitle="KOT and bill printers for the on-site print agent (LAN/Wi-Fi ESC/POS). Browsers cannot print directly to thermals — keep the print agent running on a PC."
      />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">KOT printing</p>
              <p className="text-xs text-gray-400">
                One kitchen printer for dine-in saves and counter orders. Admin/manager enable
                this; staff can set the printer IP when it is on.
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
                When on, Print bill queues a slip (dine-in or counter). Checkout does not
                auto-print.
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
              Printing is off. Ask an admin or manager to enable KOT and/or Bill printing, then
              you can set printer IPs here.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="KOT printer IP / host">
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
            <Field label="KOT port">
              <input
                className={inputClass}
                type="number"
                value={printSettings.kot_printer_port || 9100}
                disabled={!canEditKot}
                onChange={(e) =>
                  setPrintSettings((s) =>
                    s
                      ? { ...s, kot_printer_port: Number(e.target.value) || 9100 }
                      : s
                  )
                }
              />
            </Field>
            <Field label="Bill printer IP / host">
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
            <Field label="Bill port">
              <input
                className={inputClass}
                type="number"
                value={printSettings.bill_printer_port || 9100}
                disabled={!canEditBill}
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
                      }
                    : {}),
                  ...(canEditBill
                    ? {
                        bill_printer_host: printSettings.bill_printer_host,
                        bill_printer_port: printSettings.bill_printer_port,
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
              printers.
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
