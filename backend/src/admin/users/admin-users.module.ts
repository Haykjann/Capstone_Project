import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [PrismaModule, AuthModule, EmailModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
