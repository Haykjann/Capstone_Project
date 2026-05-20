import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../auth/AuthProvider';
import {
  AdminAnalyticsOverview,
  AnalyticsRange,
  EmployeePerformanceItem,
  QuizAnalyticsResponse,
  fetchAnalyticsOverview,
  fetchEmployeePerformance,
  fetchQuizAnalytics,
} from '../../api/adminAnalytics';
import { QuizListItem, fetchPublishedQuizzes } from '../../api/adminQuizzes';
import { CampaignListItem, fetchCampaigns } from '../../api/adminPhishing';
import { createAdminAssignment } from '../../api/adminAssignments';
import { toDateOnly, formatDate, startOfMonth, startOfQuarter } from '../../utils/dateUtils';

// ─── constants ───────────────────────────────────────────────────────────────

const DIST_COLORS: Record<string, string> = {
  '0-49': '#ef4444',
  '50-69': '#f59e0b',
  '70-84': '#3b82f6',
  '85-100': '#10b981',
};

const CAMPAIGN_STATUS: Record<CampaignListItem['status'], { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-600' },
  SCHEDULED: { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  SENT: { label: 'Sent', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  ARCHIVED: { label: 'Archived', cls: 'bg-gray-100 text-gray-500' },
};

const distributionOrder = ['0-49', '50-69', '70-84', '85-100'] as const;

type Preset = 'mtd' | 'last7' | 'last30' | 'quarter';
type RiskFilter = 'all' | 'attention' | 'high';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getPresetRange(preset: Preset): AnalyticsRange {
  const now = new Date();
  switch (preset) {
    case 'mtd':
      return { from: toDateOnly(startOfMonth(now)), to: toDateOnly(now) };
    case 'last7':
      return {
        from: toDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)),
        to: toDateOnly(now),
      };
    case 'last30':
      return {
        from: toDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)),
        to: toDateOnly(now),
      };
    case 'quarter':
      return { from: toDateOnly(startOfQuarter(now)), to: toDateOnly(now) };
    default:
      return { from: toDateOnly(startOfMonth(now)), to: toDateOnly(now) };
  }
}

function formatPercent(v: number | null) {
  if (v === null || Number.isNaN(v)) return '—';
  return `${Math.round(v)}%`;
}

function riskLevel(emp: EmployeePerformanceItem): 'high' | 'medium' | 'low' | 'none' {
  if (emp.phishingEmailsSent === 0 && emp.totalAssignments === 0) return 'none';
  const clicked = emp.phishingClicks > 0;
  const score = emp.avgScorePercent;
  if (clicked && (score === null || score < 70)) return 'high';
  if (clicked || (score !== null && score < 50)) return 'high';
  if (score !== null && score < 70) return 'medium';
  return 'low';
}

