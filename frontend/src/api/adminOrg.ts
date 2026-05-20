import { api } from '../api';

export interface OrgSmtpStatus {
  smtpUser: string | null;
  configured: boolean;
}

export async function fetchOrgSmtp(token: string) {
  const res = await api.get<OrgSmtpStatus>('/admin/org/smtp', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function saveOrgSmtp(token: string, smtpUser: string, smtpPassword: string) {
  const res = await api.patch<{ message: string }>(
    '/admin/org/smtp',
    { smtpUser, smtpPassword },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function deleteOrgSmtp(token: string) {
  const res = await api.delete<{ message: string }>('/admin/org/smtp', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
