import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Sotuvchi: kuryerdan tovar pulini oldimi. `false` — nizo, dispetcherga. */
export class CashReceivedDto {
  @ApiProperty()
  @IsBoolean()
  received: boolean;
}
