import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, UserStatus, AssignmentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AnalyticsRangeInput {
  from?: string;
  to?: string;
}

interface ParsedRange {
  from: Date;
  to: Date;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(orgId: string, rangeInput: AnalyticsRangeInput) {
    const range = this.parseRange(rangeInput);
    const attemptWhere = {
      orgId,
      submittedAt: {
        not: null as null,
        gte: range.from,
        lte: range.to,
      },
    };

    const [
      totalEmployees,
      activeEmployees,
      totalQuizzes,
      totalAssignments,
      completedAssignments,
      scoreAggregate,
      attemptsInRange,
      recentAttempts,
      trendAttempts,
    ] = await Promise.all([
      this.prisma.user.count({ where: { orgId, role: Role.EMPLOYEE } }),
      this.prisma.user.count({
        where: { orgId, role: Role.EMPLOYEE, status: UserStatus.ACTIVE },
      }),
      this.prisma.quiz.count({ where: { orgId } }),
      this.prisma.assignment.count({ where: { orgId } }),
      this.prisma.assignment.count({ where: { orgId, status: AssignmentStatus.COMPLETED } }),
      this.prisma.attempt.aggregate({
        where: attemptWhere,
        _avg: { scorePercent: true },
      }),
      this.prisma.attempt.count({ where: attemptWhere }),
      this.prisma.attempt.findMany({
        where: attemptWhere,
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          scorePercent: true,
          submittedAt: true,
          quiz: { select: { title: true } },
          user: { select: { fullName: true } },
        },
      }),
      this.prisma.attempt.findMany({
        where: attemptWhere,
        select: {
          submittedAt: true,
          scorePercent: true,
        },
      }),
    ]);

