import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, PASSENGER_APP_ROLES } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CreateMarketOrderDto } from './dto/create-market-order.dto';
import { OptionalPaginationDto } from '../../common/dto/optional-pagination.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { CancelVendorOrderDto } from '../../common/dto/cancel-vendor-order.dto';

@ApiTags('Market (storefront)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PASSENGER_APP_ROLES)
@Controller('market')
export class MarketStorefrontController {
  constructor(private readonly marketService: MarketService) {}

  @Get('stores')
  @ApiOperation({ summary: 'List active market stores' })
  listStores() {
    return this.marketService.listActiveStores();
  }

  @Get('trending')
  @ApiOperation({ summary: "Bosh sahifa: trenddagi mahsulotlar (7 kunlik sotuv, so'ng yangilari)" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listTrending(@Query() pagination: OptionalPaginationDto) {
    return this.marketService.listTrendingProducts(pagination.page, pagination.limit);
  }

  @Get('products/search')
  @ApiOperation({ summary: "Barcha ochiq do'konlar bo'yicha mahsulot qidiruvi" })
  searchProducts(@Query() dto: SearchProductsDto) {
    return this.marketService.searchProducts(dto.q, dto.page, dto.limit);
  }

  // Pagination is optional on purpose: the mobile client calls this with no
  // query string and expects a plain array back, so the parameters only exist
  // for callers that want to page further back than the default window.
  @Get('orders')
  @ApiOperation({ summary: 'My market order history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listMyOrders(@CurrentUser() user: User, @Query() pagination: OptionalPaginationDto) {
    return this.marketService.listCustomerOrders(user.id, pagination.page, pagination.limit);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'My market order detail' })
  getMyOrder(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.marketService.getCustomerOrder(user.id, id);
  }

  @Get('stores/:id')
  @ApiOperation({ summary: 'Store detail with categories and products' })
  getStore(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketService.getStoreDetail(id);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Place a market order' })
  createOrder(@CurrentUser() user: User, @Body() dto: CreateMarketOrderDto) {
    return this.marketService.createOrder(user.id, user.phone, dto);
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel my market order (only before the vendor accepts it)' })
  cancelMyOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelVendorOrderDto,
  ) {
    return this.marketService.cancelByCustomer(user.id, id, dto.reason);
  }
}
