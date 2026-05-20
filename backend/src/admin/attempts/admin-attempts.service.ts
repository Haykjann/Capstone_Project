import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AdminAttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getResults(orgId: string, attemptId: string) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, orgId },
      include: {
        answers: true,
        quiz: {
          select: {
            id: true,
            title: true,
            questions: {
              orderBy: { createdAt: 'asc' },
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

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

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
      submittedAt: attempt.submittedAt,
      quiz: { id: attempt.quiz.id, title: attempt.quiz.title },
      results,
    };
  }
}
