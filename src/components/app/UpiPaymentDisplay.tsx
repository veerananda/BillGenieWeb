import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { RestaurantProfile } from '../../services/api';
import { buildUpiPaymentUriFromProfile } from '../../lib/upiPayment';

interface UpiPaymentDisplayProps {
  profile: RestaurantProfile | null | undefined;
  amount: number;
  transactionNote?: string;
  qrSize?: number;
  onPrintBill?: () => void;
  printBusy?: boolean;
}

export function UpiPaymentDisplay({
  profile,
  amount,
  transactionNote = 'Counter order',
  qrSize = 176,
  onPrintBill,
  printBusy = false,
}: UpiPaymentDisplayProps) {
  const upiUri = useMemo(
    () => buildUpiPaymentUriFromProfile(profile, amount, transactionNote),
    [profile, amount, transactionNote]
  );

  const printButton =
    onPrintBill ? (
      <button
        type="button"
        disabled={printBusy}
        onClick={onPrintBill}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        <Printer className="h-4 w-4" />
        {printBusy ? 'Printing…' : 'Print bill'}
      </button>
    ) : null;

  if (upiUri) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-800">Scan to pay exact amount</p>
        <p className="text-2xl font-bold text-primary">₹{amount.toFixed(2)}</p>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <QRCodeSVG value={upiUri} size={qrSize} />
        </div>
        {profile?.upi_id ? (
          <p className="text-xs text-gray-500">UPI ID: {profile.upi_id}</p>
        ) : null}
        {printButton}
      </div>
    );
  }

  if (profile?.upi_qr_code) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-800">Scan QR code to pay</p>
        <p className="text-2xl font-bold text-primary">₹{amount.toFixed(2)}</p>
        <p className="text-xs text-gray-500">Static QR — customer may need to enter amount manually</p>
        <img
          src={profile.upi_qr_code}
          alt="UPI QR"
          className="rounded-lg object-contain"
          style={{ width: qrSize, height: qrSize }}
        />
        {printButton}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-gray-50 px-5 py-4 text-center text-sm text-gray-500">
        Add a UPI ID in Restaurant Profile to enable dynamic payment QR codes.
      </div>
      {printButton}
    </div>
  );
}
