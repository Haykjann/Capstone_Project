import {
  Controller,
  Get,
  UseGuards,
  Req,
  UnauthorizedException,
  Post,
  Param,
  NotFoundException,
  ForbiddenException,
  Body,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../common/prisma/prisma.service';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request & { user?: JwtPayload }) {
    const payload = this.requireUser(req);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { org: true },
    });

    if (!user || user.orgId !== payload.orgId) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: {
        id: user.id,
        orgId: user.orgId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
      },
      org: user.org ? { id: user.org.id, name: user.org.name } : undefined,
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: Request & { user?: JwtPayload }) {
    const payload = this.requireUser(req);

    const userData = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        assignments: {
          select: {
            id: true,
            quizId: true,
            dueAt: true,
            status: true,
            quiz: { select: { title: true } },
            attempts: {
              select: { submittedAt: true, scorePercent: true, isPassed: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        campaignTargets: { select: { emailSentAt: true, clickedAt: true } },
      },
    });

    if (!userData) throw new UnauthorizedException('User not found');

    const now = new Date();
    const assignments = userData.assignments;
    const submitted = assignments.filter((a) => a.attempts[0]?.submittedAt != null);
    const notSubmitted = assignments.filter((a) => !a.attempts[0]?.submittedAt);
    const pending = notSubmitted.filter((a) => !a.dueAt || a.dueAt >= now);
    const overdue = notSubmitted.filter((a) => a.dueAt && a.dueAt < now);

    const scores = submitted
      .map((a) => a.attempts[0]?.scorePercent)
      .filter((s): s is number => s !== null && s !== undefined);
    const avgScorePercent =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    const upcomingAssignments = pending
      .filter((a) => a.dueAt)
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
      .slice(0, 3)
      .map((a) => ({ id: a.id, quizTitle: a.quiz.title, dueAt: a.dueAt, status: a.status }));

    const recentResults = submitted.slice(0, 3).map((a) => ({
      id: a.id,
      quizTitle: a.quiz.title,
      scorePercent: a.attempts[0]?.scorePercent ?? null,
      isPassed: a.attempts[0]?.isPassed ?? null,
      submittedAt: a.attempts[0]?.submittedAt ?? null,
    }));

    return {
      totalAssignments: assignments.length,
      completedAssignments: submitted.length,
      pendingAssignments: pending.length,
      overdueAssignments: overdue.length,
      avgScorePercent,
      phishingEmailsReceived: userData.campaignTargets.filter((t) => t.emailSentAt != null).length,
      phishingClicked: userData.campaignTargets.filter((t) => t.clickedAt != null).length,
      upcomingAssignments,
      recentResults,
    };
  }

  @Get('assignments')
  @UseGuards(JwtAuthGuard)
  async listAssignments(@Req() req: Request & { user?: JwtPayload }) {
    const payload = this.requireUser(req);

    const assignments = await this.prisma.assignment.findMany({
      where: { orgId: payload.orgId, userId: payload.sub },
      include: {
        quiz: { select: { title: true, passingScore: true } },
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, submittedAt: true, scorePercent: true, isPassed: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    return assignments.map((assignment) => {
      const latestAttempt = assignment.attempts[0];
      let status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'OVERDUE';

      if (latestAttempt?.submittedAt) {
        status = 'SUBMITTED';
      } else if (latestAttempt) {
        status = assignment.dueAt && assignment.dueAt < now ? 'OVERDUE' : 'IN_PROGRESS';
      } else {
        status = assignment.dueAt && assignment.dueAt < now ? 'OVERDUE' : 'NOT_STARTED';
      }

      return {
        id: assignment.id,
        orgId: assignment.orgId,
        quizId: assignment.quizId,
        quizTitle: assignment.quiz.title,
        passingScore: assignment.quiz.passingScore,
        dueAt: assignment.dueAt,
        status,
        latestAttemptId: latestAttempt?.id ?? null,
        latestAttemptScorePercent: latestAttempt?.scorePercent ?? null,
        latestAttemptIsPassed: latestAttempt?.isPassed ?? null,
      };
    });
  }

  @Post('assignments/:id/start')
  @UseGuards(JwtAuthGuard)
  async startAssignment(
    @Param('id') id: string,
    @Req() req: Request & { user?: JwtPayload },
  ) {
    const payload = this.requireUser(req);

    const assignment = await this.prisma.assignment.findFirst({
      where: { id, orgId: payload.orgId, userId: payload.sub },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            tags: true,
            passingScore: true,
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                text: true,
                explanation: true,
                order: true,
                choices: {
                  orderBy: { order: 'asc' },
                  select: { id: true, text: true },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    // Fix #7: block starting overdue assignments that haven't been started
    const now = new Date();
    if (assignment.dueAt && assignment.dueAt < now) {
      const existingCheck = await this.prisma.attempt.findFirst({
        where: { assignmentId: assignment.id, userId: payload.sub, submittedAt: null },
      });
      if (!existingCheck) {
        throw new ForbiddenException('Assignment is past due and cannot be started');
      }
    }

    // Fix #15: resume existing attempt rather than always creating a new one
    const existingAttempt = await this.prisma.attempt.findFirst({
      where: {
        assignmentId: assignment.id,
        orgId: payload.orgId,
        userId: payload.sub,
        submittedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        answers: { select: { questionId: true, choiceId: true } },
      },
    });

    const attempt =
      existingAttempt ||
      (await this.prisma.attempt.create({
        data: {
          assignmentId: assignment.id,
          orgId: payload.orgId,
          quizId: assignment.quizId,
          userId: payload.sub,
        },
        select: {
          id: true,
          answers: { select: { questionId: true, choiceId: true } },
        },
      }));

    // Fix #10: return saved draft answers so the frontend can restore progress on reload
    const savedAnswers = attempt.answers.reduce<Record<string, string>>(
      (acc, a) => {
        if (a.choiceId) acc[a.questionId] = a.choiceId;
        return acc;
      },
      {},
    );

    return {
      attemptId: attempt.id,
      savedAnswers,
      quiz: assignment.quiz,
    };
  }

  // Fix #10: persist individual answers mid-quiz so progress survives page refresh
  @Post('assignments/:id/save-answers')
  @UseGuards(JwtAuthGuard)
  async saveAnswers(
    @Param('id') id: string,
    @Body() body: { attemptId: string; answers: { questionId: string; choiceId: string }[] },
    @Req() req: Request & { user?: JwtPayload },
  ) {
    const payload = this.requireUser(req);

    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: body.attemptId,
        assignmentId: id,
        orgId: payload.orgId,
        userId: payload.sub,
        submittedAt: null,
      },
    });

    if (!attempt) throw new NotFoundException('Active attempt not found');

    await this.prisma.$transaction(
      body.answers.map((a) =>
        this.prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: a.questionId } },
          update: { choiceId: a.choiceId, isCorrect: false },
          create: { attemptId: attempt.id, questionId: a.questionId, choiceId: a.choiceId, isCorrect: false },
        }),
      ),
    );

    return { saved: body.answers.length };
  }

  @Post('assignments/:id/submit')
  @UseGuards(JwtAuthGuard)
  async submitAssignment(
    @Param('id') id: string,
    @Body() body: { attemptId: string; answers: { questionId: string; choiceId: string }[] },
    @Req() req: Request & { user?: JwtPayload },
  ) {
    const payload = this.requireUser(req);

    const assignment = await this.prisma.assignment.findFirst({
      where: { id, orgId: payload.orgId, userId: payload.sub },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                text: true,
                choices: { select: { id: true, isCorrect: true } },
              },
            },
          },
        },
      },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    // Fix #7: block submission after due date
    if (assignment.dueAt && assignment.dueAt < new Date()) {
      throw new ForbiddenException('Assignment is past due and cannot be submitted');
    }

    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: body.attemptId,
        assignmentId: assignment.id,
        orgId: payload.orgId,
        userId: payload.sub,
        submittedAt: null,
      },
    });

    if (!attempt) throw new NotFoundException('Active attempt not found');

    const quizQuestions = assignment.quiz.questions;
    const totalQuestions = quizQuestions.length;
    const answersByQuestion = new Map(
      (body.answers || []).map((a) => [a.questionId, a.choiceId]),
    );

    let correctCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const question of quizQuestions) {
        const chosenChoiceId = answersByQuestion.get(question.id) ?? null;
        const correctChoice = question.choices.find((c) => c.isCorrect);
        const isCorrect = !!(chosenChoiceId && correctChoice && correctChoice.id === chosenChoiceId);
        if (isCorrect) correctCount++;

        await tx.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
          update: { choiceId: chosenChoiceId, isCorrect },
          create: { attemptId: attempt.id, questionId: question.id, choiceId: chosenChoiceId, isCorrect },
        });
      }

      const scorePercent = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
      // Fix #9: compute isPassed based on the quiz's passingScore threshold
      const passingScore = assignment.quiz.passingScore;
      const isPassed =
        passingScore !== null && passingScore !== undefined ? scorePercent >= passingScore : null;

      await tx.attempt.update({
        where: { id: attempt.id },
        data: { submittedAt: new Date(), scorePercent, correctCount, totalCount: totalQuestions, isPassed },
      });

      await tx.assignment.update({ where: { id: assignment.id }, data: { status: 'COMPLETED' } });
    });

    const scorePercent = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
    const passingScore = assignment.quiz.passingScore;
    const isPassed =
      passingScore !== null && passingScore !== undefined ? scorePercent >= passingScore : null;

    return { attemptId: attempt.id, scorePercent, correctCount, totalQuestions, isPassed, passingScore };
  }

  @Get('attempts/:id/results')
  @UseGuards(JwtAuthGuard)
  async getAttemptResults(@Param('id') id: string, @Req() req: Request & { user?: JwtPayload }) {
    const payload = this.requireUser(req);

    const attempt = await this.prisma.attempt.findFirst({
      where: { id, orgId: payload.orgId, userId: payload.sub },
      include: {
        answers: true,
        quiz: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                text: true,
                explanation: true,
                choices: {
                  orderBy: { order: 'asc' },
                  select: { id: true, text: true, isCorrect: true },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found');

    const answerMap = new Map(
      attempt.answers.map((ans) => [ans.questionId, { choiceId: ans.choiceId, isCorrect: ans.isCorrect }]),
    );

    const results = attempt.quiz.questions.map((question) => {
      const chosen = answerMap.get(question.id);
      const correctChoice = question.choices.find((c) => c.isCorrect);
      const chosenChoice = question.choices.find((c) => c.id === chosen?.choiceId);
      return {
        questionId: question.id,
        text: question.text,
        explanation: question.explanation,
        chosenChoiceId: chosen?.choiceId ?? null,
        chosenText: chosenChoice?.text ?? null,
        correctChoiceId: correctChoice?.id ?? null,
        correctText: correctChoice?.text ?? null,
        isCorrect: !!chosen?.isCorrect,
      };
    });

    return {
      attemptId: attempt.id,
      scorePercent: attempt.scorePercent,
      isPassed: attempt.isPassed,
      passingScore: attempt.quiz.passingScore,
      submittedAt: attempt.submittedAt,
      quiz: { id: attempt.quiz.id, title: attempt.quiz.title },
      results,
    };
  }

  private requireUser(req: Request & { user?: JwtPayload }) {
    const payload = req.user;
    if (!payload) throw new UnauthorizedException('Missing user context');
    return payload;
  }
}
