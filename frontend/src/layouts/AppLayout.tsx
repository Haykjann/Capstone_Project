import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 p-4 hidden sm:block">
        <div className="text-lg font-semibold text-gray-900 mb-6">Phishing Training</div>
        <nav className="space-y-2 text-sm">
          <Link className="block text-gray-700 hover:text-indigo-600" to="/admin">
            Admin
          </Link>
          <Link className="block text-gray-700 hover:text-indigo-600" to="/admin/quizzes">
            Quizzes
          </Link>
          <Link className="block text-gray-700 hover:text-indigo-600" to="/employee">
            Employee
          </Link>
          <Link className="block text-gray-700 hover:text-indigo-600" to="/employee/assignments">
            Assignments
          </Link>
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {user ? `${user.fullName} (${user.role})` : 'Guest'}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-indigo-600 font-medium"
          >
            Logout
          </button>
        </header>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
