import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAssignmentsService } from './admin-assignments.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateBulkAssignmentDto } from './dto/create-bulk-assignment.dto';

@Controller('admin/assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminAssignmentsController {
  constructor(private readonly service: AdminAssignmentsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateAssignmentDto) {
    return this.service.create(req.user.orgId, req.user.sub, dto);
  }

  @Post('bulk')
  async createBulk(@Req() req: any, @Body() dto: CreateBulkAssignmentDto) {
    return this.service.createBulkAssignment(req.user.orgId, req.user.sub, dto);
  }

  @Get()
  async list(@Req() req: any) {
    return this.service.list(req.user.orgId);
  }
}
