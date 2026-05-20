import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { AdminAttemptsService } from './admin-attempts.service';

@Controller('admin/attempts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminAttemptsController {
  constructor(private readonly service: AdminAttemptsService) {}

  @Get(':id/results')
  async getResults(@Param('id') id: string, @Req() req: any) {
    return this.service.getResults(req.user.orgId, id);
  }
}
