import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { OptionalEnumPipe } from '../../common/pipes/optional-enum.pipe';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { BulkUpdateProductsDto } from './dto/bulk-update-products.dto';
import { MarketOrderStatus } from '../../database/entities/market-order.entity';

@ApiTags('Market (vendor)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MARKET)
@Controller('market/vendor')
export class MarketVendorController {
  constructor(private readonly marketService: MarketService) {}

  @Get('store')
  @ApiOperation({ summary: 'Get my store profile' })
  getStore(@CurrentUser() user: User) {
    return this.marketService.getStoreByOwner(user.id);
  }

  @Patch('store')
  @ApiOperation({ summary: 'Update my store settings' })
  async updateStore(@CurrentUser() user: User, @Body() dto: UpdateStoreDto) {
    return this.marketService.updateStore(user.id, dto);
  }

  @Get('dashboard')
  @ApiOperation({ summary: "Vendor dashboard summary" })
  async getDashboard(@CurrentUser() user: User) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.getDashboard(store.id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Vendor sales reports' })
  async getReports(@CurrentUser() user: User) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.getReports(store.id);
  }

  // ---------- categories ----------

  @Get('categories')
  @ApiOperation({ summary: 'List my categories' })
  async listCategories(@CurrentUser() user: User) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.listCategories(store.id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a category' })
  async createCategory(@CurrentUser() user: User, @Body() dto: CreateCategoryDto) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.createCategory(store.id, dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  async updateCategory(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.updateCategory(store.id, id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category' })
  async deleteCategory(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const store = await this.marketService.getStoreByOwner(user.id);
    await this.marketService.deleteCategory(store.id, id);
    return { deleted: true };
  }

  // ---------- products ----------

  @Get('products')
  @ApiOperation({ summary: 'List my products' })
  async listProducts(@CurrentUser() user: User) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.listProducts(store.id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a product' })
  async createProduct(@CurrentUser() user: User, @Body() dto: CreateProductDto) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.createProduct(store.id, dto);
  }

  @Patch('products/bulk-status')
  @ApiOperation({ summary: 'Bulk activate/hide products' })
  async bulkUpdateProducts(@CurrentUser() user: User, @Body() dto: BulkUpdateProductsDto) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.bulkUpdateProductStatus(store.id, dto);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a product (price, stock, status, etc.)' })
  async updateProduct(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.updateProduct(store.id, id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete a product' })
  async deleteProduct(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const store = await this.marketService.getStoreByOwner(user.id);
    await this.marketService.deleteProduct(store.id, id);
    return { deleted: true };
  }

  @Get('stock/movements')
  @ApiOperation({ summary: 'Recent stock movements' })
  async listStockMovements(@CurrentUser() user: User) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.listStockMovements(store.id);
  }

  // ---------- orders ----------

  @Get('orders')
  @ApiOperation({ summary: 'List orders for my store' })
  async listOrders(
    @CurrentUser() user: User,
    @Query('status', new OptionalEnumPipe(MarketOrderStatus, 'status'))
    status?: MarketOrderStatus,
  ) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.listOrders(store.id, status);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order detail' })
  async getOrder(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.getOrder(store.id, id);
  }

  @Patch('orders/:id/items/:index/toggle-pack')
  @ApiOperation({ summary: 'Toggle packed state of an order item' })
  async togglePack(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index') index: string,
  ) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.togglePackItem(store.id, id, Number(index));
  }

  @Patch('orders/:id/advance')
  @ApiOperation({ summary: 'Advance order to the next status' })
  async advanceOrder(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const store = await this.marketService.getStoreByOwner(user.id);
    return this.marketService.advanceOrder(store.id, id);
  }
}
