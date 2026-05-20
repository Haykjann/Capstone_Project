import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { AddTargetsDto } from './dto/add-targets.dto';
import { CampaignStatus } from '@prisma/client';

@Injectable()
export class PhishingCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async create(orgId: string, createdById: string, dto: CreateCampaignDto) {
    return this.prisma.phishingCampaign.create({
      data: {
        orgId,
        createdById,
        name: dto.name,
        description: dto.description,
        emailSubject: dto.emailSubject,
        emailBody: dto.emailBody,
        senderName: dto.senderName,
        senderEmail: dto.senderEmail ?? '',
        status: CampaignStatus.DRAFT,
      },
    });
  }

  async list(orgId: string) {
    const campaigns = await this.prisma.phishingCampaign.findMany({
      where: { orgId },
      include: {
        _count: { select: { targets: true } },
        targets: { select: { clickedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status,
      senderName: c.senderName,
      senderEmail: c.senderEmail,
      emailSubject: c.emailSubject,
      scheduledAt: c.scheduledAt,
      sentAt: c.sentAt,
      createdAt: c.createdAt,
      targetCount: c._count.targets,
      clickCount: c.targets.filter((t) => t.clickedAt !== null).length,
    }));
  }

  async get(orgId: string, id: string) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id, orgId },
      include: {
        targets: {
          include: {
            user: { select: { id: true, email: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      emailSubject: campaign.emailSubject,
      emailBody: campaign.emailBody,
      senderName: campaign.senderName,
      senderEmail: campaign.senderEmail,
      smtpUser: campaign.smtpUser ?? null,
      smtpConfigured: !!campaign.smtpUser,
      scheduledAt: campaign.scheduledAt,
      sentAt: campaign.sentAt,
      createdAt: campaign.createdAt,
      targets: campaign.targets.map((t) => ({
        id: t.id,
        userId: t.userId,
        email: t.user.email,
        fullName: t.user.fullName,
        emailSentAt: t.emailSentAt,
        clickedAt: t.clickedAt,
      })),
    };
  }

  async addTargets(orgId: string, campaignId: string, dto: AddTargetsDto) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new ForbiddenException('Cannot modify targets of a sent or scheduled campaign');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds }, orgId },
      select: { id: true },
    });

    const validUserIds = new Set(users.map((u) => u.id));
    const toCreate = dto.userIds.filter((uid) => validUserIds.has(uid));

    await this.prisma.$transaction(
      toCreate.map((userId) =>
        this.prisma.campaignTarget.upsert({
          where: { campaignId_userId: { campaignId, userId } },
          update: {},
          create: {
            campaignId,
            userId,
            token: randomBytes(32).toString('hex'),
          },
        }),
      ),
    );

    return { added: toCreate.length };
  }

  async removeTarget(orgId: string, campaignId: string, targetId: string) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new ForbiddenException('Cannot modify targets of a sent or scheduled campaign');
    }
    const target = await this.prisma.campaignTarget.findFirst({
      where: { id: targetId, campaignId },
    });
    if (!target) throw new NotFoundException('Target not found');
    await this.prisma.campaignTarget.delete({ where: { id: targetId } });
    return { message: 'Target removed' };
  }

  // Schedule for future delivery
  async schedule(orgId: string, campaignId: string, scheduledAt: Date) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id: campaignId, orgId },
      include: { _count: { select: { targets: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === CampaignStatus.SENT) {
      throw new ForbiddenException('Campaign already sent');
    }
    if (campaign.status === CampaignStatus.ARCHIVED) {
      throw new ForbiddenException('Campaign is archived');
    }
    if (campaign._count.targets === 0) {
      throw new ForbiddenException('Add targets before scheduling');
    }
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    // Verify campaign has SMTP configured
    await this.requireCampaignSmtp(campaignId);

    await this.prisma.phishingCampaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.SCHEDULED, scheduledAt },
    });

    return { scheduledAt };
  }

  // Cancel a scheduled campaign back to DRAFT
  async unschedule(orgId: string, campaignId: string) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.SCHEDULED) {
      throw new ForbiddenException('Campaign is not scheduled');
    }
    await this.prisma.phishingCampaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.DRAFT, scheduledAt: null },
    });
    return { message: 'Campaign unscheduled.' };
  }

  async send(orgId: string, campaignId: string) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id: campaignId, orgId },
      include: {
        targets: {
          where: { emailSentAt: null },
          include: { user: { select: { email: true, fullName: true } } },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === CampaignStatus.ARCHIVED) {
      throw new ForbiddenException('Campaign is archived');
    }
    if (campaign.targets.length === 0) {
      throw new ForbiddenException('No targets to send to');
    }

    const credentials = await this.requireCampaignSmtp(campaignId);
    // BACKEND_URL is the externally reachable address of this server.
    // Set it in .env to your machine's LAN IP or public domain so links work on phones.
    // Example: BACKEND_URL=http://192.168.1.100:3000
    const backendUrl = this.config.get<string>('BACKEND_URL') ?? 'http://localhost:3000';
    let sentCount = 0;

    for (const target of campaign.targets) {
      const trackUrl = `${backendUrl}/api/c/${target.token}?ngrok-skip-browser-warning=true`;
      const body = campaign.emailBody.replace(/\{\{trackUrl\}\}/g, trackUrl);
      const htmlBody = body.includes('<')
        ? body
        : `<p>${body.replace(/\n/g, '<br>')}</p>`;

      try {
        await this.emailService.sendMailAs(credentials, {
          from: `"${campaign.senderName}" <${credentials.user}>`,
          to: target.user.email,
          subject: campaign.emailSubject,
          html: htmlBody,
          text: body.replace(/<[^>]+>/g, ''),
        });

        await this.prisma.campaignTarget.update({
          where: { id: target.id },
          data: { emailSentAt: new Date() },
        });
        sentCount++;
      } catch {
        // Continue sending to remaining targets even if one fails
      }
    }

    await this.prisma.phishingCampaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.SENT, sentAt: new Date() },
    });

    return { sent: sentCount };
  }

  // Called by the cron scheduler — sends all due SCHEDULED campaigns
  async sendDueScheduledCampaigns() {
    // Use string literal cast so this works even if the Prisma client hasn't been
    // regenerated yet after the SCHEDULED enum value was added in migration.
    const due = await this.prisma.phishingCampaign.findMany({
      where: {
        status: ('SCHEDULED' as CampaignStatus),
        scheduledAt: { lte: new Date() },
      },
      select: { id: true, orgId: true },
    });

    for (const campaign of due) {
      try {
        await this.send(campaign.orgId, campaign.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[Phishing] Failed to send scheduled campaign ${campaign.id}:`, err);
      }
    }
  }

  async delete(orgId: string, campaignId: string) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.prisma.phishingCampaign.delete({ where: { id: campaignId } });
    return { message: 'Deleted' };
  }

  async recordClick(token: string): Promise<{ alreadyClicked: boolean; userFullName: string; userEmail: string }> {
    const target = await this.prisma.campaignTarget.findUnique({
      where: { token },
      include: { user: { select: { fullName: true, email: true } } },
    });

    if (!target) throw new NotFoundException('Invalid tracking link');

    const alreadyClicked = target.clickedAt !== null;
    if (!alreadyClicked) {
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data: { clickedAt: new Date() },
      });
    }

    return {
      alreadyClicked,
      userFullName: target.user.fullName,
      userEmail: target.user.email,
    };
  }

  async updateSmtp(orgId: string, campaignId: string, smtpUser: string, smtpPassword: string) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.prisma.phishingCampaign.update({
      where: { id: campaignId },
      data: { smtpUser, smtpPassword },
    });
    return { message: 'Gmail credentials saved.', smtpUser };
  }

  async removeSmtp(orgId: string, campaignId: string) {
    const campaign = await this.prisma.phishingCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.prisma.phishingCampaign.update({
      where: { id: campaignId },
      data: { smtpUser: null, smtpPassword: null },
    });
    return { message: 'Gmail credentials removed.' };
  }

  private async requireCampaignSmtp(campaignId: string): Promise<{ user: string; password: string }> {
    const campaign = await this.prisma.phishingCampaign.findUnique({
      where: { id: campaignId },
      select: { smtpUser: true, smtpPassword: true },
    });
    if (!campaign?.smtpUser || !campaign?.smtpPassword) {
      throw new BadRequestException(
        'No Gmail credentials configured for this campaign. ' +
        'Open the campaign and set a Gmail address + App Password before sending.',
      );
    }
    return { user: campaign.smtpUser, password: campaign.smtpPassword };
  }
}
