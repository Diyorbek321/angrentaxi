import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Bitta yechishning eng kichik summasi, so'm. 0,01 yoki 500 so'mlik so'rov
 * admin navbatini to'ldiradi va qo'lda o'tkazmada komissiyadan ham arzon.
 */
export const MIN_WITHDRAWAL_AMOUNT = 10_000;

/** Eng katta summa — `withdrawal_requests.amount` numeric(10,2) ostida. */
export const MAX_WITHDRAWAL_AMOUNT = 99_999_999;

export class RequestWithdrawalDto {
  @ApiProperty({
    example: 150000,
    minimum: MIN_WITHDRAWAL_AMOUNT,
    maximum: MAX_WITHDRAWAL_AMOUNT,
    description: "Amount to withdraw, whole so'm (must not exceed the withdrawable balance)",
  })
  // Butun so'm: kasr (0,01) tiyin yaxlitlash farqlarini daftarga olib kirardi.
  @IsInt()
  @Min(MIN_WITHDRAWAL_AMOUNT)
  @Max(MAX_WITHDRAWAL_AMOUNT)
  amount: number;

  @ApiProperty({
    example: '+998 90 123 45 67',
    description: 'Free-text payout target (card number or phone number for mobile money)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  payoutDestination: string;
}
