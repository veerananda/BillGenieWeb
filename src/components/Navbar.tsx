import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-all rounded-lg px-3 py-1.5 ${
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-ink-soft hover:bg-surface-alt hover:text-ink'
  }`;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur transition-shadow ${
        scrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <NavLink to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <img src="/favicon.png" alt="" className="h-8 w-8 rounded-xl" />
          <span className="text-lg font-bold text-ink tracking-tight">BillGenie</span>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md active:scale-95"
          >
            Start free trial
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={linkClass}
                end={link.to === '/'}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="my-2 border-t border-border" />
            <Link
              to="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="mt-1 rounded-full bg-primary px-5 py-2.5 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Start free trial
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
