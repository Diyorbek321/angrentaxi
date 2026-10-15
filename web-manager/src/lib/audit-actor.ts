import type { AuditLogActor } from './api';

/** `users.role` → o'zbekcha nom (backend `UserRole`). */
export const AUDIT_ROLE_LABEL: Readonly<Record<string, string>> = {
  admin: 'Admin',
  manager: 'Menejer',
  driver: 'Haydovchi',
  passenger: 'Yoʻlovchi',
  market: 'Doʻkon',
  restaurant: 'Restoran',
};

export interface AuditActorView {
  /** Asosiy matn: ism → telefon → "Foydalanuvchi oʻchirilgan" / "Tizim". */
  name: string;
  /** Rol nomi; tizim amalida `null`. */
  role: string | null;
  isSystem: boolean;
}

/**
 * Audit yozuvidagi `actor` (§22) ni ko'rsatish shakliga keltiradi.
 * `actor = null` va `actorUserId` bor — foydalanuvchi o'chirilgan;
 * ikkalasi ham yo'q — tizim amali (masalan `payment.refund_clawback`).
 */
export function auditActorView(
  actor: AuditLogActor | null | undefined,
  actorUserId: string | null,
  formatPhone: (phone: string) => string = (p) => p
): AuditActorView {
  if (!actor) {
    return actorUserId
      ? { name: 'Foydalanuvchi oʻchirilgan', role: null, isSystem: false }
      : { name: 'Tizim', role: null, isSystem: true };
  }
  const name = actor.name?.trim() || (actor.phone ? formatPhone(actor.phone) : 'Ism kiritilmagan');
  return { name, role: AUDIT_ROLE_LABEL[actor.role] ?? actor.role, isSystem: false };
}
