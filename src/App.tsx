import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Features } from './pages/Features';
import { Pricing } from './pages/Pricing';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ResetPassword } from './pages/auth/ResetPassword';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ForgotLogin } from './pages/auth/ForgotLogin';
import { VerifyEmail } from './pages/auth/VerifyEmail';
import { EmailVerificationPending } from './pages/auth/EmailVerificationPending';
import { ProtectedRoute } from './components/app/ProtectedRoute';
import { AppShell } from './components/app/AppShell';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { Contact } from './pages/Contact';
import { Spinner } from './components/app/Spinner';

const Dashboard = lazy(() => import('./pages/app/Dashboard').then((m) => ({ default: m.Dashboard })));
const Menu = lazy(() => import('./pages/app/Menu').then((m) => ({ default: m.Menu })));
const Orders = lazy(() => import('./pages/app/Orders').then((m) => ({ default: m.Orders })));
const Counter = lazy(() => import('./pages/app/Counter').then((m) => ({ default: m.Counter })));
const Kitchen = lazy(() => import('./pages/app/Kitchen').then((m) => ({ default: m.Kitchen })));
const Sales = lazy(() => import('./pages/app/Sales').then((m) => ({ default: m.Sales })));
const History = lazy(() => import('./pages/app/History').then((m) => ({ default: m.History })));
const Staff = lazy(() => import('./pages/app/Staff').then((m) => ({ default: m.Staff })));
const Profile = lazy(() => import('./pages/app/Profile').then((m) => ({ default: m.Profile })));
const Inventory = lazy(() => import('./pages/app/Inventory').then((m) => ({ default: m.Inventory })));
const Support = lazy(() => import('./pages/app/Support').then((m) => ({ default: m.Support })));

function AppRouteFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Spinner />
    </div>
  );
}

function LazyAppPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AppRouteFallback />}>{children}</Suspense>;
}

function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Marketing pages */}
      <Route path="/" element={<MarketingLayout><Home /></MarketingLayout>} />
      <Route path="/features" element={<MarketingLayout><Features /></MarketingLayout>} />
      <Route path="/pricing" element={<MarketingLayout><Pricing /></MarketingLayout>} />
      <Route path="/privacy" element={<MarketingLayout><PrivacyPolicy /></MarketingLayout>} />
      <Route path="/terms" element={<MarketingLayout><TermsOfService /></MarketingLayout>} />
      <Route path="/contact" element={<MarketingLayout><Contact /></MarketingLayout>} />

      {/* Auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/forgot-login" element={<ForgotLogin />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify-email-pending" element={<EmailVerificationPending />} />

      {/* Protected app */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<LazyAppPage><Dashboard /></LazyAppPage>} />
        <Route path="menu" element={<LazyAppPage><Menu /></LazyAppPage>} />
        <Route path="orders" element={<LazyAppPage><Orders /></LazyAppPage>} />
        <Route path="counter" element={<LazyAppPage><Counter /></LazyAppPage>} />
        <Route path="kitchen" element={<LazyAppPage><Kitchen /></LazyAppPage>} />
        <Route path="sales" element={<LazyAppPage><Sales /></LazyAppPage>} />
        <Route path="history" element={<LazyAppPage><History /></LazyAppPage>} />
        <Route path="staff" element={<LazyAppPage><Staff /></LazyAppPage>} />
        <Route path="profile" element={<LazyAppPage><Profile /></LazyAppPage>} />
        <Route path="inventory" element={<LazyAppPage><Inventory /></LazyAppPage>} />
        <Route path="support" element={<LazyAppPage><Support /></LazyAppPage>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
