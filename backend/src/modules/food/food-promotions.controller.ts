import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { PromotionVendorType } from '../../database/entities/promotion.entity';
import { PromotionsService } from '../promotions/promotions.service';
import { CreatePromotionDto, UpdatePromotionDto } from '../promotions/dto/promotion.dto';
import { FoodService } from './food.service';

/** Restoran aksiyalari (docs/specs/food-market-ux-v5.md §4) — faqat o'z restorani. */
@ApiTags('Food (vendor)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RESTAURANT)
@Controller('food/vendor/promotions')
export class FoodPromotionsController {
  constructor(
    private readonly foodService: FoodService,
    private readonly promotionsService: PromotionsService,
  ) {}

  private async restaurantId(user: User): Promise<string> {
    return (await this.foodService.getRestaurantByOwner(user.id)).id;
  }

  @Get()
  @ApiOperation({ summary: 'Mening aksiyalarim' })
  async list(@CurrentUser() user: User) {
    return this.promotionsService.listForVendor(PromotionVendorType.RESTAURANT, await this.restaurantId(user));
  }

  @Post()
  @ApiOperation({ summary: 'Aksiya yaratish' })
  async create(@CurrentUser() user: User, @Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(PromotionVendorType.RESTAURANT, await this.restaurantId(user), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Aksiyani tahrirlash' })
  async update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto) {
    return this.promotionsService.update(PromotionVendorType.RESTAURANT, await this.restaurantId(user), id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Aksiyani o'chirish" })
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.remove(PromotionVendorType.RESTAURANT, await this.restaurantId(user), id);
  }
}
