import { api } from '../api';

export type AssignmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'OVERDUE';

export interface AssignmentItem {
  id: string;
  orgId: string;
  quizId: string;
  quizTitle: string;
  passingScore: number | null;
  dueAt: string | null;
  status: AssignmentStatus;
  latestAttemptId: string | null;
  latestAttemptScorePercent: number | null;
  latestAttemptIsPassed: boolean | null;
}

export interface StartAssignmentResponse {
  attemptId: string;
  // Fix #10 & #15: saved draft answers for mid-quiz persistence
  savedAnswers: Record<string, string>;
  quiz: {
    id: string;
    title: string;
    description: string | null;
    difficulty: string;
    tags: string[];
    passingScore: number | null;
    questions: {
      id: string;
      text: string;
      explanation: string | null;
      order: number;
      choices: { id: string; text: string }[];
    }[];
  };
}

export interface SubmitAssignmentPayload {
  attemptId: string;
  answers: { questionId: string; choiceId: string }[];
}

export interface SubmitAssignmentResponse {
  attemptId: string;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  isPassed: boolean | null;
  passingScore: number | null;
}

export interface AttemptResultsResponse {
  attemptId: string;
  scorePercent: number | null;
  isPassed: boolean | null;
  passingScore: number | null;
  submittedAt: string | null;
  quiz: { id: string; title: string };
  results: {
    questionId: string;
    text: string;
    explanation: string | null;
    chosenChoiceId: string | null;
    chosenText: string | null;
    correctChoiceId: string | null;
    correctText: string | null;
    isCorrect: boolean;
  }[];
}

export interface MyStats {
  totalAssignments: number;
  completedAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  avgScorePercent: number | null;
  phishingEmailsReceived: number;
  phishingClicked: number;
  upcomingAssignments: { id: string; quizTitle: string; dueAt: string | null; status: string }[];
  recentResults: { id: string; quizTitle: string; scorePercent: number | null; isPassed: boolean | null; submittedAt: string | null }[];
}

export async function getMyStats(token: string) {
  const res = await api.get<MyStats>('/me/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getMyAssignments(token: string) {
  const res = await api.get<AssignmentItem[]>('/me/assignments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function startAssignment(assignmentId: string, token: string) {
  const res = await api.post<StartAssignmentResponse>(
    `/me/assignments/${assignmentId}/start`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

// Fix #10: persist answers during quiz so progress survives page refresh
export async function saveAnswers(
  assignmentId: string,
  data: { attemptId: string; answers: { questionId: string; choiceId: string }[] },
  token: string,
) {
  const res = await api.post<{ saved: number }>(
    `/me/assignments/${assignmentId}/save-answers`,
    data,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function submitAssignment(
  assignmentId: string,
  data: SubmitAssignmentPayload,
  token: string,
) {
  const res = await api.post<SubmitAssignmentResponse>(
    `/me/assignments/${assignmentId}/submit`,
    data,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function getAttemptResults(attemptId: string, token: string) {
  const res = await api.get<AttemptResultsResponse>(`/me/attempts/${attemptId}/results`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
