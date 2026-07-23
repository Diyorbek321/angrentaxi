import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import Cookies from 'js-cookie';
import { OrderStatus, PaymentMethod } from './constants';

// ─── Entity Types ───────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Passenger {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  carNumber: string;
  carModel: string;
  rating: number;
  status: string;
  currentOrderId: string | null;
  lastSeen: string;
  location?: Coordinates;
}

export interface Tariff {
  id: string;
  name: string;
  basePrice: number;
  pricePerKm: number;
  pricePerMin: number;
  minPrice: number;
  maxPrice: number | null;
  surgeMultiplier: number;
  isActive: boolean;
}

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

export interface CreatePromoCodePayload {
  code: string;
  discountPercent?: number;
  discountFixed?: number;
  maxUses?: number;
  minOrderAmount?: number;
  expiresAt?: string;
}

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

export interface ProposeTariffChangePayload {
  action: TariffChangeAction;
  tariffId?: string;
  proposedChanges: Record<string, unknown>;
}

export type BonusRuleType = 'trip_count' | 'weekly_goal';
export type BonusRuleStatus = 'active' | 'inactive';

export interface DriverBonusRule {
  id: string;
  name: string;
  ruleType: BonusRuleType;
  tripThreshold: number;
  bonusAmount: number;
  serviceType: string | null;
  status: BonusRuleStatus;
  createdAt: string;
}

