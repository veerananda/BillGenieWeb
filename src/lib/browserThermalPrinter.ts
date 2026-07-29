/**
 * Browser-side ESC/POS printing for Chrome/Edge:
 * - Web Serial: Classic Bluetooth printers paired in the OS (appear as COM ports)
 * - Web Bluetooth: BLE thermal printers only
 *
 * Config is stored per-browser in localStorage. KOT/bill cloud agent settings
 * remain separate (LAN or COM via the print agent).
 */

const STORAGE_KEY = 'billgenie_browser_thermal_printers_v1';
const FEED_STORAGE_KEY = 'billgenie_print_feed_lines_v1';
const PAPER_STORAGE_KEY = 'billgenie_paper_width_mm_v1';

export type BrowserPrinterRole = 'bill' | 'kot';
export type BrowserPrinterKind = 'serial' | 'bluetooth';
export type PaperWidthMm = 58 | 80;

export type BrowserPrinterConfig = {
  kind: BrowserPrinterKind;
  name: string;
  /** Web Bluetooth device id (for reconnect). */
  bluetoothDeviceId?: string;
  /** Web Serial USB ids so we can pick the same port after refresh. */
  usbVendorId?: number;
  usbProductId?: number;
  /** Last connected label for UI. */
  connectedAt?: string;
  /** Thermal paper width used for column layout (32 vs 48 cols). */
  paperWidthMm?: PaperWidthMm;
};

export type PrintFeedLines = { top: number; bottom: number };

function clampFeedLines(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const v = Math.floor(n);
  if (v < 0) return 0;
  if (v > 20) return 20;
  return v;
}

/** Cache restaurant paper-feed settings for browser ESC/POS encoding. */
export function cachePrintFeedLines(top: number, bottom: number): void {
  const next: PrintFeedLines = {
    top: clampFeedLines(top),
    bottom: clampFeedLines(bottom),
  };
  localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(next));
}

export function getCachedPrintFeedLines(): PrintFeedLines {
  try {
    const raw = localStorage.getItem(FEED_STORAGE_KEY);
    if (!raw) return { top: 0, bottom: 3 };
    const parsed = JSON.parse(raw) as Partial<PrintFeedLines>;
    return {
      top: clampFeedLines(Number(parsed.top ?? 0)),
      bottom: clampFeedLines(Number(parsed.bottom ?? 3)),
    };
  } catch {
    return { top: 0, bottom: 3 };
  }
}

function parsePaperWidthMm(value: unknown): PaperWidthMm {
  return Number(value) === 80 ? 80 : 58;
}

type StoredPaperWidths = { bill?: PaperWidthMm; kot?: PaperWidthMm };

function readPaperStore(): StoredPaperWidths {
  try {
    const raw = localStorage.getItem(PAPER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredPaperWidths;
    return {
      bill:
        parsed.bill === 58 || parsed.bill === 80
          ? parsed.bill
          : parsed.bill != null
            ? parsePaperWidthMm(parsed.bill)
            : undefined,
      kot:
        parsed.kot === 58 || parsed.kot === 80
          ? parsed.kot
          : parsed.kot != null
            ? parsePaperWidthMm(parsed.kot)
            : undefined,
    };
  } catch {
    return {};
  }
}

function writePaperStore(next: StoredPaperWidths) {
  localStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(next));
}

/** Preferred paper width for a role (paired browser printer, else cached preference). */
export function getPaperWidthMm(role: BrowserPrinterRole = 'bill'): PaperWidthMm {
  const printer = getBrowserPrinter(role);
  if (printer && (printer.paperWidthMm === 58 || printer.paperWidthMm === 80)) {
    return printer.paperWidthMm;
  }
  const cached = readPaperStore()[role];
  return cached ?? 58;
}

/** Persist paper width for a role and attach it to a paired browser printer when present. */
export function setPaperWidthMm(role: BrowserPrinterRole, width: PaperWidthMm): void {
  const paperWidthMm = parsePaperWidthMm(width);
  const papers = readPaperStore();
  papers[role] = paperWidthMm;
  writePaperStore(papers);

  const store = readStore();
  const existing = store[role];
  if (existing) {
    store[role] = { ...existing, paperWidthMm };
    writeStore(store);
  }
}

