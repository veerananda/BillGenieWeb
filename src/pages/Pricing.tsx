import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  ADDON_OPTIONS,
  BASIC_FEATURES,
  BASIC_MONTHLY_PRICE,
  annualMonthlyEquivalent,
  annualSavings,
  formatInr,
} from '../data/pricing';

type Cycle = 'monthly' | 'annual';

export function Pricing() {
  usePageTitle('Pricing');
  const [cycle, setCycle] = useState<Cycle>('monthly');

  const displayPrice =
    cycle === 'monthly' ? BASIC_MONTHLY_PRICE : annualMonthlyEquivalent(BASIC_MONTHLY_PRICE);

  return (
    <div>
      <section className="bg-linear-to-b from-primary-light/60 to-surface">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Simple, modular pricing
          </h1>
          <p className="mt-5 text-lg text-ink-soft">
            Start with the basics, then add only what your restaurant needs. Every plan starts
            with a 30-day free trial.
          </p>

          <div className="mt-8 inline-flex items-center rounded-full border border-border bg-white p-1">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                cycle === 'monthly' ? 'bg-primary text-white' : 'text-ink-soft'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle('annual')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                cycle === 'annual' ? 'bg-primary text-white' : 'text-ink-soft'
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
        {/* Basic plan */}
        <div className="overflow-hidden rounded-3xl border-2 border-primary bg-white shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="border-b border-border p-8 md:col-span-1 md:border-b-0 md:border-r">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                Basic plan
              </span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-ink">{formatInr(displayPrice)}</span>
                <span className="text-sm font-medium text-ink-soft">/month</span>
              </div>
              {cycle === 'annual' && (
                <p className="mt-1 text-xs text-ink-muted">billed annually</p>
              )}
              <p className="mt-4 text-sm text-ink-soft">
                Everything a single-location restaurant needs to get started.
              </p>
              <div className="mt-6 inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">
                30-day free trial
              </div>
              <Link
                to="/register"
                className="mt-6 block rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Start free trial
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
        <div className="mt-16">
          <h2 className="text-xl font-bold text-ink">Add-ons</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Turn on exactly what your restaurant needs — billed monthly, on top of the Basic plan.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ADDON_OPTIONS.map((addon) => (
              <div
                key={addon.key}
                className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-white p-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{addon.title}</h3>
                    {addon.comingSoon && (
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary-dark">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{addon.description}</p>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold text-ink">
                  +{formatInr(addon.price)}
                  <div className="text-xs font-normal text-ink-muted">/mo</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-ink-muted">
          Extra staff and managers, and additional table capacity, are also available beyond what's
          bundled with the Basic plan — talk to us to size a plan for your restaurant.
        </p>
      </div>
    </div>
  );
}
