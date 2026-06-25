import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { PaginationDto } from '../orders/dto/pagination.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Initiate online payment for a completed order' })
  @ApiResponse({ status: 201, description: 'Payment checkout URL returned' })
  @ApiResponse({ status: 400, description: 'Order not completed or invalid' })
  async initiatePayment(
    @CurrentUser() user: User,
    @Body() dto: InitiatePaymentDto,
    @Query('provider') provider: 'payme' | 'click' | 'uzcard' = 'payme',
  ) {
    return this.paymentsService.initiatePayment(dto.orderId, provider, user.id);
  }

  @Post('payme/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payme payment callback (internal use)' })
  @ApiResponse({ status: 200, description: 'Callback processed' })
  async handlePaymeCallback(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authHeader: string,
  ) {
    return this.paymentsService.handlePaymeCallback(body, authHeader);
  }

  @Post('click/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Click payment callback (internal use)' })
  @ApiResponse({ status: 200, description: 'Callback processed' })
  async handleClickCallback(@Body() body: Record<string, unknown>) {
    return this.paymentsService.handleClickCallback(body);
  }

  @Post('uzcard/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Uzcard/UZPS payment callback (internal use)' })
  @ApiResponse({ status: 200, description: 'Callback processed' })
  async handleUzcardCallback(@Body() body: Record<string, unknown>) {
    return this.paymentsService.handleUzcardCallback(body);
  }

  @Get('wallet')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({ status: 200, description: 'Wallet balance' })
  async getWallet(@CurrentUser() user: User) {
    return this.paymentsService.getWalletBalance(user.id);
  }

  @Get('transactions')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get transaction history' })
  @ApiResponse({ status: 200, description: 'Paginated transaction history' })
  async getTransactions(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ) {
    return this.paymentsService.getTransactionHistory(
      user.id,
      pagination.page ?? 1,
      pagination.limit ?? 20,
    );
  }
}
