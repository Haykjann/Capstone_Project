import { api } from '../api';
import { AttemptResultsResponse } from './me';

export async function fetchAdminAttemptResults(token: string, attemptId: string) {
  const res = await api.get<AttemptResultsResponse>(`/admin/attempts/${attemptId}/results`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
