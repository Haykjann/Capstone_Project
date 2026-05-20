import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AttemptResultsResponse, getAttemptResults } from '../../api/me';

export function AttemptResultsPage() {
  const { attemptId = '' } = useParams();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<AttemptResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!accessToken) {
        setError('You must be logged in to view results.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getAttemptResults(attemptId, accessToken);
        setResults(data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to load results. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    if (attemptId) load();
  }, [accessToken, attemptId]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-sm text-slate-600">Loading results...</div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">{error}</div>;
  }

  if (!results) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-sm text-slate-600">
        No results found for this attempt.
      </div>
    );
  }

  const correctCount = results.results.filter((r) => r.isCorrect).length;
  const total = results.results.length;
  const score = results.scorePercent ?? 0;
  const { isPassed, passingScore } = results;

  const scoreColor =
    isPassed === true
      ? 'text-green-700 bg-green-50 border-green-100'
      : isPassed === false
        ? 'text-red-700 bg-red-50 border-red-100'
        : 'text-indigo-700 bg-indigo-50 border-indigo-100';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className={`h-16 w-16 rounded-full border flex items-center justify-center text-xl font-bold ${scoreColor}`}>
            {score}%
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{results.quiz.title}</h1>
            <p className="text-sm text-slate-600">
              Correct {correctCount}/{total} · Submitted{' '}
              {results.submittedAt ? new Date(results.submittedAt).toLocaleString() : 'N/A'}
            </p>
            {/* Fix #9: show pass/fail result */}
            {isPassed !== null && (
              <p className={`text-sm font-semibold mt-1 ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                {isPassed ? 'Passed' : 'Failed'}
                {passingScore !== null && ` (required: ${passingScore}%)`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/employee/assignments')}
          className="px-4 py-2 text-sm font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          Back to assignments
        </button>
      </div>

      <div className="space-y-3">
        {results.results.map((r, idx) => (
          <div
            key={r.questionId}
            className={`rounded-xl border shadow-sm p-4 ${
              r.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-600">Question {idx + 1}</p>
                <p className="text-base font-semibold text-slate-900">{r.text}</p>
              </div>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  r.isCorrect ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}
              >
                {r.isCorrect ? 'Correct' : 'Incorrect'}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="rounded-md bg-white/60 border border-white/80 px-3 py-2">
                <span className="font-semibold text-slate-800">Your answer: </span>
                <span className="text-slate-800">{r.chosenText ?? 'No answer selected'}</span>
              </div>
              <div className="rounded-md bg-white/60 border border-white/80 px-3 py-2">
                <span className="font-semibold text-slate-800">Correct answer: </span>
                <span className="text-slate-800">{r.correctText ?? 'N/A'}</span>
              </div>
              {r.explanation && (
                <div className="rounded-md bg-white/60 border border-white/80 px-3 py-2 text-slate-700">
                  <span className="font-semibold text-slate-800">Explanation: </span>
                  {r.explanation}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
