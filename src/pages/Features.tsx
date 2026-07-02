import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { FeatureCard } from '../components/FeatureCard';
import { CATEGORY_LABELS, FEATURES, type FeatureCategory } from '../data/features';

const CATEGORY_ORDER: FeatureCategory[] = ['operations', 'kitchen', 'staff', 'insights'];

export function Features() {
  usePageTitle('Features');

  return (
    <div>
      <section className="bg-gradient-to-b from-primary-light/60 to-surface">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Everything your restaurant runs on
          </h1>
          <p className="mt-5 text-lg text-ink-soft">
            From the moment an order is placed to the moment the bill is printed, BillGenie keeps
            the front desk, kitchen, and counter in sync.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-16">
        {CATEGORY_ORDER.map((category) => {
          const items = FEATURES.filter((f) => f.category === category);
          return (
            <section key={category} className="mb-16 last:mb-0">
              <h2 className="text-xl font-bold text-ink">{CATEGORY_LABELS[category]}</h2>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((feature) => (
                  <FeatureCard key={feature.title} feature={feature} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="bg-ink py-16 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">See what it costs to turn these on</h2>
          <Link
            to="/pricing"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-md hover:bg-primary-dark"
          >
            View pricing <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
