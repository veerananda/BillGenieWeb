import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

type Props = {
  title: string;
  children: React.ReactNode;
};

export function LegalPage({ title, children }: Props) {
  usePageTitle(title);

  return (
    <div className="bg-surface">
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-ink-muted">
            Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl space-y-6 px-6 py-12 text-ink-soft [&_a]:font-medium [&_a]:text-primary [&_a]:hover:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:space-y-2">
        {children}
      </article>

      <div className="mx-auto max-w-3xl px-6 pb-16 text-sm text-ink-muted">
        <p>
          Questions?{' '}
          <Link to="/contact" className="font-medium text-primary hover:underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
