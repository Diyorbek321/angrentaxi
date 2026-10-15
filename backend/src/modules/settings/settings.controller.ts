import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { UpdateGlobalSettingsDto } from './dto/update-global-settings.dto';
import { UpdateTripOptionFeesDto } from './dto/update-trip-option-fees.dto';
import { UpdateLegalComplianceDto } from './dto/update-legal-compliance.dto';
import { UpdateLaunchPromoDto } from './dto/update-launch-promo.dto';
import { UpdateVendorSettlementDto } from './dto/update-vendor-settlement.dto';
import { UpdateShiftPassSettingsDto } from './dto/update-shift-pass-settings.dto';
import { UpdateWalletTopupDto } from './dto/update-wallet-topup.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, UserRole } from '../../database/entities/user.entity';

@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('commission')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.TARIFFS_MANAGE)
  @ApiOperation({ summary: 'Get the platform default commission rate (manager/admin only)' })
  async getCommission() {
    return this.settingsService.getCommissionSettings();
  }

  @Patch('commission')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set the platform default commission rate (admin only)' })
  async updateCommission(@Body() dto: UpdateCommissionDto) {
    return this.settingsService.setDefaultCommissionRate(dto.defaultCommissionRate);
  }

  /**
   * Ishga tushirish aksiyasi (`launchPromoCommissionUntil`): shu sanagacha
   * taksi haydovchilaridan komissiya olinmaydi. Javob — `GET commission`
   * bilan bir xil shakl.
   */
  @Patch('commission/launch-promo')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set/clear the launch promo (0% taxi commission until a date) (admin only)' })
  async updateLaunchPromo(@Body() dto: UpdateLaunchPromoDto) {
    return this.settingsService.setLaunchPromoCommissionUntil(dto.launchPromoCommissionUntil);
  }

  /** VMQ 200 / PQ-247 sozlamalari — docs/LEGAL-COMPLIANCE.md. */
  @Get('legal-compliance')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Legal compliance settings: enforcement date, driver rules, tax withholding' })
  async getLegalCompliance() {
    return this.settingsService.getLegalComplianceSettings();
  }

  @Patch('legal-compliance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update legal compliance settings (admin only)' })
  async updateLegalCompliance(@Body() dto: UpdateLegalComplianceDto) {
    return this.settingsService.updateLegalComplianceSettings(dto);
  }

  /**
   * The subset of settings any signed-in customer app needs.
   *
   * The delivery fee in particular used to be a hardcoded constant in the
   * Flutter app (`SuperappProvider._deliveryFee = 7000`), so changing it
   * required a new app release and, until every user updated, the checkout
   * total disagreed with the order the server actually recorded.
   *
   * Deliberately excludes `maintenanceMode` and anything else operational —
   * those stay on the manager/admin endpoint below.
   */
  @Get('public')
  @ApiOperation({
    summary:
      'Customer/courier/vendor settings: support contact, delivery fee, cash limit, effective vendor settlement mode',
  })
  async getPublic() {
    // `vendorSettlementMode` — AMALDAGI rejim ('cash' | 'wallet'): kuryer va
    // sotuvchi ilovalari "To'ladim"/"Oldim" tugmalarini shunga qarab ko'rsatadi.
    return this.settingsService.getPublicSettings();
  }

  /** Sotuvchi bilan hisob-kitob rejimi — docs/LEGAL-COMPLIANCE.md §7. */
  @Get('vendor-settlement')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vendor settlement mode (cash | wallet) and the wallet-mandatory date' })
  async getVendorSettlement() {
    return this.settingsService.getVendorSettlementSettings();
  }

  @Patch('vendor-settlement')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update vendor settlement mode / date (admin only)' })
  async updateVendorSettlement(@Body() dto: UpdateVendorSettlementDto) {
    return this.settingsService.updateVendorSettlementSettings(dto);
  }

  /** Smena (kunlik obuna) — docs/LEGAL-COMPLIANCE.md §8. */
  @Get('shift-pass')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Driver shift pass settings (enabled, price, duration, service types)' })
  async getShiftPass() {
    return this.settingsService.getShiftPassSettings();
  }

  @Patch('shift-pass')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update driver shift pass settings (admin only)' })
  async updateShiftPass(@Body() dto: UpdateShiftPassSettingsDto) {
    return this.settingsService.updateShiftPassSettings(dto);
  }

  /** Hamyonni Payme/Click orqali to'ldirish — docs/LEGAL-COMPLIANCE.md §11. */
  @Get('wallet-topup')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Driver/courier wallet self top-up settings (enabled, min, max, presets)' })
  async getWalletTopup() {
    return this.settingsService.getWalletTopupSettings();
  }

  @Patch('wallet-topup')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update wallet self top-up settings (admin only)' })
  async updateWalletTopup(@Body() dto: UpdateWalletTopupDto) {
    return this.settingsService.updateWalletTopupSettings(dto);
  }

  /**
   * Safar opsiyalari haqi. Har qanday kirgan foydalanuvchi o'qiydi —
   * yo'lovchi ilovasi opsiya yonida "+5 000 so'm" ni ko'rsatadi.
   */
  @Get('trip-option-fees')
  @ApiOperation({ summary: 'Trip option surcharges, so\'m (child seat, pet...)' })
  async getTripOptionFees() {
    return this.settingsService.getTripOptionFees();
  }

  /**
   * Menejer belgilaydi (biznes qarori, 2026-10-09). Tarif kabi admin
   * tasdig'idan o'tmaydi: bu kichik qat'iy summa, foiz yoki koeffitsient emas.
   */
  @Patch('trip-option-fees')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.TARIFFS_MANAGE)
  @ApiOperation({ summary: 'Set trip option surcharges (manager/admin)' })
  async updateTripOptionFees(@Body() dto: UpdateTripOptionFeesDto) {
    return this.settingsService.updateTripOptionFees(dto);
  }

  @Get('global')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get platform name/support contact/maintenance-mode flag (manager/admin only)' })
  async getGlobal() {
    return this.settingsService.getGlobalSettings();
  }

  @Patch('global')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update platform name/support contact/maintenance-mode flag (admin only)' })
  async updateGlobal(@Body() dto: UpdateGlobalSettingsDto) {
    return this.settingsService.updateGlobalSettings(dto);
  }
}
