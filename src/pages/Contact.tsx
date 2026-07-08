import { Mail, Globe, Clock } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

const SUPPORT_EMAIL = 'hello@thebillgenie.com';
const WEBSITE = 'https://thebillgenie.com';

export function Contact() {
  usePageTitle('Contact');

  return (
    <div className="bg-surface">
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Contact us</h1>
          <p className="mt-4 text-lg text-ink-soft">
            Questions about BillGenie, subscriptions, or your account? We&apos;re here to help.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Email</h2>
              <p className="mt-1 text-sm text-ink-soft">For support, billing, and general enquiries</p>
              <p className="mt-2 text-sm font-medium text-primary">{SUPPORT_EMAIL}</p>
            </div>
          </a>

          <div className="flex gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Website</h2>
              <p className="mt-1 text-sm text-ink-soft">Product information and account access</p>
              <a
                href={WEBSITE}
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                {WEBSITE.replace('https://', '')}
              </a>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm sm:col-span-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Response time</h2>
              <p className="mt-1 text-sm text-ink-soft leading-relaxed">
                We typically respond to email within 1–2 business days (Monday–Saturday, IST).
                For urgent payment or account access issues, include your restaurant name and
                registered email in the subject line.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-white p-6 text-sm text-ink-soft">
          <p className="font-semibold text-ink">BillGenie</p>
          <p className="mt-2">
            Restaurant billing and operations software for Indian restaurants. Subscription billing
            is processed securely via Razorpay.
          </p>
          <p className="mt-4">
            See also:{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>{' '}
            ·{' '}
            <a href="/terms" className="text-primary hover:underline">
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
