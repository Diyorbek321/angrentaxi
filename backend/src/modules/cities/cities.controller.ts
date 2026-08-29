import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { SetCityActiveDto } from './dto/set-city-active.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { City } from '../../database/entities/city.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  /**
   * Ommaviy: faol shaharlar ro'yxati.
   *
   * Mobil ilova buni QAMROVNI KO'RSATISH uchun o'qiydi ("Hozircha faqat
   * Angren"), shahar TANLASH uchun emas — shahar olish nuqtasidan
   * aniqlanadi (`CitiesService` izohiga qarang).
   */
  @Get()
  @ApiOperation({ summary: 'Faol shaharlar (qamrov) — ochiq' })
  @ApiResponse({ status: 200, description: 'Faol shaharlar ro\'yxati' })
  async listActive(): Promise<City[]> {
    return this.citiesService.listActive();
  }

  /**
   * Nuqta qaysi shaharga tushishini tekshirish.
   *
   * ⚠️ `manage` dan OLDIN emas, lekin `:id` YO'Q shu kontrollerda — barcha
   * yo'llar literal, shuning uchun tartib muhim emas. Ammo yangi
   * parametrli yo'l qo'shilsa, u SHU ikkisidan KEYIN turishi kerak.
   */
  @Get('resolve')
  @ApiOperation({ summary: 'Koordinata qaysi shaharga tushadi — ochiq' })
  @ApiQuery({ name: 'lat', example: 40.0956 })
  @ApiQuery({ name: 'lng', example: 70.9432 })
  @ApiResponse({
    status: 200,
    description:
      "city null bo'lishi mumkin: qamrovdan tashqarida yoki qamrov umuman sozlanmagan",
  })
  async resolve(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<{ city: City | null; enforced: boolean }> {
    const enforced = await this.citiesService.isCoverageEnforced();
    const city = enforced
      ? await this.citiesService.resolveForPoint(
          Number.parseFloat(lat),
          Number.parseFloat(lng),
        )
      : null;
    // `enforced` ATAYLAB qaytariladi: `city: null` ning ikki xil ma'nosi
    // bor (qamrovdan tashqarida / qamrov umuman yoqilmagan) va mijoz
    // ularni ajrata olishi kerak — birinchisida "xizmat yo'q" deyish
    // to'g'ri, ikkinchisida esa hech narsa demaslik kerak.
    return { city, enforced };
  }

  @Get('manage')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Barcha shaharlar, nofaollari bilan (manager/admin)' })
  @ApiResponse({ status: 200, description: 'Shaharlar ro\'yxati' })
  async findAll(): Promise<City[]> {
    return this.citiesService.findAll();
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Shahar qo\'shish (manager/admin)' })
  @ApiResponse({ status: 201, description: 'Shahar yaratildi' })
  async create(@Body() dto: CreateCityDto): Promise<City> {
    return this.citiesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Shaharni yangilash (manager/admin)' })
  @ApiParam({ name: 'id', description: 'Shahar UUID' })
  @ApiResponse({ status: 200, description: 'Shahar yangilandi' })
  @ApiResponse({ status: 404, description: 'Shahar topilmadi' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCityDto,
  ): Promise<City> {
    return this.citiesService.update(id, dto);
  }

  @Patch(':id/active')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Shaharni faollashtirish/o\'chirish (manager/admin)' })
  @ApiParam({ name: 'id', description: 'Shahar UUID' })
  @ApiResponse({ status: 200, description: 'Holat o\'zgartirildi' })
  @ApiResponse({ status: 404, description: 'Shahar topilmadi' })
  async setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCityActiveDto,
  ): Promise<City> {
    return this.citiesService.setActive(id, dto.isActive);
  }
}
