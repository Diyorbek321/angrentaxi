import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class CompleteTripDto {
  @ApiPropertyOptional({
    example: '0427',
    description: "Posilka, ovqat, market: qabul qiluvchi aytgan 4 xonali kod. Boshqa safarlarda yuborilmaydi.",
  })
  @IsOptional()
  @Matches(/^\d{4}$/, { message: "PIN 4 ta raqamdan iborat bo'lsin" })
  deliveryPin?: string;
}