export interface DriverBonusProgress {
  ruleId: string;
  name: string;
  ruleType: BonusRuleType;
  tripThreshold: number;
  bonusAmount: number;
  currentCount: number;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface Order {
  id: string;
  passengerId: string;
  passenger: Passenger;
  driverId: string | null;
  driver: Driver | null;
  tariffId: string;
  tariff: Tariff;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  pickupLocation: GeoPoint;
  dropoffLocation: GeoPoint;
  estimatedPrice: number;
  finalPrice: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  // Not tracked as separate columns on the backend today — always absent;
  // consumers must treat these as optional and fall back to createdAt/status.
  acceptedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

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

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
}

export interface CreateOrderPayload {
  passengerPhone: string;
  passengerName?: string;
  pickupAddress?: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress?: string;
  dropoffLat: number;
  dropoffLng: number;
  tariffId: string;
  paymentMethod: PaymentMethod;
  note?: string;
}

export interface CalculatePricePayload {
  tariffId: string;
  distanceKm: number;
  durationMin: number;
}

export interface CalculatePriceResponse {
  price: number;
  tariffId: string;
  distanceKm: number;
  durationMin: number;
}

export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Axios Instance ──────────────────────────────────────────────────────────

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use((config) => {
    const token = Cookies.get('manager_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        Cookies.remove('manager_token');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

export const apiClient = createApiClient();

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function sendOtp(phone: string): Promise<{ message: string; code?: string }> {
  const res = await apiClient.post<ApiResponse<{ message: string; code?: string }>>('/auth/send-otp', { phone });
  return res.data.data;
}

export async function verifyOtp(phone: string, code: string): Promise<LoginResponse> {
  const res = await apiClient.post<ApiResponse<{ accessToken: string; user: LoginResponse['user'] }>>('/auth/verify-otp', { phone, code });
  return { token: res.data.data.accessToken, user: res.data.data.user };
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export async function getActiveOrders(): Promise<Order[]> {
  const res = await apiClient.get<ApiResponse<Order[]>>('/orders/active');
  return res.data.data;
}

export async function getOrders(
  filters: OrderFilters = {}
): Promise<PaginatedResponse<Order>> {
  const params: Record<string, unknown> = {};
  if (filters.status) {
    params.status = Array.isArray(filters.status)
      ? filters.status.join(',')
      : filters.status;
  }
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;
  if (filters.search) params.search = filters.search;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;

  const res = await apiClient.get<
    ApiResponse<{ orders: Order[]; total: number; page: number; limit: number }>
  >('/orders', { params });
  const { orders, total, page, limit } = res.data.data;
  return { data: orders, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getOrderById(id: string): Promise<Order> {
  const res = await apiClient.get<ApiResponse<Order>>(`/orders/${id}`);
  return res.data.data;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await apiClient.post<ApiResponse<Order>>('/orders/dispatch', payload);
  return res.data.data;
}

export async function calculatePrice(
  payload: CalculatePricePayload
): Promise<CalculatePriceResponse> {
  const res = await apiClient.post<ApiResponse<CalculatePriceResponse>>(
    '/orders/calculate-price',
    payload
  );
  return res.data.data;
}

// The backend's `/accept` route is for a driver to accept their own offered
// order via their JWT — a manager assigning a specific driver (first time or
// reassigning) always goes through `/reassign`, which handles both cases.
// This is now an exception path (MatchingService assigns drivers
// automatically in the normal case) — `reason` is required and recorded in
// the backend's dispatch_overrides audit log.
export async function assignDriver(orderId: string, driverId: string, reason: string): Promise<Order> {
  return reassignDriver(orderId, driverId, reason);
}

export async function cancelOrder(orderId: string, reason?: string): Promise<Order> {
  const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${orderId}/cancel`, {
    reason,
  });
  return res.data.data;
}

export async function completeOrder(orderId: string): Promise<Order> {
  const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${orderId}/complete`);
  return res.data.data;
}

export async function reassignDriver(orderId: string, driverId: string, reason: string): Promise<Order> {
  const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${orderId}/reassign`, {
    driverId,
    reason,
  });
  return res.data.data;
}

export interface DispatchOverride {
  id: string;
  orderId: string;
  performedByUserId: string;
  previousDriverId: string | null;
  newDriverId: string;
  reason: string;
  createdAt: string;
}

export async function getDispatchOverrides(
  page = 1,
  limit = 20
): Promise<{ overrides: DispatchOverride[]; total: number; page: number; limit: number }> {
  const res = await apiClient.get<ApiResponse<{
    overrides: DispatchOverride[];
    total: number;
    page: number;
    limit: number;
  }>>('/orders/dispatch-overrides', { params: { page, limit } });
  return res.data.data;
}

// Orders MatchingService auto-cancelled after its search window (see
// MatchingService.NO_DRIVER_TIMEOUT_MS) — read-only: a cancelled order can't
// be reassigned, the remedy is a fresh manual order via Create Order.
export async function getNoDriversFoundExceptions(
  page = 1,
  limit = 20
): Promise<PaginatedResponse<Order>> {
  const res = await apiClient.get<
    ApiResponse<{ orders: Order[]; total: number; page: number; limit: number }>
  >('/orders/exceptions/no-drivers-found', { params: { page, limit } });
  const { orders, total, page: p, limit: l } = res.data.data;
  return { data: orders, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
}

// ─── Safety / SOS ────────────────────────────────────────────────────────────

export type SosReporterRole = 'passenger' | 'driver';
export type SosAlertStatus = 'active' | 'resolved';

export interface SosAlert {
  id: string;
  orderId: string;
  reportedByUserId: string;
  reportedByRole: SosReporterRole;
  lat: number;
  lng: number;
  status: SosAlertStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export async function getActiveSosAlerts(): Promise<SosAlert[]> {
  const res = await apiClient.get<ApiResponse<SosAlert[]>>('/sos/active');
  return res.data.data;
}

export async function resolveSosAlert(id: string): Promise<SosAlert> {
  const res = await apiClient.patch<ApiResponse<SosAlert>>(`/sos/${id}/resolve`);
  return res.data.data;
}

export async function getSosTodaySummary(): Promise<{ resolvedToday: number; stillOpen: number }> {
  const res = await apiClient.get<ApiResponse<{ resolvedToday: number; stillOpen: number }>>(
    '/sos/today-summary'
  );
  return res.data.data;
}

// ─── Dashboard stats (Manager Overview) ─────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  ordersToday: number;
  completedToday: number;
  revenueToday: number;
  avgTripPriceToday: number;
  cancellationRateToday: number;
  newCustomersToday: number;
  activeDrivers: number;
  onlineDrivers: number;
  pendingDriverApprovals: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await apiClient.get<ApiResponse<DashboardStats>>('/orders/stats');
  return res.data.data;
}

// ─── Driver roster (full profile, not the live-status shape above) ─────────

export interface DriverProfile {
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
  createdAt: string;
  // Only meaningful when the caller has the drivers_finance permission —
  // present on the API response regardless, but the UI only shows/edits
  // these when that permission is granted (see getCurrentUserProfile).
  balance?: number;
  commissionRate?: number | null;
  // Self-reported at application time; null until the driver enters it.
  carYear?: number | null;
  // Highest Tariff.tier (1 = Start ... 5 = Biznes) this driver may be
  // matched against — set by a manager/admin after reviewing the car.
  approvedTariffTier: number;
}

// Keep in sync with backend Tariff.tier (1-5) and the seed data in
// 020_tariff_tiers.ts.
export const TARIFF_TIERS = [
  { tier: 1, label: 'Start' },
  { tier: 2, label: 'Standart' },
  { tier: 3, label: 'Komfort' },
  { tier: 4, label: "Komfort+" },
  { tier: 5, label: 'Biznes' },
] as const;

export async function getDriverRoster(filters: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
} = {}): Promise<{ drivers: DriverProfile[]; total: number; page: number; limit: number }> {
  const res = await apiClient.get<
    ApiResponse<{ drivers: DriverProfile[]; total: number; page: number; limit: number }>
  >('/drivers', { params: filters });
  return res.data.data;
}

export async function approveDriverProfile(id: string): Promise<DriverProfile> {
  const res = await apiClient.patch<ApiResponse<DriverProfile>>(`/drivers/${id}/approve`);
  return res.data.data;
}

// Requires the drivers_finance permission (see getCurrentUserProfile) — the
// backend rejects this for a manager who wasn't granted it, ADMIN always
// allowed.
export async function addDriverFunds(
  id: string,
  amount: number,
  note?: string
): Promise<DriverProfile> {
  const res = await apiClient.patch<ApiResponse<DriverProfile>>(`/drivers/${id}/balance`, {
    amount,
    note,
  });
  return res.data.data;
}

export async function setDriverCommissionRate(
  id: string,
  commissionRate: number | null
): Promise<DriverProfile> {
  const res = await apiClient.patch<ApiResponse<DriverProfile>>(`/drivers/${id}/commission-rate`, {
    commissionRate,
  });
  return res.data.data;
}

// Requires the drivers_approve permission — same gate as approveDriverProfile,
// since setting how high a tariff a driver may serve is the same "vet this
// driver's car" judgment call.
export async function setDriverTariffTier(id: string, tier: number): Promise<DriverProfile> {
  const res = await apiClient.patch<ApiResponse<DriverProfile>>(`/drivers/${id}/tariff-tier`, {
    tier,
  });
  return res.data.data;
}

// ─── Current user / RBAC ────────────────────────────────────────────────────

export interface CurrentUserProfile {
  id: string;
  role: string;
  permissions: string[];
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const res = await apiClient.get<ApiResponse<CurrentUserProfile>>('/users/me');
  return res.data.data;
}

// ─── Finance (view-only for managers — requires withdrawals_view) ──────────

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface WithdrawalRequest {
  id: string;
  amount: number;
  ownerType: 'driver' | 'vendor' | 'restaurant';
  payoutDestination: string;
  status: WithdrawalStatus;
  requestedAt: string;
  driver?: { firstName: string | null; lastName: string | null; phone: string } | null;
}

export async function getAllWithdrawals(
  page = 1,
  limit = 20,
  status?: WithdrawalStatus
): Promise<{ withdrawals: WithdrawalRequest[]; total: number; page: number; limit: number }> {
  const res = await apiClient.get<
    ApiResponse<{ withdrawals: WithdrawalRequest[]; total: number; page: number; limit: number }>
  >('/payments/withdrawals', { params: { page, limit, status } });
  return res.data.data;
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

export async function getOnlineDrivers(): Promise<Driver[]> {
  const res = await apiClient.get<ApiResponse<Driver[]>>('/drivers/online');
  return res.data.data;
}

export async function getDriverById(id: string): Promise<Driver> {
  const res = await apiClient.get<ApiResponse<Driver>>(`/drivers/${id}`);
  return res.data.data;
}

// ─── Tariffs ─────────────────────────────────────────────────────────────────

export async function getTariffs(): Promise<Tariff[]> {
  const res = await apiClient.get<ApiResponse<Tariff[]>>('/tariffs');
  return res.data.data;
}

// ─── Support Chat ────────────────────────────────────────────────────────────

export type SupportThreadStatus = 'open' | 'closed';

export interface SupportThread {
  id: string;
  userId: string;
  userRole: 'passenger' | 'driver';
  orderId: string | null;
  status: SupportThreadStatus;
  assignedManagerId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface SupportThreadListItem extends SupportThread {
  userName: string;
  userPhone: string;
  unreadCount: number;
}

export interface SupportMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: 'passenger' | 'driver' | 'manager' | 'admin';
  body: string;
  createdAt: string;
}

export async function getSupportThreads(
  status?: SupportThreadStatus
): Promise<SupportThreadListItem[]> {
  const res = await apiClient.get<ApiResponse<{ threads: SupportThreadListItem[]; total: number }>>(
    '/support/threads',
    { params: status ? { status } : undefined }
  );
  return res.data.data.threads;
}

export async function getSupportMessages(
  threadId: string
): Promise<{ messages: SupportMessage[]; total: number }> {
  const res = await apiClient.get<ApiResponse<{ messages: SupportMessage[]; total: number }>>(
    `/support/threads/${threadId}/messages`,
    { params: { limit: 100 } }
  );
  return res.data.data;
}

export async function sendSupportMessage(threadId: string, body: string): Promise<SupportMessage> {
  const res = await apiClient.post<ApiResponse<SupportMessage>>(
    `/support/threads/${threadId}/messages`,
    { body }
  );
  return res.data.data;
}

export async function markSupportThreadRead(threadId: string): Promise<void> {
  await apiClient.patch(`/support/threads/${threadId}/read`);
}

export async function setSupportThreadStatus(
  threadId: string,
  status: SupportThreadStatus
): Promise<SupportThread> {
  const res = await apiClient.patch<ApiResponse<SupportThread>>(
    `/support/threads/${threadId}/status`,
    { status }
  );
  return res.data.data;
}

// ─── Tariff Change Requests ──────────────────────────────────────────────────

export async function proposeTariffChange(
  payload: ProposeTariffChangePayload
): Promise<TariffChangeRequest> {
  const res = await apiClient.post<ApiResponse<TariffChangeRequest>>(
    '/tariff-change-requests',
    payload
  );
  return res.data.data;
}

export async function getTariffChangeRequests(
  status?: TariffChangeRequestStatus
): Promise<TariffChangeRequest[]> {
  const res = await apiClient.get<ApiResponse<TariffChangeRequest[]>>(
    '/tariff-change-requests',
    { params: status ? { status } : undefined }
  );
  return res.data.data;
}

// ─── Promo Codes ──────────────────────────────────────────────────────────────

export async function getPromoCodes(): Promise<PromoCode[]> {
  const res = await apiClient.get<ApiResponse<PromoCode[]>>('/promo-codes');
  return res.data.data;
}

export async function createPromoCode(
  payload: CreatePromoCodePayload
): Promise<PromoCode> {
  const res = await apiClient.post<ApiResponse<PromoCode>>('/promo-codes', payload);
  return res.data.data;
}

// ─── Driver Bonus Rules ────────────────────────────────────────────────────────

export async function getBonusRules(): Promise<DriverBonusRule[]> {
  const res = await apiClient.get<ApiResponse<DriverBonusRule[]>>('/driver-bonus-rules');
  return res.data.data;
}

export async function getDriverBonusProgress(
  driverId: string
): Promise<DriverBonusProgress[]> {
  const res = await apiClient.get<ApiResponse<DriverBonusProgress[]>>(
    `/driver-bonus-rules/driver/${driverId}/progress`
  );
  return res.data.data;
}
