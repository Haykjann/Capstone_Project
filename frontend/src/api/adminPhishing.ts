import { api } from '../api';

export interface CampaignListItem {
  id: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'ARCHIVED';
  senderName: string;
  senderEmail: string;
  emailSubject: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  targetCount: number;
  clickCount: number;
}

export interface CampaignTarget {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  emailSentAt: string | null;
  clickedAt: string | null;
}

export interface CampaignDetail extends Omit<CampaignListItem, 'targetCount' | 'clickCount'> {
  emailBody: string;
  smtpUser: string | null;
  smtpConfigured: boolean;
  targets: CampaignTarget[];
}

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  emailSubject: string;
  emailBody: string;
  senderName: string;
}

export async function fetchCampaigns(token: string) {
  const res = await api.get<CampaignListItem[]>('/admin/phishing', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function fetchCampaign(token: string, id: string) {
  const res = await api.get<CampaignDetail>(`/admin/phishing/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createCampaign(token: string, payload: CreateCampaignPayload) {
  const res = await api.post<CampaignDetail>('/admin/phishing', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function addTargets(token: string, campaignId: string, userIds: string[]) {
  const res = await api.post<{ added: number }>(
    `/admin/phishing/${campaignId}/targets`,
    { userIds },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function removeTarget(token: string, campaignId: string, targetId: string) {
  await api.delete(`/admin/phishing/${campaignId}/targets/${targetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendCampaign(token: string, campaignId: string) {
  const res = await api.post<{ sent: number }>(
    `/admin/phishing/${campaignId}/send`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function scheduleCampaign(token: string, campaignId: string, scheduledAt: string) {
  const res = await api.post<{ scheduledAt: string }>(
    `/admin/phishing/${campaignId}/schedule`,
    { scheduledAt },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function unscheduleCampaign(token: string, campaignId: string) {
  const res = await api.post<{ message: string }>(
    `/admin/phishing/${campaignId}/unschedule`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function updateCampaignSmtp(token: string, campaignId: string, smtpUser: string, smtpPassword: string) {
  const res = await api.patch<{ message: string; smtpUser: string }>(
    `/admin/phishing/${campaignId}/smtp`,
    { smtpUser, smtpPassword },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function removeCampaignSmtp(token: string, campaignId: string) {
  const res = await api.delete<{ message: string }>(
    `/admin/phishing/${campaignId}/smtp`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function deleteCampaign(token: string, campaignId: string) {
  await api.delete(`/admin/phishing/${campaignId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
