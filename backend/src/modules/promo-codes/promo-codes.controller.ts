import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PromoCodesService, ValidatePromoResult } from './promo-codes.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { PromoCode } from '../../database/entities/promo_code.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Promo Codes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post('validate')
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: 'Validate a promo code against an order amount' })
  @ApiResponse({ status: 200, description: 'Promo code is valid, returns discount info' })
  @ApiResponse({ status: 400, description: 'Promo code is invalid or conditions not met' })
  async validatePromo(
    @CurrentUser() user: User,
    @Body() dto: ValidatePromoDto,
  ): Promise<ValidatePromoResult> {
    return this.promoCodesService.validate(dto.code, user.id, dto.orderAmount);
  }

  @Get('active')
  @ApiOperation({ summary: 'List currently-active, usable promo codes' })
  @ApiResponse({ status: 200, description: 'List of active promo codes' })
  async findActive(): Promise<PromoCode[]> {
    return this.promoCodesService.findActive();
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List all promo codes (manager/admin only)' })
  @ApiResponse({ status: 200, description: 'List of all promo codes' })
  async findAll(): Promise<PromoCode[]> {
    return this.promoCodesService.findAll();
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new promo code (manager/admin only)' })
  @ApiResponse({ status: 201, description: 'Promo code created' })
  @ApiResponse({ status: 400, description: 'Promo code already exists' })
  async create(@Body() dto: CreatePromoCodeDto): Promise<PromoCode> {
    return this.promoCodesService.create(dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate a promo code (admin only)' })
  @ApiParam({ name: 'id', description: 'Promo code UUID' })
  @ApiResponse({ status: 200, description: 'Promo code deactivated' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<PromoCode> {
    return this.promoCodesService.deactivate(id);
  }
}
