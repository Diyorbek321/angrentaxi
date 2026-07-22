import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGlobalSettingsDto {
  @ApiPropertyOptional({ example: 'Angren Taxi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformName?: string;

  @ApiPropertyOptional({ example: '+998 71 200 00 00' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  supportPhone?: string;

  @ApiPropertyOptional({ example: 'support@angrentaxi.uz' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({ description: 'Stored/toggleable only — not yet enforced by a request guard' })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}
