import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DriverDocumentsService, UploadedDiskFile } from './driver-documents.service';
import {
  DriverDocument,
  DriverDocumentReviewStatus,
  DriverDocumentType,
} from '../../database/entities/driver-document.entity';
import { DriversService } from './drivers.service';
import { Driver } from '../../database/entities/driver.entity';

describe('DriverDocumentsService', () => {
  let service: DriverDocumentsService;
  let documentRepository: { save: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let driversService: { findByUserIdOrThrow: jest.Mock };

  const driver = { id: 'driver-1', userId: 'user-1' } as Driver;

  const diskFile: UploadedDiskFile = {
    filename: 'abc123.jpg',
    path: '/tmp/abc123.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
  };

  beforeEach(async () => {
    documentRepository = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    driversService = {
      findByUserIdOrThrow: jest.fn().mockResolvedValue(driver),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverDocumentsService,
        { provide: getRepositoryToken(DriverDocument), useValue: documentRepository },
        { provide: DriversService, useValue: driversService },
      ],
    }).compile();

    service = module.get<DriverDocumentsService>(DriverDocumentsService);
  });

  describe('recordUpload', () => {
    it('records a pending document for the authenticated driver on successful upload', async () => {
      const saved: DriverDocument = {
        id: 'doc-1',
        driverId: driver.id,
        documentType: DriverDocumentType.LICENSE_FRONT,
        fileUrl: '/uploads/driver-documents/abc123.jpg',
        reviewStatus: DriverDocumentReviewStatus.PENDING,
        uploadedAt: new Date(),
      } as DriverDocument;
      documentRepository.save.mockResolvedValue(saved);

      const result = await service.recordUpload(
        driver.userId,
        DriverDocumentType.LICENSE_FRONT,
        diskFile,
      );

      expect(driversService.findByUserIdOrThrow).toHaveBeenCalledWith(driver.userId);
      expect(documentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: driver.id,
          documentType: DriverDocumentType.LICENSE_FRONT,
          fileUrl: '/uploads/driver-documents/abc123.jpg',
          reviewStatus: DriverDocumentReviewStatus.PENDING,
        }),
      );
      expect(result.reviewStatus).toBe(DriverDocumentReviewStatus.PENDING);
    });

    it('rejects an unsupported document type without touching the repository', async () => {
      await expect(
        service.recordUpload(driver.userId, 'drivers_license_selfie', diskFile),
      ).rejects.toThrow(BadRequestException);

      expect(documentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('returns the documents belonging to the authenticated driver', async () => {
      const docs = [
        { id: 'doc-1', driverId: driver.id, documentType: DriverDocumentType.PASSPORT },
        { id: 'doc-2', driverId: driver.id, documentType: DriverDocumentType.LICENSE_FRONT },
      ] as DriverDocument[];
      documentRepository.find.mockResolvedValue(docs);

      const result = await service.listForUser(driver.userId);

      expect(driversService.findByUserIdOrThrow).toHaveBeenCalledWith(driver.userId);
      expect(documentRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { driverId: driver.id } }),
      );
      expect(result).toEqual(docs);
    });
  });

  describe('listForDriver', () => {
    it('returns documents for a given driver id (admin/manager path)', async () => {
      const docs = [{ id: 'doc-3', driverId: 'driver-2' }] as DriverDocument[];
      documentRepository.find.mockResolvedValue(docs);

      const result = await service.listForDriver('driver-2');

      expect(documentRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { driverId: 'driver-2' } }),
      );
      expect(result).toEqual(docs);
    });
  });

  describe('review', () => {
    const existingDocument = (): DriverDocument =>
      ({
        id: 'doc-1',
        driverId: driver.id,
        documentType: DriverDocumentType.LICENSE_FRONT,
        fileUrl: '/uploads/driver-documents/abc123.jpg',
        reviewStatus: DriverDocumentReviewStatus.REJECTED,
        rejectionReason: 'Blurry photo',
        uploadedAt: new Date(),
      }) as DriverDocument;

    it('approving clears any prior rejectionReason', async () => {
      const document = existingDocument();
      documentRepository.findOne.mockResolvedValue(document);
      documentRepository.save.mockImplementation((doc) => Promise.resolve(doc));

      const result = await service.review('doc-1', {
        status: DriverDocumentReviewStatus.APPROVED,
      });

      expect(result.reviewStatus).toBe(DriverDocumentReviewStatus.APPROVED);
      expect(result.rejectionReason).toBeNull();
      expect(documentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: DriverDocumentReviewStatus.APPROVED,
          rejectionReason: null,
        }),
      );
    });

    it('rejecting without a reason throws BadRequestException', async () => {
      documentRepository.findOne.mockResolvedValue(existingDocument());

      await expect(
        service.review('doc-1', { status: DriverDocumentReviewStatus.REJECTED }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.review('doc-1', { status: DriverDocumentReviewStatus.REJECTED, reason: '   ' }),
      ).rejects.toThrow(BadRequestException);

      expect(documentRepository.save).not.toHaveBeenCalled();
    });

    it('rejecting with a reason sets both reviewStatus and rejectionReason correctly', async () => {
      const document = existingDocument();
      documentRepository.findOne.mockResolvedValue(document);
      documentRepository.save.mockImplementation((doc) => Promise.resolve(doc));

      const result = await service.review('doc-1', {
        status: DriverDocumentReviewStatus.REJECTED,
        reason: 'License number not legible',
      });

      expect(result.reviewStatus).toBe(DriverDocumentReviewStatus.REJECTED);
      expect(result.rejectionReason).toBe('License number not legible');
      expect(documentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: DriverDocumentReviewStatus.REJECTED,
          rejectionReason: 'License number not legible',
        }),
      );
    });

    it('reviewing a non-existent document throws NotFoundException', async () => {
      documentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.review('missing-doc', { status: DriverDocumentReviewStatus.APPROVED }),
      ).rejects.toThrow(NotFoundException);

      expect(documentRepository.save).not.toHaveBeenCalled();
    });
  });
});
