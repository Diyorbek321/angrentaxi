import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';

export class AddFundsDto {
  @ApiProperty({ example: 50000, description: "Amount to add in UZS (negative for a manual correction)" })
  @IsNumber()
  @NotEquals(0)
  amount: number;

  @ApiPropertyOptional({ example: 'Naqd pul orqali to\'ldirildi' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
