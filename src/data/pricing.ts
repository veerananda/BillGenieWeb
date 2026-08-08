/**
 * Pricing model — keep in sync with
 * BillGenieApp-new/src/config/subscriptionPricing.ts
 * and restaurant-api/internal/services/subscription_pricing.go
 */

export type BillingCycle = 'quarterly' | 'half_yearly' | 'annual';
export type OperationMode = 'dine_in' | 'counter' | 'both';
export type CityTier = 'tier_1' | 'tier_2' | 'tier_3';
export type PlanBand = 'starter' | 'growth' | 'scale';

export const PLAN_STARTER_TABLES = 10;
export const PLAN_GROWTH_TABLES = 18;
export const PLAN_SCALE_TABLES = 25;

export const SUBSCRIPTION_INCLUDED = {
  admins: 1,
  managers: 1,
  staff: 2,
  chefs: 1,
  tables: PLAN_STARTER_TABLES,
  history_days: 90,
} as const;

/** @deprecated Use PLAN_STARTER_TABLES */
export const INCLUDED_TABLES_BASIC = PLAN_STARTER_TABLES;
export const MIN_TABLES_DINE_IN = 5;
export const MAX_TABLES = PLAN_SCALE_TABLES;
export const MAX_EXTRA_STAFF = 0;
export const MAX_EXTRA_CHEFS = 0;
export const MAX_EXTRA_MANAGERS = 0;

export const BAND_SEATS: Record<PlanBand, { staff: number; chefs: number; managers: number }> = {
  starter: { staff: 2, chefs: 1, managers: 1 },
  growth: { staff: 4, chefs: 2, managers: 1 },
  scale: { staff: 5, chefs: 3, managers: 1 },
};

export const PLAN_MONTHLY_BY_TIER: Record<PlanBand, Record<CityTier, number>> = {
  starter: { tier_1: 1199, tier_2: 999, tier_3: 799 },
  growth: { tier_1: 1499, tier_2: 1299, tier_3: 1099 },
  scale: { tier_1: 1899, tier_2: 1599, tier_3: 1399 },
};

export const BASIC_MONTHLY_PRICE = PLAN_MONTHLY_BY_TIER.starter.tier_2;
export const STARTS_FROM_MONTHLY = PLAN_MONTHLY_BY_TIER.starter.tier_3;
/** Marketing teaser only — equivalent of lowest catalog monthly / 30. */
export const STARTS_FROM_PER_DAY = Math.max(1, Math.floor(STARTS_FROM_MONTHLY / 30));
export const BILLGENIE_SUPPORT_EMAIL = 'hello@thebillgenie.com';
export const BASIC_MONTHLY_BY_TIER: Record<CityTier, number> = PLAN_MONTHLY_BY_TIER.starter;
export const ANNUAL_MULTIPLIER = 11;
export const QUARTERLY_MULTIPLIER = 3;
export const HALF_YEARLY_MULTIPLIER = 6;
export const TRIAL_DURATION_DAYS = 15;

export const BILLING_CYCLE_OPTIONS: Array<{
  id: BillingCycle;
  label: string;
  shortLabel: string;
  hint?: string;
}> = [
  { id: 'quarterly', label: 'Quarterly', shortLabel: '3 months' },
  { id: 'half_yearly', label: 'Half-yearly', shortLabel: '6 months' },
  { id: 'annual', label: 'Annual', shortLabel: 'year', hint: '1 month free' },
];

export function normalizeBillingCycle(cycle: string | undefined | null): BillingCycle {
  const c = String(cycle || '').toLowerCase().trim();
  if (c === 'annual' || c === 'yearly' || c === 'year') return 'annual';
  if (
    c === 'half_yearly' ||
    c === 'half-yearly' ||
    c === 'halfyearly' ||
    c === 'semiannual' ||
    c === 'semi_annual'
  ) {
    return 'half_yearly';
  }
  return 'quarterly';
}

