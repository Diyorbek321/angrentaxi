import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PASSENGER_APP_ROLES } from '../../database/entities/user.entity';
import { ActivePromotionFeedItem, PromotionsService } from './promotions.service';
import { ActivePromotionsQueryDto } from './dto/promotion.dto';

@ApiTags('Promotions (storefront)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PASSENGER_APP_ROLES)
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('active')
  @ApiOperation({ summary: '"Chegirmalar" lentasi — faol aksiyalar, eng kattasi birinchi' })
  @ApiQuery({ name: 'serviceType', required: false, enum: ['food', 'market'] })
  active(@Query() query: ActivePromotionsQueryDto): Promise<ActivePromotionFeedItem[]> {
    return this.promotionsService.activeFeed(query.serviceType);
  }
}
