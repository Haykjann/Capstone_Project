import { IsArray, IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsArray()
  @IsOptional()
  choices?: { id?: string; text: string }[];

  @IsUUID()
  @IsOptional()
  correctChoiceId?: string;
}
