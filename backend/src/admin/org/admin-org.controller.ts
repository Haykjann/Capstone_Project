import { Body, Controller, Delete, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IsNotEmpty, IsString } from 'class-validator';

class UpdateSmtpDto {
  @IsString() @IsNotEmpty() smtpUser: string;
  @IsString() @IsNotEmpty() smtpPassword: string;
}

@Controller('admin/org')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrgController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('smtp')
  async getSmtp(@Req() req: any) {
    const org = await this.prisma.org.findUnique({
      where: { id: req.user.orgId },
      select: { smtpUser: true },
    });
    return { smtpUser: org?.smtpUser ?? null, configured: !!org?.smtpUser };
  }

  @Patch('smtp')
  async updateSmtp(@Req() req: any, @Body() dto: UpdateSmtpDto) {
    await this.prisma.org.update({
      where: { id: req.user.orgId },
      data: { smtpUser: dto.smtpUser, smtpPassword: dto.smtpPassword },
    });
    return { message: 'SMTP credentials saved.' };
  }

  @Delete('smtp')
  async deleteSmtp(@Req() req: any) {
    await this.prisma.org.update({
      where: { id: req.user.orgId },
      data: { smtpUser: null, smtpPassword: null },
    });
    return { message: 'SMTP credentials removed.' };
  }
}
