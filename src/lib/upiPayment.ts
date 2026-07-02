/**
 * Ported from BillGenieFrontEnd/src/utils/upiPayment.ts
 */

export function isValidUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  if (trimmed.length < 3) return false;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [handle, domain] = parts;
  return handle.length > 0 && domain.length > 0;
}

export function hasUpiPaymentConfigured(upiId: string | null | undefined): boolean {
  return !!upiId && isValidUpiId(upiId);
}

export function buildUpiPaymentUri(
  upiId: string,
  amount: number,
  merchantName?: string,
  transactionNote?: string
): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: merchantName ?? 'BillGenie',
    am: amount.toFixed(2),
    cu: 'INR',
  });
  if (transactionNote) params.append('tn', transactionNote);
  return `upi://pay?${params.toString()}`;
}

export function buildUpiPaymentUriFromProfile(
  profile: { upi_id?: string; name?: string } | null | undefined,
  amount: number
): string | null {
  if (!profile?.upi_id || !isValidUpiId(profile.upi_id)) return null;
  return buildUpiPaymentUri(profile.upi_id, amount, profile.name, 'BillGenie payment');
}
