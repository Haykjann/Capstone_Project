import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateQuizDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['DRAFT', 'PUBLISHED'])
  @IsOptional()
  status?: string;

  // Fix #9: allow setting a passing score threshold (0–100)
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  passingScore?: number;
}
