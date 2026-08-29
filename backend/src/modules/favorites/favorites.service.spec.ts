import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoriteAddress } from '../../database/entities/favorite-address.entity';
import { CreateFavoriteAddressDto } from './dto/create-favorite-address.dto';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favoriteAddressRepository: {
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };

  const userId = 'user-1';
  const otherUserId = 'user-2';

  const dto: CreateFavoriteAddressDto = {
    label: 'Uy',
    address: 'Angren sh., Mustaqillik ko\'chasi 12',
    lat: 41.0167,
    lng: 70.1436,
  };

  beforeEach(async () => {
    favoriteAddressRepository = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(FavoriteAddress), useValue: favoriteAddressRepository },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  describe('create', () => {
    it('saves and returns a new favorite address for the authenticated user', async () => {
      const saved: FavoriteAddress = {
        id: 'fav-1',
        userId,
        label: dto.label,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        createdAt: new Date(),
      };
      favoriteAddressRepository.save.mockResolvedValue(saved);

      const result = await service.create(userId, dto);

      expect(favoriteAddressRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          label: dto.label,
          address: dto.address,
          lat: dto.lat,
          lng: dto.lng,
        }),
      );
      expect(result).toEqual(saved);
    });
  });

  describe('findAllForUser', () => {
    it('only returns the caller own records, ordered newest first', async () => {
      const own = [
        { id: 'fav-1', userId, label: 'Uy' },
        { id: 'fav-2', userId, label: 'Ish' },
      ] as FavoriteAddress[];
      favoriteAddressRepository.find.mockResolvedValue(own);

      const result = await service.findAllForUser(userId);

      expect(favoriteAddressRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(own);
      expect(result.every((f) => f.userId === userId)).toBe(true);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the record does not exist', async () => {
      favoriteAddressRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(userId, 'missing-id')).rejects.toThrow(NotFoundException);
      expect(favoriteAddressRepository.remove).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the record belongs to a different user', async () => {
      const foreign = { id: 'fav-1', userId: otherUserId } as FavoriteAddress;
      favoriteAddressRepository.findOne.mockResolvedValue(foreign);

      await expect(service.remove(userId, 'fav-1')).rejects.toThrow(ForbiddenException);
      expect(favoriteAddressRepository.remove).not.toHaveBeenCalled();
    });

    it('succeeds and removes the record when the caller is the owner', async () => {
      const own = { id: 'fav-1', userId } as FavoriteAddress;
      favoriteAddressRepository.findOne.mockResolvedValue(own);
      favoriteAddressRepository.remove.mockResolvedValue(own);

      await service.remove(userId, 'fav-1');

      expect(favoriteAddressRepository.remove).toHaveBeenCalledWith(own);
    });
  });
});
