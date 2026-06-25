import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethod } from '../../../database/entities/order.entity';

export class InitiatePaymentDto {
  @ApiProperty({ example: 'uuid', description: 'Order ID to pay for' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: [PaymentMethod.CARD], description: 'Payment method (card only for online)' })
  @IsEnum([PaymentMethod.CARD])
  method: PaymentMethod.CARD;
}
