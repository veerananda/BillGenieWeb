/**
 * Ported from BillGenieFrontEnd/src/utils/inventoryAlerts.ts
 * No RN Alert dependency — low-stock check only.
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

export function getStockWarningLevel(
  currentStock: number,
  fullStock: number
): 'GREEN' | 'YELLOW' | 'RED' {
  if (fullStock <= 0) return 'GREEN';
  const ratio = currentStock / fullStock;
  if (ratio <= 0.1) return 'RED';
  if (ratio <= 0.25) return 'YELLOW';
  return 'GREEN';
}

export function isLowStock(currentStock: number, fullStock: number): boolean {
  return fullStock > 0 && currentStock / fullStock <= 0.25;
}

export function getLowStockIngredients(
  ingredients: InventoryIngredient[]
): InventoryIngredient[] {
  return ingredients.filter(
    (item) => item.fullStock > 0 && isLowStock(item.currentStock, item.fullStock)
  );
}
