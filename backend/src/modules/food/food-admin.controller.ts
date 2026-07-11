import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FoodService } from './food.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CreateRestaurantAdminDto } from './dto/create-restaurant-admin.dto';
import { SetRestaurantStatusDto } from './dto/set-restaurant-status.dto';

@ApiTags('Food (admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('food/admin')
export class FoodAdminController {
  constructor(private readonly foodService: FoodService) {}

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

  @Patch('restaurants/:id/status')
  @ApiOperation({ summary: "Set a restaurant's active/closed status (admin only)" })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRestaurantStatusDto) {
    return this.foodService.adminSetRestaurantStatus(id, dto.status);
  }
}
