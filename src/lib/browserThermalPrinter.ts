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
      bill: parsed.bill ? parsePaperWidthMm(parsed.bill) : undefined,
      kot: parsed.kot ? parsePaperWidthMm(parsed.kot) : undefined,
    };
  } catch {
    return {};
  }
}

function writePaperStore(next: StoredPaperWidths) {
  localStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(next));
}

/** Preferred paper width for a role (browser printer override, else cached preference). */
export function getPaperWidthMm(role: BrowserPrinterRole = 'bill'): PaperWidthMm {
  const printer = getBrowserPrinter(role);
  if (printer?.paperWidthMm) return parsePaperWidthMm(printer.paperWidthMm);
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
}

export function getBrowserPrinter(role: BrowserPrinterRole): BrowserPrinterConfig | null {
  const store = readStore();
  return store[role] ?? null;
}

export function clearBrowserPrinter(role: BrowserPrinterRole) {
  const store = readStore();
  store[role] = null;
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
  await port.open({ baudRate: 9600 });
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
export async function pairSerialPrinter(role: BrowserPrinterRole): Promise<BrowserPrinterConfig> {
  if (!navigator.serial) {
    throw new Error('Web Serial is not supported in this browser. Use Chrome or Edge on desktop.');
  }
  const port = await navigator.serial.requestPort();
  const info = port.getInfo?.() ?? {};
  const name =
    info.usbVendorId != null
      ? `Serial printer (${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)})`
      : 'Bluetooth / serial printer';

  // Smoke-open then close so permission is granted.
  await port.open({ baudRate: 9600 });
  await port.close();

  const paperWidthMm = getPaperWidthMm(role);
  const config: BrowserPrinterConfig = {
    kind: 'serial',
    name,
    connectedAt: new Date().toISOString(),
    paperWidthMm,
  };
  const store = readStore();
  store[role] = config;
  writeStore(store);
  return config;
}

/** Pair a BLE thermal printer via Web Bluetooth. */
export async function pairBluetoothPrinter(role: BrowserPrinterRole): Promise<BrowserPrinterConfig> {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.');
  }
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
  const store = readStore();
  store[role] = config;
  writeStore(store);
  // Keep a live reference for immediate reconnect in this session.
  sessionBluetoothDevices.set(device.id, device);
  return config;
}

const sessionBluetoothDevices = new Map<string, BluetoothDeviceLike>();

async function resolveBluetoothDevice(config: BrowserPrinterConfig): Promise<BluetoothDeviceLike> {
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
  }
  // Fall back to a new picker (user gesture required).
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_PRINT_SERVICES,
  });
  sessionBluetoothDevices.set(device.id, device);
  return device;
}

async function resolveSerialPort(): Promise<SerialPortLike> {
  if (!navigator.serial) throw new Error('Web Serial is not available');
  const ports = await navigator.serial.getPorts();
  if (ports.length === 1) return ports[0];
  if (ports.length > 1) {
    // Prefer previously authorized port; if multiple, ask again.
    return navigator.serial.requestPort();
  }
  return navigator.serial.requestPort();
}

/**
 * Print plain text to the browser-paired printer for this role.
 * Returns false if no browser printer is configured (caller may fall back to agent).
 */
export async function printTextToBrowserPrinter(
  role: BrowserPrinterRole,
  text: string
): Promise<boolean> {
  const config = getBrowserPrinter(role);
  if (!config) return false;

  const bytes = encodeEscPosText(text);

  if (config.kind === 'serial') {
    const port = await resolveSerialPort();
    await writeSerial(port, bytes);
    return true;
  }

  const device = await resolveBluetoothDevice(config);
  await printViaBluetoothDevice(device, bytes);
  return true;
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
