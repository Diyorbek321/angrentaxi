import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateWalletTopupDto {
  @ApiPropertyOptional({ description: "Haydovchi/kuryer hamyonini Payme/Click orqali to'ldirish" })
  @IsOptional()
  @IsBoolean()
  walletTopupEnabled?: boolean;

  @ApiPropertyOptional({ example: 10000, description: "Eng kam summa, so'm" })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(100_000_000)
  walletTopupMin?: number;

  @ApiPropertyOptional({ example: 2000000, description: "Eng katta summa, so'm" })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(100_000_000)
  walletTopupMax?: number;

  @ApiPropertyOptional({ example: [50000, 100000, 200000], description: "Tezkor tugmalar, so'm" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1000, { each: true })
  walletTopupPresets?: number[];

  @ApiPropertyOptional({ example: 7, description: "Karta to'ldirishi shuncha kun yechib olinmaydi (0 — o'chiq)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  walletTopupHoldDays?: number;

  @ApiPropertyOptional({ example: 2000000, description: "Menejer qo'lda tuzatishining |summa| chegarasi, so'm" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5_000_000)
  manualAdjustmentManagerLimit?: number;
}
