import axios from 'axios';
import { attachAuthInterceptor } from './session';

/**
 * Requests go to this app's own /api/proxy, not to the backend directly. The
 * route handler there reads the httpOnly session cookie and adds the Bearer
 * header server-side, which is what keeps the token out of reach of page scripts.
 *
 * The backend host is therefore a *server* setting now (API_URL /
 * NEXT_PUBLIC_API_URL, resolved in lib/server/api-config.ts) and no longer needs
 * to be baked into the browser bundle.
 */
export const API_PROXY_BASE_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_PROXY_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Same-origin now, so the session cookie rides along automatically.
  withCredentials: true,
});

// Handles 401 → single-flight refresh → retry. See lib/session.ts for why the
// refresh must never run more than once at a time.
attachAuthInterceptor(api);

export default api;

// ─── Type-safe API helpers ─────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─── Auth ──────────────────────────────────────────────────────────

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<ApiResponse<{ message: string; code?: string }>>('/auth/send-otp', { phone }),

  /**
   * Verified through our own route handler, not the backend.
   *
   * That handler turns the token pair into httpOnly cookies; calling the backend
   * from here would hand the tokens back to page JS, which is precisely what we
   * are removing. Only the profile comes back.
   */
  verifyOtp: async (phone: string, code: string): Promise<AdminUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
      credentials: 'same-origin',
    });

    const payload = (await res.json().catch(() => null)) as
      | { data?: { user?: AdminUser }; message?: string }
      | null;

    if (!res.ok || !payload?.data?.user) {
      throw new Error(payload?.message || 'Notoʻgʻri kod');
    }

    return payload.data.user;
  },

  getMe: () => api.get<ApiResponse<AdminUser>>('/users/me'),

  /**
   * Revokes the refresh token server-side and clears the cookies. The refresh
   * token is not readable here, so this cannot be a plain backend call any more.
   */
  logout: () =>
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {}),
};

// ─── Users ────────────────────────────────────────────────────────

export type Permission =
  | 'dispatch'
  | 'drivers_view'
  | 'drivers_approve'
  | 'drivers_finance'
  | 'tariffs_manage'
  | 'promo_manage'
  | 'bonuses_view'
  | 'support_manage'
  | 'withdrawals_view'
  | 'users_view';

export const ALL_PERMISSIONS: Permission[] = [
  'dispatch',
  'drivers_view',
  'drivers_approve',
  'drivers_finance',
  'tariffs_manage',
  'promo_manage',
  'bonuses_view',
  'support_manage',
  'withdrawals_view',
  'users_view',
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  dispatch: 'Dispatch (live monitor, exceptions, override, audit log)',
  drivers_view: 'View driver roster',
  drivers_approve: 'Approve driver KYC',
  drivers_finance: "Adjust driver balance / commission rate",
  tariffs_manage: 'Propose tariff changes, surge, view commission setting',
  promo_manage: 'View & create promo codes',
  bonuses_view: 'View bonus rules/progress',
  support_manage: 'Support threads',
  withdrawals_view: 'View withdrawal payout queue',
  users_view: 'View general user list',
};

export interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  status: 'active' | 'blocked';
  blockReason?: string | null;
  createdAt: string;
  totalOrders?: number;
  permissions?: Permission[];
}

export interface AdminUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
}

