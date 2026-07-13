import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { ProcessWithdrawalDto } from './dto/process-withdrawal.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { PaginationDto } from '../orders/dto/pagination.dto';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

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

  // --- Withdrawal requests (MVP/skeleton payout flow) ---
  //
  // There is no real bank/mobile-money integration wired up here. A driver
  // files a withdrawal request against their wallet balance; an admin
  // reviews it out-of-band (approve/reject), then — after actually sending
  // the money by whatever manual channel the business uses today (bank
  // transfer, cash, mobile money app, etc.) — marks the request 'paid'
  // through the same PATCH endpoint. Nothing in this controller talks to a
  // payment processor for payouts.

  @Post('wallet/withdraw')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Request a wallet withdrawal (driver only)' })
  @ApiResponse({ status: 201, description: 'Withdrawal request created' })
  @ApiResponse({ status: 400, description: 'Amount exceeds wallet balance' })
  async requestWithdrawal(
    @CurrentUser() user: User,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.paymentsService.requestWithdrawal(user.id, dto);
  }

  @Get('wallet/withdrawals')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "List the current driver's own withdrawal requests" })
  @ApiResponse({ status: 200, description: 'Withdrawal request list' })
  async getMyWithdrawals(@CurrentUser() user: User) {
    return this.paymentsService.getMyWithdrawals(user.id);
  }

  @Patch('wallet/withdrawals/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve, reject, or mark a withdrawal request paid (admin only)' })
  @ApiParam({ name: 'id', description: 'Withdrawal request UUID' })
  @ApiResponse({ status: 200, description: 'Withdrawal request updated' })
  async processWithdrawal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.paymentsService.processWithdrawal(id, dto);
  }
}
