import { ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import {
  SupportThread,
  SupportThreadStatus,
} from '../../database/entities/support-thread.entity';
import { SupportMessage } from '../../database/entities/support-message.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

export interface SupportThreadListItem extends SupportThread {
  userName: string;
  userPhone: string;
  unreadCount: number;
}

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportThread)
    private readonly threadRepository: Repository<SupportThread>,
    @InjectRepository(SupportMessage)
    private readonly messageRepository: Repository<SupportMessage>,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  private isOperator(user: User): boolean {
    return user.role === UserRole.MANAGER || user.role === UserRole.ADMIN;
  }

  private assertCanAccess(thread: SupportThread, user: User): void {
    if (thread.userId !== user.id && !this.isOperator(user)) {
      throw new ForbiddenException('You cannot access this support thread');
    }
  }

  /**
   * Public, id-based access check for callers that hold only a thread id —
   * currently the realtime gateway, which must apply the same rule before
   * joining a socket to `support:thread:<id>` as the REST reads do.
   */
  async assertCanAccessThread(threadId: string, user: User): Promise<void> {
    const thread = await this.findByIdOrThrow(threadId);
    this.assertCanAccess(thread, user);
  }

  async getOrCreateForUser(user: User): Promise<SupportThread> {
    const existing = await this.threadRepository.findOne({ where: { userId: user.id } });
    if (existing) {
      return existing;
    }

    const created = await this.threadRepository.save({
      userId: user.id,
      userRole: user.role === UserRole.DRIVER ? 'driver' : 'passenger',
      status: SupportThreadStatus.OPEN,
    });

    this.realtimeGateway.emitToManagers('support:thread:updated', created);
    return created;
  }

  async findByIdOrThrow(id: string): Promise<SupportThread> {
    const thread = await this.threadRepository.findOne({ where: { id } });
    if (!thread) {
      throw new NotFoundException(`Support thread ${id} not found`);
    }
    return thread;
  }

  async getMessages(
    threadId: string,
    requester: User,
    page = 1,
    limit = 50,
  ): Promise<{ messages: SupportMessage[]; total: number; page: number; limit: number }> {
    const thread = await this.findByIdOrThrow(threadId);
    this.assertCanAccess(thread, requester);

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { threadId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { messages, total, page, limit };
  }

  async postMessage(threadId: string, sender: User, body: string): Promise<SupportMessage> {
    const thread = await this.findByIdOrThrow(threadId);
    this.assertCanAccess(thread, sender);

    const operatorSending = this.isOperator(sender);
    const senderRole = operatorSending
      ? (sender.role === UserRole.ADMIN ? 'admin' : 'manager')
      : thread.userRole;

    const message = await this.messageRepository.save({
      threadId,
      senderId: sender.id,
      senderRole,
      body,
    });

    // A customer message reopens a closed thread; an operator reply doesn't
    // change status — closing/reopening is an explicit operator action.
    await this.threadRepository.update(thread.id, {
      lastMessageAt: message.createdAt,
      ...(!operatorSending && thread.status === SupportThreadStatus.CLOSED
        ? { status: SupportThreadStatus.OPEN }
        : {}),
    });
    const updatedThread = await this.findByIdOrThrow(thread.id);

    this.realtimeGateway.emitToUser(thread.userId, 'support:message:new', message);
    this.realtimeGateway.emitToRoom(`support:thread:${threadId}`, 'support:message:new', message);
    this.realtimeGateway.emitToManagers('support:thread:updated', updatedThread);
    if (!operatorSending) {
      this.realtimeGateway.emitToUser(thread.userId, 'support:thread:updated', updatedThread);
    }

    // Notify the customer (push) when an operator replies — mirrors the
    // fire-and-forget pattern used by notifyOrderAccepted etc.
    if (operatorSending) {
      const recipient = await this.usersService.findById(thread.userId);
      if (recipient) {
        await this.notificationsService.notifySupportReply(recipient);
      }
    }

    return message;
  }

  async markRead(threadId: string, user: User): Promise<void> {
    const thread = await this.findByIdOrThrow(threadId);
    this.assertCanAccess(thread, user);

    const now = new Date();
    await this.threadRepository.update(
      thread.id,
      this.isOperator(user) ? { lastReadAtOperator: now } : { lastReadAtUser: now },
    );
  }

  async setStatus(threadId: string, status: SupportThreadStatus): Promise<SupportThread> {
    await this.findByIdOrThrow(threadId);
    await this.threadRepository.update(threadId, { status });
    const updated = await this.findByIdOrThrow(threadId);

    this.realtimeGateway.emitToUser(updated.userId, 'support:thread:updated', updated);
    this.realtimeGateway.emitToManagers('support:thread:updated', updated);
    return updated;
  }

  async listThreads(
    status: SupportThreadStatus | undefined,
    page = 1,
    limit = 20,
  ): Promise<{ threads: SupportThreadListItem[]; total: number; page: number; limit: number }> {
    const [threads, total] = await this.threadRepository.findAndCount({
      where: status ? { status } : {},
      order: { lastMessageAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items = await Promise.all(
      threads.map(async (thread) => {
        const user = await this.usersService.findById(thread.userId);
        const unreadCount = await this.countUnread(thread.id, thread.lastReadAtOperator);
        const userName =
          [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
          user?.phone ||
          "Noma'lum";

        return {
          ...thread,
          userName,
          userPhone: user?.phone ?? '',
          unreadCount,
        };
      }),
    );

    return { threads: items, total, page, limit };
  }

  private async countUnread(threadId: string, since: Date | null): Promise<number> {
    if (!since) {
      return this.messageRepository.count({ where: { threadId } });
    }
    return this.messageRepository.count({ where: { threadId, createdAt: MoreThan(since) } });
  }
}
