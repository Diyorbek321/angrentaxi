import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteAddressDto } from './dto/create-favorite-address.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('Favorites')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users/favorite-addresses')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Save a new favorite address (e.g. Uy/Ish) for the current user' })
  @ApiResponse({ status: 201, description: 'Favorite address saved' })
  async create(@CurrentUser() user: User, @Body() dto: CreateFavoriteAddressDto) {
    return this.favoritesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's saved favorite addresses, newest first" })
  @ApiResponse({ status: 200, description: 'List of favorite addresses' })
  async findAll(@CurrentUser() user: User) {
    return this.favoritesService.findAllForUser(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Delete one of the current user's favorite addresses" })
  @ApiResponse({ status: 200, description: 'Favorite address deleted' })
  @ApiResponse({ status: 403, description: 'Favorite address belongs to another user' })
  @ApiResponse({ status: 404, description: 'Favorite address not found' })
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.favoritesService.remove(user.id, id);
    return { id };
  }
}
