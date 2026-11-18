import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import {
  AdminShiftPassList,
  MyShiftPassInfo,
  ShiftPassCancelResult,
  ShiftPassView,
  ShiftPassesService,
} from './shift-passes.service';
import { ShiftPassRangeQueryDto } from './dto/shift-pass-range-query.dto';
import { CancelShiftPassDto } from './dto/cancel-shift-pass.dto';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

const DEFAULT_ADMIN_RANGE_DAYS = 30;

/** Haydovchi smenasi (kunlik obuna) — docs/LEGAL-COMPLIANCE.md §8. */
@ApiTags('Drivers — shift pass')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers/me/shift-pass')
export class DriverShiftPassController {
  constructor(private readonly shiftPasses: ShiftPassesService) {}

  @Get()
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'My current shift pass, price/enabled info and a 7-day commission comparison' })
  getMine(@CurrentUser() user: User): Promise<MyShiftPassInfo> {
    return this.shiftPasses.getMine(user.id);
  }

  @Post()
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Buy a shift pass from the wallet (no commission on covered rides while active)' })
  buy(@CurrentUser() user: User): Promise<ShiftPassView> {
    return this.shiftPasses.buy(user.id);
  }
}

@ApiTags('Shift passes (admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/shift-passes')
export class AdminShiftPassesController {
  constructor(private readonly shiftPasses: ShiftPassesService) {}

  @Get()
  @ApiOperation({ summary: 'Shift passes started within [from, to] + totals (admin only)' })
  list(@Query() query: ShiftPassRangeQueryDto): Promise<AdminShiftPassList> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_ADMIN_RANGE_DAYS * 24 * 60 * 60 * 1000);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException("'from' sanasi 'to' dan keyin bo'lishi mumkin emas");
    }
    return this.shiftPasses.listForAdmin(from, to, { page: query.page, limit: query.limit });
  }

  /** §15: bekor qilish, ixtiyoriy pro-rata qaytarim; amallar jurnaliga yoziladi. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a shift pass (optional pro-rata refund to the wallet), audit-logged (admin only)' })
  cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelShiftPassDto,
  ): Promise<ShiftPassCancelResult> {
    return this.shiftPasses.cancel(user.id, id, dto);
  }
}
