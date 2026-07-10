import { Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from './Modal';

interface TrackingQrModalProps {
  open: boolean;
  onClose: () => void;
  ticketNumber: number | null;
  trackingUrl: string | null;
  paymentSummary?: string | null;
  kitchenEnabled?: boolean;
  title?: string;
  confirmLabel?: string;
}

export function TrackingQrModal({
  open,
  onClose,
  ticketNumber,
  trackingUrl,
  paymentSummary,
  kitchenEnabled = false,
  title = 'Payment successful',
  confirmLabel = 'Next order',
}: TrackingQrModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex flex-col items-center text-center">
        {ticketNumber != null ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2">
            <Ticket className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold text-primary">Ticket #{ticketNumber}</span>
          </div>
        ) : null}

        {paymentSummary ? (
          <p className="mb-4 text-sm text-gray-600">{paymentSummary}</p>
        ) : null}

        {trackingUrl ? (
          <div className="w-full rounded-2xl bg-primary/5 p-5">
            <p className="mb-3 text-sm font-semibold text-gray-700">
              {kitchenEnabled
                ? 'Customer scans to track order and view bill'
                : 'Customer scans to view and download bill'}
            </p>
            <div className="flex justify-center">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG value={trackingUrl} size={200} />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {kitchenEnabled
                ? 'Status updates live — bill summary and download appear on the page after scanning'
                : 'Bill summary and download are shown on the page after scanning'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Order placed successfully</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