function scoreColor(score: number | null) {
  if (score === null) return 'bg-slate-200';
  if (score < 50) return 'bg-red-500';
  if (score < 70) return 'bg-amber-400';
  if (score < 85) return 'bg-blue-500';
  return 'bg-emerald-500';
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return <div className="h-28 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex gap-4 items-start">
      <div className={`text-2xl w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: ReturnType<typeof riskLevel> }) {
  const map = {
    high: { label: 'High Risk', cls: 'bg-red-50 text-red-700 border border-red-200' },
    medium: { label: 'At Risk', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    low: { label: 'Passing', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    none: { label: 'No Data', cls: 'bg-slate-100 text-slate-500' },
  };
  const { label, cls } = map[level];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  const pct = score ?? 0;
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 w-9 text-right">{formatPercent(score)}</span>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-100 bg-white shadow-xl px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-indigo-600">Avg score: {formatPercent(payload[0]?.value)}</p>
      {payload[1] && <p className="text-slate-500">Attempts: {payload[1].value}</p>}
    </div>
  );
}

function DistTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-100 bg-white shadow-xl px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700">Score {label}</p>
      <p className="text-slate-600 mt-0.5">{payload[0]?.value} employee{payload[0]?.value !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [quizAnalytics, setQuizAnalytics] = useState<QuizAnalyticsResponse | null>(null);
  const [employees, setEmployees] = useState<EmployeePerformanceItem[] | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);

  const [range, setRange] = useState<AnalyticsRange>(getPresetRange('mtd'));
  const [draftRange, setDraftRange] = useState<AnalyticsRange>(getPresetRange('mtd'));
  const [pickerOpen, setPickerOpen] = useState(false);

  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [assignPanel, setAssignPanel] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ quizId: '', dueAt: '' });
  const [assignLoading, setAssignLoading] = useState(false);

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [quizLoading, setQuizLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok?: boolean } | null>(null);

  const showToast = (msg: string, ok = false) => setToast({ msg, ok });

  useEffect(() => {
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // initial loads (not date-range-dependent)
  useEffect(() => {
    if (!accessToken) return;
    fetchPublishedQuizzes(accessToken)
      .then((list) => {
        setQuizzes(list);
        setSelectedQuizId((cur) => cur || list[0]?.id || '');
      })
      .catch(() => showToast('Failed to load quizzes'));

    fetchCampaigns(accessToken)
      .then(setCampaigns)
      .catch(() => {});

    fetchEmployeePerformance(accessToken)
      .then(setEmployees)
      .catch(() => showToast('Failed to load employee data'))
      .finally(() => setEmpLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    setOverviewLoading(true);
    fetchAnalyticsOverview(accessToken, range)
      .then(setOverview)
      .catch(() => showToast('Failed to load overview'))
      .finally(() => setOverviewLoading(false));
  }, [accessToken, range]);

  useEffect(() => {
    if (!accessToken || !selectedQuizId) return;
    setQuizLoading(true);
    fetchQuizAnalytics(accessToken, selectedQuizId, range)
      .then(setQuizAnalytics)
      .catch(() => showToast('Failed to load quiz analytics'))
      .finally(() => setQuizLoading(false));
  }, [accessToken, selectedQuizId, range]);

  // derived data
  const trendData = useMemo(
    () => (overview?.scoreTrend ?? []).map((p) => ({ ...p, label: formatDate(p.date) })),
    [overview],
  );

  const distData = useMemo(() => {
    if (!quizAnalytics) return [];
    return distributionOrder.map((b) => ({ bucket: b, count: quizAnalytics.distribution[b] }));
  }, [quizAnalytics]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (riskFilter === 'all') return employees;
    return employees.filter((e) => {
      const r = riskLevel(e);
      if (riskFilter === 'high') return r === 'high';
      return r === 'high' || r === 'medium';
    });
  }, [employees, riskFilter]);

  const atRiskCount = useMemo(
    () => (employees ?? []).filter((e) => riskLevel(e) === 'high' || riskLevel(e) === 'medium').length,
    [employees],
  );

  const phishingClickRate = useMemo(() => {
    const sent = campaigns.reduce((s, c) => s + (c.status === 'SENT' ? c.targetCount : 0), 0);
    const clicked = campaigns.reduce((s, c) => s + (c.status === 'SENT' ? c.clickCount : 0), 0);
    return sent > 0 ? Math.round((clicked / sent) * 100) : null;
  }, [campaigns]);

  const completionRate = useMemo(() => {
    if (!overview || overview.totalAssignments === 0) return null;
    return Math.round((overview.completedAssignments / overview.totalAssignments) * 100);
  }, [overview]);

  const applyPreset = (p: Preset) => {
    const next = getPresetRange(p);
    setRange(next);
    setDraftRange(next);
    setPickerOpen(false);
  };

  const applyCustom = () => {
    if (!draftRange.from || !draftRange.to) return;
    setRange(draftRange);
    setPickerOpen(false);
  };

  const handleAssign = async () => {
    if (!accessToken || !assignPanel || !assignForm.quizId) return;
    setAssignLoading(true);
    try {
      await createAdminAssignment(accessToken, {
        quizId: assignForm.quizId,
        userId: assignPanel,
        dueAt: assignForm.dueAt || undefined,
      });
      showToast('Quiz assigned successfully', true);
      setAssignPanel(null);
      setAssignForm({ quizId: '', dueAt: '' });
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to assign quiz');
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg border shadow-lg px-4 py-3 text-sm font-medium ${
            toast.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-white text-red-700'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── header ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Organization overview and security analytics</p>
        </div>
        {/* date range picker */}
        <div className="relative self-start lg:self-auto">
          <button
            type="button"
            onClick={() => { setDraftRange(range); setPickerOpen((o) => !o); }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <span className="text-slate-400">📅</span>
            <span className="font-medium text-slate-900">
              {formatDate(range.from)} – {formatDate(range.to)}
            </span>
          </button>
          {pickerOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl z-40 space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {(['mtd', 'last7', 'last30', 'quarter'] as Preset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => applyPreset(p)}
                    className="rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    {p === 'mtd' ? 'This month' : p === 'last7' ? 'Last 7 days' : p === 'last30' ? 'Last 30 days' : 'This quarter'}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start</label>
                  <input type="date" value={draftRange.from} max={draftRange.to}
                    onChange={(e) => setDraftRange((r) => ({ ...r, from: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End</label>
                  <input type="date" value={draftRange.to} min={draftRange.from}
                    onChange={(e) => setDraftRange((r) => ({ ...r, to: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPickerOpen(false)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={applyCustom}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      {overviewLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon="👥"
            label="Employees"
            value={overview.totalEmployees}
            sub={`${overview.activeEmployees} active`}
            accent="bg-blue-50"
          />
          <StatCard
            icon="🎯"
            label="Avg Quiz Score"
            value={formatPercent(overview.avgScorePercent)}
            sub={`${overview.attemptsInRange} attempts in range`}
            accent={
              overview.avgScorePercent === null ? 'bg-slate-50'
              : overview.avgScorePercent < 50 ? 'bg-red-50'
              : overview.avgScorePercent < 70 ? 'bg-amber-50'
              : 'bg-emerald-50'
            }
          />
          <StatCard
            icon="✅"
            label="Completion Rate"
            value={completionRate !== null ? `${completionRate}%` : '—'}
            sub={`${overview.completedAssignments} of ${overview.totalAssignments} assignments`}
            accent="bg-indigo-50"
          />
          <StatCard
            icon="🎣"
            label="Phishing Click Rate"
            value={phishingClickRate !== null ? `${phishingClickRate}%` : '—'}
            sub={atRiskCount > 0 ? `${atRiskCount} employee${atRiskCount !== 1 ? 's' : ''} need attention` : 'All employees passing'}
            accent={phishingClickRate !== null && phishingClickRate > 20 ? 'bg-red-50' : 'bg-amber-50'}
          />
        </div>
      ) : null}

      {/* ── score trend ── */}
      {!overviewLoading && overview && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Average Score Over Time</h2>
            <span className="text-xs text-slate-400">{formatDate(range.from)} – {formatDate(range.to)}</span>
          </div>
          {trendData.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No quiz submissions in this range.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={20} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TrendTooltip />} />
                  <Area type="monotone" dataKey="avgScorePercent" stroke="#6366f1" fill="url(#scoreFill)" strokeWidth={2.5} connectNulls dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── employee performance ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Employee Performance</h2>
            <p className="text-xs text-slate-400 mt-0.5">Filter at-risk employees and assign remediation quizzes directly</p>
          </div>
          <div className="flex gap-1.5 text-xs shrink-0">
            {(['all', 'attention', 'high'] as RiskFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setRiskFilter(f)}
                className={`rounded-md px-3 py-1.5 font-medium border transition-colors ${
                  riskFilter === f
                    ? f === 'high' ? 'bg-red-600 text-white border-red-600'
                      : f === 'attention' ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f === 'all' ? `All (${employees?.length ?? 0})` : f === 'attention' ? `Needs Attention (${atRiskCount})` : `High Risk`}
              </button>
            ))}
          </div>
        </div>

        {empLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />)}
          </div>
        ) : !employees || employees.length === 0 ? (
          <p className="text-sm text-slate-500 p-5">No employees found.</p>
        ) : filteredEmployees.length === 0 ? (
          <p className="text-sm text-slate-500 p-5">No employees match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Quiz Score</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Assignments</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Phishing</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Risk</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const risk = riskLevel(emp);
                  const isOpen = assignPanel === emp.id;
                  return (
                    <Fragment key={emp.id}>
                      <tr className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${isOpen ? 'bg-indigo-50/40' : ''}`}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{emp.fullName}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <ScoreBar score={emp.avgScorePercent} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">{emp.completedAssignments}</span>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-500">{emp.totalAssignments}</span>
                          </div>
                          <div className="mt-1 h-1 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-400"
                              style={{ width: emp.totalAssignments > 0 ? `${(emp.completedAssignments / emp.totalAssignments) * 100}%` : '0%' }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {emp.phishingEmailsSent === 0 ? (
                            <span className="text-xs text-slate-400">No emails sent</span>
                          ) : (
                            <div>
                              <span className={`text-xs font-medium ${emp.phishingClicks > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {emp.phishingClicks > 0 ? `⚠️ Clicked ${emp.phishingClicks}` : '✓ No clicks'}
                              </span>
                              <p className="text-xs text-slate-400 mt-0.5">{emp.phishingEmailsSent} email{emp.phishingEmailsSent !== 1 ? 's' : ''} sent</p>
                              {emp.phishingCampaigns.length > 0 && (
                                <p className="text-xs text-slate-400 truncate max-w-[160px]" title={emp.phishingCampaigns.map(c => c.campaignName).join(', ')}>
                                  {emp.phishingCampaigns.map(c => c.campaignName).join(', ')}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <RiskBadge level={risk} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setAssignPanel(isOpen ? null : emp.id);
                              setAssignForm({ quizId: quizzes[0]?.id ?? '', dueAt: '' });
                            }}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                              isOpen
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                            }`}
                          >
                            {isOpen ? 'Cancel' : 'Assign Quiz'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-indigo-100 bg-indigo-50/60">
                          <td colSpan={6} className="px-5 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Quiz</label>
                                <select
                                  value={assignForm.quizId}
                                  onChange={(e) => setAssignForm((f) => ({ ...f, quizId: e.target.value }))}
                                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm min-w-[200px] focus:border-indigo-400 focus:outline-none"
                                >
                                  {quizzes.length === 0 && <option value="">No published quizzes</option>}
                                  {quizzes.map((q) => (
                                    <option key={q.id} value={q.id}>{q.title}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Due date (optional)</label>
                                <input
                                  type="date"
                                  value={assignForm.dueAt}
                                  onChange={(e) => setAssignForm((f) => ({ ...f, dueAt: e.target.value }))}
                                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                                />
                              </div>
                              <button
                                onClick={handleAssign}
                                disabled={assignLoading || !assignForm.quizId}
                                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {assignLoading ? 'Assigning…' : 'Assign'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── phishing campaigns ── */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Phishing Campaigns</h2>
            <button
              onClick={() => navigate('/admin/phishing')}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View all →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.slice(0, 6).map((c) => {
              const clickRate = c.targetCount > 0 ? Math.round((c.clickCount / c.targetCount) * 100) : 0;
              const s = CAMPAIGN_STATUS[c.status];
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 text-sm leading-tight">{c.name}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{c.targetCount}</p>
                      <p className="text-xs text-slate-400">Targets</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">{c.clickCount}</p>
                      <p className="text-xs text-slate-400">Clicked</p>
                    </div>
                    <div>
                      <p className={`text-lg font-bold ${clickRate > 30 ? 'text-red-600' : clickRate > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {c.status === 'SENT' ? `${clickRate}%` : '—'}
                      </p>
                      <p className="text-xs text-slate-400">Click rate</p>
                    </div>
                  </div>
                  {c.status === 'SENT' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Click rate</span>
                        <span>{clickRate}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${clickRate > 30 ? 'bg-red-500' : clickRate > 10 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                          style={{ width: `${clickRate}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {c.sentAt && (
                    <p className="text-xs text-slate-400">Sent {new Date(c.sentAt).toLocaleDateString()}</p>
                  )}
                  {c.scheduledAt && c.status === 'SCHEDULED' && (
                    <p className="text-xs text-amber-600">Scheduled for {new Date(c.scheduledAt).toLocaleDateString()}</p>
                  )}
                  <button
                    onClick={() => navigate(`/admin/phishing/${c.id}`)}
                    className="mt-auto w-full rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── quiz analytics ── */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Quiz Analytics</h2>

        {quizzes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">No published quizzes yet.</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Select Quiz</label>
              <select
                className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
              >
                {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              {quizLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : quizAnalytics ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Submitted Attempts</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{quizAnalytics.attemptsCount}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Average Score</p>
                      <p className={`text-3xl font-bold mt-1 ${
                        quizAnalytics.avgScorePercent === null ? 'text-slate-400'
                        : quizAnalytics.avgScorePercent < 50 ? 'text-red-600'
                        : quizAnalytics.avgScorePercent < 70 ? 'text-amber-600'
                        : 'text-emerald-600'
                      }`}>
                        {formatPercent(quizAnalytics.avgScorePercent)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Score Distribution</h3>
                    {quizAnalytics.attemptsCount === 0 ? (
                      <p className="text-sm text-slate-500">No submitted attempts in this range.</p>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distData} barSize={40}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<DistTooltip />} />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                              {distData.map((entry) => (
                                <Cell key={entry.bucket} fill={DIST_COLORS[entry.bucket]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {quizAnalytics.mostMissedQuestions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">Most Missed Questions</h3>
                      <div className="space-y-3">
                        {quizAnalytics.mostMissedQuestions.map((q, i) => (
                          <div key={q.questionId} className="flex gap-3 items-start">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 leading-snug">{q.prompt}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-[120px]">
                                  <div className="h-full rounded-full bg-red-400" style={{ width: `${q.incorrectRate * 100}%` }} />
                                </div>
                                <span className="text-xs text-red-600 font-medium">{Math.round(q.incorrectRate * 100)}% incorrect</span>
                                <span className="text-xs text-slate-400">({q.incorrectAnswers}/{q.totalAnswers})</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
