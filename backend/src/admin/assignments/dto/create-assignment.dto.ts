import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @IsNotEmpty()
  quizId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
