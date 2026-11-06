import type { IncidentPartyRole } from '../../database/entities/incident.entity';
import { IncidentCategory, ReporterSide, customerSubjectChoice } from './incident-policy';
import type { IncidentOrderContext, OrderParty } from './incident-orders';

export type SubjectChoice = 'courier' | 'driver' | 'vendor' | 'customer';

export interface IncidentSubject {
  userId: string;
  role: IncidentPartyRole;
}

/** Sotuvchi mijoz haqida yozadigan toifalar (aniq tanlanmasa). */
const VENDOR_ABOUT_CUSTOMER: readonly IncidentCategory[] = ['no_show', 'did_not_pay'];

export const SIDE_OF_PARTY: Record<OrderParty, ReporterSide> = {
  customer: 'customer',
  driver: 'driver',
  vendor: 'vendor',
};

export const REPORTER_ROLE_OF_PARTY: Record<OrderParty, IncidentPartyRole> = {
  customer: 'passenger',
  driver: 'driver',
  vendor: 'vendor',
};

function pick(ctx: IncidentOrderContext, who: 'driver' | 'vendor' | 'customer'): IncidentSubject | null {
  if (who === 'driver') return ctx.driverUserId ? { userId: ctx.driverUserId, role: 'driver' } : null;
  if (who === 'vendor') return ctx.vendorOwnerId ? { userId: ctx.vendorOwnerId, role: 'vendor' } : null;
  return { userId: ctx.customerId, role: 'passenger' };
}

/**
 * Kim haqida shikoyat: xabarchi tomoni + toifa + (ixtiyoriy) aniq tanlov.
 * `party = null` — menejer o'zi ochmoqda. O'zi haqida shikoyat — `null`.
 */
export function resolveSubject(
  ctx: IncidentOrderContext,
  party: OrderParty | null,
  category: IncidentCategory,
  choice?: SubjectChoice,
): IncidentSubject | null {
  const normalized = choice === 'courier' ? 'driver' : choice;
  let subject: IncidentSubject | null;
  if (party === 'customer') {
    const explicit = normalized === 'vendor' ? 'vendor' : normalized === 'driver' ? 'courier' : undefined;
    const target = customerSubjectChoice(category, explicit) === 'vendor' ? 'vendor' : 'driver';
    subject = ctx.vertical === 'taxi' ? pick(ctx, 'driver') : pick(ctx, target);
  } else if (party === 'driver') {
    subject = normalized === 'vendor' && ctx.vertical !== 'taxi' ? pick(ctx, 'vendor') : pick(ctx, 'customer');
  } else if (party === 'vendor') {
    const who = normalized ?? (VENDOR_ABOUT_CUSTOMER.includes(category) ? 'customer' : 'driver');
    subject = pick(ctx, who === 'vendor' ? 'driver' : who);
  } else {
    subject = normalized ? pick(ctx, normalized) : (pick(ctx, 'driver') ?? pick(ctx, 'customer'));
  }
  return subject;
}
