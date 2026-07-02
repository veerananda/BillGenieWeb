import type { Feature } from '../data/features';

export function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <div className="relative rounded-2xl border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      {feature.comingSoon && (
        <span className="absolute right-4 top-4 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
          Coming Soon
        </span>
      )}
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light">
        <Icon size={22} className="text-primary" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.description}</p>
    </div>
  );
}
