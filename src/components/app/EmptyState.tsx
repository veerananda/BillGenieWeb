import type { LucideIcon } from 'lucide-react';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-gray-900">{title}</h3>
      {description && <p className="mb-4 text-sm text-gray-500">{description}</p>}
      {action}
    </div>
  );
}
