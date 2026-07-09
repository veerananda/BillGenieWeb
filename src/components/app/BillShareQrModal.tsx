import { QRCodeSVG } from 'qrcode.react';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

interface BillShareQrModalProps {
  open: boolean;
  billUrl: string | null;
  loading?: boolean;
  onClose: () => void;
}

export function BillShareQrModal({ open, billUrl, loading = false, onClose }: BillShareQrModalProps) {
  const handleShareLink = async () => {
    if (!billUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bill summary',
          text: 'Your bill summary',
          url: billUrl,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(billUrl);
      alert('Bill link copied to clipboard');
    } catch {
      alert(billUrl);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Customer bill QR" maxWidth="sm">
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">
          Ask the customer to scan this QR to review and download the bill as PDF. The link stays active for 1 hour.
        </p>

        <div className="mx-auto flex min-h-[252px] min-w-[252px] items-center justify-center rounded-2xl bg-gray-50 p-4">
          {loading ? (
            <Spinner />
          ) : billUrl ? (
            <QRCodeSVG value={billUrl} size={220} />
          ) : null}
        </div>

        {billUrl ? (
          <p className="break-all text-xs text-gray-500">{billUrl}</p>
        ) : null}

        <button
          type="button"
          onClick={handleShareLink}
          disabled={!billUrl || loading}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Share link
        </button>
      </div>
    </Modal>
  );
}
