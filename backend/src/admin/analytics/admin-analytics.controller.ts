import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminAnalyticsController {
  constructor(private readonly service: AdminAnalyticsService) {}

  @Get('overview')
  async getOverview(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getOverview(req.user.orgId, { from, to });
  }

  @Get('employees')
  async getEmployeePerformance(@Req() req: any) {
    return this.service.getEmployeePerformance(req.user.orgId);
  }

  @Get('quizzes/:quizId')
  async getQuizAnalytics(
    @Req() req: any,
    @Param('quizId') quizId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getQuizAnalytics(req.user.orgId, quizId, { from, to });
  }
}
