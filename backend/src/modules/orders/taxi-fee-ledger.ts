import { EntityManager } from 'typeorm';
import { Order, PaymentMethod } from '../../database/entities/order.entity';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import {
  computeSpendableBalance,
  DriverBalanceSync,
  lockWalletForUpdate,
  syncDriverBalanceColumn,
} from '../payments/wallet-balance.util';
import { TAXI_FEE_CHARGE_TAG, TAXI_FEE_PAYOUT_TAG } from './taxi-cancel-policy';

export type TaxiFeeKind = 'late_cancel' | 'no_show';

export interface TaxiFeeInput {
  orderId: string;
  passengerId: string;
  driverUserId: string;
  fee: number;
  kind: TaxiFeeKind;
  /** Kim bekor qildi / belgiladi (yo'lovchi yoki haydovchi). */
  actorUserId: string;
}

export interface TaxiFeeResult {
  /** `completed` — hamyondan yechildi; `pending` — yo'lovchi qarzi. */
  status: TransactionStatus.COMPLETED | TransactionStatus.PENDING;
  driverBalance: DriverBalanceSync;
}

/**
 * Kech bekor qilish / kelmaslik jarimasi (INCIDENT-POLICY §5) — chaqiruvchi
 * tranzaksiyasida, bekor qilish bilan BIRGA.
 *
 *  · Yo'lovchi: hamyon DEBIT (`taxi_fee_charge_<order>`). Sarflanadigan qoldiq
 *    yetsa COMPLETED, yetmasa PENDING — mavjud qarz mexanizmi
 *    (`outstanding-wallet-debt.ts`): to'lanmaguncha yangi buyurtma berilmaydi.
 *  · Haydovchi: TO'LIQ summa CREDIT (`taxi_fee_payout_<order>`), KOMISSIYASIZ.
 *    Holati yo'lovchi to'lovi bilan bir xil — yig'ilmagan pul haydovchiga
 *    sarflanadigan bo'lib yozilmaydi (hamyon yetmagan safar bilan bir xil
 *    qoida, `orders-completion.service.ts`).
 *  · Ikkala qator ham `uq_transactions_taxi_fee` bilan buyurtmaga bir marta.
 *  · Audit `order.cancel_fee` — shu tranzaksiyada.
 */
export async function chargeTaxiFee(
  manager: EntityManager,
  auditLog: AuditLogService,
  input: TaxiFeeInput,
): Promise<TaxiFeeResult> {
  await lockWalletForUpdate(manager, input.passengerId);
  const ledger = manager.getRepository(Transaction);
  const balance = await computeSpendableBalance(ledger, input.passengerId);
  const status = balance >= input.fee ? TransactionStatus.COMPLETED : TransactionStatus.PENDING;

  await manager.save(Transaction, {
    userId: input.passengerId,
    orderId: input.orderId,
    amount: input.fee,
    type: TransactionType.DEBIT,
    paymentMethod: PaymentMethod.WALLET,
    status,
    externalId: TAXI_FEE_CHARGE_TAG(input.orderId),
  });

  await lockWalletForUpdate(manager, input.driverUserId);
  await manager.save(Transaction, {
    userId: input.driverUserId,
    orderId: input.orderId,
    amount: input.fee,
    type: TransactionType.CREDIT,
    paymentMethod: PaymentMethod.WALLET,
    status,
    externalId: TAXI_FEE_PAYOUT_TAG(input.orderId),
  });
  const driverBalance = await syncDriverBalanceColumn(manager, input.driverUserId);

  await manager.update(Order, { id: input.orderId }, { cancellationFee: input.fee });
  await auditLog.record(
    {
      actorUserId: input.actorUserId,
      action: AUDIT_ACTIONS.orderCancelFee,
      targetType: 'order',
      targetId: input.orderId,
      amount: input.fee,
      metadata: { kind: input.kind, status, passengerId: input.passengerId, driverUserId: input.driverUserId },
    },
    manager,
  );
  return { status, driverBalance };
}
