import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoriteAddress } from '../../database/entities/favorite-address.entity';
import { CreateFavoriteAddressDto } from './dto/create-favorite-address.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(FavoriteAddress)
    private readonly favoriteAddressRepository: Repository<FavoriteAddress>,
  ) {}

  async create(userId: string, dto: CreateFavoriteAddressDto): Promise<FavoriteAddress> {
    return this.favoriteAddressRepository.save({
      userId,
      label: dto.label,
      address: dto.address,
      lat: dto.lat,
      lng: dto.lng,
    });
  }

  async findAllForUser(userId: string): Promise<FavoriteAddress[]> {
    return this.favoriteAddressRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const favorite = await this.favoriteAddressRepository.findOne({ where: { id } });

    if (!favorite) {
      throw new NotFoundException('Favorite address not found');
    }

    if (favorite.userId !== userId) {
      throw new ForbiddenException('You do not have access to this favorite address');
    }

    await this.favoriteAddressRepository.remove(favorite);
  }
}
