import { Outlet, Link, useLocation } from 'react-router-dom';

export function AuthLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="text-2xl font-semibold text-gray-900">
            Phishing Training
          </Link>
          <p className="text-sm text-gray-500 mt-1">
            {location.pathname.includes('register')
              ? 'Create your organization and admin account.'
              : location.pathname.includes('verify')
              ? 'Verify your email to continue.'
              : 'Sign in to your workspace.'}
          </p>
        </div>
        <div className="bg-white shadow-sm border border-gray-100 rounded-lg p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
