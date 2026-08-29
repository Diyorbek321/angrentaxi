import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DriverDocument,
  DriverDocumentReviewStatus,
  DriverDocumentType,
} from '../../database/entities/driver-document.entity';
import { UserRole } from '../../database/entities/user.entity';
import { DriversService } from './drivers.service';
import { ReviewDriverDocumentDto } from './dto/review-driver-document.dto';
import {
  DRIVER_UPLOAD_DIR,
  DRIVER_UPLOAD_URL_PREFIX,
  DriverUploadFile,
  UploadedDiskFile,
  readDriverUploadFile,
} from './driver-uploads';

// Yuklash katalogi, MIME ro'yxati va yo'l tiklash mantig'i `driver-uploads.ts`
// da — davriy tekshiruv fotolari ham AYNAN o'sha qoidalardan foydalanadi.
// Bu yerdagi nomlar mavjud import'lar (test va kontroller) buzilmasligi uchun
// qayta eksport qilinadi.
export const DRIVER_DOCUMENTS_UPLOAD_DIR = DRIVER_UPLOAD_DIR;

/** KYC fayli — ruxsat berilgan chaqiruvchiga oqim bilan qaytariladi. */
export type DriverDocumentFile = DriverUploadFile;

export type { UploadedDiskFile };

export interface DocumentRequester {
  id: string;
  role: UserRole;
}

const VALID_DOCUMENT_TYPES = Object.values(DriverDocumentType) as string[];

@Injectable()
export class DriverDocumentsService {
  constructor(
    @InjectRepository(DriverDocument)
    private readonly documentRepository: Repository<DriverDocument>,
    private readonly driversService: DriversService,
  ) {}

  // Records an already-saved-to-disk file against the authenticated driver.
  // `documentType` arrives as a raw string from the multipart form field, so
  // it's validated here too (not just via the DTO/ValidationPipe) since this
  // is the boundary that actually persists the record.
  async recordUpload(
    userId: string,
    documentType: string,
    file: UploadedDiskFile,
  ): Promise<DriverDocument> {
    if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
      throw new BadRequestException(
        `Unsupported document type "${documentType}". Must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`,
      );
    }

    const driver = await this.driversService.findByUserIdOrThrow(userId);

    // Storage locator, NOT a publicly reachable URL: these are passport and
    // licence scans, so they are only served through the authorized
    // GET /drivers/documents/:id/file endpoint. Kept in this shape so existing
    // rows keep working without a data migration.
    const fileUrl = `${DRIVER_UPLOAD_URL_PREFIX}/${file.filename}`;

    return this.documentRepository.save({
      driverId: driver.id,
      documentType: documentType as DriverDocumentType,
      fileUrl,
      reviewStatus: DriverDocumentReviewStatus.PENDING,
    });
  }

  async listForUser(userId: string): Promise<DriverDocument[]> {
    const driver = await this.driversService.findByUserIdOrThrow(userId);
    return this.listForDriver(driver.id);
  }

  async listForDriver(driverId: string): Promise<DriverDocument[]> {
    return this.documentRepository.find({
      where: { driverId },
      order: { uploadedAt: 'DESC' },
    });
  }

  // Resolves a KYC file for download, enforcing access itself rather than
  // relying on the route guard alone: a driver may only read their own
  // documents, while managers and admins may read any. Everyone else is
  // rejected even if a future route change widens @Roles.
  async getFileForDownload(
    documentId: string,
    requester: DocumentRequester,
  ): Promise<DriverDocumentFile> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException(`Driver document "${documentId}" not found`);
    }

    await this.assertCanReadDocument(document, requester);

    const file = readDriverUploadFile(document.fileUrl);
    if (!file) {
      throw new NotFoundException(`File for driver document "${documentId}" is missing`);
    }

    return file;
  }

  private async assertCanReadDocument(
    document: DriverDocument,
    requester: DocumentRequester,
  ): Promise<void> {
    if (requester.role === UserRole.MANAGER || requester.role === UserRole.ADMIN) {
      return;
    }

    if (requester.role === UserRole.DRIVER) {
      const driver = await this.driversService.findByUserIdOrThrow(requester.id);
      if (driver.id === document.driverId) {
        return;
      }
    }

    throw new ForbiddenException('You may only access your own documents');
  }

  // Admin/manager review decision on an uploaded KYC document. 'pending' is
  // never a valid target here (it's only the initial state set on upload),
  // and rejecting without a reason is rejected outright — the driver has no
  // other way to find out what to fix on re-upload.
  async review(documentId: string, dto: ReviewDriverDocumentDto): Promise<DriverDocument> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException(`Driver document "${documentId}" not found`);
    }

    if (dto.status === DriverDocumentReviewStatus.PENDING) {
      throw new BadRequestException(
        '"pending" is not a valid review target; use "approved" or "rejected"',
      );
    }

    if (dto.status === DriverDocumentReviewStatus.REJECTED && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required when rejecting a document');
    }

    document.reviewStatus = dto.status;
    document.rejectionReason =
      dto.status === DriverDocumentReviewStatus.REJECTED ? dto.reason!.trim() : null;

    return this.documentRepository.save(document);
  }
}
