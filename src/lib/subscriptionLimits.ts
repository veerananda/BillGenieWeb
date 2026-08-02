/**
 * Ported from BillGenieApp-new/src/utils/subscriptionLimits.ts
 */

export interface SubscriptionLimits {
  is_legacy?: boolean;
  max_staff_and_chefs: number;
  max_staff?: number;
  max_chefs?: number;
  max_managers: number;
  max_tables: number;
  dine_in_enabled: boolean;
  counter_enabled: boolean;
  kitchen_dine_in: boolean;
  kitchen_counter: boolean;
  history_days: number;
  inventory: boolean;
  expenses?: boolean;
}

export interface SubscriptionUsage {
  staff_and_chefs: number;
  staff?: number;
  chefs?: number;
  managers: number;
  tables: number;
  admins?: number;
}

export function parseSubscriptionLimits(
  config: Record<string, unknown> | null | undefined
): SubscriptionLimits {
  const maxChefs = (config?.max_chefs as number) ?? 1;
  const maxStaffAndChefs = (config?.max_staff_and_chefs as number) ?? 4;
  const maxStaff =
    (config?.max_staff as number) ?? Math.max(0, maxStaffAndChefs - maxChefs);
  return {
    is_legacy: Boolean(config?.is_legacy),
    max_staff_and_chefs: maxStaffAndChefs,
    max_staff: maxStaff,
    max_chefs: maxChefs,
    max_managers: (config?.max_managers as number) ?? 1,
    max_tables: (config?.max_tables as number) ?? 10,
    dine_in_enabled: (config?.dine_in_enabled as boolean) ?? true,
    counter_enabled: (config?.counter_enabled as boolean) ?? true,
    kitchen_dine_in: (config?.kitchen_dine_in as boolean) ?? true,
    kitchen_counter: (config?.kitchen_counter as boolean) ?? true,
    history_days: (config?.history_days as number) ?? 90,
    inventory: (config?.inventory as boolean) ?? false,
    expenses: (config?.expenses as boolean) ?? false,
  };
}

export function hasKitchenAccess(limits: SubscriptionLimits): boolean {
  return limits.kitchen_dine_in || limits.kitchen_counter;
}

export function canAssignChefRole(limits: SubscriptionLimits): boolean {
  return hasKitchenAccess(limits);
}

export function canAddStaff(limits: SubscriptionLimits, usage: SubscriptionUsage): boolean {
  const maxStaff = limits.max_staff ?? limits.max_staff_and_chefs;
  const staffUsed = usage.staff ?? usage.staff_and_chefs;
  return staffUsed < maxStaff;
}

export function canAddManager(limits: SubscriptionLimits, usage: SubscriptionUsage): boolean {
  return usage.managers < limits.max_managers;
}

export function canAddChef(limits: SubscriptionLimits, usage: SubscriptionUsage): boolean {
  if (!canAssignChefRole(limits)) return false;
  const maxChefs = limits.max_chefs ?? 1;
  const chefsUsed = usage.chefs ?? 0;
  return chefsUsed < maxChefs;
}

export function formatStaffPlanHint(
  limits: SubscriptionLimits,
  usage: SubscriptionUsage
): string {
  const maxStaff = limits.max_staff ?? limits.max_staff_and_chefs;
  const maxChefs = limits.max_chefs ?? 1;
  const staffUsed = usage.staff ?? 0;
  const chefsUsed = usage.chefs ?? 0;
  const kitchen = canAssignChefRole(limits);
  const chefPart = kitchen ? ` · ${chefsUsed}/${maxChefs} chef` : '';
  return `Plan: 1 admin · ${staffUsed}/${maxStaff} staff${chefPart} · ${usage.managers}/${limits.max_managers} manager${limits.max_managers === 1 ? '' : 's'}`;
}

/** Derive seat usage from the live team list so add/delete updates the gate immediately. */
export function usageFromTeamMembers(
  members: Array<{ role?: string | null }>,
  base?: Partial<SubscriptionUsage> | null
): SubscriptionUsage {
  let managers = 0;
  let staffCount = 0;
  let chefs = 0;
  let admins = 0;
  for (const member of members) {
    switch (member.role) {
      case 'manager':
        managers += 1;
        break;
      case 'staff':
        staffCount += 1;
        break;
      case 'chef':
        chefs += 1;
        break;
      case 'admin':
        admins += 1;
        break;
      default:
        break;
    }
  }
  return {
    tables: base?.tables ?? 0,
    managers,
    staff: staffCount,
    chefs,
    staff_and_chefs: staffCount + chefs,
    admins: admins || base?.admins || 0,
  };
}

export function canAddTable(limits: SubscriptionLimits, usage: SubscriptionUsage): boolean {
  return usage.tables < limits.max_tables;
}

export function hasExpensesAccess(limits: SubscriptionLimits): boolean {
  return Boolean(limits.expenses || limits.is_legacy);
}
