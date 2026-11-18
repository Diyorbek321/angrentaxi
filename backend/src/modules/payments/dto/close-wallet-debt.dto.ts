import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export const WALLET_DEBT_CLOSE_MODES = ['cash_received', 'write_off'] as const;
export type WalletDebtCloseMode = (typeof WALLET_DEBT_CLOSE_MODES)[number];

export class CloseWalletDebtDto {
  @ApiProperty({ enum: WALLET_DEBT_CLOSE_MODES })
  @IsIn(WALLET_DEBT_CLOSE_MODES as unknown as string[])
  mode: WalletDebtCloseMode;

  @ApiProperty({ example: "Ofisda naqd oldim, kvitansiya 123", maxLength: 500 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: "Qaysi qarzlar (DEBIT id); bo'lmasa — hammasi", type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  transactionIds?: string[];
}
