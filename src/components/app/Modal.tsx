import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  zIndexClass?: string;
}

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '3xl': 'max-w-3xl' };

export function Modal({ open, onClose, title, children, maxWidth = 'md', zIndexClass = 'z-50' }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 ${zIndexClass} flex items-end justify-center bg-black/50 sm:items-center sm:p-4`}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/*
        Panel:
        - Mobile: full-width sheet rising from bottom, rounded top corners, max 92vh tall
        - sm+: centred dialog, rounded all corners, max 90vh tall
        The header is shrink-0 (never scrolls away).
        The body is flex-1 + min-h-0 + overflow-y-auto so it scrolls independently.
      */}
      <div
        className={`
          flex w-full flex-col bg-white shadow-xl overflow-hidden
          rounded-t-2xl sm:rounded-2xl
          max-h-[92vh] sm:max-h-[90vh]
          ${widths[maxWidth]}
        `}
      >
        {/* Sticky header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          {title ? (
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
