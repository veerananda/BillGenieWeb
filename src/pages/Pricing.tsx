import { useState } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  BASIC_FEATURES,
  BASIC_MONTHLY_PRICE,
  PRICING,
  TRIAL_DURATION_DAYS,
  annualMonthlyEquivalent,
  annualSavings,
  formatInr,
} from '../data/pricing';

const MARKETING_ADDONS = [
  { key: 'dual_service', title: 'Dine-in + Counter', description: 'Run both service modes from one account', price: PRICING.dual_service },
  { key: 'kitchen_dine_in', title: 'Kitchen — dine-in', description: 'KOT queue & ready status for table orders', price: PRICING.kitchen_dine_in },
  { key: 'kitchen_counter', title: 'Kitchen — counter / takeaway', description: 'Kitchen screen for counter tickets', price: PRICING.kitchen_counter },
  { key: 'history_extended', title: 'Extended order history', description: '2 years of order & sales history', price: PRICING.history_extended },
  { key: 'inventory', title: 'Inventory & stock management', description: 'Track ingredient levels, get low-stock alerts, and let staff restock from the app', price: PRICING.inventory },
];

type Cycle = 'monthly' | 'annual';

export function Pricing() {
  usePageTitle('Pricing');
  const [cycle, setCycle] = useState<Cycle>('monthly');

  const displayPrice =
    cycle === 'monthly' ? BASIC_MONTHLY_PRICE : annualMonthlyEquivalent(BASIC_MONTHLY_PRICE);

  return (
    <div>
      {/* Hero */}
      <section className="bg-linear-to-b from-primary-light/60 to-surface">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <span className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/20">
            Transparent pricing
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Simple, modular pricing
          </h1>
          <p className="mt-5 text-lg text-ink-soft leading-relaxed">
            Start with the basics, then add only what your restaurant needs. Every plan starts
            with a {TRIAL_DURATION_DAYS}-day free trial.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                cycle === 'monthly' ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle('annual')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                cycle === 'annual' ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              Annual
              <span className="ml-1.5 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary-dark">
                Save {formatInr(annualSavings(BASIC_MONTHLY_PRICE))}/yr
              </span>
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Basic plan card */}
        <div className="overflow-hidden rounded-3xl border-2 border-primary bg-white shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="border-b border-border p-8 md:col-span-1 md:border-b-0 md:border-r">
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                Basic plan
              </span>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-ink">{formatInr(displayPrice)}</span>
                <span className="text-sm font-medium text-ink-soft">/month</span>
              </div>
              {cycle === 'annual' && (
                <p className="mt-1 text-xs text-ink-muted">billed annually</p>
              )}
              <p className="mt-3 text-sm text-ink-soft">
                Everything a single-location restaurant needs to get started.
              </p>
              <div className="mt-5 inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">
                {TRIAL_DURATION_DAYS}-day free trial
              </div>
              <Link
                to="/register"
                className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-dark hover:shadow-md active:scale-95"
              >
                Start free trial <ArrowRight size={15} />
              </Link>
            </div>
            <div className="p-8 md:col-span-2">
              <h3 className="text-sm font-semibold text-ink">What's included</h3>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {BASIC_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Add-ons */}
        <div className="mt-12 rounded-3xl bg-indigo-50 p-8">
          <div className="mb-6">
            <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              Add-ons
            </span>
            <h2 className="mt-2 text-xl font-bold text-ink">Pay only for what you turn on</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Billed monthly, on top of the Basic plan. Enable or disable any time.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MARKETING_ADDONS.map((addon) => (
              <div
                key={addon.key}
                className="flex items-start justify-between gap-4 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <h3 className="text-sm font-semibold text-ink">{addon.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{addon.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-bold text-ink">+{formatInr(addon.price)}</span>
                  <div className="text-xs font-normal text-ink-muted">/mo</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-ink-muted">
          Extra staff and managers, and additional table capacity, are also available beyond what's
          bundled with the Basic plan — talk to us to size a plan for your restaurant.
        </p>
      </div>

      {/* CTA */}
      <section className="relative overflow-hidden bg-linear-to-br from-ink via-ink to-primary-dark py-20 text-center">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-dark/30 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mt-3 text-white/70">
            {TRIAL_DURATION_DAYS}-day free trial — no credit card required.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-mid hover:shadow-lg active:scale-95"
          >
            Start free trial <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
