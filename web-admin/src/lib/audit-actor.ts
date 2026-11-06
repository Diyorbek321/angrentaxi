import type { AuditLogActor } from './compliance-api';
import { t } from '@/locales';
import { nameFallback } from './format';

/** `users.role` → faol tildagi nom (backend `UserRole`). */
export function auditRoleLabels(): Readonly<Record<string, string>> {
  return t().audit.roleLabels;
}

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
  const a = t().audit.actor;
  if (!actor) {
    return actorUserId
      ? { name: a.deletedUser, role: null, isSystem: false }
      : { name: a.system, role: null, isSystem: true };
  }
  const name = actor.name?.trim() || (actor.phone ? formatPhone(actor.phone) : nameFallback());
  return { name, role: auditRoleLabels()[actor.role] ?? actor.role, isSystem: false };
}
