/** Default landing path after login / app index (Dashboard is hidden). */
export function getDefaultAppPath(
  role: string | null | undefined,
  opts?: { hasKitchenAccess?: boolean }
): string {
  if (role === 'chef') {
    return opts?.hasKitchenAccess ? '/app/kitchen' : '/app/support';
  }
  if (role === 'admin') return '/app/sales';
  // manager, staff, and unknown
  return '/app/orders';
}
