import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketService } from './market.service';
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
import { CreateStoreAdminDto } from './dto/create-store-admin.dto';
import { SetStoreStatusDto } from './dto/set-store-status.dto';

@ApiTags('Market (admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('market/admin')
export class MarketAdminController {
  constructor(
    private readonly marketService: MarketService,
    private readonly catalogImages: CatalogImageService,
    private readonly vendorTin: VendorTinService,
  ) {}

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

  /** Fiskal chekdagi komitent STIR'i (9 raqam | null) — amallar jurnaliga yoziladi (`vendor.tin_update`). */
  @Patch('stores/:id/tin')
  @ApiOperation({ summary: "Set or clear a store's TIN (9 digits | null), audit-logged (admin only)" })
  setTin(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetVendorTinDto,
  ) {
    return this.vendorTin.setTin(user.id, 'store', id, dto.tin);
  }

  @Patch('stores/:id/status')
  @ApiOperation({ summary: "Set a store's active/closed status (admin only)" })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetStoreStatusDto) {
    return this.marketService.adminSetStoreStatus(id, dto.status);
  }

  @Get('products')
  @ApiOperation({ summary: 'List products across every store, for moderation (admin only)' })
  listProducts(@Query() query: CatalogModerationQueryDto) {
    return this.marketService.adminListProducts(query);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Remove a product (moderation — admin only)' })
  async deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    const imageKey = await this.marketService.adminDeleteProduct(id);
    await this.catalogImages.discard(imageKey);
  }
}
