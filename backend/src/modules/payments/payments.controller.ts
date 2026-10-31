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
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { CreateWalletTopupDto } from './dto/create-wallet-topup.dto';
import {
  WalletTopupCheckout,
  WalletTopupView,
  WalletTopupsService,
} from './wallet-topups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { WithdrawalOwnerType } from '../../database/entities/withdrawal-request.entity';
import { PaginationDto } from '../orders/dto/pagination.dto';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymeMerchantService } from './merchant/payme-merchant.service';
import { ClickShopService, ClickShopResponse } from './merchant/click-shop.service';
import { PaymeRpcResponse } from './merchant/payme-rpc';

// Maps the caller's account role to the withdrawal's informational
// ownerType tag (see WithdrawalRequest.ownerType). Anything that isn't a
// Market vendor or Eats restaurant owner defaults to DRIVER — the only role
// this endpoint served before Market/Food vendors gained withdrawal access.
function resolveWithdrawalOwnerType(role: UserRole): WithdrawalOwnerType {
  if (role === UserRole.MARKET) return WithdrawalOwnerType.VENDOR;
  if (role === UserRole.RESTAURANT) return WithdrawalOwnerType.RESTAURANT;
  return WithdrawalOwnerType.DRIVER;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly walletTopups: WalletTopupsService,
    private readonly paymeMerchant: PaymeMerchantService,
    private readonly clickShop: ClickShopService,
  ) {}

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

  // Payme va Click: buyurtma to'lovi VA hamyonni to'ldirish uchun yagona
  // protokol (docs/LEGAL-COMPLIANCE.md §18). Javob xom — `{ success, data }`
  // konvertisiz (`@RawResponse()`), HTTP 200; provayder serverlari tez-tez
  // chaqiradi — throttling yo'q (imzo/Basic auth himoya qiladi).

  @Post('payme/callback')
  @RawResponse()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payme Merchant API endpoint (JSON-RPC 2.0, internal use)' })
  @ApiResponse({ status: 200, description: '{ jsonrpc, id, result } | { jsonrpc, id, error }' })
  async handlePaymeCallback(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authHeader: string | undefined,
  ): Promise<PaymeRpcResponse> {
    return this.paymeMerchant.handle(body, authHeader);
  }

  @Post('click/callback')
  @RawResponse()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Click SHOP API Prepare (action=0) / Complete (action=1) (internal use)' })
  @ApiResponse({ status: 200, description: 'Click SHOP API response object' })
  async handleClickCallback(@Body() body: Record<string, unknown>): Promise<ClickShopResponse> {
    return this.clickShop.handle(body ?? {});
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

  // --- Hamyonni to'ldirish (Payme / Click / UZPS) — docs/LEGAL-COMPLIANCE.md §11 ---
  //
  // Haydovchi/kuryer summani tanlaydi → `checkoutUrl` ni ochadi → provayder
  // callback'i (`payme|click|uzcard/callback`, merchant havolasi
  // `topup_<id>`) to'lovni tasdiqlaganda hamyonga kirim tushadi va ilovaga
  // `wallet:updated` hodisasi + push keladi. Ilova holatni shu GET bilan ham
  // so'rashi mumkin.

  @Post('wallet/topup')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Start a wallet top-up via Payme/Click/Uzcard (driver/courier)' })
  @ApiResponse({ status: 201, description: '{ topupId, checkoutUrl, ...WalletTopup }' })
  @ApiResponse({ status: 400, description: 'Disabled, amount out of range, or provider not configured' })
  async createTopup(
    @CurrentUser() user: User,
    @Body() dto: CreateWalletTopupDto,
  ): Promise<WalletTopupCheckout> {
    return this.walletTopups.create(user.id, user.phone ?? '', dto);
  }

  @Get('wallet/topups')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'My last 20 wallet top-ups' })
  async listTopups(@CurrentUser() user: User): Promise<WalletTopupView[]> {
    return this.walletTopups.listForUser(user.id);
  }

  @Get('wallet/topup/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Wallet top-up status (pending | paid | failed | cancelled | expired)' })
  @ApiParam({ name: 'id', description: 'Top-up UUID' })
  async getTopup(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WalletTopupView> {
    return this.walletTopups.getForUser(user.id, id);
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
  @Roles(UserRole.DRIVER, UserRole.MARKET, UserRole.RESTAURANT)
  @ApiOperation({ summary: 'Request a wallet withdrawal (driver, Market vendor, or Eats restaurant owner)' })
  @ApiResponse({ status: 201, description: 'Withdrawal request created' })
  @ApiResponse({ status: 400, description: 'Amount exceeds wallet balance' })
  async requestWithdrawal(
    @CurrentUser() user: User,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.paymentsService.requestWithdrawal(user.id, dto, resolveWithdrawalOwnerType(user.role));
  }

  @Get('wallet/withdrawals')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.MARKET, UserRole.RESTAURANT)
  @ApiOperation({ summary: "List the current caller's own withdrawal requests" })
  @ApiResponse({ status: 200, description: 'Withdrawal request list' })
  async getMyWithdrawals(@CurrentUser() user: User) {
    return this.paymentsService.getMyWithdrawals(user.id);
  }

  @Get('withdrawals')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.WITHDRAWALS_VIEW)
  @ApiOperation({
    summary:
      'List all withdrawal requests across every owner — driver, Market vendor, Eats ' +
      'restaurant (manager/admin only); manager can view, only admin can process',
  })
  @ApiResponse({ status: 200, description: 'Paginated withdrawal request list' })
  async getAllWithdrawals(
    @Query() query: ListWithdrawalsQueryDto,
  ) {
    return this.paymentsService.getAllWithdrawals(query.status, query.page ?? 1, query.limit ?? 20);
  }

  @Patch('wallet/withdrawals/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.WITHDRAWALS_APPROVE)
  @ApiOperation({ summary: 'Approve, reject, or mark a withdrawal request paid (admin, or manager with withdrawals_approve)' })
  @ApiParam({ name: 'id', description: 'Withdrawal request UUID' })
  @ApiResponse({ status: 200, description: 'Withdrawal request updated' })
  async processWithdrawal(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.paymentsService.processWithdrawal(id, dto, actor.id);
  }
}
