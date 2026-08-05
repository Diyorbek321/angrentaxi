import * as fs from 'fs';
import * as path from 'path';
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

// PRODUCTION TODO: local disk does not survive redeploys/scale-out on most
// hosts (e.g. Railway). Move to S3 (or another object store) behind this same
// service interface before launch; only this directory + the fileUrl
// construction and the download resolver below would change.
export const DRIVER_DOCUMENTS_UPLOAD_DIR = path.resolve(
  process.cwd(),
  'uploads',
  'driver-documents',
);

// Public path prefix recorded in DriverDocument.fileUrl. Kept as-is so existing
// rows stay valid — the value is treated as an opaque record, never as a path
// to read from (see resolveStoredFilePath).
const DRIVER_DOCUMENTS_URL_PREFIX = '/uploads/driver-documents';

const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const FALLBACK_MIME_TYPE = 'application/octet-stream';

// A KYC file resolved for streaming back to an authorized caller.
export interface DriverDocumentFile {
  absolutePath: string;
  filename: string;
  mimeType: string;
}

export interface DocumentRequester {
  id: string;
  role: UserRole;
}

// File on disk as handed to us by Multer's diskStorage engine. Kept minimal
// (rather than depending on @types/multer's fuller Express.Multer.File) so the
// service stays decoupled from the HTTP/multipart layer.
export interface UploadedDiskFile {
  filename: string;
  path: string;
  mimetype: string;
  size: number;
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
    const fileUrl = `${DRIVER_DOCUMENTS_URL_PREFIX}/${file.filename}`;

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

    const absolutePath = this.resolveStoredFilePath(document.fileUrl);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      throw new NotFoundException(`File for driver document "${documentId}" is missing`);
    }

    const filename = path.basename(absolutePath);
    return {
      absolutePath,
      filename,
      mimeType:
        EXTENSION_MIME_TYPES[path.extname(filename).toLowerCase()] ?? FALLBACK_MIME_TYPE,
    };
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

  // Path-traversal guard. The DB value is never handed to path.join directly:
  // only its basename is used, and the result must still land directly inside
  // the upload directory. So "../../etc/passwd" or an absolute path stored in
  // fileUrl cannot escape.
  private resolveStoredFilePath(fileUrl: string | null | undefined): string | null {
    if (!fileUrl) {
      return null;
    }

    const filename = path.basename(fileUrl);
    if (!filename || filename === '.' || filename === '..') {
      return null;
    }

    const absolutePath = path.resolve(DRIVER_DOCUMENTS_UPLOAD_DIR, filename);
    if (!absolutePath.startsWith(DRIVER_DOCUMENTS_UPLOAD_DIR + path.sep)) {
      return null;
    }

    return absolutePath;
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