type StoredPrinters = {
  bill?: BrowserPrinterConfig | null;
  kot?: BrowserPrinterConfig | null;
};

type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};

type BluetoothRemoteGATTCharacteristicLike = {
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
};

type BluetoothRemoteGATTServiceLike = {
  uuid?: string;
  getCharacteristic: (c: string) => Promise<BluetoothRemoteGATTCharacteristicLike>;
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicLike[]>;
};

type BluetoothRemoteGATTServerLike = {
  getPrimaryService: (service: string) => Promise<BluetoothRemoteGATTServiceLike>;
  getPrimaryServices: () => Promise<BluetoothRemoteGATTServiceLike[]>;
};

type BluetoothDeviceLike = {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<BluetoothRemoteGATTServerLike>;
    disconnect: () => void;
  };
};

declare global {
  interface Navigator {
    serial?: {
      requestPort: (options?: {
        filters?: Array<{ usbVendorId?: number }>;
      }) => Promise<SerialPortLike>;
      getPorts: () => Promise<SerialPortLike[]>;
    };
    bluetooth?: {
      requestDevice: (options: {
        acceptAllDevices?: boolean;
        filters?: Array<{ services?: string[]; namePrefix?: string }>;
        optionalServices?: string[];
      }) => Promise<BluetoothDeviceLike>;
      getDevices?: () => Promise<BluetoothDeviceLike[]>;
    };
  }
}

/** Common BLE ESC/POS printer service UUIDs (Chinese module + Nordic UART). */
const BLE_PRINT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent
];

const BLE_WRITE_CHARS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
];

function readStore(): StoredPrinters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredPrinters;
  } catch {
    return {};
  }
}

function writeStore(next: StoredPrinters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('billgenie-printers-changed'));
  }
}

export function getBrowserPrinter(role: BrowserPrinterRole): BrowserPrinterConfig | null {
  const store = readStore();
  return store[role] ?? null;
}

/**
 * Printer paired for this role only (no silent fall back to the other role).
 */
export function getResolvedBrowserPrinter(role: BrowserPrinterRole): BrowserPrinterConfig | null {
  return getBrowserPrinter(role);
}

export function hasAnyBrowserPrinter(): boolean {
  return Boolean(getBrowserPrinter('bill') || getBrowserPrinter('kot'));
}

export function clearBrowserPrinter(role: BrowserPrinterRole) {
  const store = readStore();
  store[role] = null;
  writeStore(store);
  sessionSerialPorts.delete(role);
}

/** Clear both KOT and bill browser pairings. */
export function clearAllBrowserPrinters() {
  writeStore({ bill: null, kot: null });
  sessionSerialPorts.clear();
}

function savePrinterConfig(
  config: BrowserPrinterConfig,
  role: BrowserPrinterRole,
  shareBoth: boolean
) {
  const store = readStore();
  if (shareBoth) {
    store.bill = { ...config };
    store.kot = { ...config };
  } else {
    store[role] = config;
  }
  writeStore(store);
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.serial);
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
}

export function encodeEscPosText(
  text: string,
  feeds?: { top?: number; bottom?: number }
): Uint8Array {
  const cached = getCachedPrintFeedLines();
  const top = clampFeedLines(feeds?.top ?? cached.top);
  const bottom = clampFeedLines(feeds?.bottom ?? cached.bottom);
  const topFeed = top > 0 ? '\n'.repeat(top) : '';
  const bottomFeed = bottom > 0 ? '\n'.repeat(bottom) : '';
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const withNewline = normalized.endsWith('\n') ? normalized : `${normalized}\n`;
  const encoder = new TextEncoder();
  const body = encoder.encode(topFeed + withNewline + bottomFeed);
  const out = new Uint8Array(2 + body.length + 3);
  out[0] = 0x1b;
  out[1] = 0x40; // ESC @
  out.set(body, 2);
  // GS V 1 = partial cut (safer on many 58mm models than full cut).
  out[out.length - 3] = 0x1d;
  out[out.length - 2] = 0x56;
  out[out.length - 1] = 0x01;
  return out;
}

