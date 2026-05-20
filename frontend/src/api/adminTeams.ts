import { api } from '../api';

export interface AdminTeam {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
}

export async function fetchAdminTeams(token: string) {
  const res = await api.get<AdminTeam[]>('/admin/teams', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
