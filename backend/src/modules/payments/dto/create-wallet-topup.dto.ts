import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { WalletTopupProvider } from '../../../database/entities/wallet-topup.entity';
import { WALLET_TOPUP_PROVIDERS } from '../wallet-topups.service';

export class CreateWalletTopupDto {
  @ApiProperty({
    example: 100000,
    description: "So'm, butun son. Chegaralar — `GET /settings/public` dagi walletTopupMin/Max",
  })
  @IsInt({ message: "Summa butun son bo'lishi kerak" })
  @Min(1, { message: "Summa musbat bo'lishi kerak" })
  @Max(100_000_000)
  amount: number;

  @ApiProperty({ enum: WALLET_TOPUP_PROVIDERS, example: 'payme' })
  @IsIn(WALLET_TOPUP_PROVIDERS as unknown as string[], {
    message: "To'lov tizimi: payme, click yoki uzcard",
  })
  provider: WalletTopupProvider;
}
