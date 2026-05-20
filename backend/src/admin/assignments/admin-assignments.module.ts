import { Module } from '@nestjs/common';
import { AdminAssignmentsController } from './admin-assignments.controller';
import { AdminAssignmentsService } from './admin-assignments.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminAssignmentsController],
  providers: [AdminAssignmentsService],
})
export class AdminAssignmentsModule {}
