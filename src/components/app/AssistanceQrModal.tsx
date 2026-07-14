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
          title: `Table ${tableName} assistance`,
          text: `Scan for table ${tableName} assistance`,
          url: assistanceUrl,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(assistanceUrl);
      alert('Assistance link copied to clipboard');
    } catch {
      alert(assistanceUrl);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Customer assistance QR" maxWidth="sm">
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">
          Ask the customer to scan this QR for table <span className="font-semibold text-gray-800">{tableName}</span>.
          They can call a waiter, and when you start checkout their bill review and download appear on the same page.
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
