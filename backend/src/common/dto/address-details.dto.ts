import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AddressDetails } from '../../database/entities/address-details';

/** Manzil tafsilotlari (docs/specs/food-market-ux-v5.md §3) — buyurtma va saqlangan manzil uchun. */
export class AddressDetailsDto implements AddressDetails {
  @ApiPropertyOptional({ description: 'Podyezd', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  entrance?: string;

  @ApiPropertyOptional({ description: 'Qavat', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  floor?: string;

  @ApiPropertyOptional({ description: 'Xonadon', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  apartment?: string;

  @ApiPropertyOptional({ description: 'Domofon', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  intercom?: string;

  @ApiPropertyOptional({ description: "Mo'ljal", maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @ApiPropertyOptional({ description: 'Kuryerga izoh', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  courierNote?: string;
}

const ADDRESS_DETAIL_KEYS: ReadonlyArray<keyof AddressDetails> = [
  'entrance',
  'floor',
  'apartment',
  'intercom',
  'landmark',
  'courierNote',
];

/**
 * Faqat ma'lum kalitlar, bo'sh joylar kesilgan; hammasi bo'sh bo'lsa `null`
 * (JSON'da `addressDetails: null`).
 */
export function normalizeAddressDetails(input: AddressDetails | null | undefined): AddressDetails | null {
  if (!input) return null;
  const entries = ADDRESS_DETAIL_KEYS.map((key) => [key, input[key]?.trim()] as const).filter(
    (entry): entry is readonly [keyof AddressDetails, string] => typeof entry[1] === 'string' && entry[1].length > 0,
  );
  return entries.length > 0 ? (Object.fromEntries(entries) as AddressDetails) : null;
}
