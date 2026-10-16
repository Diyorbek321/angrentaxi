import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateIntercitySettingsDto {
  @ApiPropertyOptional({ description: "Shaharlararo qatnovni yoqish/o'chirish" })
  @IsOptional()
  @IsBoolean()
  intercityEnabled?: boolean;
}
