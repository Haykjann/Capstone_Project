import { Module } from '@nestjs/common';
import { AdminTeamsController } from './admin-teams.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminTeamsController],
})
export class AdminTeamsModule {}