async function writeSerial(port: SerialPortLike, bytes: Uint8Array): Promise<void> {
  // Classic BT COM ports often stay "open" briefly; tolerate already-open.
  try {
    await port.open({ baudRate: 9600 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already open/i.test(msg)) throw err;
  }
  try {
    if (!port.writable) throw new Error('Serial port is not writable');
    const writer = port.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  } finally {
    try {
      await port.close();
    } catch {
      // ignore close errors
    }
  }
}

async function writeCharacteristic(
  characteristic: BluetoothRemoteGATTCharacteristicLike,
  bytes: Uint8Array
): Promise<void> {
  const chunkSize = 180;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else if (characteristic.writeValueWithResponse) {
      await characteristic.writeValueWithResponse(chunk);
    } else if (characteristic.writeValue) {
      await characteristic.writeValue(chunk);
    } else {
      throw new Error('Bluetooth characteristic does not support write');
    }
  }
}

async function findWriteCharacteristic(
  server: BluetoothRemoteGATTServerLike
): Promise<BluetoothRemoteGATTCharacteristicLike> {
  for (const serviceUuid of BLE_PRINT_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const charUuid of BLE_WRITE_CHARS) {
        try {
          return await service.getCharacteristic(charUuid);
        } catch {
          // try next
        }
      }
      const chars = await service.getCharacteristics();
      if (chars[0]) return chars[0];
    } catch {
      // try next service
    }
  }

  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const c of chars) {
      return c;
    }
  }
  throw new Error('No writable Bluetooth print characteristic found on this device');
}

async function printViaBluetoothDevice(device: BluetoothDeviceLike, bytes: Uint8Array): Promise<void> {
  if (!device.gatt) throw new Error('Bluetooth device has no GATT server');
  const server = await device.gatt.connect();
  try {
    const characteristic = await findWriteCharacteristic(server);
    await writeCharacteristic(characteristic, bytes);
  } finally {
    try {
      device.gatt.disconnect();
    } catch {
      // ignore
    }
  }
}

/** Pair a Classic Bluetooth (serial/COM) printer via Chrome Web Serial picker. */
export async function pairSerialPrinter(
  role: BrowserPrinterRole,
  options?: { shareBoth?: boolean }
): Promise<BrowserPrinterConfig> {
  if (!navigator.serial) {
    throw new Error('Web Serial is not supported in this browser. Use Chrome or Edge on desktop.');
  }
  const shareBoth = options?.shareBoth === true;
  const port = await navigator.serial.requestPort();
  const info = port.getInfo?.() ?? {};
  const name =
    info.usbVendorId != null
      ? `Serial printer (${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)})`
      : 'Bluetooth / serial printer';

  // Smoke-open then close so permission is granted.
  try {
    await port.open({ baudRate: 9600 });
    await port.close();
  } catch {
    // Some COM devices error on smoke open; permission is still granted.
  }

  const paperWidthMm = getPaperWidthMm(role);
  const config: BrowserPrinterConfig = {
    kind: 'serial',
    name,
    usbVendorId: info.usbVendorId,
    usbProductId: info.usbProductId,
    connectedAt: new Date().toISOString(),
    paperWidthMm,
  };
  savePrinterConfig(config, role, shareBoth);
  sessionSerialPorts.set(role, port);
  if (shareBoth) {
    const other: BrowserPrinterRole = role === 'bill' ? 'kot' : 'bill';
    sessionSerialPorts.set(other, port);
  }
  return config;
}

/** Pair a BLE thermal printer via Web Bluetooth. */
export async function pairBluetoothPrinter(
  role: BrowserPrinterRole,
  options?: { shareBoth?: boolean }
): Promise<BrowserPrinterConfig> {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.');
  }
  const shareBoth = options?.shareBoth === true;
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_PRINT_SERVICES,
  });
  const paperWidthMm = getPaperWidthMm(role);
  const config: BrowserPrinterConfig = {
    kind: 'bluetooth',
    name: device.name || 'Bluetooth printer',
    bluetoothDeviceId: device.id,
    connectedAt: new Date().toISOString(),
    paperWidthMm,
  };
  savePrinterConfig(config, role, shareBoth);
  // Keep a live reference for immediate reconnect in this session.
  sessionBluetoothDevices.set(device.id, device);
  return config;
}

