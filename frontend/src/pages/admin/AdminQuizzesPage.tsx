import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { fetchQuizzes, QuizListItem } from '../../api/adminQuizzes';
import { QuizStatus } from '../../auth/types';

export function AdminQuizzesPage() {
  const { accessToken } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuizStatus | 'ALL'>('ALL');

  useEffect(() => {
    const load = async () => {
      if (!accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchQuizzes(accessToken);
        setQuizzes(data);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load quizzes');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [accessToken]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return quizzes;
    return quizzes.filter((q) => q.status === filter);
  }, [quizzes, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quizzes</h1>
          <p className="text-sm text-gray-600">Manage training quizzes for your organization.</p>
        </div>
        <Link
          to="/admin/quizzes/new"
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          New Quiz
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        {(['ALL', 'DRAFT', 'PUBLISHED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-md border ${
              filter === f ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'border-gray-200 text-gray-700'
            }`}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-600">Loading quizzes...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && filtered.length === 0 && <p className="text-sm text-gray-600">No quizzes yet.</p>}

      <div className="grid gap-3">
        {filtered.map((q) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{q.title}</h3>
              <p className="text-sm text-gray-600">{q.description || 'No description'}</p>
              <p className="text-xs text-gray-500 mt-1">
                {q.questionCount} questions • {q.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/admin/quizzes/${q.id}`}
                className="text-sm text-indigo-600 hover:underline font-medium"
              >
                Edit / View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
