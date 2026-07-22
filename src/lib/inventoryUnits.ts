/** Inventory unit helpers — storage is canonical kg / liters (server-enforced). */

export type UnitFamily = 'weight' | 'volume' | 'other';

const TO_SMALL: Record<string, number> = {
  grams: 1,
  kg: 1000,
  ml: 1,
  liters: 1000,
};

export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  switch (u) {
    case 'g':
    case 'gram':
    case 'grams':
    case 'gm':
    case 'gms':
      return 'grams';
    case 'kg':
    case 'kgs':
    case 'kilogram':
    case 'kilograms':
      return 'kg';
    case 'ml':
    case 'milliliter':
    case 'milliliters':
    case 'millilitre':
    case 'millilitres':
      return 'ml';
    case 'l':
    case 'lt':
    case 'ltr':
    case 'liter':
    case 'liters':
    case 'litre':
    case 'litres':
      return 'liters';
    case 'pc':
    case 'pcs':
    case 'piece':
    case 'pieces':
      return 'pieces';
    default:
      return unit.trim();
  }
}

export function unitFamily(unit: string): UnitFamily {
  const n = normalizeUnit(unit);
  if (n === 'grams' || n === 'kg') return 'weight';
  if (n === 'ml' || n === 'liters') return 'volume';
  return 'other';
}

export function canonicalUnit(unit: string): string {
  const family = unitFamily(unit);
  if (family === 'weight') return 'kg';
  if (family === 'volume') return 'liters';
  return normalizeUnit(unit) || unit;
}

export function convertQuantity(qty: number, fromUnit: string, toUnit: string): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!Number.isFinite(qty)) return 0;
  if (from === to) return qty;
  const fromFactor = TO_SMALL[from];
  const toFactor = TO_SMALL[to];
  if (!fromFactor || !toFactor) return qty;
  return (qty * fromFactor) / toFactor;
}

/** Preferred restock entry units for an inventory row. */
export function entryUnitsFor(inventoryUnit: string): string[] {
  const family = unitFamily(inventoryUnit);
  if (family === 'weight') return ['grams', 'kg'];
  if (family === 'volume') return ['ml', 'liters'];
  const u = normalizeUnit(inventoryUnit);
  return u ? [u] : [];
}

/** Default entry unit: large unit for weight/volume. */
export function defaultEntryUnit(inventoryUnit: string): string {
  const units = entryUnitsFor(inventoryUnit);
  if (units.includes('kg')) return 'kg';
  if (units.includes('liters')) return 'liters';
  return units[0] || normalizeUnit(inventoryUnit) || inventoryUnit;
}

/**
 * Pick a readable display unit from stored canonical qty.
 * < 1 kg → grams; < 1 L → ml; otherwise keep storage unit.
 */
export function bestDisplayUnit(qtyInStorage: number, storageUnit: string): string {
  const family = unitFamily(storageUnit);
  if (family === 'weight') {
    return qtyInStorage > 0 && qtyInStorage < 1 ? 'grams' : 'kg';
  }
  if (family === 'volume') {
    return qtyInStorage > 0 && qtyInStorage < 1 ? 'ml' : 'liters';
  }
  return normalizeUnit(storageUnit) || storageUnit;
}

export function formatInventoryQty(qtyInStorage: number, storageUnit: string): string {
  const displayUnit = bestDisplayUnit(qtyInStorage, storageUnit);
  const displayQty = convertQuantity(qtyInStorage, storageUnit, displayUnit);
  const rounded =
    displayUnit === 'grams' || displayUnit === 'ml'
      ? Math.round(displayQty * 100) / 100
      : Math.round(displayQty * 1000) / 1000;
  const text =
    Number.isInteger(rounded) || Math.abs(rounded - Math.round(rounded)) < 1e-9
      ? String(Math.round(rounded))
      : rounded.toFixed(displayUnit === 'kg' || displayUnit === 'liters' ? 3 : 2).replace(/\.?0+$/, '');
  return `${text} ${displayUnit}`;
}

export function shortUnitLabel(unit: string): string {
  const n = normalizeUnit(unit);
  if (n === 'grams') return 'g';
  if (n === 'liters') return 'L';
  return n;
}
