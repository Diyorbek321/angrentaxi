import {
  Controller,
  Get,
  GoneException,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { User } from '../../database/entities/user.entity';
import { CreatedShareLink, TripShareService } from './trip-share.service';
import { PublicTripView } from './trip-share-policy';
import { pickShareLang, renderShareErrorPage, renderSharePage } from './trip-share-page';

/** Ommaviy sahifa — begona IP'dan ko'p so'rov token terishga urinish bo'lishi mumkin. */
const PUBLIC_SHARE_THROTTLE = { short: { limit: 3, ttl: 1000 }, long: { limit: 30, ttl: 60000 } };

@ApiTags('Safety')
@Controller()
export class TripShareController {
  constructor(private readonly tripShare: TripShareService) {}

  @Post('orders/:orderId/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Throttle({ long: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Yo'lovchi: safarni ulashish havolasini yaratadi (faol safar)" })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  async create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ): Promise<CreatedShareLink> {
    return this.tripShare.create(orderId, user.id);
  }

  /** JSON — avtorizatsiyasiz, telefon raqamlarisiz. */
  @Get('share/:token/data')
  @Throttle(PUBLIC_SHARE_THROTTLE)
  @ApiOperation({ summary: "Ulashilgan safar holati (ommaviy, faqat o'qish)" })
  async data(@Param('token') token: string): Promise<PublicTripView> {
    return this.tripShare.view(token);
  }

  /** Brauzer sahifasi (oddiy HTML, JS'siz, o'zini yangilaydi). */
  @Get('share/:token')
  @Throttle(PUBLIC_SHARE_THROTTLE)
  @ApiExcludeEndpoint()
  async page(
    @Param('token') token: string,
    @Res() res: Response,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<void> {
    const l = pickShareLang(lang, acceptLanguage);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const view = await this.tripShare.view(token);
      res.type('html').send(renderSharePage(l, view));
    } catch (error) {
      if (error instanceof GoneException) {
        res.status(410).type('html').send(renderShareErrorPage(l, 'gone'));
        return;
      }
      if (error instanceof NotFoundException) {
        res.status(404).type('html').send(renderShareErrorPage(l, 'not_found'));
        return;
      }
      throw error;
    }
  }
}
