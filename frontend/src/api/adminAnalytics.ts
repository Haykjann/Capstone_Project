import { api } from '../api';

export interface AnalyticsRange {
  from: string;
  to: string;
}

export interface OverviewRecentAttempt {
  attemptId: string;
  quizTitle: string;
  userFullName: string;
  scorePercent: number | null;
  submittedAt: string;
}

export interface ScoreTrendPoint {
  date: string;
  attemptsCount: number;
  avgScorePercent: number | null;
}

export interface AdminAnalyticsOverview {
  range: AnalyticsRange;
  totalEmployees: number;
  activeEmployees: number;
  totalQuizzes: number;
  totalAssignments: number;
  completedAssignments: number;
  attemptsInRange: number;
  avgScorePercent: number | null;
  recentAttempts: OverviewRecentAttempt[];
  scoreTrend: ScoreTrendPoint[];
}

export interface QuizDistribution {
  '0-49': number;
  '50-69': number;
  '70-84': number;
  '85-100': number;
}

export interface MostMissedQuestion {
  questionId: string;
  prompt: string;
  incorrectRate: number;
  totalAnswers: number;
  incorrectAnswers: number;
}

export interface QuizAnalyticsResponse {
  range: AnalyticsRange;
  quiz: {
    id: string;
    title: string;
  };
  attemptsCount: number;
  avgScorePercent: number | null;
  distribution: QuizDistribution;
  mostMissedQuestions: MostMissedQuestion[];
}

export interface EmployeePerformanceItem {
  id: string;
  fullName: string;
  email: string;
  status: string;
  totalAssignments: number;
  completedAssignments: number;
  avgScorePercent: number | null;
  phishingEmailsSent: number;
  phishingClicks: number;
  phishingCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    clickedAt: string | null;
  }>;
}

export async function fetchEmployeePerformance(token: string) {
  const res = await api.get<EmployeePerformanceItem[]>('/admin/analytics/employees', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function fetchAnalyticsOverview(token: string, range: AnalyticsRange) {
  const res = await api.get<AdminAnalyticsOverview>('/admin/analytics/overview', {
    headers: { Authorization: `Bearer ${token}` },
    params: range,
  });
  return res.data;
}

export async function fetchQuizAnalytics(token: string, quizId: string, range: AnalyticsRange) {
  const res = await api.get<QuizAnalyticsResponse>(`/admin/analytics/quizzes/${quizId}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: range,
  });
  return res.data;
}