export const usersApi = {
  getAll: (params: { page?: number; limit?: number; search?: string; role?: string }) =>
    api.get<ApiResponse<{ users: User[]; total: number; page: number; limit: number }>>('/users', { params }),

  getById: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`),

  block: (id: string, reason?: string) => api.patch<ApiResponse<User>>(`/users/${id}/block`, { reason }),

  unblock: (id: string) => api.patch<ApiResponse<User>>(`/users/${id}/unblock`),

  updatePermissions: (id: string, permissions: Permission[]) =>
    api.patch<ApiResponse<User>>(`/users/${id}/permissions`, { permissions }),
};

// ─── Drivers ──────────────────────────────────────────────────────

export interface Driver {
  id: string;
  userId: string;
  phone: string;
  firstName: string;
  lastName: string;
  status: string;
  blockReason?: string | null;
  isOnline: boolean;
  rating: number;
  totalTrips: number;
  carModel: string;
  carNumber: string;
  carColor?: string;
  licenseNumber?: string;
  createdAt: string;
  /** @deprecated Qaror va ko'rsatish uchun `walletBalance` ishlating. */
  balance?: number;
  /**
   * Haydovchining HAQIQIY pul holati — tranzaksiyalar daftaridan
   * hisoblanadi. Manfiy bo'lishi mumkin: bu haydovchining platformaga
   * qarzi (asosan naqd safarlar komissiyasi).
   *
   * ⚠️ `balance` ustunidan FARQ QILADI va aynan shuni ko'rsatish kerak.
   * Ustun yechib olingan pulni hisobga olmaydi (yechish faqat daftarni
   * debetlaydi), ya'ni birinchi yechishdan keyin u haqiqiy qoldiqdan
   * ajralib ketadi. Ustunni ko'rsatish operator bilan haydovchiga ikki
   * xil raqam berardi.
   */
  walletBalance?: number;
  commissionRate?: number | null;
}

export interface DriverTrip {
  id: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  estimatedPrice: number;
  finalPrice: number | null;
  status: string;
  createdAt: string;
}

export const driversApi = {
  getAll: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    isOnline?: boolean;
  }) => api.get<ApiResponse<{ drivers: Driver[]; total: number; page: number; limit: number }>>('/drivers', { params }),

  getById: (id: string) => api.get<ApiResponse<Driver>>(`/drivers/${id}`),

  getTrips: (id: string, params: { page?: number; limit?: number }) =>
    api.get<ApiResponse<{ orders: Order[]; total: number; page: number; limit: number }>>(`/orders/history`, { params }),

  approve: (id: string) => api.patch<ApiResponse<Driver>>(`/drivers/${id}/approve`),

  // Note: takes the driver's userId, not the driver profile id — blocking is
  // a User-level action (/users/:id/block), a different id than /drivers/:id.
  block: (userId: string, reason?: string) => api.patch<ApiResponse<User>>(`/users/${userId}/block`, { reason }),

  unblock: (userId: string) => api.patch<ApiResponse<User>>(`/users/${userId}/unblock`),

  // amount may be negative for a manual correction; positive tops up the balance.
  addFunds: (id: string, amount: number, note?: string) =>
    api.patch<ApiResponse<Driver>>(`/drivers/${id}/balance`, { amount, note }),

  setCommissionRate: (id: string, commissionRate: number | null) =>
    api.patch<ApiResponse<Driver>>(`/drivers/${id}/commission-rate`, { commissionRate }),
};

// ─── Withdrawals (payout queue — driver, Market vendor, Eats restaurant) ──

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type WithdrawalOwnerType = 'driver' | 'vendor' | 'restaurant';

export interface WithdrawalRequest {
  id: string;
  driverId: string;
  driver: User;
  ownerType: WithdrawalOwnerType;
  amount: number;
  status: WithdrawalStatus;
  payoutDestination: string;
  requestedAt: string;
  processedAt: string | null;
  adminNote: string | null;
}

export const withdrawalsApi = {
  getAll: (params: { page?: number; limit?: number; status?: WithdrawalStatus } = {}) =>
    api.get<
      ApiResponse<{ withdrawals: WithdrawalRequest[]; total: number; page: number; limit: number }>
    >('/payments/withdrawals', { params }),

  process: (id: string, status: WithdrawalStatus, adminNote?: string) =>
    api.patch<ApiResponse<WithdrawalRequest>>(`/payments/wallet/withdrawals/${id}`, {
      status,
      adminNote,
    }),
};

// ─── Settings ─────────────────────────────────────────────────────

export interface GlobalSettings {
  platformName: string;
  supportPhone: string;
  supportEmail: string;
  maintenanceMode: boolean;
}

export const settingsApi = {
  getCommission: () => api.get<ApiResponse<{ defaultCommissionRate: number }>>('/settings/commission'),
  setCommission: (defaultCommissionRate: number) =>
    api.patch<ApiResponse<{ defaultCommissionRate: number }>>('/settings/commission', { defaultCommissionRate }),
  getGlobal: () => api.get<ApiResponse<GlobalSettings>>('/settings/global'),
  updateGlobal: (dto: Partial<GlobalSettings>) =>
    api.patch<ApiResponse<GlobalSettings>>('/settings/global', dto),
};

// ─── Push notifications (broadcast) ────────────────────────────────

export type BroadcastAudience = 'all' | 'customers' | 'drivers';

export interface PushBroadcast {
  id: string;
  title: string;
  body: string;
  audience: BroadcastAudience;
  sentCount: number;
  createdAt: string;
}

export const broadcastApi = {
  send: (title: string, body: string, audience: BroadcastAudience) =>
    api.post<ApiResponse<PushBroadcast>>('/notifications/broadcast', { title, body, audience }),
  getHistory: (page = 1, limit = 20) =>
    api.get<ApiResponse<{ broadcasts: PushBroadcast[]; total: number; page: number; limit: number }>>(
      '/notifications/broadcast/history',
      { params: { page, limit } }
    ),
};

// ─── Content moderation ─────────────────────────────────────────────

export interface ModeratedProduct {
  id: string;
  name: string;
  price: number;
  status: string;
  store?: { name: string };
}

export interface ModeratedDish {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  restaurant?: { name: string };
}

export const moderationApi = {
  getProducts: () => api.get<ApiResponse<ModeratedProduct[]>>('/market/admin/products'),
  deleteProduct: (id: string) => api.delete<ApiResponse<void>>(`/market/admin/products/${id}`),
  getDishes: () => api.get<ApiResponse<ModeratedDish[]>>('/food/admin/dishes'),
  deleteDish: (id: string) => api.delete<ApiResponse<void>>(`/food/admin/dishes/${id}`),
};

// ─── Orders ───────────────────────────────────────────────────────

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface Order {
  id: string;
  passenger: {
    id: string;
    phone: string;
    firstName: string;
    lastName: string;
  };
  driver?: {
    id: string;
    phone: string;
    firstName: string;
    lastName: string;
    carModel: string;
    carNumber: string;
    rating?: number;
  };
  pickupAddress: string | null;
  dropoffAddress: string | null;
  pickupLocation: GeoPoint;
  dropoffLocation: GeoPoint;
  status: string;
  estimatedPrice: number;
  finalPrice: number | null;
  paymentMethod: string;
  tariff: {
    id: string;
    name: string;
  };
  createdAt: string;
  completedAt?: string;
  cancelReason?: string;
}

export const ordersApi = {
  getAll: (params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    from?: string;
    to?: string;
  }) => api.get<ApiResponse<{ orders: Order[]; total: number; page: number; limit: number }>>('/orders', { params }),

  getById: (id: string) => api.get<ApiResponse<Order>>(`/orders/${id}`),

  cancel: (id: string, reason: string) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/cancel`, { reason }),
};

