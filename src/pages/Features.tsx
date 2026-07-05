import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { FeatureCard } from '../components/FeatureCard';
import { CATEGORY_LABELS, FEATURES, type FeatureCategory } from '../data/features';

const CATEGORY_ORDER: FeatureCategory[] = ['operations', 'kitchen', 'staff', 'insights'];

const CATEGORY_META: Record<FeatureCategory, { bg: string; pill: string; label: string }> = {
  operations: {
    bg: 'bg-white',
    pill: 'bg-primary/10 text-primary',
    label: 'Orders & Billing',
  },
  kitchen: {
    bg: 'bg-amber-50',
    pill: 'bg-amber-100 text-amber-700',
    label: 'Kitchen',
  },
  staff: {
    bg: 'bg-indigo-50',
    pill: 'bg-indigo-100 text-indigo-700',
    label: 'Staff & Setup',
  },
  insights: {
    bg: 'bg-emerald-50',
    pill: 'bg-emerald-100 text-emerald-700',
    label: 'Insights & Inventory',
  },
};

export function Features() {
  usePageTitle('Features');

  return (
    <div>
      {/* Hero */}
      <section className="bg-linear-to-b from-primary-light/60 to-surface">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <span className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/20">
            Full feature list
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Everything your restaurant runs on
          </h1>
          <p className="mt-5 text-lg text-ink-soft leading-relaxed">
            From the moment an order is placed to the moment the bill is printed, BillGenie keeps
            the front desk, kitchen, and counter in sync.
          </p>
        </div>
      </section>

      {/* Category sections — each gets its own background */}
      {CATEGORY_ORDER.map((category) => {
        const items = FEATURES.filter((f) => f.category === category);
        const meta = CATEGORY_META[category];
        return (
          <section key={category} className={`${meta.bg} py-16`}>
            <div className="mx-auto max-w-6xl px-6">
              <div className="mb-8">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${meta.pill}`}
                >
                  {CATEGORY_LABELS[category]}
                </span>
                <h2 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                  {meta.label}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((feature) => (
                  <FeatureCard key={feature.title} feature={feature} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <section className="relative overflow-hidden bg-linear-to-br from-ink via-ink to-primary-dark py-20 text-center">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-dark/30 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            See what it costs to turn these on
          </h2>
          <p className="mt-3 text-white/70">Simple modular pricing — pay only for what you use.</p>
          <Link
            to="/pricing"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-mid hover:shadow-lg active:scale-95"
          >
            View pricing <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
