import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTeamAssignmentDto {
  @IsString()
  @IsNotEmpty()
  quizId: string;

  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