// ─── Tariffs ──────────────────────────────────────────────────────

export interface Tariff {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  pricePerKm: number;
  pricePerMin: number;
  minPrice: number;
  maxPrice: number | null;
  surgeMultiplier: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TariffCreateInput {
  name: string;
  description?: string;
  basePrice: number;
  pricePerKm: number;
  pricePerMin: number;
  minPrice: number;
  maxPrice?: number;
  isActive?: boolean;
}

export const tariffsApi = {
  getAll: () => api.get<ApiResponse<Tariff[]>>('/tariffs'),

  getById: (id: string) => api.get<ApiResponse<Tariff>>(`/tariffs/${id}`),

  create: (data: TariffCreateInput) => api.post<ApiResponse<Tariff>>('/tariffs', data),

  update: (id: string, data: Partial<TariffCreateInput>) =>
    api.patch<ApiResponse<Tariff>>(`/tariffs/${id}`, data),

  toggleActive: (id: string, isActive: boolean) =>
    api.patch<ApiResponse<Tariff>>(`/tariffs/${id}`, { isActive }),

  setSurge: (id: string, multiplier: number) =>
    api.patch<ApiResponse<Tariff>>(`/tariffs/${id}/surge`, { multiplier }),

  delete: (id: string) => api.delete<ApiResponse<void>>(`/tariffs/${id}`),
};

// ─── Reports ──────────────────────────────────────────────────────

export interface ReportStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalDrivers: number;
  activeDrivers: number;
  newUsers: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  totalTrips: number;
  totalRevenue: number;
  rating: number;
}

export interface ReportData {
  stats: ReportStats;
  revenueChart: RevenueDataPoint[];
  topDrivers: TopDriver[];
}

export const reportsApi = {
  getData: (params: { from: string; to: string }) =>
    api.get<ApiResponse<ReportData>>('/orders/reports', { params }),

  exportCsv: (params: { from: string; to: string }) =>
    api.get('/orders/reports', { params, responseType: 'blob' }),
};

// ─── Dashboard ────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  activeDrivers: number;
  ordersToday: number;
  revenueToday: number;
  pendingDriverApprovals: number;
  onlineDrivers: number;
}

export const dashboardApi = {
  getStats: () => api.get<ApiResponse<DashboardStats>>('/orders/stats'),
};