const sessionBluetoothDevices = new Map<string, BluetoothDeviceLike>();
const sessionSerialPorts = new Map<BrowserPrinterRole, SerialPortLike>();

/**
 * Rebuild in-memory handles from Chrome's permitted devices/ports after a refresh.
 * Does not open a pair picker. Call on History / Printers mount and before print.
 */
export async function warmBrowserPrinterSession(
  role?: BrowserPrinterRole
): Promise<{ ok: boolean; needUserGesture: boolean }> {
  const roles: BrowserPrinterRole[] = role ? [role] : ['bill', 'kot'];
  let ok = true;
  let needUserGesture = false;

  // Warm each configured role independently (bill and KOT may be different printers).
  for (const r of roles) {
    const config = getBrowserPrinter(r);
    if (!config) continue;

    if (config.kind === 'bluetooth') {
      if (config.bluetoothDeviceId && sessionBluetoothDevices.has(config.bluetoothDeviceId)) {
        continue;
      }
      if (!navigator.bluetooth?.getDevices) {
        ok = false;
        needUserGesture = true;
        continue;
      }
      try {
        const devices = await navigator.bluetooth.getDevices();
        const found =
          (config.bluetoothDeviceId
            ? devices.find((d) => d.id === config.bluetoothDeviceId)
            : undefined) ?? (devices.length === 1 ? devices[0] : undefined);
        if (found) {
          sessionBluetoothDevices.set(found.id, found);
        } else {
          ok = false;
          needUserGesture = true;
        }
      } catch {
        ok = false;
        needUserGesture = true;
      }
      continue;
    }

    if (sessionSerialPorts.has(r)) continue;
    if (!navigator.serial?.getPorts) {
      ok = false;
      needUserGesture = true;
      continue;
    }
    try {
      const ports = await navigator.serial.getPorts();
      const matched = matchSerialPort(ports, config);
      if (matched) {
        sessionSerialPorts.set(r, matched);
      } else {
        ok = false;
        needUserGesture = true;
      }
    } catch {
      ok = false;
      needUserGesture = true;
    }
  }

  return { ok, needUserGesture };
}

function matchSerialPort(
  ports: SerialPortLike[],
  config: BrowserPrinterConfig
): SerialPortLike | null {
  if (!ports.length) return null;
  // getPorts() only returns ports this origin already authorized — safe to reuse.
  if (config.usbVendorId != null) {
    const exact =
      ports.find((p) => {
        const info = p.getInfo?.() ?? {};
        return (
          info.usbVendorId === config.usbVendorId &&
          (config.usbProductId == null || info.usbProductId === config.usbProductId)
        );
      }) ?? null;
    if (exact) return exact;
  }
  // Classic Bluetooth COM ports often expose empty USB ids — reuse the permitted port.
  return ports[0] ?? null;
}

/** Serialize all browser prints so one Bluetooth printer never gets overlapping connects. */
let printChain: Promise<unknown> = Promise.resolve();

function enqueuePrint<T>(job: () => Promise<T>): Promise<T> {
  const run = printChain.then(job, job);
  printChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function resolveBluetoothDevice(
  role: BrowserPrinterRole,
  config: BrowserPrinterConfig,
  allowReconnectPicker: boolean
): Promise<BluetoothDeviceLike> {
  if (config.bluetoothDeviceId && sessionBluetoothDevices.has(config.bluetoothDeviceId)) {
    return sessionBluetoothDevices.get(config.bluetoothDeviceId)!;
  }
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth is not available');
  }
  // getDevices() only returns previously permitted devices (Chrome).
  if (navigator.bluetooth.getDevices && config.bluetoothDeviceId) {
    const devices = await navigator.bluetooth.getDevices();
    const found = devices.find((d) => d.id === config.bluetoothDeviceId);
    if (found) {
      sessionBluetoothDevices.set(found.id, found);
      return found;
    }
    // Also accept the only permitted device (id can change across Chrome profiles rarely).
    if (devices.length === 1) {
      sessionBluetoothDevices.set(devices[0].id, devices[0]);
      const store = readStore();
      const next = { ...config, bluetoothDeviceId: devices[0].id, name: devices[0].name || config.name };
      store[role] = next;
      if (getBrowserPrinter(role === 'bill' ? 'kot' : 'bill')?.bluetoothDeviceId === config.bluetoothDeviceId) {
        store[role === 'bill' ? 'kot' : 'bill'] = { ...next };
      }
      writeStore(store);
      return devices[0];
    }
  }
  if (!allowReconnectPicker) {
    throw new Error(
      'Bluetooth printer session expired after refresh. Tap Print once and approve the printer, or re-pair in Printers.'
    );
  }
  // User-gesture reconnect: restore permission without clearing Printers settings.
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_PRINT_SERVICES,
  });
  sessionBluetoothDevices.set(device.id, device);
  const next = {
    ...config,
    name: device.name || config.name,
    bluetoothDeviceId: device.id,
    connectedAt: new Date().toISOString(),
  };
  savePrinterConfig(next, role, false);
  return device;
}

