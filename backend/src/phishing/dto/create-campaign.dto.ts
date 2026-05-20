import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  emailSubject: string;

  @IsString()
  @IsNotEmpty()
  emailBody: string;

  @IsString()
  @IsNotEmpty()
  senderName: string;

  @IsString()
  @IsOptional()
  senderEmail?: string;
}
