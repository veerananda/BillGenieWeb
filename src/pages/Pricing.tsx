import { useState } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  PLAN_BANDS,
  PLAN_MONTHLY_BY_TIER,
  PRICING,
  SHARED_PLAN_FEATURES,
  STARTS_FROM_MONTHLY,
  TRIAL_DURATION_DAYS,
  annualMonthlyEquivalent,
  annualSavings,
  formatInr,
  type PlanBand,
} from '../data/pricing';

const MARKETING_ADDONS = [
  { key: 'expenses', title: 'Expenses', description: 'Track manual expenses and monthly settle reports', price: PRICING.expenses },
  { key: 'inventory', title: 'Inventory suite', description: 'Ingredients, stock levels, alerts, and stock refill', price: PRICING.inventory },
  { key: 'history_extended', title: 'Extended order history', description: '2 years of order & sales history (plans include 90 days)', price: PRICING.history_extended },
];

type Cycle = 'monthly' | 'annual';

function bandPrice(band: PlanBand, cycle: Cycle): number {
  const monthly = PLAN_MONTHLY_BY_TIER[band].tier_2;
  return cycle === 'monthly' ? monthly : annualMonthlyEquivalent(monthly);
}

export function Pricing() {
  usePageTitle('Pricing');
  const [cycle, setCycle] = useState<Cycle>('monthly');

  return (
    <div>
      <section className="bg-linear-to-b from-primary-light/60 to-surface">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <span className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/20">
            Transparent pricing
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Plans by restaurant size
          </h1>
          <p className="mt-5 text-lg text-ink-soft leading-relaxed">
            Starts from {formatInr(STARTS_FROM_MONTHLY)}/month. Pick Starter, Growth, or Scale by
            table capacity — then add only what you need. Every signup includes a{' '}
            {TRIAL_DURATION_DAYS}-day free trial.
          </p>

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
                Save {formatInr(annualSavings(STARTS_FROM_MONTHLY))}/yr on Starter
              </span>
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Prices shown for mid-size cities (Tier 2). Your city may adjust the plan base.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLAN_BANDS.map((band) => {
            const price = bandPrice(band.id, cycle);
            const featured = band.id === 'growth';
            return (
              <div
                key={band.id}
                className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
                  featured ? 'border-2 border-primary shadow-md' : 'border-border'
                }`}
              >
                <div className="p-6">
                  {featured ? (
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                      Popular
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                      {band.title}
                    </span>
                  )}
                  <h2 className="mt-3 text-xl font-bold text-ink">{band.title}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{band.blurb}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-ink">{formatInr(price)}</span>
                    <span className="text-sm font-medium text-ink-soft">/month</span>
                  </div>
                  {cycle === 'annual' && (
                    <p className="mt-1 text-xs text-ink-muted">billed annually</p>
                  )}
                  <p className="mt-3 text-sm font-semibold text-ink">
                    Up to {band.tables} tables included
                  </p>
                  <ul className="mt-4 space-y-2">
                    {SHARED_PLAN_FEATURES.filter((f) => !f.includes('trial')).map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
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
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-3xl bg-indigo-50 p-8">
          <div className="mb-6">
            <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              Add-ons
            </span>
            <h2 className="mt-2 text-xl font-bold text-ink">Pay only for what you turn on</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Billed monthly, on top of your size plan. Enable or disable any time.
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
          Catalog plans cover up to 25 tables. Need more capacity or a negotiated rate? Talk to us —
          we can set a custom commercial deal for your restaurant.
        </p>
      </div>

      <section className="relative overflow-hidden bg-linear-to-br from-ink via-ink to-primary-dark py-20 text-center">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-dark/30 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to get started?</h2>
          <p className="mt-3 text-white/70">
            {TRIAL_DURATION_DAYS}-day free trial — no credit card required. Starts from{' '}
            {formatInr(STARTS_FROM_MONTHLY)}/mo.
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
