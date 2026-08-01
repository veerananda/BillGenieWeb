import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole, selectIsAuthenticated } from '../../store/authSlice';

interface Props {
  children: React.ReactNode;
  /** Roles allowed to access this route. Empty/undefined = any authenticated user. */
  roles?: string[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectAuthRole);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles && roles.length > 0) {
    const allowed = role ? roles.includes(role) : false;
    if (!allowed) return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
