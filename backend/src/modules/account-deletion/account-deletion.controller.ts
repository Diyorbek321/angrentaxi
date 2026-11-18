import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { AccountDeletionEligibility, AccountDeletionService } from './account-deletion.service';

/** Hisobni o'chirish — faqat o'z hisobi (id parametri yo'q: boshqaning hisobini o'chirib bo'lmaydi). */
@ApiTags('Account')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('account')
export class AccountDeletionController {
  constructor(private readonly service: AccountDeletionService) {}

  @Get('deletion-eligibility')
  @ApiOperation({ summary: "Can the current user delete their account now? Lists every blocking reason" })
  eligibility(@CurrentUser() user: User): Promise<AccountDeletionEligibility> {
    return this.service.getEligibility(user);
  }

  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete (anonymise) the current user account and revoke all sessions' })
  @ApiResponse({ status: 409, description: 'ACCOUNT_DELETION_BLOCKED — reasons[] lists what to resolve first' })
  @ApiResponse({ status: 403, description: 'ACCOUNT_DELETION_NOT_ALLOWED — staff/vendor accounts' })
  async delete(@CurrentUser() user: User): Promise<{ deleted: true }> {
    await this.service.deleteOwnAccount(user);
    return { deleted: true };
  }

  /**
   * Ilovaga kira olmagan foydalanuvchining so'rovi (veb-sahifadagi yo'l):
   * support raqam egasini tasdiqlagach, ADMIN o'chiradi. Xuddi o'sha
   * to'siqlar va anonimlashtirish; jurnalda bajaruvchi — admin.
   */
  @Delete(':userId')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Delete a user's account on their verified request (admin only)" })
  async deleteOnRequest(
    @CurrentUser() admin: User,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ deleted: true }> {
    await this.service.deleteOnRequest(userId, admin.id);
    return { deleted: true };
  }
}
