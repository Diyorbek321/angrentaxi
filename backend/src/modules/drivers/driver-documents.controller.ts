import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnsupportedMediaTypeException,
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
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { DriverDocumentsService, UploadedDiskFile } from './driver-documents.service';
import { UploadDriverDocumentDto } from './dto/upload-driver-document.dto';
import { ReviewDriverDocumentDto } from './dto/review-driver-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

// PRODUCTION TODO: this stores files on local disk, which does not survive
// redeploys/scale-out on most hosts (e.g. Railway). Move to S3 (or another
// object store) behind the same DriverDocumentsService interface before
// launch; only this disk-storage config + fileUrl construction would change.
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'driver-documents');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags('Drivers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers/documents')
export class DriverDocumentsController {
  constructor(private readonly driverDocumentsService: DriverDocumentsService) {}

  @Post()
  @Roles(UserRole.DRIVER)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a KYC document (license, passport, vehicle registration)' })
  @ApiResponse({ status: 201, description: 'Document uploaded, pending review' })
  @ApiResponse({ status: 400, description: 'Unsupported document type or file' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, callback) => {
          const ext = path.extname(file.originalname).toLowerCase();
          callback(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              `Unsupported file type "${file.mimetype}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser() user: User,
    @Body() dto: UploadDriverDocumentDto,
    @UploadedFile() file: UploadedDiskFile,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded (expected multipart field "file")');
    }
    return this.driverDocumentsService.recordUpload(user.id, dto.documentType, file);
  }

  @Get()
  @Roles(UserRole.DRIVER, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'List KYC documents and review status. Drivers see their own; admin/manager must pass driverId.',
  })
  @ApiQuery({
    name: 'driverId',
    required: false,
    description: 'Driver UUID (required for admin/manager, ignored for drivers)',
  })
  @ApiResponse({ status: 200, description: 'List of driver documents' })
  async list(@CurrentUser() user: User, @Query('driverId') driverId?: string) {
    if (user.role === UserRole.DRIVER) {
      return this.driverDocumentsService.listForUser(user.id);
    }

    if (!driverId) {
      throw new BadRequestException('driverId query param is required for admin/manager');
    }
    return this.driverDocumentsService.listForDriver(driverId);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve or reject an uploaded KYC document (admin/manager only)' })
  @ApiParam({ name: 'id', description: 'Driver document UUID' })
  @ApiResponse({ status: 200, description: 'Document review status updated' })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition, or rejection missing a reason',
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDriverDocumentDto,
  ) {
    return this.driverDocumentsService.review(id, dto);
  }
}
