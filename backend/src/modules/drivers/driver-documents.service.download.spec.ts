import { Readable } from 'stream';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DriverDocumentsService } from './driver-documents.service';
import {
  DriverDocument,
  DriverDocumentReviewStatus,
  DriverDocumentType,
} from '../../database/entities/driver-document.entity';
import { UserRole } from '../../database/entities/user.entity';
import { DriversService } from './drivers.service';
import { DriverUploadsStore } from './driver-uploads';
import { ObjectStorage, StoredObject } from '../storage/object-storage';

/** In-memory ObjectStorage — the real DriverUploadsStore runs on top of it. */
class MemoryStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  readonly objects = new Map<string, Buffer>();
  readonly gets: string[] = [];

  async put(key: string, body: Buffer): Promise<void> {
    this.objects.set(key, body);
  }

  async get(key: string): Promise<StoredObject | null> {
    this.gets.push(key);
    const body = this.objects.get(key);
    return body ? { stream: Readable.from(body), contentType: null, size: body.length } : null;
  }
}

// KYC scans (passport, driving licence) used to be served by
// app.useStaticAssets('uploads'), i.e. downloadable by anyone who knew the URL.
// These tests lock in the authorization rules of the replacement endpoint.
describe('DriverDocumentsService.getFileForDownload', () => {
  let service: DriverDocumentsService;
  let storage: MemoryStorage;
  let documentRepository: { findOne: jest.Mock };
  let driversService: { findByUserIdOrThrow: jest.Mock };

  const ownerDriver = { id: 'driver-1', userId: 'user-1' };
  const otherDriver = { id: 'driver-2', userId: 'user-2' };

  const realFilename = '3f2b1c9e-download-spec.png';

  const document = (fileUrl: string): DriverDocument =>
    ({
      id: 'doc-1',
      driverId: ownerDriver.id,
      documentType: DriverDocumentType.PASSPORT,
      fileUrl,
      reviewStatus: DriverDocumentReviewStatus.PENDING,
      uploadedAt: new Date(),
    }) as DriverDocument;

  beforeEach(async () => {
    storage = new MemoryStorage();
    storage.objects.set(`driver-documents/${realFilename}`, Buffer.from('fake-png-bytes'));
    documentRepository = { findOne: jest.fn() };
    driversService = { findByUserIdOrThrow: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverDocumentsService,
        { provide: getRepositoryToken(DriverDocument), useValue: documentRepository },
        { provide: DriversService, useValue: driversService },
        { provide: DriverUploadsStore, useValue: new DriverUploadsStore(storage) },
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

    expect(file.filename).toBe(realFilename);
    expect(file.mimeType).toBe('image/png');
    expect(storage.gets).toEqual([`driver-documents/${realFilename}`]);
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
    // Authorization runs before storage is touched.
    expect(storage.gets).toEqual([]);
  });

  it.each([UserRole.MANAGER, UserRole.ADMIN])(
    'lets a %s download any driver document',
    async (role) => {
      documentRepository.findOne.mockResolvedValue(
        document(`/uploads/driver-documents/${realFilename}`),
      );

      const file = await service.getFileForDownload('doc-1', { id: 'staff-1', role });

      expect(file.filename).toBe(realFilename);
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

  it('404s for an unknown document without touching storage', async () => {
    documentRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getFileForDownload('doc-missing', { id: 'staff-1', role: UserRole.ADMIN }),
    ).rejects.toThrow(NotFoundException);
    expect(storage.gets).toEqual([]);
  });

  // A tampered/legacy fileUrl must never address anything outside the
  // driver-documents prefix: only a `<name>.<ext>` basename is accepted.
  it.each([
    '/uploads/driver-documents/../../../etc/passwd',
    '../../.env',
    '/etc/passwd',
    '',
  ])('refuses to escape the upload prefix via fileUrl %p', async (fileUrl) => {
    documentRepository.findOne.mockResolvedValue(document(fileUrl));

    await expect(
      service.getFileForDownload('doc-1', { id: 'staff-1', role: UserRole.ADMIN }),
    ).rejects.toThrow(NotFoundException);
    expect(storage.gets).toEqual([]);
  });
});
