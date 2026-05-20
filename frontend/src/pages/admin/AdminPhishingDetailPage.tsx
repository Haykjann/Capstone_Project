import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import {
  CampaignDetail,
  addTargets,
  fetchCampaign,
  removeTarget,
  removeCampaignSmtp,
  scheduleCampaign,
  sendCampaign,
  unscheduleCampaign,
  updateCampaignSmtp,
} from '../../api/adminPhishing';
import { fetchAdminUsers } from '../../api/adminUsers';
import type { AdminUser } from '../../api/adminUsers';

type SendMode = 'now' | 'schedule';

export function AdminPhishingDetailPage() {
  const { id = '' } = useParams();
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Send / Schedule modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMode, setSendMode] = useState<SendMode>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  // Per-campaign Gmail settings
  const [showSmtpForm, setShowSmtpForm] = useState(false);
  const [smtpForm, setSmtpForm] = useState({ user: '', password: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);

  const load = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const [campaignData, usersData] = await Promise.all([
        fetchCampaign(accessToken, id),
        fetchAdminUsers(accessToken),
      ]);
      setCampaign(campaignData);
      setUsers(usersData);
      setError(null);
    } catch {
      setError('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [accessToken, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const targetUserIds = useMemo(() => new Set(campaign?.targets.map((t) => t.userId) ?? []), [campaign]);
  const availableUsers = useMemo(() => users.filter((u) => u.role === 'EMPLOYEE' && !targetUserIds.has(u.id)), [users, targetUserIds]);

  const handleAddTargets = async () => {
    if (!accessToken || selectedUserIds.length === 0) return;
    try {
      setAdding(true);
      const res = await addTargets(accessToken, id, selectedUserIds);
      setToast(`Added ${res.added} target(s).`);
      setSelectedUserIds([]);
      await load();
    } catch (err: any) {
      setToast(err?.response?.data?.message || 'Failed to add targets');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (targetId: string) => {
    if (!accessToken) return;
    try {
      await removeTarget(accessToken, id, targetId);
      setToast('Target removed.');
      await load();
    } catch (err: any) {
      setToast(err?.response?.data?.message || 'Failed to remove target');
    }
  };

  const handleSendOrSchedule = async () => {
    if (!accessToken) return;
    try {
      setSendLoading(true);
      if (sendMode === 'now') {
        const res = await sendCampaign(accessToken, id);
        setToast(`Sent to ${res.sent} recipient(s).`);
      } else {
        if (!scheduledAt) { setToast('Please pick a date and time.'); return; }
        await scheduleCampaign(accessToken, id, new Date(scheduledAt).toISOString());
        setToast(`Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}.`);
      }
      setShowSendModal(false);
      await load();
    } catch (err: any) {
      setToast(err?.response?.data?.message || 'Failed');
    } finally {
      setSendLoading(false);
    }
  };

  const handleUnschedule = async () => {
    if (!accessToken || !confirm('Cancel scheduled send and return to DRAFT?')) return;
    try {
      await unscheduleCampaign(accessToken, id);
      setToast('Campaign unscheduled.');
      await load();
    } catch (err: any) {
      setToast(err?.response?.data?.message || 'Failed to unschedule');
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    try {
      setSmtpSaving(true);
      await updateCampaignSmtp(accessToken, id, smtpForm.user, smtpForm.password);
      setToast('Gmail credentials saved.');
      setSmtpForm({ user: '', password: '' });
      setShowSmtpForm(false);
      await load();
    } catch (err: any) {
      setToast(err?.response?.data?.message || 'Failed to save credentials');
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleRemoveSmtp = async () => {
    if (!accessToken || !confirm('Remove Gmail credentials from this campaign?')) return;
    try {
      await removeCampaignSmtp(accessToken, id);
      setToast('Gmail credentials removed.');
      await load();
    } catch {
      setToast('Failed to remove credentials');
    }
  };

  const toggleUser = (userId: string) =>
    setSelectedUserIds((prev) => prev.includes(userId) ? prev.filter((uid) => uid !== userId) : [...prev, userId]);

  const toggleAll = () =>
    setSelectedUserIds(selectedUserIds.length === availableUsers.length ? [] : availableUsers.map((u) => u.id));

  if (loading) return <div className="text-sm text-slate-600">Loading campaign...</div>;
  if (error || !campaign) return <div className="text-sm text-red-600">{error ?? 'Campaign not found'}</div>;

  const clickCount = campaign.targets.filter((t) => t.clickedAt).length;
  const clickRate = campaign.targets.length > 0 ? Math.round((clickCount / campaign.targets.length) * 100) : 0;
  const canSend = (campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') && campaign.targets.length > 0;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md border border-slate-200 bg-white shadow-lg px-4 py-3 text-sm text-slate-800">{toast}</div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/admin/phishing')} className="text-slate-500 hover:text-slate-800 text-sm">← Campaigns</button>
        <h1 className="text-xl font-semibold text-slate-900">{campaign.name}</h1>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          campaign.status === 'SENT' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
          campaign.status === 'SCHEDULED' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
          campaign.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
          'bg-slate-100 text-slate-700 border border-slate-200'
        }`}>{campaign.status}</span>
        {campaign.status === 'SCHEDULED' && campaign.scheduledAt && (
          <span className="text-xs text-amber-700">Sends at {new Date(campaign.scheduledAt).toLocaleString()}</span>
        )}
      </div>

      {/* Gmail settings for this campaign */}
      <div className={`rounded-xl shadow p-5 space-y-3 ${campaign.smtpConfigured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {campaign.smtpConfigured ? '✓ Gmail configured' : '⚠ Gmail not configured'}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {campaign.smtpConfigured
                ? `Sending from: ${campaign.smtpUser}`
                : 'Configure a Gmail account to send phishing simulation emails for this campaign.'}
            </p>
          </div>
          <div className="flex gap-2">
            {campaign.smtpConfigured && (
              <button onClick={handleRemoveSmtp} className="text-xs text-red-600 hover:underline">
                Remove
              </button>
            )}
            <button
              onClick={() => setShowSmtpForm((s) => !s)}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {showSmtpForm ? 'Cancel' : campaign.smtpConfigured ? 'Update' : 'Set up Gmail'}
            </button>
          </div>
        </div>

        {showSmtpForm && (
          <form onSubmit={handleSaveSmtp} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-700">Gmail address</label>
              <input
                required
                type="email"
                placeholder="your-phishing-account@gmail.com"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={smtpForm.user}
                onChange={(e) => setSmtpForm((f) => ({ ...f, user: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                App Password{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  (get one here)
                </a>
              </label>
              <input
                required
                type="password"
                placeholder="16-character app password"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={smtpForm.password}
                onChange={(e) => setSmtpForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={smtpSaving}
                className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {smtpSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="sm:col-span-3 text-xs text-slate-500">
              Requires 2-Step Verification on the Gmail account. Generate an App Password at myaccount.google.com/apppasswords.
            </p>
          </form>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Targets</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{campaign.targets.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Clicked</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">{clickCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Click Rate</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{clickRate}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">{campaign.status === 'SCHEDULED' ? 'Scheduled' : 'Sent At'}</p>
          <p className="text-sm font-medium text-slate-700 mt-1">
            {campaign.status === 'SCHEDULED' && campaign.scheduledAt
              ? new Date(campaign.scheduledAt).toLocaleString()
              : campaign.sentAt
                ? new Date(campaign.sentAt).toLocaleString()
                : '—'}
          </p>
        </div>
      </div>

      {/* Email preview */}
      <div className="bg-white rounded-xl shadow p-6 space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Email Template</h2>
        <p className="text-sm"><span className="font-medium text-slate-700">From:</span> {campaign.senderName} &lt;{campaign.senderEmail}&gt;</p>
        <p className="text-sm"><span className="font-medium text-slate-700">Subject:</span> {campaign.emailSubject}</p>
        <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3 font-mono">{campaign.emailBody}</pre>
      </div>

      {/* Add targets */}
      {campaign.status === 'DRAFT' && availableUsers.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Add Targets</h2>
            <button onClick={toggleAll} className="text-xs text-indigo-600 hover:underline">
              {selectedUserIds.length === availableUsers.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
            {availableUsers.map((u) => (
              <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleUser(u.id)} className="text-indigo-600" />
                <span className="text-sm text-slate-800">{u.fullName} ({u.email})</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={handleAddTargets} disabled={adding || selectedUserIds.length === 0} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {adding ? 'Adding...' : `Add ${selectedUserIds.length > 0 ? selectedUserIds.length : ''} Selected`}
            </button>
          </div>
        </div>
      )}

      {/* Targets table */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Targets ({campaign.targets.length})</h2>
          <div className="flex gap-2">
            {campaign.status === 'SCHEDULED' && (
              <button onClick={handleUnschedule} className="px-4 py-2 rounded-md border border-amber-300 text-amber-800 text-sm font-medium hover:bg-amber-50">
                Cancel Schedule
              </button>
            )}
            {canSend && (
              <button onClick={() => setShowSendModal(true)} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                Send / Schedule
              </button>
            )}
          </div>
        </div>
        {campaign.targets.length === 0 ? (
          <p className="text-sm text-slate-600">No targets yet. Add employees above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 border-b border-slate-200">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Email Sent</th>
                  <th className="py-2 pr-4">Clicked</th>
                  {campaign.status === 'DRAFT' && <th className="py-2 pr-4"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaign.targets.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-4 text-slate-900">{t.fullName}</td>
                    <td className="py-2 pr-4 text-slate-600">{t.email}</td>
                    <td className="py-2 pr-4 text-slate-600">{t.emailSentAt ? new Date(t.emailSentAt).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-4">
                      {t.clickedAt
                        ? <span className="text-red-600 font-medium">{new Date(t.clickedAt).toLocaleString()}</span>
                        : <span className="text-green-600">Not clicked</span>}
                    </td>
                    {campaign.status === 'DRAFT' && (
                      <td className="py-2 pr-4 text-right">
                        <button onClick={() => handleRemove(t.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send / Schedule modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-5">
            <h3 className="text-lg font-semibold text-slate-900">Send Campaign</h3>

            <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm">
              <button type="button" onClick={() => setSendMode('now')} className={`flex-1 py-2 font-medium ${sendMode === 'now' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                Send Now
              </button>
              <button type="button" onClick={() => setSendMode('schedule')} className={`flex-1 py-2 font-medium ${sendMode === 'schedule' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                Schedule
              </button>
            </div>

            {sendMode === 'now' ? (
              <p className="text-sm text-slate-600">
                Emails will be sent immediately to <strong>{campaign.targets.length}</strong> employee(s) from <strong>{campaign.smtpUser ?? 'your configured Gmail'}</strong>.
              </p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Send at</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={scheduledAt}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  The system will automatically send emails to all {campaign.targets.length} target(s) at the specified time.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSendModal(false)} className="px-4 py-2 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSendOrSchedule} disabled={sendLoading} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {sendLoading ? 'Processing...' : sendMode === 'now' ? 'Send Now' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
