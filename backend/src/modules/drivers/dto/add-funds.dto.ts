import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, Matches, Max, MaxLength, Min, NotEquals } from 'class-validator';

const NOTE_REQUIRED = "Izoh majburiy: balans nima sababdan o'zgarayotganini yozing";

export class AddFundsDto {
  @ApiProperty({ example: 50000, description: "Amount to add in UZS (negative for a manual correction)" })
  // So'm — butun son; bitta tuzatish ±5 000 000 dan oshmaydi (security review #6).
  // Menejer chegarasi (`manualAdjustmentManagerLimit`) servisda — 403.
  @IsNumber({ maxDecimalPlaces: 0 }, { message: "Summa butun so'mda bo'lishi kerak" })
  @NotEquals(0)
  @Min(-5_000_000)
  @Max(5_000_000)
  amount: number;

  // Majburiy (docs/LEGAL-COMPLIANCE.md §12): amallar jurnaliga va
  // haydovchiga yuboriladigan push matniga tushadi.
  @ApiProperty({ example: "Naqd pul orqali to'ldirildi", maxLength: 200 })
  // Yo'q izoh — bo'sh satr: mijozga bitta aniq xato ("Izoh majburiy"), uchta emas.
  @Transform(({ value }: { value: unknown }) => (value === undefined || value === null ? '' : value))
  @IsString({ message: NOTE_REQUIRED })
  @Matches(/\S/, { message: NOTE_REQUIRED })
  @MaxLength(200, { message: 'Izoh 200 belgidan oshmasin' })
  note: string = '';
}
