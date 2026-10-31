import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { RoadSpeedQueryDto } from './dto/road-speed-query.dto';
import { RoadSpeedService, ZoneSpeedProfile } from './road-speed.service';

/**
 * Yig'ilgan yo'l tezligi profilini o'qish.
 *
 * FAQAT menejer/admin. Bu — shahar bo'yicha operatsion ma'lumot (qaysi zona
 * qachon tirband), haydovchiga ham, yo'lovchiga ham kerak emas; ochiq
 * qoldirilsa raqobatchiga Angrendagi trafik xaritasini tayyor holda berib
 * qo'ygan bo'lardik.
 *
 * Javob global interceptor bilan `{ success: true, data: {...} }` ga o'raladi
 * — chaqiruvchi `data` ni ochishi shart.
 */
@ApiTags('Road Speed')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('road-speed')
export class RoadSpeedController {
  constructor(private readonly roadSpeedService: RoadSpeedService) {}

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Zona va vaqt bo'yicha o'rtacha tezlik (menejer/admin)",
  })
  @ApiOkResponse({
    description:
      "Zona profili. Namuna yo'q bo'lsa `averageSpeedKmh` — null (nol emas)",
  })
  async profile(@Query() query: RoadSpeedQueryDto): Promise<ZoneSpeedProfile> {
    const now = RoadSpeedService.slotFor(new Date());

    return this.roadSpeedService.profileFor(
      RoadSpeedService.zoneFor(query.lat, query.lng),
      query.dayOfWeek ?? now.dayOfWeek,
      query.hourOfDay ?? now.hourOfDay,
    );
  }
}
