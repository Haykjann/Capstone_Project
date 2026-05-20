import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useMemo, useState } from 'react';

const ADMIN_LINKS = [
  { to: '/admin',             label: 'Dashboard',          icon: '📊' },
  { to: '/admin/quizzes',     label: 'Quizzes',            icon: '📝' },
  { to: '/admin/users',       label: 'Users',              icon: '👥' },
  { to: '/admin/assignments', label: 'Assignments',        icon: '📋' },
  { to: '/admin/phishing',    label: 'Phishing Campaigns', icon: '🎣' },
];

const EMPLOYEE_LINKS = [
  { to: '/employee',             label: 'Overview',    icon: '🏠' },
  { to: '/employee/assignments', label: 'Assignments', icon: '📋' },
];

export function SharedLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const links = useMemo(
    () => (user?.role === 'ADMIN' ? ADMIN_LINKS : EMPLOYEE_LINKS),
    [user],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── header ── */}
      <header className="h-14 border-b border-slate-700 bg-slate-900 px-4 flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-3">
          <button
            className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-slate-300 hover:bg-slate-800 border border-slate-700"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <span className="text-base font-semibold text-white sm:hidden">🛡️ PhishGuard</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user && (
            <div className="text-right hidden sm:block">
              <div className="font-medium text-slate-100">{user.fullName}</div>
              <div className="text-xs text-slate-400 capitalize">{user.role.toLowerCase()}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 border border-slate-700"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── sidebar ── */}
        <aside
          className={`${
            open ? 'flex' : 'hidden'
          } sm:flex flex-col w-64 bg-slate-900 shrink-0`}
        >
          {/* brand */}
          <div className="px-4 py-5 border-b border-slate-700">
            <span className="text-white font-bold text-lg tracking-tight">🛡️ PhishGuard</span>
            {user && (
              <p className="text-slate-400 text-xs mt-1 truncate">{user.fullName}</p>
            )}
          </div>

          {/* nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {links.map((link) => {
              const active =
                location.pathname === link.to ||
                (link.to !== '/admin' &&
                  link.to !== '/employee' &&
                  location.pathname.startsWith(link.to + '/'));
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* footer */}
          <div className="px-4 py-4 border-t border-slate-700">
            <button
              onClick={handleLogout}
              className="w-full text-left text-sm text-slate-400 hover:text-white transition-colors"
            >
              ↩ Sign out
            </button>
          </div>
        </aside>

        {/* ── main content ── */}
        <main className="flex-1 overflow-auto px-4 sm:px-6 py-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
