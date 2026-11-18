import { EntityManager } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { lockWalletForUpdate } from './wallet-balance.util';

export interface OrderPayoutRelease {
  driverUserId: string;
  /** Hamyonga ochilgan sof summa (CREDIT − DEBIT). */
  netPayout: number;
  /** `drivers.id`. */
  driverId: string;
  wentOffline: boolean;
}

type BalanceSync = (
  manager: EntityManager,
  userId: string,
  delta: number,
) => Promise<{ driverId: string; wentOffline: boolean }>;

/**
 * Haydovchining shu buyurtmadagi PENDING oyoqlarini COMPLETED qiladi —
 * chaqiruvchi tranzaksiyasida, haydovchi hamyoni qulfi ostida.
 *
 * Alohida fayl, chunki uni ikki oqim ishlatadi: `PaymentsService.settleOrderPayout`
 * (karta to'lovi) va `WalletDebtService` (hamyon qarzi). Ikkinchisi
 * `PaymentsService` ni ololmaydi: u `WalletTopupCallbacksService` →
 * `WalletTopupsService` → `WalletDebtService` orqali aylana yasardi.
 *
 * Takroriy chaqiruv PENDING oyoq topmaydi — haydovchiga ikki marta to'lanmaydi.
 */
export async function releaseOrderPayoutWithin(
  manager: EntityManager,
  syncBalance: BalanceSync,
  orderId: string,
  driverUserId: string,
): Promise<OrderPayoutRelease | null> {
  await lockWalletForUpdate(manager, driverUserId);

  const transactionRepo = manager.getRepository(Transaction);
  const pendingLegs = await transactionRepo.find({
    where: { orderId, userId: driverUserId, status: TransactionStatus.PENDING },
  });
  if (pendingLegs.length === 0) return null;

  let netPayout = 0;
  for (const leg of pendingLegs) {
    netPayout += leg.type === TransactionType.CREDIT ? leg.amount : -leg.amount;
    await transactionRepo.update({ id: leg.id }, { status: TransactionStatus.COMPLETED });
  }
  if (netPayout === 0) return { driverUserId, netPayout, driverId: '', wentOffline: false };

  const synced = await syncBalance(manager, driverUserId, netPayout);
  return { driverUserId, netPayout, driverId: synced.driverId, wentOffline: synced.wentOffline };
}