export function billingCycleLabel(cycle: BillingCycle | string): string {
  switch (normalizeBillingCycle(cycle)) {
    case 'annual':
      return 'year';
    case 'half_yearly':
      return '6 months';
    default:
      return 'quarter';
  }
}

export function periodSubtotalFromQuote(
  quote: { monthly_subtotal: number; annual_total: number },
  cycle: BillingCycle | string
): number {
  const monthly = quote.monthly_subtotal;
  switch (normalizeBillingCycle(cycle)) {
    case 'annual':
      return quote.annual_total > 0 ? quote.annual_total : monthly * ANNUAL_MULTIPLIER;
    case 'half_yearly':
      return monthly * HALF_YEARLY_MULTIPLIER;
    default:
      return monthly * QUARTERLY_MULTIPLIER;
  }
}

export function formatPeriodPrice(
  quote: { monthly_subtotal: number; annual_total: number },
  cycle: BillingCycle | string
): string {
  const amount = periodSubtotalFromQuote(quote, cycle);
  const c = normalizeBillingCycle(cycle);
  if (c === 'annual') return `${formatInr(amount)}/year`;
  if (c === 'half_yearly') return `${formatInr(amount)}/6 mo`;
  return `${formatInr(amount)}/quarter`;
}

export const PRICING = {
  extra_staff: 69,
  extra_chef: 69,
  extra_manager: 99,
  history_extended: 99,
  inventory: 299,
  expenses: 79,
} as const;

export const PLAN_BANDS: Array<{
  id: PlanBand;
  title: string;
  tables: number;
  blurb: string;
  bestFor: string;
  details: string[];
}> = [
  {
    id: 'starter',
    title: 'Starter',
    tables: PLAN_STARTER_TABLES,
    blurb: 'Up to 10 tables · 2 staff · 1 chef · 1 manager',
    bestFor: 'Small cafés and compact dining rooms',
    details: [
      'Up to 10 dine-in tables',
      'Team: 1 admin · 1 manager · 2 staff · 1 chef',
      'Dine-in + counter (takeaway) + kitchen screens',
      'Unlimited menu items, billing & sales summary',
      'Order history for the last 90 days',
    ],
  },
  {
    id: 'growth',
    title: 'Growth',
    tables: PLAN_GROWTH_TABLES,
    blurb: 'Up to 18 tables · 4 staff · 2 chefs · 1 manager',
    bestFor: 'Busy mid-size restaurants with more floor staff',
    details: [
      'Up to 18 dine-in tables',
      'Team: 1 admin · 1 manager · 4 staff · 2 chefs',
      'Dine-in + counter (takeaway) + kitchen screens',
      'Unlimited menu items, billing & sales summary',
      'Order history for the last 90 days',
    ],
  },
  {
    id: 'scale',
    title: 'Scale',
    tables: PLAN_SCALE_TABLES,
    blurb: 'Up to 25 tables · 5 staff · 3 chefs · 1 manager',
    bestFor: 'Larger dining floors needing more kitchen coverage',
    details: [
      'Up to 25 dine-in tables',
      'Team: 1 admin · 1 manager · 5 staff · 3 chefs',
      'Dine-in + counter (takeaway) + kitchen screens',
      'Unlimited menu items, billing & sales summary',
      'Order history for the last 90 days',
    ],
  },
];

export interface SubscriptionSelection {
  billing_cycle: BillingCycle;
  operation_mode: OperationMode;
  max_tables: number;
  extra_staff: number;
  extra_chefs: number;
  extra_managers: number;
  history_extended: boolean;
  inventory: boolean;
  expenses: boolean;
  kitchen_dine_in: boolean;
  kitchen_counter: boolean;
}

export const DEFAULT_SUBSCRIPTION_SELECTION: SubscriptionSelection = {
  billing_cycle: 'quarterly',
  operation_mode: 'both',
  max_tables: PLAN_STARTER_TABLES,
  extra_staff: 0,
  extra_chefs: 0,
  extra_managers: 0,
  history_extended: false,
  inventory: false,
  expenses: false,
  kitchen_dine_in: true,
  kitchen_counter: true,
};

