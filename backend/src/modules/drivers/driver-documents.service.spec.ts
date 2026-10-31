import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DriverDocumentsService, UploadedMemoryFile } from './driver-documents.service';
import { DriverUploadsStore } from './driver-uploads';
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
  let uploads: { save: jest.Mock; open: jest.Mock };

  const driver = { id: 'driver-1', userId: 'user-1' } as Driver;

  const diskFile: UploadedMemoryFile = {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    mimetype: 'image/jpeg',
    size: 4,
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

    uploads = {
      save: jest.fn().mockResolvedValue('/uploads/driver-documents/abc123.jpg'),
      open: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverDocumentsService,
        { provide: getRepositoryToken(DriverDocument), useValue: documentRepository },
        { provide: DriversService, useValue: driversService },
        { provide: DriverUploadsStore, useValue: uploads },
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
      // Nothing is written to storage for a request that was going to fail.
      expect(uploads.save).not.toHaveBeenCalled();
    });

    it('stores the file only after resolving the driver', async () => {
      driversService.findByUserIdOrThrow.mockRejectedValueOnce(new NotFoundException());

      await expect(
        service.recordUpload('user-x', DriverDocumentType.PASSPORT, diskFile),
      ).rejects.toThrow(NotFoundException);
      expect(uploads.save).not.toHaveBeenCalled();
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

describe('DriverDocumentsService.listPending', () => {
  it('returns pending documents oldest first with the driver name and phone', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        id: 'doc-1',
        driverId: 'driver-1',
        documentType: DriverDocumentType.PASSPORT,
        uploadedAt: new Date('2026-09-01T08:00:00Z'),
        driver: { user: { firstName: 'Ali', lastName: 'Valiyev', phone: '+998901234571' } },
      },
      {
        id: 'doc-2',
        driverId: 'driver-2',
        documentType: DriverDocumentType.LICENSE_FRONT,
        uploadedAt: new Date('2026-09-02T08:00:00Z'),
        driver: { user: { firstName: null, lastName: null, phone: '+998901234572' } },
      },
    ]);
    const service = new DriverDocumentsService({ find } as never, {} as never, {} as never);

    const result = await service.listPending();

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reviewStatus: DriverDocumentReviewStatus.PENDING },
        order: { uploadedAt: 'ASC' },
        take: 200,
      }),
    );
    expect(result).toEqual([
      {
        id: 'doc-1',
        driverId: 'driver-1',
        driverName: 'Ali Valiyev',
        driverPhone: '+998901234571',
        documentType: DriverDocumentType.PASSPORT,
        uploadedAt: '2026-09-01T08:00:00.000Z',
      },
      {
        id: 'doc-2',
        driverId: 'driver-2',
        driverName: null,
        driverPhone: '+998901234572',
        documentType: DriverDocumentType.LICENSE_FRONT,
        uploadedAt: '2026-09-02T08:00:00.000Z',
      },
    ]);
  });
});
