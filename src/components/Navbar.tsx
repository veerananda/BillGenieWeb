import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${
    isActive ? 'text-primary' : 'text-ink-soft hover:text-ink'
  }`;

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <img src="/favicon.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-semibold text-ink">BillGenie</span>
        </NavLink>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="text-sm font-medium text-ink-soft hover:text-ink transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            Start free trial
          </Link>
        </div>

        <button
          type="button"
          className="text-ink md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
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
            <Link
              to="/login"
              className="text-sm font-medium text-ink-soft hover:text-ink transition-colors"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="mt-2 rounded-full bg-primary px-5 py-2.5 text-center text-sm font-semibold text-white"
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
