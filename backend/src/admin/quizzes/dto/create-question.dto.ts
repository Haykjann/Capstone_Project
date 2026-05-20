import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsArray()
  @ArrayMinSize(2)
  choices: { text: string }[];

  @IsInt()
  @Min(0)
  correctChoiceIndex: number;
}
