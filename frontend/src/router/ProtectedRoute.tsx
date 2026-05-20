import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}
