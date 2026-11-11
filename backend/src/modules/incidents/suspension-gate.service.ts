import { Global, Injectable, Module } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { SuspensionAction, assertNotSuspended } from './suspension';

/**
 * To'xtatish darvozasi — buyurtma va onlayn yo'llari shuni chaqiradi.
 * Global modul: buyurtma, ovqat, market, shaharlararo va haydovchi
 * modullari incidents modulini import qilmasdan (aylanma bog'liqliksiz)
 * ishlatadi. Ular uni `@Optional()` oladi — qo'lda yig'iladigan eski
 * spec'larda darvoza yo'q.
 */
@Injectable()
export class SuspensionGate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async assertMay(userId: string, action: SuspensionAction, now: Date = new Date()): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'suspendedUntil', 'suspensionReason'],
    });
    assertNotSuspended(user, action, now);
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [SuspensionGate],
  exports: [SuspensionGate],
})
export class SuspensionModule {}
