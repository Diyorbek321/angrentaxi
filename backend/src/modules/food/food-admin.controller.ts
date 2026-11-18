import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FoodService } from './food.service';
import { CatalogImageService } from '../storage/catalog-image.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorTinService } from '../vendor-tin/vendor-tin.service';
import { SetVendorTinDto } from '../vendor-tin/dto/set-vendor-tin.dto';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CatalogModerationQueryDto } from '../../common/dto/catalog-moderation-query.dto';
import { CreateRestaurantAdminDto } from './dto/create-restaurant-admin.dto';
import { SetRestaurantStatusDto } from './dto/set-restaurant-status.dto';

@ApiTags('Food (admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('food/admin')
export class FoodAdminController {
  constructor(
    private readonly foodService: FoodService,
    private readonly catalogImages: CatalogImageService,
    private readonly vendorTin: VendorTinService,
  ) {}

  @Get('restaurants')
  @ApiOperation({ summary: 'List all restaurants (admin only)' })
  listRestaurants() {
    return this.foodService.adminListRestaurants();
  }

  @Post('restaurants')
  @ApiOperation({ summary: 'Onboard a new restaurant vendor (admin only)' })
  createRestaurant(@Body() dto: CreateRestaurantAdminDto) {
    return this.foodService.adminCreateRestaurant(dto);
  }

  /** Fiskal chekdagi komitent STIR'i (9 raqam | null) — amallar jurnaliga yoziladi (`vendor.tin_update`). */
  @Patch('restaurants/:id/tin')
  @ApiOperation({ summary: "Set or clear a restaurant's TIN (9 digits | null), audit-logged (admin only)" })
  setTin(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetVendorTinDto,
  ) {
    return this.vendorTin.setTin(user.id, 'restaurant', id, dto.tin);
  }

  @Patch('restaurants/:id/status')
  @ApiOperation({ summary: "Set a restaurant's active/closed status (admin only)" })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRestaurantStatusDto) {
    return this.foodService.adminSetRestaurantStatus(id, dto.status);
  }

  @Get('dishes')
  @ApiOperation({ summary: 'List dishes across every restaurant, for moderation (admin only)' })
  listDishes(@Query() query: CatalogModerationQueryDto) {
    return this.foodService.adminListDishes(query);
  }

  @Delete('dishes/:id')
  @ApiOperation({ summary: 'Remove a dish (moderation — admin only)' })
  async deleteDish(@Param('id', ParseUUIDPipe) id: string) {
    const imageKey = await this.foodService.adminDeleteDish(id);
    await this.catalogImages.discard(imageKey);
  }
}
