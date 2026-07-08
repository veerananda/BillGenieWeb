import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Features } from './pages/Features';
import { Pricing } from './pages/Pricing';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ResetPassword } from './pages/auth/ResetPassword';
import { VerifyEmail } from './pages/auth/VerifyEmail';
import { EmailVerificationPending } from './pages/auth/EmailVerificationPending';
import { ProtectedRoute } from './components/app/ProtectedRoute';
import { AppShell } from './components/app/AppShell';
import { Dashboard } from './pages/app/Dashboard';
import { Menu } from './pages/app/Menu';
import { Orders } from './pages/app/Orders';
import { Counter } from './pages/app/Counter';
import { Kitchen } from './pages/app/Kitchen';
import { Sales } from './pages/app/Sales';
import { History } from './pages/app/History';
import { Staff } from './pages/app/Staff';
import { Profile } from './pages/app/Profile';
import { Inventory } from './pages/app/Inventory';

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

      {/* Auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="menu" element={<Menu />} />
        <Route path="orders" element={<Orders />} />
        <Route path="counter" element={<Counter />} />
        <Route path="kitchen" element={<Kitchen />} />
        <Route path="sales" element={<Sales />} />
        <Route path="history" element={<History />} />
        <Route path="staff" element={<Staff />} />
        <Route path="profile" element={<Profile />} />
        <Route path="inventory" element={<Inventory />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