    return {
      range: {
        from: this.toDateOnly(range.from),
        to: this.toDateOnly(range.to),
      },
      totalEmployees,
      activeEmployees,
      totalQuizzes,
      totalAssignments,
      completedAssignments,
      attemptsInRange,
      avgScorePercent: scoreAggregate._avg.scorePercent,
      recentAttempts: recentAttempts.map((attempt) => ({
        attemptId: attempt.id,
        quizTitle: attempt.quiz.title,
        userFullName: attempt.user.fullName,
        scorePercent: attempt.scorePercent,
        submittedAt: attempt.submittedAt,
      })),
      scoreTrend: this.buildScoreTrend(range, trendAttempts),
    };
  }

  async getQuizAnalytics(orgId: string, quizId: string, rangeInput: AnalyticsRangeInput) {
    const range = this.parseRange(rangeInput);
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, orgId },
      select: { id: true, title: true },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const attemptWhere = {
      orgId,
      quizId,
      submittedAt: {
        not: null as null,
        gte: range.from,
        lte: range.to,
      },
    };

    const [attemptsCount, scoreAggregate, attempts, answers] = await Promise.all([
      this.prisma.attempt.count({
        where: attemptWhere,
      }),
      this.prisma.attempt.aggregate({
        where: attemptWhere,
        _avg: { scorePercent: true },
      }),
      this.prisma.attempt.findMany({
        where: attemptWhere,
        select: { scorePercent: true },
      }),
      this.prisma.attemptAnswer.findMany({
        where: {
          attempt: attemptWhere,
        },
        select: {
          isCorrect: true,
          questionId: true,
          question: {
            select: {
              text: true,
            },
          },
        },
      }),
    ]);

    const distribution = {
      '0-49': 0,
      '50-69': 0,
      '70-84': 0,
      '85-100': 0,
    };

    for (const attempt of attempts) {
      const score = attempt.scorePercent ?? 0;
      if (score <= 49) {
        distribution['0-49'] += 1;
      } else if (score <= 69) {
        distribution['50-69'] += 1;
      } else if (score <= 84) {
        distribution['70-84'] += 1;
      } else {
        distribution['85-100'] += 1;
      }
    }

    const questionStats = new Map<
      string,
      { questionId: string; prompt: string; totalAnswers: number; incorrectAnswers: number }
    >();

    for (const answer of answers) {
      const existing = questionStats.get(answer.questionId) ?? {
        questionId: answer.questionId,
        prompt: answer.question.text,
        totalAnswers: 0,
        incorrectAnswers: 0,
      };

      existing.totalAnswers += 1;
      if (!answer.isCorrect) {
        existing.incorrectAnswers += 1;
      }

      questionStats.set(answer.questionId, existing);
    }

    const mostMissedQuestions = [...questionStats.values()]
      .map((item) => ({
        ...item,
        incorrectRate: item.totalAnswers === 0 ? 0 : item.incorrectAnswers / item.totalAnswers,
      }))
      .sort((a, b) => {
        if (b.incorrectRate !== a.incorrectRate) {
          return b.incorrectRate - a.incorrectRate;
        }
        return b.totalAnswers - a.totalAnswers;
      })
      .slice(0, 5);

    return {
      range: {
        from: this.toDateOnly(range.from),
        to: this.toDateOnly(range.to),
      },
      quiz,
      attemptsCount,
      avgScorePercent: scoreAggregate._avg.scorePercent,
      distribution,
      mostMissedQuestions,
    };
  }

  async getEmployeePerformance(orgId: string) {
    const employees = await this.prisma.user.findMany({
      where: { orgId, role: Role.EMPLOYEE },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        assignments: {
          select: {
            attempts: {
              select: { scorePercent: true, submittedAt: true },
            },
          },
        },
        campaignTargets: {
          select: {
            clickedAt: true,
            emailSentAt: true,
            campaign: { select: { id: true, name: true } },
          },
        },
      },
    });

    return employees.map((emp) => {
      const allAttempts = emp.assignments.flatMap((a) => a.attempts);
      const submittedAttempts = allAttempts.filter((att) => att.submittedAt != null);
      const scores = submittedAttempts
        .map((att) => att.scorePercent)
        .filter((s): s is number => s !== null);
      const avgScore =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const completedAssignments = emp.assignments.filter((a) =>
        a.attempts.some((att) => att.submittedAt != null),
      ).length;
      const phishingClicks = emp.campaignTargets.filter((t) => t.clickedAt != null);

      return {
        id: emp.id,
        fullName: emp.fullName,
        email: emp.email,
        status: emp.status,
        totalAssignments: emp.assignments.length,
        completedAssignments,
        avgScorePercent: avgScore,
        phishingEmailsSent: emp.campaignTargets.filter((t) => t.emailSentAt != null).length,
        phishingClicks: phishingClicks.length,
        phishingCampaigns: phishingClicks.map((t) => ({
          campaignId: t.campaign.id,
          campaignName: t.campaign.name,
          clickedAt: t.clickedAt,
        })),
      };
    });
  }

  private buildScoreTrend(
    range: ParsedRange,
    attempts: Array<{ submittedAt: Date | null; scorePercent: number | null }>,
  ) {
    const points = new Map<string, { date: string; attemptsCount: number; totalScore: number }>();

    for (const attempt of attempts) {
      if (!attempt.submittedAt) continue;
      const date = this.toDateOnly(attempt.submittedAt);
      const existing = points.get(date) ?? { date, attemptsCount: 0, totalScore: 0 };
      existing.attemptsCount += 1;
      existing.totalScore += attempt.scorePercent ?? 0;
      points.set(date, existing);
    }

    const trend: Array<{ date: string; attemptsCount: number; avgScorePercent: number | null }> = [];
    let cursor = new Date(range.from);
    while (cursor <= range.to) {
      const date = this.toDateOnly(cursor);
      const point = points.get(date);
      trend.push({
        date,
        attemptsCount: point?.attemptsCount ?? 0,
        avgScorePercent:
          point && point.attemptsCount > 0 ? point.totalScore / point.attemptsCount : null,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }

    return trend;
  }

  private parseRange(input: AnalyticsRangeInput): ParsedRange {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);

    const from = input.from ? this.parseDateOnly(input.from, 'from') : defaultFrom;
    const to = input.to ? this.parseDateOnly(input.to, 'to', true) : now;

    if (from > to) {
      throw new BadRequestException('Invalid range: from must be before or equal to to');
    }

    return { from, to };
  }

  private parseDateOnly(value: string, field: 'from' | 'to', endOfDay = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`Invalid ${field} date format. Expected YYYY-MM-DD`);
    }

    const [yearStr, monthStr, dayStr] = value.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    const date = endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new BadRequestException(`Invalid ${field} date`);
    }

    return date;
  }

  private toDateOnly(date: Date) {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
