import { Module } from '@nestjs/common';
import { AdminOrgController } from './admin-org.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminOrgController],
})
export class AdminOrgModule {}
