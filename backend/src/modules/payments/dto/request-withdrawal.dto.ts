import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestWithdrawalDto {
  @ApiProperty({ example: 150000, description: 'Amount to withdraw (must not exceed wallet balance)' })
  @IsNumber()
  @IsPositive()
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
