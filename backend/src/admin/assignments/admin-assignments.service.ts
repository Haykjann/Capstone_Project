import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateBulkAssignmentDto } from './dto/create-bulk-assignment.dto';
import { AssignmentStatus, QuizStatus } from '@prisma/client';

@Injectable()
export class AdminAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orgId: string, adminId: string, dto: CreateAssignmentDto) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: dto.quizId, orgId, status: QuizStatus.PUBLISHED },
    });
    if (!quiz) throw new ForbiddenException('Quiz not found or not published');

    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, orgId } });
    if (!user) throw new ForbiddenException('User not found in org');

    const dueAtDate = dto.dueAt ? new Date(dto.dueAt) : undefined;

    return this.prisma.assignment.create({
      data: {
        orgId,
        quizId: dto.quizId,
        userId: dto.userId,
        status: AssignmentStatus.PENDING,
        dueAt: dueAtDate,
        createdAt: new Date(),
      },
    });
  }

  async createBulkAssignment(orgId: string, adminId: string, dto: CreateBulkAssignmentDto) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: dto.quizId, orgId, status: QuizStatus.PUBLISHED },
    });
    if (!quiz) throw new ForbiddenException('Quiz not found or not published');

    if (!dto.userIds || dto.userIds.length === 0) {
      throw new ForbiddenException('No users selected');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds }, orgId },
      select: { id: true },
    });

    if (users.length === 0) throw new NotFoundException('No valid users found in org');

    const dueAtDate = dto.dueAt ? new Date(dto.dueAt) : undefined;

    const assignments = await this.prisma.$transaction(
      users.map((u) =>
        this.prisma.assignment.create({
          data: {
            orgId,
            quizId: dto.quizId,
            userId: u.id,
            status: AssignmentStatus.PENDING,
            dueAt: dueAtDate,
            createdAt: new Date(),
          },
        }),
      ),
    );

    return { created: assignments.length };
  }

  async list(orgId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: { orgId },
      include: {
        quiz: { select: { title: true } },
        user: { select: { email: true } },
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, scorePercent: true, submittedAt: true, createdAt: true, isPassed: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    return assignments.map((a) => {
      const latestAttempt = a.attempts[0];
      let assignmentStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'OVERDUE';
      if (!latestAttempt) {
        assignmentStatus = a.dueAt && a.dueAt < now ? 'OVERDUE' : 'NOT_STARTED';
      } else if (latestAttempt.submittedAt) {
        assignmentStatus = 'SUBMITTED';
      } else {
        assignmentStatus = a.dueAt && a.dueAt < now ? 'OVERDUE' : 'IN_PROGRESS';
      }

      return {
        id: a.id,
        quizTitle: a.quiz.title,
        userEmail: a.user.email,
        dueAt: a.dueAt,
        createdAt: a.createdAt,
        assignmentStatus,
        latestAttemptId: latestAttempt?.id ?? null,
        latestAttemptScorePercent: latestAttempt?.scorePercent ?? null,
        latestAttemptIsPassed: latestAttempt?.isPassed ?? null,
        latestAttemptSubmittedAt: latestAttempt?.submittedAt ?? null,
      };
    });
  }
}
