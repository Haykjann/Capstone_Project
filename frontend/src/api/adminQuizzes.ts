import { api } from '../api';
import { QuizStatus } from './types';

export interface QuizListItem {
  id: string;
  title: string;
  description?: string | null;
  status: QuizStatus;
  createdAt: string;
  questionCount: number;
}

export interface Choice {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  text: string;
  explanation?: string | null;
  choices: Choice[];
}

export interface QuizDetail {
  id: string;
  title: string;
  description?: string | null;
  status: QuizStatus;
  questions: Question[];
}

export async function fetchQuizzes(token: string) {
  const res = await api.get<QuizListItem[]>('/admin/quizzes', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function fetchPublishedQuizzes(token: string) {
  const res = await api.get<QuizListItem[]>('/admin/quizzes', {
    headers: { Authorization: `Bearer ${token}` },
    params: { status: 'PUBLISHED' },
  });
  return res.data;
}

export async function createQuiz(token: string, payload: { title: string; description?: string }) {
  const res = await api.post<QuizDetail>('/admin/quizzes', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function fetchQuiz(token: string, id: string) {
  const res = await api.get<QuizDetail>(`/admin/quizzes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateQuiz(
  token: string,
  id: string,
  payload: { title?: string; description?: string; status?: QuizStatus },
) {
  const res = await api.put(`/admin/quizzes/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function deleteQuiz(token: string, id: string) {
  await api.delete(`/admin/quizzes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
}

export async function addQuestion(
  token: string,
  quizId: string,
  payload: { text: string; explanation?: string; choices: { text: string }[]; correctChoiceIndex: number },
) {
  const res = await api.post(`/admin/quizzes/${quizId}/questions`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as Question;
}

export async function updateQuestion(
  token: string,
  questionId: string,
  payload: { text?: string; explanation?: string; choices?: { id?: string; text: string }[]; correctChoiceId?: string },
) {
  const res = await api.put(`/admin/questions/${questionId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as Question;
}

export async function deleteQuestion(token: string, questionId: string) {
  await api.delete(`/admin/questions/${questionId}`, { headers: { Authorization: `Bearer ${token}` } });
}
