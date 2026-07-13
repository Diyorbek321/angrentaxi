import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendTripMessageDto {
  @ApiProperty({ example: '5 daqiqada yetib boraman' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;
}
