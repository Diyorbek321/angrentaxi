import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FoodService } from './food.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { CreateMenuCategoryDto, UpdateMenuCategoryDto } from './dto/category.dto';
import { CreateDishDto, UpdateDishDto } from './dto/dish.dto';
import { RejectOrderDto } from './dto/reject-order.dto';

@ApiTags('Food (vendor)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RESTAURANT)
@Controller('food/vendor')
export class FoodVendorController {
  constructor(private readonly foodService: FoodService) {}

  @Get('restaurant')
  @ApiOperation({ summary: 'Get my restaurant profile' })
  getRestaurant(@CurrentUser() user: User) {
    return this.foodService.getRestaurantByOwner(user.id);
  }

  @Patch('restaurant')
  @ApiOperation({ summary: 'Update my restaurant settings' })
  updateRestaurant(@CurrentUser() user: User, @Body() dto: UpdateRestaurantDto) {
    return this.foodService.updateRestaurant(user.id, dto);
  }

  @Patch('restaurant/toggle-open')
  @ApiOperation({ summary: 'Toggle open/closed status' })
  toggleOpen(@CurrentUser() user: User) {
    return this.foodService.toggleOpen(user.id);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Vendor dashboard summary' })
  async getDashboard(@CurrentUser() user: User) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.getDashboard(restaurant.id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Vendor sales reports' })
  async getReports(@CurrentUser() user: User, @Query('range') range?: string) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    const rangeDays = range === '30' ? 30 : 7;
    return this.foodService.getReports(restaurant.id, rangeDays);
  }

  // ---------- categories ----------

  @Get('categories')
  @ApiOperation({ summary: 'List my menu categories' })
  async listCategories(@CurrentUser() user: User) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.listCategories(restaurant.id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a menu category' })
  async createCategory(@CurrentUser() user: User, @Body() dto: CreateMenuCategoryDto) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.createCategory(restaurant.id, dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a menu category' })
  async updateCategory(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.updateCategory(restaurant.id, id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a menu category' })
  async deleteCategory(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    await this.foodService.deleteCategory(restaurant.id, id);
    return { deleted: true };
  }

  // ---------- dishes ----------

  @Get('dishes')
  @ApiOperation({ summary: 'List my dishes' })
  async listDishes(@CurrentUser() user: User) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.listDishes(restaurant.id);
  }

  @Post('dishes')
  @ApiOperation({ summary: 'Create a dish' })
  async createDish(@CurrentUser() user: User, @Body() dto: CreateDishDto) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.createDish(restaurant.id, dto);
  }

  @Patch('dishes/:id')
  @ApiOperation({ summary: 'Update a dish (price, availability, etc.)' })
  async updateDish(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDishDto,
  ) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.updateDish(restaurant.id, id, dto);
  }

  @Delete('dishes/:id')
  @ApiOperation({ summary: 'Delete a dish' })
  async deleteDish(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    await this.foodService.deleteDish(restaurant.id, id);
    return { deleted: true };
  }

  // ---------- orders ----------

  @Get('orders')
  @ApiOperation({ summary: 'List all orders for my restaurant (kanban)' })
  async listOrders(@CurrentUser() user: User) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.listOrders(restaurant.id);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order detail' })
  async getOrder(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.getOrder(restaurant.id, id);
  }

  @Patch('orders/:id/accept')
  @ApiOperation({ summary: 'Accept a new order' })
  async acceptOrder(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.acceptOrder(restaurant.id, id);
  }

  @Patch('orders/:id/advance')
  @ApiOperation({ summary: 'Advance order to the next status' })
  async advanceOrder(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.advanceOrder(restaurant.id, id);
  }

  @Patch('orders/:id/reject')
  @ApiOperation({ summary: 'Reject an order with a reason' })
  async rejectOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
  ) {
    const restaurant = await this.foodService.getRestaurantByOwner(user.id);
    return this.foodService.rejectOrder(restaurant.id, id, dto.reason);
  }
}
