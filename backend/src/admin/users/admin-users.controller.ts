import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.service.create(req.user.orgId, dto);
  }

  @Get()
  async list(@Req() req: any) {
    return this.service.list(req.user.orgId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'DEACTIVATED' },
  ) {
    return this.service.updateStatus(req.user.orgId, req.user.sub, id, body.status);
  }
}
