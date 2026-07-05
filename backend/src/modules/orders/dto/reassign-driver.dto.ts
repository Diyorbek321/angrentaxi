import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ReassignDriverDto {
  @ApiProperty({ description: 'Driver profile UUID to assign to this order' })
  @IsUUID()
  driverId: string;
}
