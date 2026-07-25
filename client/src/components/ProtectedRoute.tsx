import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../hooks/useAuth';

/** Gate for authenticated routes: loading → spinner, unauthenticated → /login. */
export function ProtectedRoute() {
  const { data: user, isLoading } = useMe();
  if (isLoading) {
    return <div className="screen center muted">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
