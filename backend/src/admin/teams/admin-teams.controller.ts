import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('admin/teams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminTeamsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    return this.prisma.team.findMany({
      where: { orgId: req.user.orgId },
      select: { id: true, orgId: true, name: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }
}
