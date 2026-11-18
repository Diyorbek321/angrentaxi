import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { DriverServicesService, DriverServicesSummary } from './driver-services.service';
import { UpdateDriverServicesDto } from './dto/update-driver-services.dto';

/**
 * Haydovchining xizmat turlari (taksi / yuk / ovqat / market).
 *
 * ⚠️ `DriversController` dan ALOHIDA, lekin AYNI `drivers` prefiksida —
 * `DriverVerificationController` dagi bilan bir xil sabab: marshrutlar
 * kontraktda shunday kelishilgan. To'qnashuv yo'q, chunki bu yerdagi
 * yo'llar ikki bo'lakli, `DriversController` dagi `:id` esa bir bo'lakli.
 */
@ApiTags('Drivers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers')
export class DriverServicesController {
  constructor(private readonly servicesService: DriverServicesService) {}

  @Get('me/services')
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary:
      "Haydovchi qabul qiladigan xizmat turlari. Nom va izoh SERVERDAN keladi — ilovada tarjima jadvali yo'q.",
  })
  @ApiResponse({ status: 200, description: 'enabled[], options[]' })
  @ApiResponse({ status: 404, description: 'Haydovchi profili topilmadi' })
  async myServices(@CurrentUser() user: User): Promise<DriverServicesSummary> {
    return this.servicesService.getForUser(user.id);
  }

  @Patch('me/services')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Xizmat turlarini almashtirish (to'liq ro'yxat yuboriladi)" })
  @ApiResponse({ status: 200, description: 'Yangilangan ro‘yxat, GET bilan bir xil shaklda' })
  @ApiResponse({
    status: 400,
    description:
      "Bo'sh ro'yxat, tekshiruvdan o'tmagan tur, yoki o'chirilayotgan turda faol buyurtma bor",
  })
  async updateMyServices(
    @CurrentUser() user: User,
    @Body() dto: UpdateDriverServicesDto,
  ): Promise<DriverServicesSummary> {
    return this.servicesService.updateForUser(user.id, dto.serviceTypes);
  }
}