async function resolveSerialPort(
  role: BrowserPrinterRole,
  config: BrowserPrinterConfig,
  allowReconnectPicker: boolean
): Promise<SerialPortLike> {
  const cached = sessionSerialPorts.get(role);
  if (cached) return cached;

  if (!navigator.serial) throw new Error('Web Serial is not available');
  const ports = await navigator.serial.getPorts();
  const matched = matchSerialPort(ports, config);
  if (matched) {
    sessionSerialPorts.set(role, matched);
    return matched;
  }
  if (!allowReconnectPicker) {
    throw new Error(
      'Serial printer session expired after refresh. Re-pair once in Printers (permission is then remembered).'
    );
  }
  const port = await navigator.serial.requestPort();
  const info = port.getInfo?.() ?? {};
  sessionSerialPorts.set(role, port);
  const next: BrowserPrinterConfig = {
    ...config,
    usbVendorId: info.usbVendorId ?? config.usbVendorId,
    usbProductId: info.usbProductId ?? config.usbProductId,
    connectedAt: new Date().toISOString(),
  };
  savePrinterConfig(next, role, false);
  return port;
}

/**
 * Print plain text to the browser-paired printer for this role only.
 * Returns false if that role has no printer configured.
 */
export async function printTextToBrowserPrinter(
  role: BrowserPrinterRole,
  text: string,
  options?: { allowReconnectPicker?: boolean; settleMs?: number }
): Promise<boolean> {
  const config = getResolvedBrowserPrinter(role);
  if (!config) return false;

  const allowReconnectPicker = options?.allowReconnectPicker !== false;
  const settleMs = options?.settleMs ?? (config.kind === 'bluetooth' ? 900 : 700);
  const bytes = encodeEscPosText(text);

  return enqueuePrint(async () => {
    const attempt = async () => {
      if (config.kind === 'serial') {
        const port = await resolveSerialPort(role, config, allowReconnectPicker);
        await writeSerial(port, bytes);
        return;
      }
      const device = await resolveBluetoothDevice(role, config, allowReconnectPicker);
      await printViaBluetoothDevice(device, bytes);
    };

    try {
      await attempt();
    } catch (firstErr) {
      // Same Bluetooth printer often needs a moment after a prior slip/cut.
      await new Promise((r) => setTimeout(r, 1000));
      try {
        await attempt();
      } catch {
        throw firstErr;
      }
    }

    await new Promise((r) => setTimeout(r, settleMs));
    return true;
  });
}

/** Gap between KOT and bill on one shared Bluetooth/serial printer. */
export function printerSettleDelay(ms = 1200): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function printTestToBrowserPrinter(role: BrowserPrinterRole): Promise<void> {
  const width = getPaperWidthMm(role) === 80 ? 48 : 32;
  const divider = '-'.repeat(width);
  const ok = await printTextToBrowserPrinter(
    role,
    [
      'BillGenie test print',
      divider,
      `Role: ${role.toUpperCase()}`,
      `Paper: ${getPaperWidthMm(role)}mm (${width} cols)`,
      `Time: ${new Date().toLocaleString('en-IN')}`,
      divider,
      'Browser Bluetooth / serial OK',
      '',
    ].join('\n')
  );
  if (!ok) {
    throw new Error('No browser printer configured for this role. Pair one first.');
  }
}
