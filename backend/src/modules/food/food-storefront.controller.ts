import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FoodService } from './food.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';

@ApiTags('Food (storefront)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PASSENGER)
@Controller('food')
export class FoodStorefrontController {
  constructor(private readonly foodService: FoodService) {}

  @Get('restaurants')
  @ApiOperation({ summary: 'List active restaurants' })
  listRestaurants() {
    return this.foodService.listActiveRestaurants();
  }

  @Get('orders')
  @ApiOperation({ summary: 'My food order history' })
  listMyOrders(@CurrentUser() user: User) {
    return this.foodService.listCustomerOrders(user.id);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'My food order detail' })
  getMyOrder(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.foodService.getCustomerOrder(user.id, id);
  }

  @Get('restaurants/:id')
  @ApiOperation({ summary: 'Restaurant detail with categories and dishes' })
  getRestaurant(@Param('id', ParseUUIDPipe) id: string) {
    return this.foodService.getRestaurantDetail(id);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Place a food order' })
  createOrder(@CurrentUser() user: User, @Body() dto: CreateFoodOrderDto) {
    return this.foodService.createOrder(user.id, user.phone, dto);
  }
}
