import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import {
  AdminAssignment,
  createBulkAssignment,
  fetchAdminAssignments,
} from '../../api/adminAssignments';
import { AdminUser, fetchAdminUsers } from '../../api/adminUsers';
import { fetchPublishedQuizzes, QuizListItem } from '../../api/adminQuizzes';
import { fetchAdminAttemptResults } from '../../api/adminAttempts';
import { AttemptResultsResponse } from '../../api/me';

export function AdminAssignmentsPage() {
  const { accessToken } = useAuth();
  const [assignments, setAssignments] = useState<AdminAssignment[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [quizId, setQuizId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [results, setResults] = useState<AttemptResultsResponse | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  const employeeOptions = useMemo(() => users.filter((u) => u.role === 'EMPLOYEE'), [users]);
  const allSelected = employeeOptions.length > 0 && selectedUserIds.size === employeeOptions.length;

  const loadAll = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const [assignmentsRes, usersRes, quizzesRes] = await Promise.all([
        fetchAdminAssignments(accessToken),
        fetchAdminUsers(accessToken),
        fetchPublishedQuizzes(accessToken),
      ]);
      setAssignments(assignmentsRes);
      setUsers(usersRes);
      setQuizzes(quizzesRes);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const openResults = async (attemptId: string | null) => {
    if (!accessToken || !attemptId) return;
    try {
      setResultsError(null);
      const data = await fetchAdminAttemptResults(accessToken, attemptId);
      setResults(data);
      setResultsOpen(true);
    } catch (err) {
      console.error(err);
      setResultsError('Failed to load results');
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(employeeOptions.map((u) => u.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (selectedUserIds.size === 0) {
      setError('Select at least one employee.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const res = await createBulkAssignment(accessToken, {
        quizId,
        userIds: Array.from(selectedUserIds),
        dueAt: dueAt || undefined,
      });
      setSuccessMsg(`Assigned to ${res.created} employee(s).`);
      await loadAll();
      setSelectedUserIds(new Set());
      setQuizId('');
      setDueAt('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create assignments');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Assignments</h1>
          <p className="text-sm text-slate-600">Assign published quizzes to one or more employees.</p>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-900">Assign Quiz</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quiz + Due Date row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Quiz</label>
              <select
                required
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                value={quizId}
                onChange={(e) => setQuizId(e.target.value)}
              >
                <option value="">Select quiz</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Due date (optional)</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>

          {/* Employee multi-select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Employees
                {selectedUserIds.size > 0 && (
                  <span className="ml-2 text-violet-600 font-normal">({selectedUserIds.size} selected)</span>
                )}
              </label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-violet-600 hover:text-violet-800"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {employeeOptions.length === 0 ? (
              <p className="text-sm text-slate-500">No employees found.</p>
            ) : (
              <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {employeeOptions.map((u) => {
                  const checked = selectedUserIds.has(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors ${
                        checked ? 'bg-violet-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(u.id)}
                        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-sm text-slate-800">{u.fullName}</span>
                      <span className="text-xs text-slate-500 ml-auto">{u.email}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || selectedUserIds.size === 0}
              className="px-4 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              {submitting
                ? 'Assigning...'
                : selectedUserIds.size > 0
                  ? `Assign to ${selectedUserIds.size} employee${selectedUserIds.size > 1 ? 's' : ''}`
                  : 'Assign'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Assignments</h2>
        </div>
        {loading ? (
          <p className="text-sm text-slate-600">Loading assignments...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2 pr-4">Quiz</th>
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2 pr-4">Submitted</th>
                  <th className="py-2 pr-4">Due</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assignments.map((a) => {
                  const canViewResults = a.assignmentStatus === 'SUBMITTED' && a.latestAttemptId;
                  const score = a.latestAttemptScorePercent ?? '-';
                  const submitted = a.latestAttemptSubmittedAt
                    ? new Date(a.latestAttemptSubmittedAt).toLocaleString()
                    : '—';
                  const statusColor =
                    a.assignmentStatus === 'SUBMITTED'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : a.assignmentStatus === 'IN_PROGRESS'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : a.assignmentStatus === 'OVERDUE'
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200';

                  return (
                    <tr key={a.id} className="text-slate-800">
                      <td className="py-2 pr-4">{a.quizTitle}</td>
                      <td className="py-2 pr-4">{a.userEmail}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {a.assignmentStatus}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{score === '-' ? score : `${score}%`}</td>
                      <td className="py-2 pr-4">
                        {a.latestAttemptIsPassed === true && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-200">Passed</span>
                        )}
                        {a.latestAttemptIsPassed === false && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-800 border border-red-200">Failed</span>
                        )}
                        {a.latestAttemptIsPassed === null && '—'}
                      </td>
                      <td className="py-2 pr-4">{submitted}</td>
                      <td className="py-2 pr-4">{a.dueAt ? new Date(a.dueAt).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-4">{new Date(a.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right">
                        <button
                          disabled={!canViewResults}
                          onClick={() => openResults(a.latestAttemptId)}
                          className="px-3 py-1.5 rounded-md text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          View Results
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resultsOpen && results && (
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{results.quiz.title}</h3>
              <p className="text-sm text-slate-600">
                Score: {results.scorePercent ?? 0}%
                {results.isPassed !== null && (
                  <span className={`ml-2 font-semibold ${results.isPassed ? 'text-green-600' : 'text-red-600'}`}>
                    · {results.isPassed ? 'Passed' : 'Failed'}
                    {results.passingScore !== null && ` (required: ${results.passingScore}%)`}
                  </span>
                )}
                {' · '}Submitted:{' '}
                {results.submittedAt ? new Date(results.submittedAt).toLocaleString() : 'N/A'}
              </p>
            </div>
            <button
              onClick={() => { setResultsOpen(false); setResults(null); }}
              className="px-3 py-1.5 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
          {resultsError && <p className="text-sm text-red-600">{resultsError}</p>}
          <div className="space-y-3">
            {results.results.map((r, idx) => (
              <div key={r.questionId} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Question {idx + 1}</p>
                    <p className="text-base font-medium text-slate-900">{r.text}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    r.isCorrect
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {r.isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-800">
                  <p><span className="font-semibold">Chosen:</span> {r.chosenText ?? 'No answer'}</p>
                  <p><span className="font-semibold">Correct:</span> {r.correctText ?? 'N/A'}</p>
                  {r.explanation && (
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-700">Explanation:</span> {r.explanation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
