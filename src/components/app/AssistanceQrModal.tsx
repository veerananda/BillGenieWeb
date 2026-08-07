import { QRCodeSVG } from 'qrcode.react';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

interface AssistanceQrModalProps {
  open: boolean;
  tableName: string;
  assistanceUrl: string | null;
  loading?: boolean;
  onClose: () => void;
}

export function AssistanceQrModal({
  open,
  tableName,
  assistanceUrl,
  loading = false,
  onClose,
}: AssistanceQrModalProps) {
  const handleShareLink = async () => {
    if (!assistanceUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Table ${tableName}`,
          text: `Scan for table ${tableName} menu, call waiter, and bill`,
          url: assistanceUrl,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(assistanceUrl);
      alert('Table QR link copied to clipboard');
    } catch {
      alert(assistanceUrl);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Table QR" maxWidth="sm" centered>
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">
          Ask the customer to scan this fixed QR for table{' '}
          <span className="font-semibold text-gray-800">{tableName}</span>. They can browse the menu, call a
          waiter, and review/download the bill after checkout starts. The same QR works for the next guest.
        </p>

        <div className="mx-auto flex min-h-[252px] min-w-[252px] items-center justify-center rounded-2xl bg-gray-50 p-4">
          {loading ? (
            <Spinner />
          ) : assistanceUrl ? (
            <QRCodeSVG value={assistanceUrl} size={220} />
          ) : null}
        </div>

        {assistanceUrl ? (
          <p className="break-all text-xs text-gray-500">{assistanceUrl}</p>
        ) : null}

        <button
          type="button"
          onClick={handleShareLink}
          disabled={!assistanceUrl || loading}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Share link
        </button>
      </div>
    </Modal>
  );
}
