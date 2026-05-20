import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { getMyAssignments, saveAnswers, startAssignment, submitAssignment } from '../../api/me';

interface QuestionState {
  id: string;
  text: string;
  explanation: string | null;
  choices: { id: string; text: string }[];
}

// Fix #14: clean up stale attempt keys that no longer match active assignments
function cleanStaleAttemptKeys(activeAssignmentIds: string[]) {
  const activeSet = new Set(activeAssignmentIds);
  Object.keys(localStorage)
    .filter((key) => key.startsWith('attempt:'))
    .forEach((key) => {
      const assignmentId = key.slice('attempt:'.length);
      if (!activeSet.has(assignmentId)) {
        localStorage.removeItem(key);
      }
    });
}

export function AssignmentTakingPage() {
  const { assignmentId = '' } = useParams();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [passingScore, setPassingScore] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!accessToken) {
        setError('You must be logged in to start this assignment.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const assignments = await getMyAssignments(accessToken);

        // Fix #14: remove localStorage keys for assignments that are no longer active
        cleanStaleAttemptKeys(assignments.filter((a) => a.status !== 'SUBMITTED').map((a) => a.id));

        const assignment = assignments.find((a) => a.id === assignmentId);
        if (!assignment) {
          setError('Assignment not found.');
          return;
        }

        if (assignment.status === 'SUBMITTED') {
          if (assignment.latestAttemptId) {
            navigate(`/employee/attempts/${assignment.latestAttemptId}/results`, { replace: true });
          } else {
            setError('This assignment has already been submitted.');
          }
          return;
        }

        if (assignment.status === 'OVERDUE') {
          setError('This assignment is past its due date and can no longer be started.');
          setLoading(false);
          return;
        }

        // Fix #15: backend returns existing attempt — no need to rely on localStorage for the ID
        const data = await startAssignment(assignmentId, accessToken);
        setAttemptId(data.attemptId);
        localStorage.setItem(`attempt:${assignmentId}`, data.attemptId);
        setQuestions(data.quiz.questions);
        setQuizTitle(data.quiz.title);
        setPassingScore(data.quiz.passingScore);

        // Fix #10 & #15: restore saved answers from the server so progress survives refresh
        if (data.savedAnswers && Object.keys(data.savedAnswers).length > 0) {
          setAnswers(data.savedAnswers);
        }

        setError(null);
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Unable to load assignment. Please try again.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    if (assignmentId) load();
  }, [accessToken, assignmentId, navigate]);

  const totalQuestions = useMemo(() => questions.length, [questions]);
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);
  const hasProgress = attemptId && Object.keys(answers).length > 0 && !submitting;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasProgress) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasProgress]);

  // Fix #10: auto-save answers to server 1s after last change (debounced)
  const persistAnswers = useCallback(
    (currentAttemptId: string, currentAnswers: Record<string, string>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        if (!accessToken || !currentAttemptId) return;
        const payload = Object.entries(currentAnswers).map(([questionId, choiceId]) => ({
          questionId,
          choiceId,
        }));
        if (payload.length === 0) return;
        try {
          await saveAnswers(assignmentId, { attemptId: currentAttemptId, answers: payload }, accessToken);
        } catch {
          // silent — answers are saved on submit anyway
        }
      }, 1000);
    },
    [accessToken, assignmentId],
  );

  const handleChoiceSelect = (questionId: string, choiceId: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: choiceId };
      if (attemptId) persistAnswers(attemptId, next);
      return next;
    });
  };

  const goNext = () => setCurrentIndex((idx) => Math.min(idx + 1, totalQuestions - 1));
  const goPrev = () => setCurrentIndex((idx) => Math.max(idx - 1, 0));

  const handleSubmit = async () => {
    if (!accessToken || !attemptId) return;
    try {
      setSubmitting(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const payload = {
        attemptId,
        answers: Object.entries(answers).map(([questionId, choiceId]) => ({ questionId, choiceId })),
      };
      const res = await submitAssignment(assignmentId, payload, accessToken);
      localStorage.removeItem(`attempt:${assignmentId}`);
      navigate(`/employee/attempts/${res.attemptId}/results`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to submit. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm text-sm text-gray-600">
        Loading assignment...
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">{error}</div>;
  }

  if (!currentQuestion) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm text-sm text-gray-600">
        No questions available for this quiz.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{quizTitle}</h1>
        <p className="text-sm text-slate-600">
          Question {currentIndex + 1} of {totalQuestions}
          {passingScore !== null && (
            <span className="ml-2 text-slate-500">· Passing score: {passingScore}%</span>
          )}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow p-4 sm:p-6 space-y-4">
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-indigo-500 transition-all"
            style={{ width: `${totalQuestions ? ((currentIndex + 1) / totalQuestions) * 100 : 0}%` }}
          />
        </div>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">{currentQuestion.text}</h2>
          <div className="space-y-3">
            {currentQuestion.choices.map((choice) => (
              <label
                key={choice.id}
                className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer ${
                  answers[currentQuestion.id] === choice.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <input
                  type="radio"
                  className="text-indigo-600 focus:ring-indigo-500"
                  name={currentQuestion.id}
                  value={choice.id}
                  checked={answers[currentQuestion.id] === choice.id}
                  onChange={() => handleChoiceSelect(currentQuestion.id, choice.id)}
                />
                <span className="text-sm text-slate-900">{choice.text}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 text-sm font-medium rounded-md border border-slate-200 text-slate-700 disabled:opacity-50 hover:bg-slate-100"
        >
          Previous
        </button>
        <div className="space-x-2">
          {currentIndex < totalQuestions - 1 && (
            <button
              onClick={goNext}
              disabled={!currentAnswer}
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50"
            >
              Next
            </button>
          )}
          {currentIndex === totalQuestions - 1 && (
            <button
              onClick={() => setConfirming(true)}
              disabled={submitting || !allAnswered}
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Submit quiz?</h3>
            <p className="text-sm text-slate-600">You cannot change your answers after submitting.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
