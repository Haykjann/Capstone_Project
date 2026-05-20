import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { AdminUser, createAdminUser, fetchAdminUsers, updateUserStatus } from '../../api/adminUsers';

const badgeClasses: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-800 border border-green-200',
  PENDING_VERIFICATION: 'bg-amber-50 text-amber-800 border border-amber-200',
  DEACTIVATED: 'bg-slate-100 text-slate-700 border border-slate-200',
};

export function AdminUsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'EMPLOYEE' as 'EMPLOYEE' | 'ADMIN' });
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadUsers = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const data = await fetchAdminUsers(accessToken);
      setUsers(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    try {
      setSubmitting(true);
      await createAdminUser(accessToken, form);
      await loadUsers();
      setForm({ fullName: '', email: '', password: '', role: 'EMPLOYEE' });
      showToast('User created successfully.');
    } catch (err) {
      console.error(err);
      setError('Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (u: AdminUser) => {
    if (!accessToken) return;
    const newStatus = u.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    try {
      setTogglingId(u.id);
      const updated = await updateUserStatus(accessToken, u.id, newStatus);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: updated.status } : x)));
      showToast(`${u.fullName} ${newStatus === 'DEACTIVATED' ? 'deactivated' : 'reactivated'}.`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md border border-slate-200 bg-white shadow-lg px-4 py-3 text-sm text-slate-800">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-600">Manage employees and admins in your organization.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Create User</h2>
        <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Full name</label>
            <input
              required
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              required
              type="email"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              required
              type="password"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Role</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'ADMIN' | 'EMPLOYEE' }))}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">All Users</h2>
        </div>
        {loading ? (
          <p className="text-sm text-slate-600">Loading users...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="text-slate-800 hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-medium">{u.fullName}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{u.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className="capitalize text-slate-600">{u.role.toLowerCase()}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeClasses[u.status] ?? 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        {u.status === 'PENDING_VERIFICATION' ? 'Pending' : u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5">
                      {u.id !== currentUser?.id && u.status !== 'PENDING_VERIFICATION' && (
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={togglingId === u.id}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border disabled:opacity-50 ${
                            u.status === 'ACTIVE'
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {togglingId === u.id ? '...' : u.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
