import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CreateStoreAdminDto } from './dto/create-store-admin.dto';
import { SetStoreStatusDto } from './dto/set-store-status.dto';

@ApiTags('Market (admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('market/admin')
export class MarketAdminController {
  constructor(private readonly marketService: MarketService) {}

  @Get('stores')
  @ApiOperation({ summary: 'List all Market stores (admin only)' })
  listStores() {
    return this.marketService.adminListStores();
  }

  @Post('stores')
  @ApiOperation({ summary: 'Onboard a new Market vendor + store (admin only)' })
  createStore(@Body() dto: CreateStoreAdminDto) {
    return this.marketService.adminCreateStore(dto);
  }

  @Patch('stores/:id/status')
  @ApiOperation({ summary: "Set a store's active/closed status (admin only)" })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetStoreStatusDto) {
    return this.marketService.adminSetStoreStatus(id, dto.status);
  }

  @Get('products')
  @ApiOperation({ summary: 'List products across every store, for moderation (admin only)' })
  listProducts() {
    return this.marketService.adminListProducts();
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Remove a product (moderation — admin only)' })
  deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketService.adminDeleteProduct(id);
  }
}
