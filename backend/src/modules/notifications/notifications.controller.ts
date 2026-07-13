import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

// This endpoint is the one missing link in an otherwise fully-built push
// pipeline: NotificationsService already sends FCM pushes for order-offer/
// driver-assigned/arrived/completed/cancelled events (see
// notifications.service.ts), all gated on `user.fcmToken` being set. Without
// this route, the mobile client's token registration call
// (main_passenger.dart/main_driver.dart) always 404'd, fcmToken stayed null
// forever, and every one of those pushes silently no-opped.
@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register/update the FCM push token for the current user' })
  @ApiResponse({ status: 204, description: 'Token stored' })
  async registerToken(
    @CurrentUser() user: User,
    @Body() dto: RegisterFcmTokenDto,
  ): Promise<void> {
    await this.usersService.updateFcmToken(user.id, dto.token);
  }
}
