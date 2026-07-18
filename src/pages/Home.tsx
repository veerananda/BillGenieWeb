import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Zap, ShieldCheck, Clock } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { FeatureCard } from '../components/FeatureCard';
import { HOME_HIGHLIGHTS } from '../data/features';
import { BASIC_FEATURES, BASIC_MONTHLY_PRICE, TRIAL_DURATION_DAYS, formatInr } from '../data/pricing';

const TRUST_ITEMS = [
  { icon: Zap, label: 'Set up in under 10 minutes' },
  { icon: ShieldCheck, label: 'No credit card required' },
  { icon: Clock, label: `${TRIAL_DURATION_DAYS}-day free trial` },
];

export function Home() {
  usePageTitle('Restaurant Billing & Operations, Simplified');

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-linear-to-b from-primary-light/70 via-primary-light/30 to-surface">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-primary-light/60 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Built for Indian restaurants
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl md:text-6xl leading-tight">
            Run your restaurant's billing and floor from one app
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-soft leading-relaxed">
            BillGenie brings dine-in billing, counter orders, QR self-service, a live kitchen
            display, and team management together — synced in real time across every device.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg active:scale-95"
            >
              Start your {TRIAL_DURATION_DAYS}-day free trial
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-7 py-3.5 text-base font-semibold text-ink transition-all hover:border-primary/40 hover:text-primary hover:shadow-sm"
            >
              Explore features
            </Link>
          </div>

          {/* Trust bar */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-ink-soft">
                <Icon size={15} className="text-primary" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem / solution ───────────────────────────────────────────────── */}
      <section className="bg-amber-50 py-16">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-600">
            The problem we solve
          </span>
          <h2 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
            One app instead of five disconnected tools
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-soft">
            No more juggling a separate billing register, a paper KOT pad, and a notebook for
            stock. BillGenie keeps your front desk, kitchen, and counter on the same page —
            literally, in real time.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Front desk', desc: 'Dine-in tables, counter tickets, and cash/UPI billing in one view.' },
              { label: 'Kitchen', desc: 'Live KOT board — every chef sees orders the second they are placed.' },
              { label: 'Management', desc: 'Sales, inventory, and staff all within reach, any time.' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-amber-100 bg-white p-6 text-left shadow-sm">
                <h3 className="text-base font-semibold text-ink">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature highlights ───────────────────────────────────────────────── */}
      <section className="bg-surface-alt py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Features</span>
              <h2 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Everything you need, built in</h2>
            </div>
            <Link
              to="/features"
              className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:flex"
            >
              See all features <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ── Pricing teaser ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm md:flex">
          <div className="p-10 md:w-1/2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Simple pricing
            </span>
            <h2 className="mt-3 text-3xl font-bold text-ink">
              {formatInr(BASIC_MONTHLY_PRICE)}
              <span className="text-base font-medium text-ink-soft">/month</span>
            </h2>
            <p className="mt-2 text-ink-soft">Everything you need to get started, with a {TRIAL_DURATION_DAYS}-day free trial.</p>
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
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
            >
              See full pricing & add-ons <ArrowRight size={16} />
            </Link>
          </div>
          <div className="bg-linear-to-br from-primary-light/60 to-primary/10 p-10 md:w-1/2">
            <h3 className="text-sm font-semibold text-ink">Add what your restaurant needs</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Kitchen displays, extended history, inventory, and more are all optional
              add-ons — pay only for what you turn on.
            </p>
            <Link
              to="/register"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              Start free trial <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-linear-to-br from-ink via-ink to-primary-dark py-20 text-center">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-dark/30 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to simplify your billing?
          </h2>
          <p className="mt-3 text-white/70">
            Start a {TRIAL_DURATION_DAYS}-day free trial — no credit card required.
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
