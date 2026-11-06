import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AdsService } from './ads.service';
import { AdDailyRow } from './ad-daily-series';
import { adImageMulterOptions } from './ad-images';
import { CreateAdBannerDto } from './dto/create-ad-banner.dto';
import { UpdateAdBannerDto } from './dto/update-ad-banner.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { UserRole } from '../../database/entities/user.entity';
import { AdBanner } from '../../database/entities/ad-banner.entity';
import type { UploadedMemoryFile } from '../drivers/driver-uploads';

// Hisoblagichlar uchun: karusel har bannerni sessiyada bir marta hisoblaydi,
// ya'ni normal foydalanuvchi daqiqasiga 10 tadan oshmaydi. Undan ko'pi —
// reklama beruvchi hisobotini sun'iy shishirish urinishi.
const COUNTER_THROTTLE = { long: { limit: 60, ttl: 60000 } };

/**
 * ⚠️ Yo'llar tartibi: literal yo'llar (`active`) `:id` li yo'llardan OLDIN.
 */
@ApiTags('Ads')
@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Barcha bannerlar, hisoblagichlari bilan (admin)' })
  findAll(): Promise<AdBanner[]> {
    return this.adsService.findAll();
  }

  @Get('active')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Hozir ko'rsatiladigan bannerlar (bosh ekran karuseli)" })
  listActive(): Promise<AdBanner[]> {
    return this.adsService.listActive();
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Banner yaratish (admin). Multipart: "image" + maydonlar' })
  @ApiResponse({ status: 415, description: 'Rasm JPEG/PNG/WEBP emas' })
  @UseInterceptors(FileInterceptor('image', adImageMulterOptions))
  create(
    @Body() dto: CreateAdBannerDto,
    @UploadedFile() file: UploadedMemoryFile,
  ): Promise<AdBanner> {
    if (!file) {
      throw new BadRequestException('Rasm yuborilmadi (multipart maydoni "image" kutilgan)');
    }
    return this.adsService.create(dto, file);
  }

  @Get(':id/daily')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Bannerning kunlik ko'rish/bosish hisoboti (admin)" })
  @ApiParam({ name: 'id', description: 'Banner UUID' })
  @ApiQuery({ name: 'days', required: false, description: 'Oxirgi necha kun (1–90, standart 30)' })
  dailyStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<AdDailyRow[]> {
    return this.adsService.dailyStats(id, days);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bannerni tahrirlash (admin). Rasm o\'zgarmaydi' })
  @ApiParam({ name: 'id', description: 'Banner UUID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdBannerDto,
  ): Promise<AdBanner> {
    return this.adsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Bannerni o'chirish (admin)" })
  @ApiParam({ name: 'id', description: 'Banner UUID' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.adsService.remove(id);
  }

  /**
   * OCHIQ: reklama rasmi maxfiy emas, `Image.network` va panel `<img>` i
   * sarlavhasiz yuklay olishi kerak. Rasm banner yaratilgandan keyin
   * o'zgarmaydi (PATCH uni o'zgartirmaydi), shuning uchun uzoq kesh xavfsiz.
   */
  @Get(':id/image')
  @ApiOperation({ summary: 'Banner rasmi (ochiq, keshlanadi)' })
  @ApiParam({ name: 'id', description: 'Banner UUID' })
  async image(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const image = await this.adsService.openImage(id);
    if (!image) throw new NotFoundException('Rasm topilmadi');
    // `@Res()` orqali oqim: aks holda global ResponseInterceptor binar
    // javobni JSON konvertiga o'rab qo'yardi.
    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    image.stream.pipe(res);
  }

  @Post(':id/impression')
  @HttpCode(204)
  @Throttle(COUNTER_THROTTLE)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Banner ko'rildi (+1)" })
  recordImpression(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.adsService.recordImpression(id);
  }

  @Post(':id/click')
  @HttpCode(204)
  @Throttle(COUNTER_THROTTLE)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Banner bosildi (+1)' })
  recordClick(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.adsService.recordClick(id);
  }
}
