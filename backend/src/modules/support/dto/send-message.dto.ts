import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Salom, buyurtmam bilan muammo bor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}
