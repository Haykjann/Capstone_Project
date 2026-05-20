import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PhishingCampaignsController, PhishingTrackController } from './phishing-campaigns.controller';
import { PhishingCampaignsService } from './phishing-campaigns.service';
import { PhishingSchedulerService } from './phishing-scheduler.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AuthModule, EmailModule],
  controllers: [PhishingCampaignsController, PhishingTrackController],
  providers: [PhishingCampaignsService, PhishingSchedulerService],
})
export class PhishingCampaignsModule {}
