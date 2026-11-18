import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { UsersService, ACCOUNT_DELETED_REASON } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { blockedPush } from './incident-texts';

/**
 * Bloklanganda push — sabab bilan (INCIDENT-POLICY §3). Admin bloki ham,
 * hodisa natijasidagi blok ham `UsersService` tinglovchilari orqali o'tadi.
 * O'z hisobini o'chirgan foydalanuvchiga push yuborilmaydi.
 */
@Injectable()
export class IncidentBlockNotifier implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  onModuleInit(): void {
    this.usersService.onUserBlocked?.((userId) => this.notifyBlocked(userId));
  }

  async notifyBlocked(userId: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'blockReason'] });
    if (!user || user.blockReason === ACCOUNT_DELETED_REASON) return;
    await this.notifications.notifyUserIds([userId], blockedPush(user.blockReason?.trim() || '—'), 'account_blocked');
  }
}
