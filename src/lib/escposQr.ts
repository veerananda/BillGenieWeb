/** Marker pair embedded in thermal bill text; expanded to ESC/POS QR by printers. */
export const BILLGENIE_QR_START = '<<<BILLGENIE_QR>>>';
export const BILLGENIE_QR_END = '<<<END_QR>>>';

export function wrapTrackingUrlAsQrMarker(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return `${BILLGENIE_QR_START}\n${trimmed}\n${BILLGENIE_QR_END}`;
}

/** Epson-compatible QR (model 2, error correction M). */
export function buildEscPosQrCode(data: string, moduleSize = 5): Uint8Array {
  let size = moduleSize;
  if (size < 1) size = 1;
  if (size > 16) size = 16;
  const payload = new TextEncoder().encode(data);
  const parts: number[] = [];
  // Select model 2
  parts.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  // Module size
  parts.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
  // Error correction M (0x31)
  parts.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
  // Store data
  const storeLen = payload.length + 3;
  parts.push(0x1d, 0x28, 0x6b, storeLen & 0xff, (storeLen >> 8) & 0xff, 0x31, 0x50, 0x30);
  for (let i = 0; i < payload.length; i += 1) parts.push(payload[i]!);
  // Print
  parts.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  return Uint8Array.from(parts);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Expand <<<BILLGENIE_QR>>> / <<<END_QR>>> markers into ESC/POS QR bytes,
 * leaving surrounding text as UTF-8.
 */
export function expandBillGenieQrMarkers(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let rest = text;
  while (rest.length > 0) {
    const i = rest.indexOf(BILLGENIE_QR_START);
    if (i < 0) {
      chunks.push(encoder.encode(rest));
      break;
    }
    if (i > 0) chunks.push(encoder.encode(rest.slice(0, i)));
    rest = rest.slice(i + BILLGENIE_QR_START.length);
    const j = rest.indexOf(BILLGENIE_QR_END);
    if (j < 0) {
      chunks.push(encoder.encode(BILLGENIE_QR_START + rest));
      break;
    }
    const payload = rest.slice(0, j).trim();
    rest = rest.slice(j + BILLGENIE_QR_END.length);
    if (payload) {
      chunks.push(buildEscPosQrCode(payload, 5));
      chunks.push(encoder.encode('\n'));
    }
  }
  return concatBytes(chunks);
}
