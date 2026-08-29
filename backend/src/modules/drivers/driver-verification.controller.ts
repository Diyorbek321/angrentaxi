import * as fs from 'fs';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { UploadedDiskFile, driverUploadMulterOptions } from './driver-uploads';
import {
  DriverVerificationItem,
  DriverVerificationService,
  DriverVerificationSummary,
  PendingVerificationEntry,
} from './driver-verification.service';
import { ReviewDriverVerificationDto } from './dto/review-driver-verification.dto';

/**
 * Davriy tekshiruv endpointlari.
 *
 * ⚠️ `DriversController` dan ALOHIDA kontroller, lekin AYNI `drivers`
 * prefiksida — marshrutlar kontraktda shunday kelishilgan. To'qnashuv yo'q:
 * bu yerdagi har bir yo'l kamida ikki bo'lakli, `DriversController` dagi
 * `:id` esa bir bo'lakli.
 */
@ApiTags('Drivers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers')
export class DriverVerificationController {
  constructor(private readonly verificationService: DriverVerificationService) {}

  @Get('me/verification')
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary:
      "Haydovchining tekshiruv ro'yxati va holati. Ro'yxat butunlay serverdan keladi.",
  })
  @ApiResponse({ status: 200, description: 'canGoOnline, blockedReason, items[]' })
  async myVerification(@CurrentUser() user: User): Promise<DriverVerificationSummary> {
    return this.verificationService.getSummaryForUser(user.id);
  }

  @Post('me/verification/:code')
  @Roles(UserRole.DRIVER)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Tekshiruv materialini yuklash (multipart maydoni: \"file\")" })
  @ApiParam({ name: 'code', description: "Talab kodi, masalan vehicle_photo_front" })
  @ApiResponse({ status: 201, description: "Yuborildi, status pending_review" })
  @ApiResponse({ status: 400, description: "Noma'lum kod yoki fayl yuborilmagan" })
  // Yuklash sozlamasi (katalog, 10 MB chegara, MIME ro'yxati) KYC hujjatlari
  // bilan BITTA manbadan — `driver-uploads.ts`.
  @UseInterceptors(FileInterceptor('file', driverUploadMulterOptions))
  async submit(
    @CurrentUser() user: User,
    @Param('code') code: string,
    @UploadedFile() file: UploadedDiskFile,
  ): Promise<DriverVerificationItem> {
    if (!file) {
      throw new BadRequestException('Fayl yuborilmadi (multipart maydoni "file" kutilgan)');
    }
    return this.verificationService.submit(user.id, code, file);
  }

  @Get('verification/pending')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Ko'rilmagan tekshiruv materiallari navbati" })
  async pending(): Promise<PendingVerificationEntry[]> {
    return this.verificationService.listPending();
  }

  @Get('verification/:id/file')
  @Roles(UserRole.DRIVER, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Yuborilgan faylni ko'rish. Haydovchi faqat o'zinikini, menejer/admin hammasini.",
  })
  @ApiParam({ name: 'id', description: 'Submission UUID' })
  @ApiResponse({ status: 403, description: 'Begona material' })
  @ApiResponse({ status: 404, description: 'Material yoki fayl topilmadi' })
  async downloadFile(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.verificationService.getFileForDownload(id, {
      id: user.id,
      role: user.role,
    });

    // `@Res()` orqali oqim: aks holda binar javob global
    // ResponseInterceptor konvertiga o'ralib qolardi.
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    // Shaxsni tasdiqlovchi hujjatlar: proksi ham, disk ham keshlamasin.
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(file.absolutePath).pipe(res);
  }

  @Patch('verification/:id/review')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Tekshiruv materialini tasdiqlash yoki rad etish' })
  @ApiParam({ name: 'id', description: 'Submission UUID' })
  @ApiResponse({ status: 400, description: "Allaqachon ko'rilgan yoki sabab yo'q" })
  async review(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDriverVerificationDto,
  ): Promise<DriverVerificationItem> {
    return this.verificationService.review(id, user.id, dto);
  }
}
