import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';

export type VendorKind = 'restaurant' | 'store';

/**
 * Admin sotuvchining STIR'ini (fiskal chekdagi komitent, §3) o'rnatadi yoki
 * tozalaydi. O'zgarish va `audit_logs` yozuvi BITTA tranzaksiyada
 * (`vendor.tin_update`, metadata: eski/yangi qiymat). Qiymat o'zgarmasa —
 * hech narsa yozilmaydi.
 */
@Injectable()
export class VendorTinService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLog: AuditLogService,
  ) {}

  async setTin(
    actorUserId: string,
    kind: VendorKind,
    vendorId: string,
    tin: string | null,
  ): Promise<Restaurant | Store> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository<Restaurant | Store>(kind === 'restaurant' ? Restaurant : Store);
      const vendor = await repo.findOne({ where: { id: vendorId } });
      if (!vendor) {
        throw new NotFoundException(kind === 'restaurant' ? 'Restaurant not found' : 'Store not found');
      }
      const previousTin = vendor.tin ?? null;
      if (previousTin === tin) return vendor;

      const saved = await repo.save({ ...vendor, tin });
      await this.auditLog.record(
        {
          actorUserId,
          action: AUDIT_ACTIONS.vendorTinUpdate,
          targetType: kind,
          targetId: vendorId,
          metadata: { previousTin, tin, name: vendor.name },
        },
        manager,
      );
      return saved;
    });
  }
}
