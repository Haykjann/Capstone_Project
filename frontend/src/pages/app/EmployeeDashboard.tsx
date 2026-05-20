import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { MyStats, getMyStats } from '../../api/me';

const SECURITY_TIPS = [
  'Never click links in emails asking for passwords — go directly to the website instead.',
  'Use a unique password for every account and store them in a password manager.',
  'Enable multi-factor authentication on all accounts that support it.',
  'Verify unexpected requests by calling the sender on a known phone number.',
  'Keep software and operating systems updated to patch security vulnerabilities.',
  'Lock your screen whenever you step away from your workstation.',
  'Report suspicious emails to your security team — even if you are unsure.',
];

const tip = SECURITY_TIPS[new Date().getDay()];

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function dueBadge(dueAt: string | null) {
  if (!dueAt) return null;
  const diff = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  const cls =
    diff < 0 ? 'bg-red-100 text-red-700' :
    diff <= 3 ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-600';
  const label = diff < 0 ? 'Overdue' : diff === 0 ? 'Due today' : `Due in ${diff}d`;
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export function EmployeeDashboard() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getMyStats(accessToken)
      .then(setStats)
      .catch(() => setError('Failed to load your stats'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const phishingClean = stats ? stats.phishingClicked === 0 : true;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.fullName?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">Here's your security training snapshot.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Assigned" value={stats.totalAssignments} sub={`${stats.pendingAssignments} pending`} />
          <KpiCard
            label="Completed"
            value={stats.completedAssignments}
            sub={stats.totalAssignments > 0 ? `${Math.round((stats.completedAssignments / stats.totalAssignments) * 100)}% done` : undefined}
            accent="text-violet-700"
          />
          <KpiCard
            label="Avg Score"
            value={stats.avgScorePercent !== null ? `${stats.avgScorePercent}%` : '—'}
            sub="across completed quizzes"
            accent={stats.avgScorePercent !== null && stats.avgScorePercent >= 70 ? 'text-emerald-600' : 'text-amber-600'}
          />
          <KpiCard
            label="Phishing"
            value={phishingClean ? '✓ Clean' : `⚠ ${stats.phishingClicked} click${stats.phishingClicked !== 1 ? 's' : ''}`}
            sub={`${stats.phishingEmailsReceived} email${stats.phishingEmailsReceived !== 1 ? 's' : ''} received`}
            accent={phishingClean ? 'text-emerald-600' : 'text-red-600'}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming assignments */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Upcoming Assignments</h2>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
            </div>
          ) : stats && stats.upcomingAssignments.length > 0 ? (
            <div className="space-y-2">
              {stats.upcomingAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.quizTitle}</p>
                    <div className="mt-0.5">{dueBadge(a.dueAt)}</div>
                  </div>
                  <button
                    onClick={() => navigate('/employee/assignments')}
                    className="shrink-0 px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs font-medium hover:bg-violet-700"
                  >
                    {a.status === 'IN_PROGRESS' ? 'Continue' : 'Start'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No upcoming assignments — you're all caught up!</p>
          )}
          {stats && stats.pendingAssignments > 3 && (
            <button onClick={() => navigate('/employee/assignments')} className="mt-3 text-xs text-violet-600 hover:underline">
              View all {stats.pendingAssignments} assignments →
            </button>
          )}
        </div>

        {/* Recent results */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent Results</h2>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
            </div>
          ) : stats && stats.recentResults.length > 0 ? (
            <div className="space-y-2">
              {stats.recentResults.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.quizTitle}</p>
                    {r.submittedAt && (
                      <p className="text-xs text-slate-400">{new Date(r.submittedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.scorePercent !== null && (
                      <span className={`text-sm font-bold ${r.scorePercent >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {r.scorePercent}%
                      </span>
                    )}
                    {r.isPassed !== null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {r.isPassed ? 'Passed' : 'Failed'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No completed quizzes yet. Start one from your assignments!</p>
          )}
        </div>
      </div>

      {/* Security tip */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 flex gap-3">
        <span className="text-xl shrink-0">💡</span>
        <div>
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-0.5">Security Tip of the Day</p>
          <p className="text-sm text-violet-900">{tip}</p>
        </div>
      </div>
    </div>
  );
}
