import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AssignmentItem, AssignmentStatus, getMyAssignments } from '../../api/me';

const statusStyles: Record<AssignmentStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-800 border border-gray-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border border-amber-200',
  SUBMITTED: 'bg-green-100 text-green-800 border border-green-200',
  OVERDUE: 'bg-red-100 text-red-800 border border-red-200',
};

const statusLabel: Record<AssignmentStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  OVERDUE: 'Overdue',
};

export function EmployeeAssignmentsPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!accessToken) {
        setError('You must be logged in to view assignments.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getMyAssignments(accessToken);
        setAssignments(data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to load assignments. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, [accessToken]);

  const sortedAssignments = useMemo(
    () =>
      [...assignments].sort((a, b) => {
        const aOverdue = a.status === 'OVERDUE' ? 1 : 0;
        const bOverdue = b.status === 'OVERDUE' ? 1 : 0;
        if (bOverdue !== aOverdue) return bOverdue - aOverdue;
        return (b.dueAt ? new Date(b.dueAt).getTime() : 0) - (a.dueAt ? new Date(a.dueAt).getTime() : 0);
      }),
    [assignments],
  );

  const handleAction = (assignment: AssignmentItem) => {
    if (assignment.status === 'SUBMITTED') {
      if (assignment.latestAttemptId) {
        navigate(`/employee/attempts/${assignment.latestAttemptId}/results`);
      }
      return;
    }
    if (assignment.status === 'OVERDUE') return;
    navigate(`/employee/assignments/${assignment.id}/attempt`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Assignments</h1>
        <p className="text-sm text-gray-600">Start, resume, or review your assigned quizzes.</p>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm text-sm text-gray-600">Loading assignments...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">{error}</div>
      )}

      {!loading && !error && sortedAssignments.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm text-sm text-gray-600">
          You have no assignments yet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {sortedAssignments.map((assignment) => {
          const isSubmitted = assignment.status === 'SUBMITTED';
          const isOverdue = assignment.status === 'OVERDUE';
          const score = assignment.latestAttemptScorePercent;
          const isPassed = assignment.latestAttemptIsPassed;

          const actionLabel =
            isSubmitted
              ? assignment.latestAttemptId
                ? 'View Results'
                : 'No attempt found'
              : isOverdue
                ? 'Past Due'
                : assignment.status === 'NOT_STARTED'
                  ? 'Start'
                  : 'Resume';

          return (
            <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{assignment.quizTitle}</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {assignment.dueAt && (
                      <p className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        Due {new Date(assignment.dueAt).toLocaleString()}
                      </p>
                    )}
                    {assignment.passingScore !== null && (
                      <p className="text-xs text-gray-500">· Pass: {assignment.passingScore}%</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[assignment.status]}`}>
                    {statusLabel[assignment.status]}
                  </span>
                  {isSubmitted && score !== null && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                      isPassed === true
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : isPassed === false
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      {score}%{isPassed !== null ? (isPassed ? ' · Passed' : ' · Failed') : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => handleAction(assignment)}
                  disabled={(isSubmitted && !assignment.latestAttemptId) || isOverdue}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
