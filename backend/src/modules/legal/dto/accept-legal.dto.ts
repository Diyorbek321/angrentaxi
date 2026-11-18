import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { LEGAL_DOCUMENTS, LegalDocument } from '../legal-versions';

export class LegalAcceptanceItemDto {
  @ApiProperty({ enum: LEGAL_DOCUMENTS, example: 'terms' })
  @IsIn(LEGAL_DOCUMENTS as unknown as string[])
  document: LegalDocument;

  @ApiProperty({ example: '2026-11-03.1', description: 'Must equal the current version (GET /legal/acceptance)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}\.\d{1,3}$/)
  version: string;
}

export class AcceptLegalDto {
  @ApiProperty({ type: [LegalAcceptanceItemDto] })
  @ValidateNested({ each: true })
  @Type(() => LegalAcceptanceItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  items: LegalAcceptanceItemDto[];

  @ApiPropertyOptional({ enum: ['login', 'sheet'], default: 'sheet' })
  @IsOptional()
  @IsIn(['login', 'sheet'])
  source?: 'login' | 'sheet';
}
