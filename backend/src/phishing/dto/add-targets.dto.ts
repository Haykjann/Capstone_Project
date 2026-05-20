import { IsArray, IsString, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class AddTargetsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  userIds: string[];
}
