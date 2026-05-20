import { api } from '../api';

export interface AdminAssignment {
  id: string;
  quizTitle: string;
  userEmail: string;
  dueAt: string | null;
  createdAt: string;
  assignmentStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'OVERDUE';
  latestAttemptId: string | null;
  latestAttemptScorePercent: number | null;
  latestAttemptIsPassed: boolean | null;
  latestAttemptSubmittedAt: string | null;
}

export async function fetchAdminAssignments(token: string) {
  const res = await api.get<AdminAssignment[]>('/admin/assignments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createAdminAssignment(
  token: string,
  payload: { quizId: string; userId: string; dueAt?: string },
) {
  const res = await api.post<AdminAssignment>('/admin/assignments', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createBulkAssignment(
  token: string,
  payload: { quizId: string; userIds: string[]; dueAt?: string },
) {
  const res = await api.post<{ created: number }>(
    '/admin/assignments/bulk',
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}
