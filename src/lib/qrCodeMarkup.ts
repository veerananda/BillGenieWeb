import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';

/** Render a tracking QR as inline SVG markup for HTML bill prints. */
export async function qrCodeSvgMarkup(value: string, size = 140): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return '';

  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      createElement(QRCodeSVG, {
        value: trimmed,
        size,
        marginSize: 1,
        level: 'M',
      })
    );
    requestAnimationFrame(() => {
      const svg = host.querySelector('svg')?.outerHTML ?? '';
      root.unmount();
      host.remove();
      resolve(svg);
    });
  });
}
