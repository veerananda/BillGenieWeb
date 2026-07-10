/**
 * Ported from BillGenieFrontEnd/src/utils/upiPayment.ts
 */

const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidUpiId(upiId: string): boolean {
  return UPI_ID_PATTERN.test(upiId.trim());
}

export function hasUpiPaymentConfigured(
  profile: { upi_id?: string; upi_qr_code?: string } | null | undefined
): boolean {
  if (!profile) return false;
  return Boolean(profile.upi_id?.trim() || profile.upi_qr_code?.trim());
}

export function buildUpiPaymentUri(params: {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionNote?: string;
  transactionRef?: string;
}): string {
  const pa = params.upiId.trim();
  const pn = encodeURIComponent(params.payeeName.trim().slice(0, 50) || 'Restaurant');
  const am = Math.max(0, params.amount).toFixed(2);
  const tn = encodeURIComponent((params.transactionNote || 'Bill payment').slice(0, 50));
  let uri = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  if (params.transactionRef) {
    uri += `&tr=${encodeURIComponent(params.transactionRef.slice(0, 50))}`;
  }
  return uri;
}

export function buildUpiPaymentUriFromProfile(
  profile: { upi_id?: string; name?: string } | null | undefined,
  amount: number,
  transactionNote?: string,
  transactionRef?: string
): string | null {
  const upiId = profile?.upi_id?.trim();
  if (!upiId || !isValidUpiId(upiId)) return null;
  return buildUpiPaymentUri({
    upiId,
    payeeName: profile?.name || 'Restaurant',
    amount,
    transactionNote,
    transactionRef,
  });
}
