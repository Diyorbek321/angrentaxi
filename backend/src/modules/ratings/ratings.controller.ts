import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RatingsService, DriverRatingStats } from './ratings.service';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Rating } from '../../database/entities/rating.entity';

@ApiTags('Ratings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @Roles(UserRole.PASSENGER, UserRole.DRIVER)
  @ApiOperation({ summary: 'Submit a rating for a completed order' })
  @ApiResponse({ status: 201, description: 'Rating submitted successfully' })
  @ApiResponse({ status: 400, description: 'Order not completed or user not a party to order' })
  @ApiResponse({ status: 409, description: 'Rating already submitted for this order' })
  async submitRating(
    @CurrentUser() user: User,
    @Body() dto: SubmitRatingDto,
  ): Promise<Rating> {
    const fromRole = user.role === UserRole.DRIVER ? 'driver' : 'passenger';
    return this.ratingsService.submitRating(user.id, dto, fromRole);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get all ratings for a specific order' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'List of ratings for the order' })
  async getOrderRatings(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<Rating[]> {
    return this.ratingsService.getOrderRatings(orderId);
  }

  @Get('driver/:userId')
  @ApiOperation({ summary: 'Get rating statistics for a driver' })
  @ApiParam({ name: 'userId', description: 'Driver user UUID' })
  @ApiResponse({ status: 200, description: 'Driver rating stats with avg, count, and breakdown' })
  async getDriverRatingStats(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<DriverRatingStats> {
    return this.ratingsService.getDriverRatingStats(userId);
  }
}
