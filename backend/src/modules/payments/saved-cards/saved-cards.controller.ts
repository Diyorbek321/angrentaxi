import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import { PASSENGER_APP_ROLES, User } from '../../../database/entities/user.entity';
import { SavedCardsAvailability, SavedCardsService, SavedCardView } from './saved-cards.service';

export class AddSavedCardDto {
  @ApiProperty({ description: "Payme `cards.verify` qaytargan token (ilovada bog'langan)" })
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  // Token — ochiq matn; bo'shliq/boshqaruv belgisi bo'lmasligi kerak.
  @Matches(/^[\x21-\x7E]+$/)
  token: string;
}

/** Karta bog'lash urinishlari cheklangan — tokenlarni tanlab ko'rishga qarshi. */
const ADD_CARD_THROTTLE = { long: { limit: 10, ttl: 60 * 60 * 1000 } };

@ApiTags('Saved cards')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PASSENGER_APP_ROLES)
@Controller('payments/cards')
export class SavedCardsController {
  constructor(private readonly savedCards: SavedCardsService) {}

  @Get('availability')
  @ApiOperation({ summary: "Karta bog'lash yoqilganmi va ilova uchun Payme sozlamalari" })
  availability(): SavedCardsAvailability {
    return this.savedCards.availability();
  }

  @Get()
  @ApiOperation({ summary: 'Mening saqlangan kartalarim' })
  list(@CurrentUser() user: User): Promise<SavedCardView[]> {
    return this.savedCards.list(user.id);
  }

  @Post()
  @Throttle(ADD_CARD_THROTTLE)
  @ApiOperation({ summary: "Payme'da bog'langan kartani saqlash (token server tomonda tekshiriladi)" })
  @ApiResponse({ status: 400, description: 'SAVED_CARDS_UNAVAILABLE | SAVED_CARD_INVALID | SAVED_CARD_LIMIT' })
  add(@CurrentUser() user: User, @Body() dto: AddSavedCardDto): Promise<SavedCardView> {
    return this.savedCards.add(user.id, dto.token);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Asosiy karta qilish' })
  setDefault(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<SavedCardView> {
    return this.savedCards.setDefault(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Kartani o'chirish" })
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.savedCards.remove(user.id, id);
  }
}
