import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Dispetcher: naqd nizo qanday hal qilindi. */
export class ResolveCashDisputeDto {
  @ApiProperty({ example: "Kuryer pulni do'konga olib bordi" })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  resolution: string;
}
