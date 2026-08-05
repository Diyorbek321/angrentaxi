import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  DRIVER_DOCUMENTS_UPLOAD_DIR,
  DriverDocumentsService,
} from './driver-documents.service';
import {
  DriverDocument,
  DriverDocumentReviewStatus,
  DriverDocumentType,
} from '../../database/entities/driver-document.entity';
import { UserRole } from '../../database/entities/user.entity';
import { DriversService } from './drivers.service';

// KYC scans (passport, driving licence) used to be served by
// app.useStaticAssets('uploads'), i.e. downloadable by anyone who knew the URL.
// These tests lock in the authorization rules of the replacement endpoint.
describe('DriverDocumentsService.getFileForDownload', () => {
  let service: DriverDocumentsService;
  let documentRepository: { findOne: jest.Mock };
  let driversService: { findByUserIdOrThrow: jest.Mock };

  const ownerDriver = { id: 'driver-1', userId: 'user-1' };
  const otherDriver = { id: 'driver-2', userId: 'user-2' };

  const realFilename = 'driver-documents-download-spec.png';
  const realFilePath = path.join(DRIVER_DOCUMENTS_UPLOAD_DIR, realFilename);

  const document = (fileUrl: string): DriverDocument =>
    ({
      id: 'doc-1',
      driverId: ownerDriver.id,
      documentType: DriverDocumentType.PASSPORT,
      fileUrl,
      reviewStatus: DriverDocumentReviewStatus.PENDING,
      uploadedAt: new Date(),
    }) as DriverDocument;

  beforeAll(() => {
    fs.mkdirSync(DRIVER_DOCUMENTS_UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(realFilePath, 'fake-png-bytes');
  });

  afterAll(() => {
    fs.rmSync(realFilePath, { force: true });
  });

  beforeEach(async () => {
    documentRepository = { findOne: jest.fn() };
    driversService = { findByUserIdOrThrow: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverDocumentsService,
        { provide: getRepositoryToken(DriverDocument), useValue: documentRepository },
        { provide: DriversService, useValue: driversService },
      ],
    }).compile();

    service = module.get<DriverDocumentsService>(DriverDocumentsService);
  });

  it('lets the owning driver download their own document', async () => {
    documentRepository.findOne.mockResolvedValue(
      document(`/uploads/driver-documents/${realFilename}`),
    );
    driversService.findByUserIdOrThrow.mockResolvedValue(ownerDriver);

    const file = await service.getFileForDownload('doc-1', {
      id: ownerDriver.userId,
      role: UserRole.DRIVER,
    });

    expect(file).toEqual({
      absolutePath: realFilePath,
      filename: realFilename,
      mimeType: 'image/png',
    });
  });

  it("rejects a driver asking for another driver's document", async () => {
    documentRepository.findOne.mockResolvedValue(
      document(`/uploads/driver-documents/${realFilename}`),
    );
    driversService.findByUserIdOrThrow.mockResolvedValue(otherDriver);

    await expect(
      service.getFileForDownload('doc-1', {
        id: otherDriver.userId,
        role: UserRole.DRIVER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([UserRole.MANAGER, UserRole.ADMIN])(
    'lets a %s download any driver document',
    async (role) => {
      documentRepository.findOne.mockResolvedValue(
        document(`/uploads/driver-documents/${realFilename}`),
      );

      const file = await service.getFileForDownload('doc-1', { id: 'staff-1', role });

      expect(file.absolutePath).toBe(realFilePath);
      // Staff must not be resolved through the drivers table.
      expect(driversService.findByUserIdOrThrow).not.toHaveBeenCalled();
    },
  );

  it('rejects a passenger outright', async () => {
    documentRepository.findOne.mockResolvedValue(
      document(`/uploads/driver-documents/${realFilename}`),
    );

    await expect(
      service.getFileForDownload('doc-1', { id: 'user-9', role: UserRole.PASSENGER }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('404s for an unknown document without touching the filesystem', async () => {
    documentRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getFileForDownload('doc-missing', { id: 'staff-1', role: UserRole.ADMIN }),
    ).rejects.toThrow(NotFoundException);
  });

  // A tampered/legacy fileUrl must never be able to read outside the upload
  // directory: only its basename is used, so these all resolve to a
  // non-existent file inside UPLOAD_DIR (or are rejected outright).
  it.each([
    '/uploads/driver-documents/../../../etc/passwd',
    '../../.env',
    '/etc/passwd',
    '',
  ])('refuses to escape the upload directory via fileUrl %p', async (fileUrl) => {
    documentRepository.findOne.mockResolvedValue(document(fileUrl));

    await expect(
      service.getFileForDownload('doc-1', { id: 'staff-1', role: UserRole.ADMIN }),
    ).rejects.toThrow(NotFoundException);
  });
});
