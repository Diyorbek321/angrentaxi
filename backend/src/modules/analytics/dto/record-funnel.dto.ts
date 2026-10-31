import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn } from 'class-validator';
import { ANALYTICS_APPS, AnalyticsApp, APP_FUNNEL_STEPS, AppFunnelStep } from '../analytics.constants';

export class RecordFunnelDto {
  @ApiProperty({ enum: ANALYTICS_APPS })
  @IsIn(ANALYTICS_APPS)
  app: AnalyticsApp;

  @ApiProperty({ enum: APP_FUNNEL_STEPS, isArray: true })
  @IsArray()
  @ArrayMaxSize(APP_FUNNEL_STEPS.length)
  @IsIn(APP_FUNNEL_STEPS, { each: true })
  steps: AppFunnelStep[];
}
