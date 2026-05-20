import { api } from '../api';

export interface AdminUser {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'EMPLOYEE';
  status: string;
  createdAt: string;
}

export async function fetchAdminUsers(token: string) {
  const res = await api.get<AdminUser[]>('/admin/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateUserStatus(
  token: string,
  userId: string,
  status: 'ACTIVE' | 'DEACTIVATED',
) {
  const res = await api.patch<AdminUser>(`/admin/users/${userId}/status`, { status }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createAdminUser(
  token: string,
  payload: { fullName: string; email: string; password: string; role?: 'ADMIN' | 'EMPLOYEE' },
) {
  const res = await api.post<AdminUser>('/admin/users', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
