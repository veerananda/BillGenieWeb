import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="" className="h-7 w-7 rounded-lg" />
              <span className="text-base font-semibold text-ink">BillGenie</span>
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              Restaurant billing and operations, simplified — built for Indian restaurants.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Product</h3>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                <li>
                  <Link to="/features" className="hover:text-primary">
                    Features
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="hover:text-primary">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-primary">
                    Start free trial
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-primary">
                    Log in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Contact</h3>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                <li>
                  <a href="mailto:hello@thebillgenie.com" className="hover:text-primary">
                    hello@thebillgenie.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-ink-muted">
          © {new Date().getFullYear()} BillGenie. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
