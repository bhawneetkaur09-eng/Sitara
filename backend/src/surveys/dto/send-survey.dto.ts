import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class SendSurveyDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{10,15}$/, {
    message: 'Phone must be a valid number (10-15 digits, optional + prefix)',
  })
  phone: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  channel?: string;
}
