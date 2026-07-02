interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };

export function Spinner({ size = 'md', className = '' }: Props) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-current border-t-transparent ${sizes[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
