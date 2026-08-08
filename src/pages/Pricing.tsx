import { ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  BILLGENIE_SUPPORT_EMAIL,
  STARTS_FROM_PER_DAY,
  formatInr,
} from '../data/pricing';

const REQUEST_ACCOUNT_HREF = '/register?path=request';

export function Pricing() {
  usePageTitle('Pricing');

  return (
    <div>
      <section className="bg-linear-to-b from-primary-light/60 to-surface">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <span className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/20">
            Simple pricing
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Starting at {formatInr(STARTS_FROM_PER_DAY)}
            <span className="text-2xl font-semibold text-ink-soft sm:text-3xl">/day</span>
          </h1>
          <p className="mt-5 text-lg text-ink-soft leading-relaxed">
            Every restaurant is different — table count, channels, and add-ons change what you need.
            Request an account and we&apos;ll follow up with pricing that fits your floor. You can
            also email{' '}
            <a
              href={`mailto:${BILLGENIE_SUPPORT_EMAIL}`}
              className="font-semibold text-primary hover:underline"
            >
              {BILLGENIE_SUPPORT_EMAIL}
            </a>
            .
          </p>
          <Link
            to={REQUEST_ACCOUNT_HREF}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg active:scale-95"
          >
            Request an account <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="rounded-3xl border border-border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText size={22} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-ink">Get a quote for your restaurant</h2>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed">
            Share your restaurant details on the request form. We reserve a login ID and contact
            you with a tailored offer — no public plan catalog.
          </p>
          <Link
            to={REQUEST_ACCOUNT_HREF}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-dark hover:shadow-md active:scale-95"
          >
            Request an account <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-xs text-ink-muted">
            Prefer email?{' '}
            <a
              href={`mailto:${BILLGENIE_SUPPORT_EMAIL}?subject=${encodeURIComponent('BillGenie pricing enquiry')}`}
              className="font-semibold text-primary hover:underline"
            >
              {BILLGENIE_SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>

      <section className="relative overflow-hidden bg-linear-to-br from-ink via-ink to-primary-dark py-20 text-center">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-dark/30 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to get started?</h2>
          <p className="mt-3 text-white/70">
            Starting at {formatInr(STARTS_FROM_PER_DAY)}/day. Request an account and we&apos;ll
            get back to you on pricing.
          </p>
          <Link
            to={REQUEST_ACCOUNT_HREF}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-mid hover:shadow-lg active:scale-95"
          >
            Request an account <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
