import { Module } from '@nestjs/common';
import { AdminAttemptsController } from './admin-attempts.controller';
import { AdminAttemptsService } from './admin-attempts.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminAttemptsController],
  providers: [AdminAttemptsService],
})
export class AdminAttemptsModule {}
