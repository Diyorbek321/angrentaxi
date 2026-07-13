import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TripChatService } from './trip-chat.service';
import { SendTripMessageDto } from './dto/send-trip-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { TripMessage } from '../../database/entities/trip-message.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Trip Chat')
@ApiBearerAuth('JWT-auth')
@Controller('orders/:orderId/messages')
@UseGuards(JwtAuthGuard)
export class TripChatController {
  constructor(private readonly tripChatService: TripChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send a chat message to the other party on this trip (passenger or driver only)' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 201, description: 'Message sent and broadcast over trip:message' })
  async sendMessage(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
    @Body() dto: SendTripMessageDto,
  ): Promise<TripMessage> {
    return this.tripChatService.sendMessage(orderId, user.id, dto.body);
  }

  @Get()
  @ApiOperation({ summary: 'Get trip chat history for this order, oldest first (passenger or driver only)' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  async getHistory(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ): Promise<TripMessage[]> {
    return this.tripChatService.getHistory(orderId, user.id);
  }
}
