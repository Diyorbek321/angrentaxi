/**
 * Shikoyat va hodisa (docs/INCIDENT-POLICY.md §3) — panel tomonidagi turlar
 * va sof yordamchilar. Server shakli: `backend/src/modules/incidents`.
 */

export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'rejected';
export type IncidentVertical = 'taxi' | 'food' | 'market';
export type IncidentSource = 'user' | 'manager' | 'rating_signal' | 'low_rating';
export type IncidentOutcomeType =
  | 'warning'
  | 'suspension'
  | 'block'
  | 'refund'
  | 'compensation'
  | 'penalty'
  | 'no_action';
export type StrikeSuggestion = 'none' | 'warning' | 'suspension' | 'escalate_block';

export const INCIDENT_CATEGORIES = [
  'rude',
  'dangerous_driving',
  'detour',
  'overcharge',
  'smoking',
  'dirty_car',
  'harassment',
  'safety',
  'drunk_passenger',
  'vehicle_damage',
  'did_not_pay',
  'no_show',
  'damaged_goods',
  'wrong_items',
  'cold_food',
  'lost_cargo',
  'other',
  'rating_signal',
  'low_rating',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const SAFETY_CATEGORIES: readonly string[] = ['harassment', 'safety'];
export const OUTCOME_TYPES: readonly IncidentOutcomeType[] = [
  'warning',
  'suspension',
  'block',
  'refund',
  'compensation',
  'penalty',
  'no_action',
];
export const MONEY_OUTCOMES: readonly IncidentOutcomeType[] = ['refund', 'compensation', 'penalty'];

export interface IncidentOutcomeRecord {
  type: IncidentOutcomeType;
  amount?: number;
  targetUserId?: string | null;
  refundMethod?: 'wallet' | 'card';
  days?: number;
  until?: string;
  automatic?: boolean;
  liftedAt?: string;
  auditLogId: string | null;
  actorUserId: string | null;
  at: string;
}

export interface IncidentParty {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
  suspendedUntil: string | null;
  driverRating: number | null;
  passengerRating: number | null;
  passengerRatingCount: number;
}

export interface IncidentItem {
  id: string;
  reporterUserId: string | null;
  reporterRole: string;
  subjectUserId: string | null;
  subjectRole: string | null;
  orderVertical: IncidentVertical | null;
  orderId: string | null;
  category: string;
  description: string;
  /** Faqat indekslar (`'0'`, `'1'`) — saqlash kaliti panelga berilmaydi. */
  photoKeys: string[];
  status: IncidentStatus;
  source: IncidentSource;
  assignedManagerId: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  confirmedAgainstSubject: boolean;
  outcomes: IncidentOutcomeRecord[];
  safetySuspended: boolean;
  escalatedToAdmin: boolean;
  appealedAt: string | null;
  appealNote: string | null;
  appealDecision: 'upheld' | 'overturned' | null;
  createdAt: string;
  ageHours: number;
  reporter: IncidentParty | null;
  subject: IncidentParty | null;
}

export interface IncidentPage {
  items: IncidentItem[];
  total: number;
  page: number;
  limit: number;
}

export interface IncidentOrderContext {
  vertical: IncidentVertical;
  orderId: string;
  rideOrderId: string | null;
  customerId: string;
  driverUserId: string | null;
  vendorOwnerId: string | null;
  vendorName: string | null;
  status: string;
  endedAt: string | null;
  paymentMethod: string | null;
  totalPrice: number | null;
}

export interface IncidentDetail extends IncidentItem {
  order: IncidentOrderContext | null;
  evidence: {
    ratings: Array<{ id: string; fromRole: string; score: number; comment: string | null; createdAt: string }>;
    sos: Array<{ id: string; status: string; reportedByRole: string; createdAt: string; resolvedAt: string | null }>;
    lostItems: Array<{ id: string; status: string; description: string; createdAt: string }>;
    photoCount: number;
  };
  strikes: {
    confirmed: number;
    windowDays: number;
    suggestion: StrikeSuggestion;
    thresholds: { warningAt: number; suspensionAt: number; blockAt: number };
  } | null;
  subjectHistory: Array<{ id: string; category: string; status: IncidentStatus; confirmedAgainstSubject: boolean; createdAt: string }>;
}

export type SlaTone = 'ok' | 'warn' | 'late';

/** SLA nishoni: < 24 soat — oddiy, 24–48 — ogohlantirish, > 48 — kechikdi. Yopilganda — `null`. */
export function slaTone(item: Pick<IncidentItem, 'status' | 'ageHours'>): SlaTone | null {
  if (item.status !== 'open' && item.status !== 'investigating') return null;
  if (item.ageHours >= 48) return 'late';
  if (item.ageHours >= 24) return 'warn';
  return 'ok';
}

export function isActive(status: IncidentStatus): boolean {
  return status === 'open' || status === 'investigating';
}

/** Admin kutilmoqda: xavfsizlik, blok pog'onasi yoki ko'rilmagan e'tiroz. */
export function needsAdmin(item: Pick<IncidentItem, 'escalatedToAdmin' | 'appealedAt' | 'appealDecision'>): boolean {
  return item.escalatedToAdmin || (item.appealedAt != null && item.appealDecision == null);
}

export function isPendingAppeal(item: Pick<IncidentItem, 'appealedAt' | 'appealDecision'>): boolean {
  return item.appealedAt != null && item.appealDecision == null;
}

/** Natija formasi (panel holati). Summalar — matn (input), kunlar — matn. */
export interface OutcomeDraft {
  type: IncidentOutcomeType;
  amount: string;
  days: string;
  refundMethod: 'wallet' | 'card';
}

export interface ResolveDraft {
  status: 'resolved' | 'rejected';
  note: string;
  confirmedAgainstSubject: boolean;
  outcomes: OutcomeDraft[];
  appealDecision: 'upheld' | 'overturned' | null;
}

export interface ResolvePayload {
  status: 'resolved' | 'rejected';
  note: string;
  confirmedAgainstSubject: boolean;
  outcomes: Array<{ type: IncidentOutcomeType; amount?: number; days?: number; refundMethod?: 'wallet' | 'card' }>;
  appealDecision?: 'upheld' | 'overturned';
}

export type ResolveProblem = 'note' | 'amount' | 'days' | 'appeal' | 'no_action_alone' | 'block_admin';

/** Formani serverga yuboriladigan shaklga o'giradi; muammo bo'lsa — ro'yxat (server ham tekshiradi). */
export function buildResolvePayload(
  draft: ResolveDraft,
  opts: { pendingAppeal: boolean; isAdmin: boolean },
): { payload: ResolvePayload | null; problems: ResolveProblem[] } {
  const problems: ResolveProblem[] = [];
  const note = draft.note.trim();
  if (note.length < 3) problems.push('note');
  if (opts.pendingAppeal && !draft.appealDecision) problems.push('appeal');
  const outcomes = draft.status === 'rejected' ? [] : draft.outcomes;
  if (outcomes.some((o) => o.type === 'no_action') && outcomes.length > 1) problems.push('no_action_alone');
  if (!opts.isAdmin && outcomes.some((o) => o.type === 'block')) problems.push('block_admin');
  const mapped = outcomes.map((o) => {
    if (MONEY_OUTCOMES.includes(o.type)) {
      const amount = Number(o.amount.replace(/\s/g, ''));
      if (!Number.isInteger(amount) || amount <= 0) problems.push('amount');
      return { type: o.type, amount, ...(o.type === 'refund' ? { refundMethod: o.refundMethod } : {}) };
    }
    if (o.type === 'suspension') {
      if (o.days.trim() === '') return { type: o.type };
      const days = Number(o.days);
      if (!Number.isInteger(days) || days < 1 || days > 90) problems.push('days');
      return { type: o.type, days };
    }
    return { type: o.type };
  });
  if (problems.length > 0) return { payload: null, problems: Array.from(new Set(problems)) };
  return {
    payload: {
      status: draft.status,
      note,
      confirmedAgainstSubject: draft.status === 'resolved' && draft.confirmedAgainstSubject,
      outcomes: mapped,
      ...(opts.pendingAppeal && draft.appealDecision ? { appealDecision: draft.appealDecision } : {}),
    },
    problems: [],
  };
}

/** Zinapoya taklifini natija qoralamasiga aylantiradi (menejer bir bosishda qo'shadi). */
export function suggestedOutcome(suggestion: StrikeSuggestion): IncidentOutcomeType | null {
  if (suggestion === 'warning') return 'warning';
  if (suggestion === 'suspension') return 'suspension';
  return null;
}

export function emptyOutcome(type: IncidentOutcomeType): OutcomeDraft {
  return { type, amount: '', days: '', refundMethod: 'wallet' };
}

/** Taksi safari — `taxi`; ovqat/market kuryer safari — sotuvchi buyurtmasi ham qidiriladi. */
export function orderIncidentTargets(order: {
  id: string;
  details?: Record<string, unknown> | null;
}): Array<{ vertical: IncidentVertical; id: string }> {
  const targets: Array<{ vertical: IncidentVertical; id: string }> = [{ vertical: 'taxi', id: order.id }];
  const food = order.details?.foodOrderId;
  const market = order.details?.marketOrderId;
  if (typeof food === 'string') targets.push({ vertical: 'food', id: food });
  if (typeof market === 'string') targets.push({ vertical: 'market', id: market });
  return targets;
}

