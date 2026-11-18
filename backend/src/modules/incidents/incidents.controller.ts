import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Incident } from '../../database/entities/incident.entity';
import { PASSENGER_APP_ROLES, Permission, User, UserRole } from '../../database/entities/user.entity';
import { UploadedMemoryFile } from '../drivers/driver-uploads';
import { AppealIncidentDto, ListIncidentsQueryDto, ReportIncidentDto, ResolveIncidentDto, VERTICALS } from './dto/incident.dto';
import { AboutMeView, IncidentsService, ReporterIncidentView, SubjectIncidentView } from './incidents.service';
import { IncidentDetail, IncidentListItem, IncidentReviewService } from './incident-review.service';
import { IncidentResolutionService } from './incident-resolution.service';
import { IncidentPhotoFile, incidentPhotoMulterOptions } from './incident-photos';
import { ERROR_CODES, codedBadRequest } from '../../common/errors/coded-error';

const PARTY_ROLES = [...PASSENGER_APP_ROLES, UserRole.DRIVER];
const STAFF = [UserRole.MANAGER, UserRole.ADMIN];

function streamPhoto(res: Response, file: IncidentPhotoFile): void {
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  file.stream.pipe(res);
}

/** Foydalanuvchi tomoni: yo'lovchi/mijoz, haydovchi/kuryer, sotuvchi (INCIDENT-POLICY §3). */
@ApiTags('Incidents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post()
  @Roles(...PARTY_ROLES)
  @Throttle({ long: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Shikoyat qoldirish (buyurtma tugaganidan 7 kun ichida; safar davomida — faqat xavfsizlik)' })
  report(@CurrentUser() user: User, @Body() dto: ReportIncidentDto): Promise<Incident> {
    return this.incidents.report(user, dto);
  }

  @Post(':id/photos')
  @Roles(...PARTY_ROLES)
  @Throttle({ long: { limit: 20, ttl: 3_600_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', incidentPhotoMulterOptions))
  @ApiOperation({ summary: "Foto qo'shish (≤ 3, JPEG/PNG/WEBP, 5 MB)" })
  async addPhoto(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedMemoryFile,
  ): Promise<{ id: string; photoCount: number }> {
    const updated = await this.incidents.addPhoto(user.id, id, file);
    return { id: updated.id, photoCount: updated.photoKeys.length };
  }

  @Get('mine')
  @Roles(...PARTY_ROLES)
  @ApiOperation({ summary: '«Murojaatlarim» — men qoldirgan shikoyatlar va natijasi' })
  mine(@CurrentUser() user: User): Promise<ReporterIncidentView[]> {
    return this.incidents.listMine(user.id);
  }

  @Get('about-me')
  @Roles(...PARTY_ROLES)
  @ApiOperation({ summary: "Menga nisbatan: ogohlantirish/to'xtatish/blok, joriy to'xtatish, e'tiroz imkoni" })
  aboutMe(@CurrentUser() user: User): Promise<AboutMeView> {
    return this.incidents.aboutMe(user.id);
  }

  @Post(':id/appeal')
  @Roles(...PARTY_ROLES)
  @ApiOperation({ summary: "E'tiroz (bir marta, natijadan keyin 7 kun ichida) — admin hal qiladi" })
  appeal(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppealIncidentDto,
  ): Promise<SubjectIncidentView> {
    return this.incidents.appeal(user.id, id, dto.note);
  }

  @Get(':id/photos/:index')
  @Roles(...PARTY_ROLES)
  @ApiOperation({ summary: "O'z murojaatimdagi foto" })
  async photo(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @Res() res: Response,
  ): Promise<void> {
    streamPhoto(res, await this.incidents.openPhoto({ id: user.id, isStaff: false }, id, index));
  }
}

/** Menejer/admin navbati (`support_manage`). Pul natijalari — qo'shimcha `drivers_finance`. */
@ApiTags('Incidents (manager)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('manager/incidents')
export class ManagerIncidentsController {
  constructor(
    private readonly review: IncidentReviewService,
    private readonly resolution: IncidentResolutionService,
    private readonly incidents: IncidentsService,
  ) {}

  @Get()
  @Roles(...STAFF)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: "Navbat: holat/sabab/vertikal filtri, `status=active` — ochiq + ko'rilmoqda (eskisi birinchi)" })
  list(@Query() query: ListIncidentsQueryDto) {
    return this.review.list(query as never);
  }

  @Get('open-count')
  @Roles(...STAFF)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: 'Yon panel nishoni: ochiq hodisalar soni' })
  openCount(): Promise<{ count: number; escalated: number }> {
    return this.review.openCount();
  }

  @Get('by-order/:vertical/:orderId')
  @Roles(...STAFF)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: 'Buyurtma sahifasidagi «Hodisalar» bo\'limi' })
  byOrder(
    @Param('vertical') vertical: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<IncidentListItem[]> {
    if (!(VERTICALS as readonly string[]).includes(vertical)) {
      throw codedBadRequest(ERROR_CODES.incidentNotAllowed, "Noto'g'ri buyurtma turi");
    }
    return this.review.byOrder(vertical as (typeof VERTICALS)[number], orderId);
  }

  @Post()
  @Roles(...STAFF)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: "Menejer o'zi hodisa ochadi (muddat cheklovisiz)" })
  create(@CurrentUser() user: User, @Body() dto: ReportIncidentDto): Promise<Incident> {
    return this.review.createByManager(user, dto);
  }

  @Get(':id')
  @Roles(...STAFF)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: 'Hodisa: dalillar (buyurtma, baholar, SOS, yo\'qolgan buyum), jarima zinapoyasi taklifi' })
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentDetail> {
    return this.review.detail(id);
  }

  @Post(':id/assign')
  @Roles(...STAFF)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: 'Menga olish — open → investigating' })
  assign(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<Incident> {
    return this.review.assignToMe(user.id, id);
  }

  @Post(':id/resolve')
  @Roles(...STAFF)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: 'Hal qilish / rad etish: izoh majburiy, natijalar audit + daftar bilan bitta tranzaksiyada' })
  resolve(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveIncidentDto,
  ): Promise<Incident> {
    return this.resolution.resolve(user, id, dto);
  }

  @Get(':id/photos/:index')
  @Roles(...STAFF)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  async photo(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @Res() res: Response,
  ): Promise<void> {
    streamPhoto(res, await this.incidents.openPhoto({ id: '', isStaff: true }, id, index));
  }
}
