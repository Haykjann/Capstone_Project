import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBulkAssignmentDto {
  @IsString()
  @IsNotEmpty()
  quizId: string;

  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @IsString()
  @IsOptional()
  dueAt?: string;
}
