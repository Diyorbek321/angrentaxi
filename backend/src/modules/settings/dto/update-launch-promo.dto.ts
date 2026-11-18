import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, ValidateIf } from 'class-validator';

export class UpdateLaunchPromoDto {
  @ApiProperty({
    example: '2027-01-01T00:00:00+05:00',
    nullable: true,
    description: "Shu sanagacha taksi komissiyasi 0. null — aksiyani o'chiradi",
  })
  @ValidateIf((_o, value) => value !== null)
  @IsDateString()
  launchPromoCommissionUntil: string | null;
}
