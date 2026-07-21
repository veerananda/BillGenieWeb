/**
 * Ported from BillGenieFrontEnd/src/utils/inventoryAlerts.ts
 * Low stock = current_stock <= alert_quantity (alert_quantity <= 0 means no alert).
 */
import type { InventoryIngredient } from '../store/inventorySlice';

export function canViewInventory(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'chef';
}

export function canEditInventory(role: string | null | undefined): boolean {
  return role === 'admin';
}

export function canViewIngredientManagement(role: string | null | undefined): boolean {
  return role === 'admin';
}

export function canSyncInventory(
  role: string | null | undefined,
  canRestockFlag?: boolean
): boolean {
  if (canViewInventory(role)) return true;
  if (role === 'staff' || role === 'chef') return Boolean(canRestockFlag);
  return false;
}

export function canRestockInventory(
  role: string | null | undefined,
  canRestockFlag?: boolean
): boolean {
  if (role === 'admin' || role === 'manager') return true;
  if (role === 'staff' || role === 'chef') return Boolean(canRestockFlag);
  return false;
}

/** RED when at/below half of alert qty; YELLOW when at/below alert qty. */
export function getStockWarningLevel(
  currentStock: number,
  alertQuantity: number
): 'GREEN' | 'YELLOW' | 'RED' {
  if (alertQuantity <= 0) return 'GREEN';
  if (currentStock <= alertQuantity * 0.5) return 'RED';
  if (currentStock <= alertQuantity) return 'YELLOW';
  return 'GREEN';
}

export function isLowStock(currentStock: number, alertQuantity: number): boolean {
  return alertQuantity > 0 && currentStock <= alertQuantity;
}

export function getLowStockIngredients(
  ingredients: InventoryIngredient[]
): InventoryIngredient[] {
  return ingredients.filter((item) => isLowStock(item.currentStock, item.alertQuantity));
}
