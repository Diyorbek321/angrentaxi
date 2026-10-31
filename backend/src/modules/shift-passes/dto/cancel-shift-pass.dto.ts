import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export class CancelShiftPassDto {
  @ApiProperty({
    description: "true — qolgan vaqt uchun pro-rata qaytarim hamyonga: floor(narx × qolgan / davomiylik)",
  })
  @IsBoolean()
  refund: boolean;

  @ApiProperty({ example: 'Texnik nosozlik tufayli', maxLength: 500 })
  @IsString({ message: 'Sabab majburiy' })
  @Matches(/\S/, { message: 'Sabab majburiy' })
  @MaxLength(500)
  reason: string;
}
