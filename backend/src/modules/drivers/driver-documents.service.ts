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
import { DriverUploadFile, DriverUploadsStore, UploadedMemoryFile } from './driver-uploads';

// Saqlash, MIME ro'yxati va kalit tiklash mantig'i `driver-uploads.ts` da —
// davriy tekshiruv fotolari ham AYNAN o'sha qoidalardan foydalanadi.

/** KYC fayli — ruxsat berilgan chaqiruvchiga oqim bilan qaytariladi. */
export type DriverDocumentFile = DriverUploadFile;

export type { UploadedMemoryFile };

/** One row of the KYC review queue (`GET /drivers/documents/pending`). */
export interface PendingDriverDocument {
  id: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  documentType: DriverDocumentType;
  uploadedAt: string;
}

/**
 * Upper bound on one queue read. A backlog bigger than this is an operations
 * problem the reviewer works through oldest-first anyway; the cap only keeps
 * one request from materialising the whole table.
 */
export const PENDING_DOCUMENTS_LIMIT = 200;

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
    private readonly uploads: DriverUploadsStore,
  ) {}

  // Stores the file and records it against the authenticated driver.
  // `documentType` arrives as a raw string from the multipart form field, so
  // it's validated here too (not just via the DTO/ValidationPipe) since this
  // is the boundary that actually persists the record.
  async recordUpload(
    userId: string,
    documentType: string,
    file: UploadedMemoryFile,
  ): Promise<DriverDocument> {
    if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
      throw new BadRequestException(
        `Unsupported document type "${documentType}". Must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`,
      );
    }

    const driver = await this.driversService.findByUserIdOrThrow(userId);

    // Stored only after the type and driver checks pass, so a rejected
    // request leaves no orphan object behind. The returned value is a storage
    // locator, NOT a publicly reachable URL: these are passport and licence
    // scans, only served through GET /drivers/documents/:id/file.
    const fileUrl = await this.uploads.save(file);

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

  /**
   * Every document still waiting for a decision, oldest first — the order a
   * reviewer should work in, since the oldest upload is the driver who has
   * waited longest to start earning.
   */
  async listPending(): Promise<PendingDriverDocument[]> {
    const documents = await this.documentRepository.find({
      where: { reviewStatus: DriverDocumentReviewStatus.PENDING },
      relations: ['driver', 'driver.user'],
      order: { uploadedAt: 'ASC' },
      take: PENDING_DOCUMENTS_LIMIT,
    });

    return documents.map((document) => {
      const user = document.driver?.user;
      return {
        id: document.id,
        driverId: document.driverId,
        driverName: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || null : null,
        driverPhone: user?.phone ?? null,
        documentType: document.documentType,
        uploadedAt: document.uploadedAt.toISOString(),
      };
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

    const file = await this.uploads.open(document.fileUrl);
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
