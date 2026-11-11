/**
 * Huquqiy talablar va moliya sozlamalari API'si (docs/LEGAL-COMPLIANCE.md).
 * `lib/api.ts` 800 qatorga yaqin — yangi bo'limlar shu yerda, o'sha axios
 * instansiyasi (proxy + 401 refresh) orqali.
 */
import api, { type ApiResponse } from './api';

// ─── Settings ─────────────────────────────────────────────────────

export interface CommissionSettings {
  defaultCommissionRate: number;
  /** ISO; shu paytgacha taksi komissiyasi 0%. `null` — aksiya yo'q. */
  launchPromoCommissionUntil: string | null;
  launchPromoActive: boolean;
}

export interface ShiftPassSettings {
  shiftPassEnabled: boolean;
  shiftPassPrice: number;
  shiftPassDurationHours: number;
  shiftPassServiceTypes: string[];
}

export interface WalletTopupSettings {
  walletTopupEnabled: boolean;
  walletTopupMin: number;
  walletTopupMax: number;
  walletTopupPresets: number[];
  /** 0 — o'chiq; standart 7, ≤ 90 (§25 #3a). Eski backend bermasligi mumkin. */
  walletTopupHoldDays?: number;
  /** So'm; standart 2 000 000, ≤ 5 000 000 (§25 #6). */
  manualAdjustmentManagerLimit?: number;
}

export type VendorSettlementMode = 'cash' | 'wallet';

export interface VendorSettlementSettings {
  vendorSettlementMode: VendorSettlementMode;
  vendorWalletSettlementFrom: string | null;
  effectiveVendorSettlementMode: VendorSettlementMode;
}

export interface LegalComplianceSettings {
  legalComplianceEnforcedFrom: string | null;
  minDriverAgeYears: number;
  minLicenceExperienceYears: number;
  maxVehicleAgeYears: number;
  taxWithholdingEnabled: boolean;
  /** Foiz: 1.0 = 1%. */
  driverTaxWithholdingRate: number;
  platformTin: string | null;
}

export const financeSettingsApi = {
  getCommission: () => api.get<ApiResponse<CommissionSettings>>('/settings/commission'),
  setLaunchPromo: (launchPromoCommissionUntil: string | null) =>
    api.patch<ApiResponse<CommissionSettings>>('/settings/commission/launch-promo', {
      launchPromoCommissionUntil,
    }),
  getShiftPass: () => api.get<ApiResponse<ShiftPassSettings>>('/settings/shift-pass'),
  updateShiftPass: (dto: Partial<ShiftPassSettings>) =>
    api.patch<ApiResponse<ShiftPassSettings>>('/settings/shift-pass', dto),
  getWalletTopup: () => api.get<ApiResponse<WalletTopupSettings>>('/settings/wallet-topup'),
  updateWalletTopup: (dto: Partial<WalletTopupSettings>) =>
    api.patch<ApiResponse<WalletTopupSettings>>('/settings/wallet-topup', dto),
  getVendorSettlement: () => api.get<ApiResponse<VendorSettlementSettings>>('/settings/vendor-settlement'),
  updateVendorSettlement: (dto: {
    vendorSettlementMode?: VendorSettlementMode;
    vendorWalletSettlementFrom?: string | null;
  }) => api.patch<ApiResponse<VendorSettlementSettings>>('/settings/vendor-settlement', dto),
  getLegalCompliance: () => api.get<ApiResponse<LegalComplianceSettings>>('/settings/legal-compliance'),
  updateLegalCompliance: (dto: Partial<LegalComplianceSettings>) =>
    api.patch<ApiResponse<LegalComplianceSettings>>('/settings/legal-compliance', dto),
};

// ─── Tax withholding report ──────────────────────────────────────

export interface TaxReportEntry {
  userId: string;
  name: string | null;
  phone: string | null;
  pinfl: string | null;
  tin: string | null;
  taxStatus: string | null;
  grossIncome: number;
  withheldAmount: number;
  pendingWithheldAmount: number;
  orderCount: number;
}

export interface TaxWithholdingReport {
  month: string;
  from: string;
  to: string;
  rows: TaxReportEntry[];
  totals: {
    grossIncome: number;
    withheldAmount: number;
    pendingWithheldAmount: number;
    orderCount: number;
  };
}

export const taxReportApi = {
  get: (month: string) =>
    api.get<ApiResponse<TaxWithholdingReport>>('/admin/tax-withholding/report', { params: { month } }),
  /** CSV konvertsiz keladi (UTF-8 BOM) — blob sifatida. */
  csv: (month: string) =>
    api.get<Blob>('/admin/tax-withholding/report.csv', { params: { month }, responseType: 'blob' }),
};

// ─── Fiscal receipts ─────────────────────────────────────────────

export type FiscalReceiptStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type FiscalPrincipalType = 'driver' | 'restaurant' | 'store' | 'platform';