// ─── Promo Codes ──────────────────────────────────────────────────

export interface PromoCode {
  id: string;
  code: string;
  discountPercent: number | null;
  discountFixed: number | null;
  maxUses: number | null;
  usedCount: number;
  minOrderAmount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export const promoCodesApi = {
  getAll: () => api.get<ApiResponse<PromoCode[]>>('/promo-codes'),

  deactivate: (id: string) => api.delete<ApiResponse<PromoCode>>(`/promo-codes/${id}`),
};

// ─── Tariff Change Requests ───────────────────────────────────────

export type TariffChangeAction = 'create' | 'update';
export type TariffChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TariffChangeRequest {
  id: string;
  action: TariffChangeAction;
  tariffId: string | null;
  proposedChanges: Record<string, unknown>;
  previousValues: Record<string, unknown> | null;
  status: TariffChangeRequestStatus;
  proposedBy: string;
  reviewNote: string | null;
  createdAt: string;
}

export const tariffChangeRequestsApi = {
  getAll: (status?: TariffChangeRequestStatus) =>
    api.get<ApiResponse<TariffChangeRequest[]>>('/tariff-change-requests', {
      params: status ? { status } : undefined,
    }),

  getById: (id: string) =>
    api.get<ApiResponse<TariffChangeRequest>>(`/tariff-change-requests/${id}`),

  approve: (id: string, reviewNote?: string) =>
    api.patch<ApiResponse<TariffChangeRequest>>(`/tariff-change-requests/${id}/approve`, {
      reviewNote,
    }),

  reject: (id: string, reviewNote?: string) =>
    api.patch<ApiResponse<TariffChangeRequest>>(`/tariff-change-requests/${id}/reject`, {
      reviewNote,
    }),
};

// ─── Driver Bonus Rules ───────────────────────────────────────────

export type BonusRuleType = 'trip_count' | 'weekly_goal';
export type BonusRuleStatus = 'active' | 'inactive';

export interface BonusRule {
  id: string;
  name: string;
  ruleType: BonusRuleType;
  tripThreshold: number;
  bonusAmount: number;
  serviceType: string | null;
  status: BonusRuleStatus;
  createdAt: string;
}

export interface BonusRuleCreateInput {
  name: string;
  ruleType: BonusRuleType;
  tripThreshold: number;
  bonusAmount: number;
  serviceType?: string;
}

export const bonusRulesApi = {
  getAll: () => api.get<ApiResponse<BonusRule[]>>('/driver-bonus-rules'),

  create: (data: BonusRuleCreateInput) =>
    api.post<ApiResponse<BonusRule>>('/driver-bonus-rules', data),

  update: (id: string, data: Partial<BonusRuleCreateInput & { status: BonusRuleStatus }>) =>
    api.patch<ApiResponse<BonusRule>>(`/driver-bonus-rules/${id}`, data),
};

// ─── Vendors (Market stores + Restaurants) ───────────────────────

export interface StoreVendor {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: 'active' | 'closed';
  owner: { phone: string; firstName: string | null; lastName: string | null };
  createdAt: string;
}

export interface RestaurantVendor {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: 'active' | 'closed';
  owner: { phone: string; firstName: string | null; lastName: string | null };
  createdAt: string;
}

export interface CreateStoreVendorInput {
  phone: string;
  firstName?: string;
  lastName?: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  lat?: number;
  lng?: number;
}

export interface CreateRestaurantVendorInput {
  phone: string;
  firstName?: string;
  lastName?: string;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  lat?: number;
  lng?: number;
}

export const marketAdminApi = {
  getAll: () => api.get<ApiResponse<StoreVendor[]>>('/market/admin/stores'),
  create: (data: CreateStoreVendorInput) =>
    api.post<ApiResponse<StoreVendor>>('/market/admin/stores', data),
  setStatus: (id: string, status: 'active' | 'closed') =>
    api.patch<ApiResponse<StoreVendor>>(`/market/admin/stores/${id}/status`, { status }),
};

export const foodAdminApi = {
  getAll: () => api.get<ApiResponse<RestaurantVendor[]>>('/food/admin/restaurants'),
  create: (data: CreateRestaurantVendorInput) =>
    api.post<ApiResponse<RestaurantVendor>>('/food/admin/restaurants', data),
  setStatus: (id: string, status: 'active' | 'closed') =>
    api.patch<ApiResponse<RestaurantVendor>>(`/food/admin/restaurants/${id}/status`, { status }),
};
