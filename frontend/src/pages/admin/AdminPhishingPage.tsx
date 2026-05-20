import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import {
  CampaignListItem,
  CreateCampaignPayload,
  createCampaign,
  deleteCampaign,
  fetchCampaigns,
  sendCampaign,
} from '../../api/adminPhishing';

const STATUS_STYLES: Record<CampaignListItem['status'], string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border border-slate-200',
  SCHEDULED: 'bg-amber-50 text-amber-800 border border-amber-200',
  SENT: 'bg-blue-50 text-blue-800 border border-blue-200',
  ARCHIVED: 'bg-gray-100 text-gray-600 border border-gray-200',
};

const defaultForm: CreateCampaignPayload = {
  name: '',
  description: '',
  emailSubject: '',
  emailBody: '',
  senderName: '',
};

export function AdminPhishingPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateCampaignPayload>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const campaignsData = await fetchCampaigns(accessToken);
      setCampaigns(campaignsData);
      setError(null);
    } catch {
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    try {
      setSubmitting(true);
      await createCampaign(accessToken, form);
      setForm(defaultForm);
      setShowForm(false);
      await load();
      setToast('Campaign created.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async (id: string) => {
    if (!accessToken || !confirm('Send phishing emails to all targets now?')) return;
    try {
      setSending(id);
      const res = await sendCampaign(accessToken, id);
      setToast(`Sent to ${res.sent} recipient(s).`);
      await load();
    } catch (err: any) {
      setToast(err?.response?.data?.message || 'Send failed');
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm('Delete this campaign?')) return;
    try {
      await deleteCampaign(accessToken, id);
      setToast('Campaign deleted.');
      await load();
    } catch (err: any) {
      setToast(err?.response?.data?.message || 'Delete failed');
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
          <h1 className="text-xl font-semibold text-slate-900">Phishing Campaigns</h1>
          {(() => {
            const base = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
            return (
              <p className="text-xs mt-0.5">
                <span className="text-slate-500">Tracking links use: </span>
                <code className="bg-slate-100 px-1 rounded text-slate-700">{base}/api/c/…</code>
                {isLocal && (
                  <span className="text-amber-600 ml-1">— set VITE_BACKEND_URL to your ngrok URL so links work from other devices</span>
                )}
              </p>
            );
          })()}
          <p className="text-sm text-slate-600">
            Simulate phishing attacks. Use <code className="bg-slate-100 px-1 rounded">{'{{trackUrl}}'}</code> in the email body as the clickable link.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
        >
          {showForm ? 'Cancel' : 'New Campaign'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Create Campaign</h2>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Campaign Name</label>
                <input required className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description (optional)</label>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Sender Name <span className="text-slate-400 font-normal">(display name shown to recipient, e.g. "IT Support")</span>
                </label>
                <input required placeholder="IT Support" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={form.senderName} onChange={(e) => setForm((f) => ({ ...f, senderName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email Subject</label>
                <input required placeholder="Urgent: Verify your account immediately" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={form.emailSubject} onChange={(e) => setForm((f) => ({ ...f, emailSubject: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Email Body <span className="text-slate-500 font-normal">(use <code className="bg-slate-100 px-1 rounded">{'{{trackUrl}}'}</code> for the phishing link)</span>
                </label>
                <textarea required rows={6} placeholder={`Dear Employee,\n\nWe detected suspicious activity. Verify your account now:\n\n{{trackUrl}}\n\nIT Security Team`} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono" value={form.emailBody} onChange={(e) => setForm((f) => ({ ...f, emailBody: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50">{submitting ? 'Creating...' : 'Create Campaign'}</button>
            </div>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-600">Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-6 text-sm text-slate-600">No campaigns yet. Create one to get started.</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sender Name</th>
                <th className="py-3 px-4">Targets</th>
                <th className="py-3 px-4">Clicks</th>
                <th className="py-3 px-4">Scheduled / Sent</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">
                    <button onClick={() => navigate(`/admin/phishing/${c.id}`)} className="text-violet-600 hover:underline text-left">{c.name}</button>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{c.senderName}</td>
                  <td className="py-3 px-4 text-slate-700">{c.targetCount}</td>
                  <td className="py-3 px-4">
                    <span className={`font-semibold ${c.clickCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>{c.clickCount}</span>
                    {c.targetCount > 0 && <span className="text-slate-500 ml-1">({Math.round((c.clickCount / c.targetCount) * 100)}%)</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">
                    {c.status === 'SCHEDULED' && c.scheduledAt
                      ? `Scheduled: ${new Date(c.scheduledAt).toLocaleString()}`
                      : c.sentAt
                        ? new Date(c.sentAt).toLocaleString()
                        : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => navigate(`/admin/phishing/${c.id}`)} className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100">Manage</button>
                      {c.status === 'DRAFT' && (
                        <button onClick={() => handleSend(c.id)} disabled={sending === c.id || c.targetCount === 0} className="px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50">
                          {sending === c.id ? 'Sending...' : 'Send Now'}
                        </button>
                      )}
                      <button onClick={() => handleDelete(c.id)} className="px-3 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
