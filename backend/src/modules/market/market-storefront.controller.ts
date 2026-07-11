import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CreateMarketOrderDto } from './dto/create-market-order.dto';

@ApiTags('Market (storefront)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PASSENGER)
@Controller('market')
export class MarketStorefrontController {
  constructor(private readonly marketService: MarketService) {}

  @Get('stores')
  @ApiOperation({ summary: 'List active market stores' })
  listStores() {
    return this.marketService.listActiveStores();
  }

  @Get('orders')
  @ApiOperation({ summary: 'My market order history' })
  listMyOrders(@CurrentUser() user: User) {
    return this.marketService.listCustomerOrders(user.id);
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
}
