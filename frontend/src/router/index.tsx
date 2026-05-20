import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import { AuthLayout } from '../layouts/AuthLayout';
import { SharedLayout } from '../layouts/SharedLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { VerifyPage } from '../pages/auth/VerifyPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { AdminDashboard } from '../pages/app/AdminDashboard';
import { EmployeeDashboard } from '../pages/app/EmployeeDashboard';
import { AdminQuizzesPage } from '../pages/admin/AdminQuizzesPage';
import { NewQuizPage } from '../pages/admin/NewQuizPage';
import { QuizBuilderPage } from '../pages/admin/QuizBuilderPage';
import { EmployeeAssignmentsPage } from '../pages/employee/EmployeeAssignmentsPage';
import { AssignmentTakingPage } from '../pages/employee/AssignmentTakingPage';
import { AttemptResultsPage } from '../pages/employee/AttemptResultsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminAssignmentsPage } from '../pages/admin/AdminAssignmentsPage';
import { AdminPhishingPage } from '../pages/admin/AdminPhishingPage';
import { AdminPhishingDetailPage } from '../pages/admin/AdminPhishingDetailPage';
import { PhishingCaughtPage } from '../pages/phishing/PhishingCaughtPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'verify', element: <VerifyPage /> },
      { path: '*', element: <Navigate to="/auth/login" replace /> },
    ],
  },
  // Fix #11: public phishing awareness landing page — no auth required
  {
    path: '/phishing/caught',
    element: <PhishingCaughtPage />,
  },
  {
    element: (
      <ProtectedRoute>
        <SharedLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/admin',
        element: (
          <RoleGuard role="ADMIN">
            <AdminDashboard />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/quizzes',
        element: (
          <RoleGuard role="ADMIN">
            <AdminQuizzesPage />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/quizzes/new',
        element: (
          <RoleGuard role="ADMIN">
            <NewQuizPage />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/quizzes/:id',
        element: (
          <RoleGuard role="ADMIN">
            <QuizBuilderPage />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <RoleGuard role="ADMIN">
            <AdminUsersPage />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/assignments',
        element: (
          <RoleGuard role="ADMIN">
            <AdminAssignmentsPage />
          </RoleGuard>
        ),
      },
      // Fix #11: phishing campaign management pages
      {
        path: '/admin/phishing',
        element: (
          <RoleGuard role="ADMIN">
            <AdminPhishingPage />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/phishing/:id',
        element: (
          <RoleGuard role="ADMIN">
            <AdminPhishingDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: '/employee',
        element: (
          <RoleGuard role="EMPLOYEE">
            <EmployeeDashboard />
          </RoleGuard>
        ),
      },
      {
        path: '/employee/assignments',
        element: (
          <RoleGuard role="EMPLOYEE">
            <EmployeeAssignmentsPage />
          </RoleGuard>
        ),
      },
      {
        path: '/employee/assignments/:assignmentId/attempt',
        element: (
          <RoleGuard role="EMPLOYEE">
            <AssignmentTakingPage />
          </RoleGuard>
        ),
      },
      {
        path: '/employee/attempts/:attemptId/results',
        element: (
          <RoleGuard role="EMPLOYEE">
            <AttemptResultsPage />
          </RoleGuard>
        ),
      },
    ],
  },
]);

function RootRedirect() {
  return <AppRedirect />;
}

import { useAuth } from '../auth/AuthProvider';

function AppRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/employee" replace />;
}