export interface FiscalReceipt {
  id: string;
  orderId: string;
  serviceType: string;
  principalType: FiscalPrincipalType;
  principalId: string | null;
  principalPinfl: string | null;
  principalTin: string | null;
  platformRole: string;
  total: number;
  commissionAmount: number;
  paymentMethod: string;
  status: FiscalReceiptStatus;
  provider: string;
  externalId: string | null;
  fiscalSign: string | null;
  qrUrl: string | null;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface FiscalReceiptQuery {
  status?: FiscalReceiptStatus;
  serviceType?: string;
  principalType?: FiscalPrincipalType;
  orderId?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface FiscalReceiptList {
  items: FiscalReceipt[];
  total: number;
  page: number;
  limit: number;
  /** Holat bo'yicha sanoq — status filtridan tashqari, qolgan filtrlar bilan. */
  counts: Record<FiscalReceiptStatus, number>;
}

export interface FiscalRetrySummary {
  retried: number;
  sent: number;
  failed: number;
  skipped: number;
}

export const fiscalReceiptsApi = {
  list: (params: FiscalReceiptQuery) =>
    api.get<ApiResponse<FiscalReceiptList>>('/admin/fiscal-receipts', { params }),
  retry: (id: string) => api.post<ApiResponse<FiscalReceipt>>(`/admin/fiscal-receipts/${id}/retry`),
  retryPending: () => api.post<ApiResponse<FiscalRetrySummary>>('/admin/fiscal-receipts/retry-pending'),
};

// ─── Shift passes ────────────────────────────────────────────────

export type ShiftPassStatus = 'active' | 'expired' | 'cancelled';

export interface AdminShiftPass {
  id: string;
  driverId: string;
  startsAt: string;
  endsAt: string;
  price: number;
  status: ShiftPassStatus;
  serviceTypes: string[];
  transactionId: string | null;
  createdAt: string | null;
  driverPhone: string | null;
  driverName: string | null;
}

export interface AdminShiftPassList {
  from: string;
  to: string;
  /** Butun oraliq bo'yicha (sahifadan qat'i nazar). */
  totals: { count: number; revenue: number; cancelled: number; activeNow: number };
  items: AdminShiftPass[];
  /** Server sahifalash (§22): `limit` standart va eng ko'pi 500. */
  total: number;
  page: number;
  limit: number;
}

export interface ShiftPassCancelResult extends AdminShiftPass {
  cancelledAt: string;
  cancelReason: string;
  refundAmount: number | null;
}

export const shiftPassesApi = {
  list: (params: { from?: string; to?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<AdminShiftPassList>>('/admin/shift-passes', { params }),
  cancel: (id: string, body: { refund: boolean; reason: string }) =>
    api.post<ApiResponse<ShiftPassCancelResult>>(`/admin/shift-passes/${id}/cancel`, body),
};

// ─── Audit log ───────────────────────────────────────────────────

export interface AuditLogActor {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  /** `null` — tizim amali yoki o'chirilgan foydalanuvchi (§22). */
  actor?: AuditLogActor | null;
  action: string;
  targetType: string;
  targetId: string | null;
  amount: number | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export const auditLogApi = {
  list: (params: {
    action?: string;
    targetType?: string;
    targetId?: string;
    actorUserId?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }) =>
    api.get<ApiResponse<AuditLogPage>>('/admin/audit-log', { params }),
};

// ─── Driver legal profile ────────────────────────────────────────

export type DriverTaxStatus = 'self_employed' | 'individual_entrepreneur';

export interface DriverLegalProfile {
  taxStatus: DriverTaxStatus | null;
  pinfl: string | null;
  tin: string | null;
  birthDate: string | null;
  drivingLicenceIssuedAt: string | null;
  taxiLicenceNumber: string | null;
  taxiLicenceRegion: string | null;
  citizenship: string;
}

/** `GET /drivers` qatoridagi qisqa xulosa (§22); to'liq ro'yxat — `GET /drivers/:id/legal`. */
export interface DriverLegalBrief {
  eligible: boolean;
  blocking: boolean;
  /** `reasons` soni. */
  issueCount: number;
}

export interface DriverLegalSummary {
  profile: DriverLegalProfile;
  eligibility: {
    eligible: boolean;
    enforced: boolean;
    enforcedFrom: string | null;
    appliesToTaxi: boolean;
    blocking: boolean;
    reasons: { code: string; message: string }[];
  };
}

export type DriverLegalPatch = Partial<DriverLegalProfile>;

export const driverLegalApi = {
  get: (driverId: string) => api.get<ApiResponse<DriverLegalSummary>>(`/drivers/${driverId}/legal`),
  update: (driverId: string, dto: DriverLegalPatch) =>
    api.patch<ApiResponse<DriverLegalSummary>>(`/drivers/${driverId}/legal`, dto),
};
