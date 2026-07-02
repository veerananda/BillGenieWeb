import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { FeatureCard } from '../components/FeatureCard';
import { HOME_HIGHLIGHTS } from '../data/features';
import { BASIC_FEATURES, BASIC_MONTHLY_PRICE, formatInr } from '../data/pricing';

export function Home() {
  usePageTitle('Restaurant Billing & Operations, Simplified');

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-light/60 to-surface">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <span className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary-light">
            Built for Indian restaurants
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl md:text-6xl">
            Run your restaurant's billing and floor from one app
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-soft">
            BillGenie brings dine-in billing, counter orders, QR self-service, a live kitchen
            display, and staff management together — synced in real time across every device.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              id="get-started"
              href="#get-started"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
            >
              Start your 30-day free trial
              <ArrowRight size={18} />
            </a>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-7 py-3.5 text-base font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
            >
              Explore features
            </Link>
          </div>
        </div>
      </section>

      {/* Problem/solution framing */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">
          One app instead of five disconnected tools
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-ink-soft">
          No more juggling a separate billing register, a paper KOT pad, and a notebook for
          stock. BillGenie keeps your front desk, kitchen, and counter on the same page —
          literally, in real time.
        </p>
      </section>

      {/* Feature highlights */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">Everything you need, built in</h2>
            <Link
              to="/features"
              className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:flex"
            >
              See all features <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HOME_HIGHLIGHTS.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link to="/features" className="text-sm font-semibold text-primary hover:underline">
              See all features →
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm md:flex">
          <div className="p-10 md:w-1/2">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Simple pricing
            </span>
            <h2 className="mt-3 text-3xl font-bold text-ink">
              {formatInr(BASIC_MONTHLY_PRICE)}
              <span className="text-base font-medium text-ink-soft">/month</span>
            </h2>
            <p className="mt-2 text-ink-soft">Everything you need to get started, with a 30-day free trial.</p>
            <ul className="mt-6 space-y-3">
              {BASIC_FEATURES.slice(0, 4).map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/pricing"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              See full pricing & add-ons <ArrowRight size={16} />
            </Link>
          </div>
          <div className="bg-primary-light/50 p-10 md:w-1/2">
            <h3 className="text-sm font-semibold text-ink">Add what your restaurant needs</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Kitchen displays, extended history, inventory, and aggregator sync are all optional
              add-ons — pay only for what you turn on.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-ink py-16 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to simplify your billing?
          </h2>
          <p className="mt-3 text-white/70">
            Start a 30-day free trial — no credit card required.
          </p>
          <a
            href="#get-started"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-md hover:bg-primary-dark"
          >
            Start free trial <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </div>
  );
}
