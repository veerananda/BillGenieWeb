interface Props {
  variant: 'pending' | 'cooking' | 'ready' | 'served' | 'completed' | 'cancelled' | 'occupied' | 'vacant' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}

const styles: Record<Props['variant'], string> = {
  pending: 'bg-gray-100 text-gray-700',
  cooking: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
  served: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  occupied: 'bg-amber-100 text-amber-700',
  vacant: 'bg-green-100 text-green-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export function Badge({ variant, children, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
