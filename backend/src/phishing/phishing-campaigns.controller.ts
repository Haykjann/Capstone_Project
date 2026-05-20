import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';
import { PhishingCampaignsService } from './phishing-campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { AddTargetsDto } from './dto/add-targets.dto';

class ScheduleCampaignDto {
  @IsDateString() @IsNotEmpty() scheduledAt: string;
}

class UpdateCampaignSmtpDto {
  @IsString() @IsNotEmpty() smtpUser: string;
  @IsString() @IsNotEmpty() smtpPassword: string;
}

// Admin endpoints for managing phishing campaigns
@Controller('admin/phishing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PhishingCampaignsController {
  constructor(private readonly service: PhishingCampaignsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateCampaignDto) {
    return this.service.create(req.user.orgId, req.user.sub, dto);
  }

  @Get()
  async list(@Req() req: any) {
    return this.service.list(req.user.orgId);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    return this.service.get(req.user.orgId, id);
  }

  @Post(':id/targets')
  async addTargets(@Req() req: any, @Param('id') id: string, @Body() dto: AddTargetsDto) {
    return this.service.addTargets(req.user.orgId, id, dto);
  }

  @Delete(':id/targets/:targetId')
  async removeTarget(@Req() req: any, @Param('id') id: string, @Param('targetId') targetId: string) {
    return this.service.removeTarget(req.user.orgId, id, targetId);
  }

  @Post(':id/send')
  async send(@Req() req: any, @Param('id') id: string) {
    return this.service.send(req.user.orgId, id);
  }

  @Post(':id/schedule')
  async schedule(@Req() req: any, @Param('id') id: string, @Body() dto: ScheduleCampaignDto) {
    return this.service.schedule(req.user.orgId, id, new Date(dto.scheduledAt));
  }

  @Post(':id/unschedule')
  async unschedule(@Req() req: any, @Param('id') id: string) {
    return this.service.unschedule(req.user.orgId, id);
  }

  @Patch(':id/smtp')
  async updateSmtp(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCampaignSmtpDto) {
    return this.service.updateSmtp(req.user.orgId, id, dto.smtpUser, dto.smtpPassword);
  }

  @Delete(':id/smtp')
  async removeSmtp(@Req() req: any, @Param('id') id: string) {
    return this.service.removeSmtp(req.user.orgId, id);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.service.delete(req.user.orgId, id);
  }
}

// Public click-tracking endpoint — no auth, used from phishing email links.
// Route is intentionally generic (/api/c/:token) to avoid tipping off employees.
@SkipThrottle()
@Controller('c')
export class PhishingTrackController {
  constructor(private readonly service: PhishingCampaignsService) {}

  @Get(':token')
  async track(@Param('token') token: string, @Res() res: Response) {
    let name = '';
    let alreadyClicked = false;
    try {
      const result = await this.service.recordClick(token);
      name = result.userFullName;
      alreadyClicked = result.alreadyClicked;
    } catch {
      // invalid token — still show the page
    }

    const heading = alreadyClicked
      ? '⚠️ You already clicked this link'
      : '🎣 You clicked a simulated phishing link';
    const greeting = name ? `<p class="name">Hi, <strong>${name}</strong>.</p>` : '';

    res.setHeader('Content-Type', 'text/html');
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Security Awareness – PhishGuard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background: #f1f5f9; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; padding: 1rem; }
    .card { background: #fff; border-radius: 1rem; box-shadow: 0 4px 24px rgba(0,0,0,.1);
            max-width: 480px; width: 100%; padding: 2.5rem 2rem; text-align: center; }
    .icon { font-size: 3.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.4rem; color: #1e293b; margin-bottom: .75rem; }
    .name { color: #475569; margin-bottom: 1.25rem; font-size: 1rem; }
    .body { color: #64748b; font-size: .95rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .tip { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: .75rem;
           padding: 1rem; font-size: .875rem; color: #475569; text-align: left; }
    .tip strong { color: #334155; }
    .badge { display: inline-block; margin-top: 1.75rem; font-size: .75rem;
             color: #94a3b8; letter-spacing: .03em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🛡️</div>
    <h1>${heading}</h1>
    ${greeting}
    <p class="body">
      This was a <strong>simulated phishing exercise</strong> run by your organisation's
      security team. No harm has been done — but in a real attack, clicking this link
      could have compromised your account or device.
    </p>
    <div class="tip">
      <strong>How to spot phishing emails:</strong><br/>
      Check the sender's actual email address · Hover over links before clicking ·
      Be suspicious of urgency or threats · When in doubt, contact IT directly.
    </div>
    <span class="badge">PhishGuard Security Training</span>
  </div>
</body>
</html>`);
  }
}
