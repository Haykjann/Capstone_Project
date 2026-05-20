import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PhishingCampaignsService } from './phishing-campaigns.service';

@Injectable()
export class PhishingSchedulerService {
  constructor(private readonly campaigns: PhishingCampaignsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledCampaigns() {
    await this.campaigns.sendDueScheduledCampaigns();
  }
}
