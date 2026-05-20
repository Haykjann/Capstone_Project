import { Module } from '@nestjs/common';
import { AdminQuizzesService } from './admin-quizzes.service';
import { AdminQuizzesController } from './admin-quizzes.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminQuizzesController],
  providers: [AdminQuizzesService],
})
export class AdminQuizzesModule {}