export const TRIAL_INCLUDES = [
  '15 days — no payment at signup',
  'Dine-in + Counter (eat-here/takeaway) + Kitchen',
  'Starter plan limits — 10 tables · 1 admin · 1 manager · 2 staff · 1 chef',
  'Menu management (unlimited items)',
  'Orders, billing, sales info',
  '90-day order history',
] as const;

export interface SubscriptionLineItem {
  id: string;
  label: string;
  amount: number;
}

export interface SubscriptionQuote {
  monthly_subtotal: number;
  annual_total: number;
  annual_monthly_equivalent: number;
  annual_savings: number;
  line_items: SubscriptionLineItem[];
  selection: SubscriptionSelection;
  bundled_staff: number;
  bundled_chefs: number;
  bundled_managers: number;
  table_bundles: number;
  city_tier?: CityTier;
  plan_band?: PlanBand;
}

export interface AddonOption {
  key: keyof Pick<SubscriptionSelection, 'history_extended' | 'inventory' | 'expenses'>;
  title: string;
  description: string;
  price: number;
}

export const ADDON_OPTIONS: AddonOption[] = [
  {
    key: 'expenses',
    title: 'Expenses',
    description: 'Track manual expenses and monthly settle reports',
    price: PRICING.expenses,
  },
  {
    key: 'inventory',
    title: 'Inventory suite',
    description: 'Ingredients, stock levels, alerts, and stock refill',
    price: PRICING.inventory,
  },
  {
    key: 'history_extended',
    title: 'Extended order history',
    description: '2 years of order & sales history (plan includes 90 days)',
    price: PRICING.history_extended,
  },
];

export const SHARED_PLAN_FEATURES = [
  'Dine-in + Counter (eat-here/takeaway)',
  'Kitchen screens included',
  'Menu management (unlimited items)',
  '1 admin included — staff/chef/manager seats grow with plan size',
  'Billing & sales summary',
  'Order history — last 90 days',
  `${TRIAL_DURATION_DAYS}-day free trial`,
] as const;

export const BASIC_FEATURES = [
  ...SHARED_PLAN_FEATURES.slice(0, 2),
  `Up to ${PLAN_STARTER_TABLES} dine-in tables (Starter)`,
  ...SHARED_PLAN_FEATURES.slice(2),
] as const;

export function planBandFromTables(maxTables: number): PlanBand {
  if (maxTables <= PLAN_STARTER_TABLES) return 'starter';
  if (maxTables <= PLAN_GROWTH_TABLES) return 'growth';
  return 'scale';
}

export function bandSeatBundle(maxTables: number): {
  staff: number;
  chefs: number;
  managers: number;
} {
  return BAND_SEATS[planBandFromTables(maxTables)];
}

export function tablesForPlanBand(band: PlanBand): number {
  switch (band) {
    case 'growth':
      return PLAN_GROWTH_TABLES;
    case 'scale':
      return PLAN_SCALE_TABLES;
    default:
      return PLAN_STARTER_TABLES;
  }
}

export function normalizeMaxTables(maxTables: number): number {
  if (maxTables <= 0) return PLAN_STARTER_TABLES;
  if (maxTables <= PLAN_STARTER_TABLES) return PLAN_STARTER_TABLES;
  if (maxTables <= PLAN_GROWTH_TABLES) return PLAN_GROWTH_TABLES;
  return PLAN_SCALE_TABLES;
}

export function normalizeSubscriptionSelection(
  selection: SubscriptionSelection
): SubscriptionSelection {
  return {
    ...selection,
    billing_cycle: normalizeBillingCycle(selection.billing_cycle),
    operation_mode: 'both',
    max_tables: normalizeMaxTables(selection.max_tables),
    kitchen_dine_in: true,
    kitchen_counter: true,
    extra_staff: 0,
    extra_chefs: 0,
    extra_managers: 0,
    history_extended: Boolean(selection.history_extended),
    inventory: Boolean(selection.inventory),
    expenses: Boolean(selection.expenses),
  };
}

