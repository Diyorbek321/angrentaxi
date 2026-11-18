import { EntityManager } from 'typeorm';

/**
 * Chaqiruvchining DB tranzaksiyasi (security review #8): merchant protokoli
 * tranzaksiya holatini (`created → performed`) pul effekti bilan BITTA
 * tranzaksiyada da'vo qiladi. Pul servislari shu `manager` ichida yozadi,
 * push/realtime/Redis kabi tashqi effektlarni esa `afterCommit` ga qo'yadi —
 * ular faqat commit'dan keyin bajariladi.
 */
export interface MoneyContext {
  manager: EntityManager;
  afterCommit: Array<() => Promise<void>>;
}

export function newMoneyContext(manager: EntityManager): MoneyContext {
  return { manager, afterCommit: [] };
}

/** Commit'dan keyingi effektlar — biri yiqilsa qolganlari baribir bajariladi. */
export async function runAfterCommit(
  ctx: MoneyContext | null,
  onError: (err: Error) => void,
): Promise<void> {
  if (!ctx) return;
  for (const effect of ctx.afterCommit) {
    try {
      await effect();
    } catch (err) {
      onError(err as Error);
    }
  }
}
