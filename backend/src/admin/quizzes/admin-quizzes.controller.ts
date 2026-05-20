import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminQuizzesService } from './admin-quizzes.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminQuizzesController {
  constructor(private readonly service: AdminQuizzesService) {}

  @Get('quizzes')
  async list(@Req() req: any) {
    return this.service.list(req.user.orgId);
  }

  @Post('quizzes')
  async create(@Req() req: any, @Body() dto: CreateQuizDto) {
    return this.service.create(req.user.orgId, req.user.sub, dto);
  }

  @Get('quizzes/:id')
  async get(@Req() req: any, @Param('id') id: string) {
    return this.service.get(req.user.orgId, id);
  }

  @Put('quizzes/:id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateQuizDto) {
    return this.service.update(req.user.orgId, id, dto);
  }

  @Delete('quizzes/:id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.service.delete(req.user.orgId, id);
  }

  @Post('quizzes/:id/questions')
  async addQuestion(@Req() req: any, @Param('id') id: string, @Body() dto: CreateQuestionDto) {
    return this.service.addQuestion(req.user.orgId, id, dto);
  }

  @Put('questions/:id')
  async updateQuestion(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.service.updateQuestion(req.user.orgId, id, dto);
  }

  @Delete('questions/:id')
  async deleteQuestion(@Req() req: any, @Param('id') id: string) {
    return this.service.deleteQuestion(req.user.orgId, id);
  }
}
