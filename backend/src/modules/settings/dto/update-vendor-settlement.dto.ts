import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, ValidateIf } from 'class-validator';
import {
  VENDOR_SETTLEMENT_MODES,
  VendorSettlementMode,
} from '../../delivery/vendor-settlement-mode';

export class UpdateVendorSettlementDto {
  @ApiPropertyOptional({
    enum: VENDOR_SETTLEMENT_MODES,
    description: "'cash' — kuryer do'konga naqd to'laydi; 'wallet' — kuryer hamyonidan o'tkazma",
  })
  @IsOptional()
  @IsIn(VENDOR_SETTLEMENT_MODES)
  vendorSettlementMode?: VendorSettlementMode;

  @ApiPropertyOptional({
    example: '2026-12-12T00:00:00+05:00',
    nullable: true,
    description: "Shu paytdan rejim baribir 'wallet' (e-tijorat qonuni 23-modda). null — sana yo'q",
  })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsDateString()
  vendorWalletSettlementFrom?: string | null;
}
