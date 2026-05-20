import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Role } from '../auth/types';

interface RoleGuardProps {
  role: Role;
  children: ReactNode;
}

export function RoleGuard({ role, children }: RoleGuardProps) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;

  if (user.role !== role) {
    const redirectPath = user.role === 'ADMIN' ? '/admin' : '/employee';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
