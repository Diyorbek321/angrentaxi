import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class RejectOrderDto {
  @ApiProperty({ example: 'Ingredientlar tugagan' })
  @IsString()
  @MaxLength(200)
  reason: string;
}
