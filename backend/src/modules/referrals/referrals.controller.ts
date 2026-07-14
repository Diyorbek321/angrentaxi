import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReferralsService, MyReferralInfo } from './referrals.service';
import { ApplyReferralCodeDto } from './dto/apply-referral-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('Referrals')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users/me/referral')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's referral code, referred count, and bonus earned" })
  @ApiResponse({ status: 200, description: 'Referral info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyReferralInfo(@CurrentUser() user: User): Promise<MyReferralInfo> {
    return this.referralsService.getMyReferralInfo(user.id);
  }

  @Post('apply')
  @ApiOperation({ summary: "Apply another user's referral code to the current account" })
  @ApiResponse({ status: 200, description: 'Referral code applied' })
  @ApiResponse({ status: 400, description: 'Invalid code, self-referral, or already applied' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async applyReferralCode(
    @CurrentUser() user: User,
    @Body() dto: ApplyReferralCodeDto,
  ): Promise<User> {
    return this.referralsService.applyReferralCode(user.id, dto.code);
  }
}
