import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DELIVERY_ETA_MINUTES_MAX,
  DELIVERY_ETA_MINUTES_MIN,
} from '../delivery-pricing';
import { DELIVERY_INCIDENT_LIMITS as L } from '../delivery-incident-settings';
import { INCIDENT_SETTINGS_LIMITS as IL } from '../incident-settings';
import { SAFETY_POLICY_LIMITS as SL } from '../safety-policy-settings';

export class UpdateGlobalSettingsDto {
  @ApiPropertyOptional({ example: 'Angren Taxi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformName?: string;

  @ApiPropertyOptional({ example: '+998 71 200 00 00' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  supportPhone?: string;

  @ApiPropertyOptional({ example: 'support@angrentaxi.uz' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({
    description:
      'When true, MaintenanceGuard rejects all non-admin traffic with 503',
  })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({
    description: "Flat delivery fee added to every food/market order, in so'm",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @ApiPropertyOptional({
    description: "Naqd ovqat/market buyurtmasi chegarasi, so'm (undan katta — faqat karta)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCashVendorOrder?: number;

  @ApiPropertyOptional({
    example: 100000,
    description: "Bepul yetkazish chegarasi, so'm (tovar summasi aksiyadan keyin, promokoddan oldin); 0 — o'chiq",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeDeliveryFrom?: number;

  @ApiPropertyOptional({ example: 30, description: 'Yetkazish vaqti, eng kami (daqiqa)' })
  @IsOptional()
  @IsInt()
  @Min(DELIVERY_ETA_MINUTES_MIN)
  @Max(DELIVERY_ETA_MINUTES_MAX)
  deliveryEtaMinMinutes?: number;

  @ApiPropertyOptional({ example: 50, description: "Yetkazish vaqti, eng ko'pi (daqiqa); eng kamidan kichik emas" })
  @IsOptional()
  @IsInt()
  @Min(DELIVERY_ETA_MINUTES_MIN)
  @Max(DELIVERY_ETA_MINUTES_MAX)
  deliveryEtaMaxMinutes?: number;

  @ApiPropertyOptional({
    example: 15,
    description: "To'lanmagan kartali ovqat/market buyurtmasi shuncha daqiqadan keyin bekor qilinadi",
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  cardPaymentTimeoutMinutes?: number;

  @ApiPropertyOptional({ example: 1000000, description: "Posilka e'lon qilingan qiymati chegarasi, so'm" })
  @IsOptional()
  @IsInt()
  @Min(L.parcelMaxDeclaredValue.min)
  @Max(L.parcelMaxDeclaredValue.max)
  parcelMaxDeclaredValue?: number;

  @ApiPropertyOptional({ example: 5, description: "Manzilda bepul kutish, daqiqa" })
  @IsOptional()
  @IsInt()
  @Min(L.dropoffFreeWaitMinutes.min)
  @Max(L.dropoffFreeWaitMinutes.max)
  dropoffFreeWaitMinutes?: number;

  @ApiPropertyOptional({ example: 50, description: "Qaytarish haqi — yetkazish haqining foizi" })
  @IsOptional()
  @IsInt()
  @Min(L.returnFeePercent.min)
  @Max(L.returnFeePercent.max)
  returnFeePercent?: number;

  @ApiPropertyOptional({ example: 2, description: "Shuncha rad — ovqat/market naqd to'lovi o'chadi" })
  @IsOptional()
  @IsInt()
  @Min(L.refusalCashBlockCount.min)
  @Max(L.refusalCashBlockCount.max)
  refusalCashBlockCount?: number;

  @ApiPropertyOptional({ example: 30, description: "Rad etishlar sanaladigan oyna, kun" })
  @IsOptional()
  @IsInt()
  @Min(L.refusalWindowDays.min)
  @Max(L.refusalWindowDays.max)
  refusalWindowDays?: number;

  @ApiPropertyOptional({ example: 60, description: "IN_PROGRESS yetkazish shuncha daqiqadan oshsa signal" })
  @IsOptional()
  @IsInt()
  @Min(L.stuckDeliveryMinutes.min)
  @Max(L.stuckDeliveryMinutes.max)
  stuckDeliveryMinutes?: number;

  @ApiPropertyOptional({ example: 10, description: "Kuryer joylashuvi shuncha daqiqadan eski bo'lsa signal" })
  @IsOptional()
  @IsInt()
  @Min(L.staleCourierLocationMinutes.min)
  @Max(L.staleCourierLocationMinutes.max)
  staleCourierLocationMinutes?: number;

  @ApiPropertyOptional({ example: 7, description: "Shikoyat muddati — buyurtmadan keyin, kun" })
  @IsOptional()
  @IsInt()
  @Min(IL.incidentReportWindowDays.min)
  @Max(IL.incidentReportWindowDays.max)
  incidentReportWindowDays?: number;

  @ApiPropertyOptional({ example: 7, description: "E'tiroz muddati — natijadan keyin, kun" })
  @IsOptional()
  @IsInt()
  @Min(IL.incidentAppealWindowDays.min)
  @Max(IL.incidentAppealWindowDays.max)
  incidentAppealWindowDays?: number;

  @ApiPropertyOptional({ example: 3, description: "Vaqtincha to'xtatish standarti, kun" })
  @IsOptional()
  @IsInt()
  @Min(IL.suspensionDays.min)
  @Max(IL.suspensionDays.max)
  suspensionDays?: number;

  @ApiPropertyOptional({ example: 90, description: "Jarima zinapoyasi oynasi, kun" })
  @IsOptional()
  @IsInt()
  @Min(IL.strikeWindowDays.min)
  @Max(IL.strikeWindowDays.max)
  strikeWindowDays?: number;

  @ApiPropertyOptional({ example: 1, description: "Shuncha tasdiqlangan shikoyat — ogohlantirish" })
  @IsOptional()
  @IsInt()
  @Min(IL.strikeWarningAt.min)
  @Max(IL.strikeWarningAt.max)
  strikeWarningAt?: number;

  @ApiPropertyOptional({ example: 3, description: "Shuncha — to'xtatish" })
  @IsOptional()
  @IsInt()
  @Min(IL.strikeSuspensionAt.min)
  @Max(IL.strikeSuspensionAt.max)
  strikeSuspensionAt?: number;

  @ApiPropertyOptional({ example: 5, description: "Shuncha — blok (admin)" })
  @IsOptional()
  @IsInt()
  @Min(IL.strikeBlockAt.min)
  @Max(IL.strikeBlockAt.max)
  strikeBlockAt?: number;

  @ApiPropertyOptional({ example: 20, description: "Reyting signali: oxirgi shuncha baho" })
  @IsOptional()
  @IsInt()
  @Min(IL.ratingSignalWindow.min)
  @Max(IL.ratingSignalWindow.max)
  ratingSignalWindow?: number;

  @ApiPropertyOptional({ example: 4.3, description: "Reyting signali: o'rtacha shundan past" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(IL.ratingSignalThreshold.min)
  @Max(IL.ratingSignalThreshold.max)
  ratingSignalThreshold?: number;

  @ApiPropertyOptional({ example: 30, description: "Bitta haydovchiga signal shuncha kunda bir marta" })
  @IsOptional()
  @IsInt()
  @Min(IL.ratingSignalCooldownDays.min)
  @Max(IL.ratingSignalCooldownDays.max)
  ratingSignalCooldownDays?: number;

  @ApiPropertyOptional({ example: 2, description: "Shu bahodan past-teng + izoh — hodisa qoralamasi" })
  @IsOptional()
  @IsInt()
  @Min(IL.lowRatingIncidentMaxScore.min)
  @Max(IL.lowRatingIncidentMaxScore.max)
  lowRatingIncidentMaxScore?: number;

  @ApiPropertyOptional({ example: 30, description: "Ulashish havolasi safar tugagach shuncha daqiqa ochiq" })
  @IsOptional()
  @IsInt()
  @Min(SL.tripShareGraceMinutes.min)
  @Max(SL.tripShareGraceMinutes.max)
  tripShareGraceMinutes?: number;

  @ApiPropertyOptional({ example: 2, description: "Qabuldan shuncha daqiqa ichida bepul bekor qilish" })
  @IsOptional()
  @IsInt()
  @Min(SL.freeCancelMinutes.min)
  @Max(SL.freeCancelMinutes.max)
  freeCancelMinutes?: number;

  @ApiPropertyOptional({ example: 3000, description: "Kech bekor qilish jarimasi, so'm (haydovchiga)" })
  @IsOptional()
  @IsInt()
  @Min(SL.lateCancelFee.min)
  @Max(SL.lateCancelFee.max)
  lateCancelFee?: number;

  @ApiPropertyOptional({ example: 5, description: "Yetib kelgach shuncha daqiqadan keyin 'chiqmadi'" })
  @IsOptional()
  @IsInt()
  @Min(SL.noShowWaitMinutes.min)
  @Max(SL.noShowWaitMinutes.max)
  noShowWaitMinutes?: number;

  @ApiPropertyOptional({ example: 5000, description: "'Yo'lovchi chiqmadi' jarimasi, so'm (haydovchiga)" })
  @IsOptional()
  @IsInt()
  @Min(SL.noShowFee.min)
  @Max(SL.noShowFee.max)
  noShowFee?: number;

  @ApiPropertyOptional({ example: 3, description: "Haydovchi kunda shuncha bekor qilsa — signal" })
  @IsOptional()
  @IsInt()
  @Min(SL.driverCancelSignalCount.min)
  @Max(SL.driverCancelSignalCount.max)
  driverCancelSignalCount?: number;
}
