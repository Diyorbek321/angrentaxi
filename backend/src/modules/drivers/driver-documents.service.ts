import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DriverDocument,
  DriverDocumentReviewStatus,
  DriverDocumentType,
} from '../../database/entities/driver-document.entity';
import { DriversService } from './drivers.service';
import { ReviewDriverDocumentDto } from './dto/review-driver-document.dto';

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

    // Served statically from /uploads (see main.ts); relative so it works
    // behind any host/port. PRODUCTION TODO: move to S3/object storage and
    // store the resulting object URL instead of a local path.
    const fileUrl = `/uploads/driver-documents/${file.filename}`;

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
