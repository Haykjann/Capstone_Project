import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuizStatus } from '@prisma/client';

@Injectable()
export class AdminQuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const quizzes = await this.prisma.quiz.findMany({
      where: { orgId },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      status: q.status,
      passingScore: q.passingScore,
      createdAt: q.createdAt,
      questionCount: q._count.questions,
    }));
  }

  async create(orgId: string, userId: string, dto: CreateQuizDto) {
    return this.prisma.quiz.create({
      data: {
        orgId,
        createdById: userId,
        title: dto.title,
        description: dto.description,
        difficulty: 'MEDIUM',
        tags: [],
        status: QuizStatus.DRAFT,
      },
    });
  }

  async get(orgId: string, id: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, orgId },
      include: {
        questions: {
          // Fix #13: order by the explicit order field
          orderBy: { order: 'asc' },
          include: { choices: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      status: quiz.status,
      passingScore: quiz.passingScore,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        explanation: q.explanation,
        order: q.order,
        choices: q.choices.map((c) => ({ id: c.id, text: c.text, isCorrect: c.isCorrect })),
      })),
    };
  }

  async update(orgId: string, id: string, dto: UpdateQuizDto) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id, orgId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return this.prisma.quiz.update({
      where: { id },
      data: {
        title: dto.title ?? quiz.title,
        description: dto.description ?? quiz.description,
        status: dto.status ?? quiz.status,
        // Fix #9: allow updating passingScore; null clears it
        passingScore: dto.passingScore !== undefined ? dto.passingScore : quiz.passingScore,
      },
    });
  }

  async delete(orgId: string, id: string) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id, orgId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    await this.prisma.quiz.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  async addQuestion(orgId: string, quizId: string, dto: CreateQuestionDto) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id: quizId, orgId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (dto.choices.length < 2) throw new ForbiddenException('At least two choices are required');
    if (dto.correctChoiceIndex < 0 || dto.correctChoiceIndex >= dto.choices.length) {
      throw new ForbiddenException('Invalid correct choice index');
    }

    // Fix #13: assign the next order value so questions are ordered deterministically
    const maxOrder = await this.prisma.question.aggregate({
      where: { quizId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    return this.prisma.question.create({
      data: {
        quizId,
        text: dto.text,
        explanation: dto.explanation,
        order: nextOrder,
        choices: {
          create: dto.choices.map((c, idx) => ({
            text: c.text,
            order: idx,
            isCorrect: idx === dto.correctChoiceIndex,
          })),
        },
      },
      include: { choices: { orderBy: { order: 'asc' } } },
    });
  }

  async updateQuestion(orgId: string, questionId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, quiz: { orgId } },
      include: { choices: { orderBy: { order: 'asc' } } },
    });
    if (!question) throw new NotFoundException('Question not found');

    const existingChoices = question.choices;
    const incoming = dto.choices ?? existingChoices.map((c) => ({ id: c.id, text: c.text }));

    const updates = incoming.map((c, idx) => ({ ...c, order: idx })).filter((c) => c.id);
    const creations = incoming.map((c, idx) => ({ ...c, order: idx })).filter((c) => !c.id);
    const incomingIds = updates.map((c) => c.id);
    const deletions = existingChoices.filter((c) => !incomingIds.includes(c.id));

    const correctChoiceId = dto.correctChoiceId
      ? dto.correctChoiceId
      : existingChoices.find((c) => c.isCorrect)?.id;

    if (correctChoiceId && ![...updates, ...existingChoices].some((c) => c.id === correctChoiceId)) {
      throw new ForbiddenException('Invalid correct choice id');
    }

    await this.prisma.$transaction([
      this.prisma.question.update({
        where: { id: questionId },
        data: { text: dto.text ?? question.text, explanation: dto.explanation ?? question.explanation },
      }),
      ...updates.map((c) =>
        this.prisma.choice.update({
          where: { id: c.id! },
          data: { text: c.text, order: c.order, isCorrect: c.id === correctChoiceId },
        }),
      ),
      ...creations.map((c) =>
        this.prisma.choice.create({
          data: { questionId, text: c.text, order: c.order, isCorrect: false },
        }),
      ),
      ...deletions.map((c) => this.prisma.choice.delete({ where: { id: c.id } })),
    ]);

    if (correctChoiceId) {
      await this.prisma.choice.updateMany({ where: { questionId }, data: { isCorrect: false } });
      await this.prisma.choice.update({ where: { id: correctChoiceId }, data: { isCorrect: true } });
    }

    return this.prisma.question.findUnique({
      where: { id: questionId },
      include: { choices: { orderBy: { order: 'asc' } } },
    });
  }

  async deleteQuestion(orgId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, quiz: { orgId } },
    });
    if (!question) throw new NotFoundException('Question not found');
    await this.prisma.question.delete({ where: { id: questionId } });
    return { message: 'Deleted' };
  }
}
