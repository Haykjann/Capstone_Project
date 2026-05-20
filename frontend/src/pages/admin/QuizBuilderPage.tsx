import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addQuestion,
  deleteQuestion,
  deleteQuiz,
  fetchQuiz,
  updateQuestion,
  updateQuiz,
  Question,
  QuizDetail,
} from '../../api/adminQuizzes';
import { useAuth } from '../../auth/AuthProvider';
import { QuizStatus } from '../../auth/types';

export function QuizBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuiz(accessToken, id);
      setQuiz(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  const [newQuestion, setNewQuestion] = useState({
    text: '',
    explanation: '',
    choices: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    correctChoiceIndex: 0,
  });

  const onAddQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !id) return;
    try {
      await addQuestion(accessToken, id, {
        text: newQuestion.text,
        explanation: newQuestion.explanation || undefined,
        choices: newQuestion.choices.map((text) => ({ text })),
        correctChoiceIndex: newQuestion.correctChoiceIndex,
      });
      setNewQuestion({
        text: '',
        explanation: '',
        choices: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctChoiceIndex: 0,
      });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add question');
    }
  };

  const onDeleteQuiz = async () => {
    if (!accessToken || !id) return;
    await deleteQuiz(accessToken, id);
    navigate('/admin/quizzes', { replace: true });
  };

  const onPublish = async () => {
    if (!accessToken || !id) return;
    await updateQuiz(accessToken, id, { status: 'PUBLISHED' });
    await load();
  };

  const onUpdateQuestion = async (q: Question) => {
    if (!accessToken) return;
    await updateQuestion(accessToken, q.id, {
      text: q.text,
      explanation: q.explanation || undefined,
      choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
      correctChoiceId: q.choices.find((c) => c.isCorrect)?.id,
    });
    await load();
  };

  const onDeleteQuestion = async (qid: string) => {
    if (!accessToken) return;
    await deleteQuestion(accessToken, qid);
    await load();
  };

  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);

  if (loading) return <p className="text-sm text-gray-600">Loading quiz...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!quiz) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{quiz.title}</h1>
          <p className="text-sm text-gray-600">{quiz.description || 'No description'}</p>
          <p className="text-xs text-gray-500">Status: {quiz.status}</p>
        </div>
        <div className="flex gap-2">
          {quiz.status !== 'PUBLISHED' && (
            <button
              onClick={onPublish}
              className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              Publish
            </button>
          )}
          <button
            onClick={onDeleteQuiz}
            className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            Delete
          </button>
          <Link
            to="/admin/quizzes"
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
        {questions.length === 0 && <p className="text-sm text-gray-600">No questions yet.</p>}
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onSave={onUpdateQuestion}
              onDelete={onDeleteQuestion}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Add Question</h2>
        <form className="space-y-3 bg-white border border-gray-200 rounded-lg p-4 shadow-sm" onSubmit={onAddQuestion}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Question</label>
            <input
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={newQuestion.text}
              onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Explanation (optional)</label>
            <textarea
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={newQuestion.explanation}
              onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Choices</label>
            {newQuestion.choices.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctChoice"
                  checked={newQuestion.correctChoiceIndex === idx}
                  onChange={() => setNewQuestion({ ...newQuestion, correctChoiceIndex: idx })}
                />
                <input
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={c}
                  onChange={(e) => {
                    const next = [...newQuestion.choices];
                    next[idx] = e.target.value;
                    setNewQuestion({ ...newQuestion, choices: next });
                  }}
                  required
                />
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Add Question
          </button>
        </form>
      </section>
    </div>
  );
}

function QuestionCard({
  question,
  onSave,
  onDelete,
}: {
  question: Question;
  onSave: (q: Question) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Question>(question);

  useEffect(() => {
    setDraft(question);
  }, [question]);

  const save = async () => {
    await onSave(draft);
    setEditing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {!editing ? (
        <div className="flex justify-between">
          <div>
            <p className="font-semibold text-gray-900">{question.text}</p>
            {question.explanation && <p className="text-sm text-gray-600">{question.explanation}</p>}
            <ul className="mt-2 space-y-1">
              {question.choices.map((c) => (
                <li
                  key={c.id}
                  className={`text-sm ${c.isCorrect ? 'text-green-700 font-medium' : 'text-gray-700'}`}
                >
                  {c.text} {c.isCorrect ? '(correct)' : ''}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button
              className="text-sm text-indigo-600 hover:underline"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button className="text-sm text-red-600 hover:underline" onClick={() => onDelete(question.id)}>
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          />
          <textarea
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={draft.explanation || ''}
            onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
          />
          <div className="space-y-2">
            {draft.choices.map((c, idx) => (
              <div key={c.id ?? `new-${idx}`} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={!!c.isCorrect}
                  onChange={() =>
                    setDraft({
                      ...draft,
                      choices: draft.choices.map((choice, cidx) => ({
                        ...choice,
                        isCorrect: cidx === idx,
                      })),
                    })
                  }
                />
                <input
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={c.text}
                  onChange={(e) => {
                    const next = [...draft.choices];
                    next[idx] = { ...next[idx], text: e.target.value };
                    setDraft({ ...draft, choices: next });
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              onClick={save}
            >
              Save
            </button>
            <button
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
              onClick={() => {
                setDraft(question);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