export function bandMonthlyForTier(band: PlanBand, tier: CityTier): number {
  return PLAN_MONTHLY_BY_TIER[band][tier] ?? PLAN_MONTHLY_BY_TIER[band].tier_2;
}

export function basicMonthlyForTier(tier: CityTier): number {
  return bandMonthlyForTier('starter', tier);
}

export function priceForTier(amount: number, _tier: CityTier): number {
  return amount;
}

export function calculateSubscriptionQuote(
  selection: SubscriptionSelection,
  cityTier: CityTier = 'tier_2'
): SubscriptionQuote {
  const sel = normalizeSubscriptionSelection(selection);
  const band = planBandFromTables(sel.max_tables);
  const planPrice = bandMonthlyForTier(band, cityTier);
  const bandTitle = band.charAt(0).toUpperCase() + band.slice(1);
  const seats = bandSeatBundle(sel.max_tables);
  const line_items: SubscriptionLineItem[] = [
    {
      id: `plan_${band}`,
      label: `${bandTitle} — up to ${sel.max_tables} tables, dine-in + counter, kitchen, 1 admin + ${seats.managers} manager + ${seats.staff} staff + ${seats.chefs} chef, 90-day history`,
      amount: planPrice,
    },
  ];
  let monthly = planPrice;

  if (sel.history_extended) {
    line_items.push({
      id: 'history_extended',
      label: 'Extended order history (2 years)',
      amount: PRICING.history_extended,
    });
    monthly += PRICING.history_extended;
  }
  if (sel.inventory) {
    line_items.push({
      id: 'inventory',
      label: 'Inventory suite',
      amount: PRICING.inventory,
    });
    monthly += PRICING.inventory;
  }
  if (sel.expenses) {
    line_items.push({ id: 'expenses', label: 'Expenses page', amount: PRICING.expenses });
    monthly += PRICING.expenses;
  }

  const annual_total = monthly * ANNUAL_MULTIPLIER;
  return {
    monthly_subtotal: monthly,
    annual_total,
    annual_monthly_equivalent: Math.round(annual_total / 12),
    annual_savings: monthly,
    line_items,
    selection: sel,
    bundled_staff: seats.staff,
    bundled_chefs: seats.chefs,
    bundled_managers: seats.managers,
    table_bundles: 0,
    city_tier: cityTier,
    plan_band: band,
  };
}

export function isBarePlanSelection(selection: SubscriptionSelection): boolean {
  const sel = normalizeSubscriptionSelection(selection);
  return (
    sel.extra_staff === 0 &&
    sel.extra_chefs === 0 &&
    sel.extra_managers === 0 &&
    !sel.history_extended &&
    !sel.inventory &&
    !sel.expenses
  );
}

export function isBasicSubscriptionSelection(selection: SubscriptionSelection): boolean {
  const sel = normalizeSubscriptionSelection(selection);
  return planBandFromTables(sel.max_tables) === 'starter' && isBarePlanSelection(sel);
}

export function formatSubscriptionPlanName(
  selection: SubscriptionSelection,
  options?: { phase?: string }
): string {
  if (options?.phase === 'trial') return 'BillGenie Trial';
  const band = planBandFromTables(normalizeSubscriptionSelection(selection).max_tables);
  const title = band.charAt(0).toUpperCase() + band.slice(1);
  return `BillGenie ${title}`;
}

export function annualTotal(monthly: number): number {
  return monthly * ANNUAL_MULTIPLIER;
}

export function annualMonthlyEquivalent(monthly: number): number {
  return Math.round(annualTotal(monthly) / 12);
}

export function annualSavings(monthly: number): number {
  return monthly;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function tableBundlesAboveBasic(_maxTables: number): number {
  return 0;
}
export function bundledStaffFromTables(_maxTables: number): number {
  return SUBSCRIPTION_INCLUDED.staff;
}
export function bundledManagersFromTables(_maxTables: number): number {
  return SUBSCRIPTION_INCLUDED.managers;
}
