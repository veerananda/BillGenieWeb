/**
 * Ported from BillGenieFrontEnd/src/utils/subscriptionLimits.ts
 */

export interface SubscriptionLimits {
  max_staff: number;
  max_managers: number;
  max_tables: number;
  dine_in_enabled: boolean;
  counter_enabled: boolean;
  kitchen_dine_in: boolean;
  kitchen_counter: boolean;
  history_days: number;
  inventory: boolean;
}

export interface SubscriptionUsage {
  staff_count: number;
  manager_count: number;
  table_count: number;
}

export function parseSubscriptionLimits(
  config: Record<string, unknown> | null | undefined
): SubscriptionLimits {
  return {
    max_staff: (config?.max_staff as number) ?? 2,
    max_managers: (config?.max_managers as number) ?? 0,
    max_tables: (config?.max_tables as number) ?? 10,
    dine_in_enabled: (config?.dine_in_enabled as boolean) ?? true,
    counter_enabled: (config?.counter_enabled as boolean) ?? false,
    kitchen_dine_in: (config?.kitchen_dine_in as boolean) ?? false,
    kitchen_counter: (config?.kitchen_counter as boolean) ?? false,
    history_days: (config?.history_days as number) ?? 30,
    inventory: (config?.inventory as boolean) ?? false,
  };
}

export function hasKitchenAccess(limits: SubscriptionLimits): boolean {
  return limits.kitchen_dine_in || limits.kitchen_counter;
}

export function canAddStaff(limits: SubscriptionLimits, usage: SubscriptionUsage): boolean {
  return usage.staff_count < limits.max_staff;
}

export function canAddManager(limits: SubscriptionLimits, usage: SubscriptionUsage): boolean {
  return usage.manager_count < limits.max_managers;
}

export function canAddTable(limits: SubscriptionLimits, usage: SubscriptionUsage): boolean {
  return usage.table_count < limits.max_tables;
}
