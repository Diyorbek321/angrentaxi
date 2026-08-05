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
  headers: { 'Content-Type': 'application/json' },
  // Same-origin now, so the session cookie rides along automatically.
  withCredentials: true,
});

// Handles 401 -> single-flight refresh -> retry. See lib/session.ts for why the
// refresh must never run more than once at a time.
attachAuthInterceptor(api);

export default api;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─── Auth ──────────────────────────────────────────────────────────

export interface VendorUser {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<ApiResponse<{ message: string; code?: string }>>('/auth/send-otp', { phone }),

  /**
   * Verified through our own route handler, not the backend.
   *
   * That handler turns the token pair into httpOnly cookies (and applies the
   * role gate before writing them); calling the backend from here would hand the
   * tokens back to page JS, which is precisely what we are removing. Only the
   * profile comes back.
   */
  verifyOtp: async (phone: string, code: string): Promise<VendorUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
      credentials: 'same-origin',
    });

    const payload = (await res.json().catch(() => null)) as
      | { data?: { user?: VendorUser }; message?: string }
      | null;

    if (!res.ok || !payload?.data?.user) {
      throw new Error(payload?.message || "Noto'g'ri kod");
    }

    return payload.data.user;
  },

  /**
   * Revokes the refresh token server-side and clears the cookies. The refresh
   * token is not readable here, so this cannot be a plain backend call any more.
   */
  logout: () =>
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {}),
};

// ─── Food domain types ─────────────────────────────────────────────

export type RestaurantStatus = 'active' | 'closed';
export type FoodOrderStatus = 'new' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type PaymentMethod = 'card' | 'cash';

export interface WorkingHoursDay {
  day: string;
  open: boolean;
  from: string;
  to: string;
}

export interface Notifications {
  sound: boolean;
  push: boolean;
  sms: boolean;
}

export interface Restaurant {
  id: string;
  ownerUserId: string;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  hours: WorkingHoursDay[];
  deliveryRadiusKm: number;
  commissionRate: number;
  notifications: Notifications;
  status: RestaurantStatus;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

export interface Dish {
  id: string;
  restaurantId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
  prepMinutes: number;
  isAvailable: boolean;
  tags: string[];
}

export interface FoodOrderItem {
  dishId: string;
  name: string;
  qty: number;
  price: number;
  prepMinutes: number;
}

export interface FoodOrder {
  id: string;
  restaurantId: string;
  customerId: string;
  status: FoodOrderStatus;
  items: FoodOrderItem[];
  deliveryAddress: string;
  customerPhone: string | null;
  paymentMethod: PaymentMethod;
  totalPrice: number;
  note: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { firstName: string | null; lastName: string | null; phone: string };
}

export interface DashboardData {
  restaurantName: string;
  isOpen: boolean;
  todayOrdersCount: number;
  todayRevenue: number;
  avgPrepMinutes: number;
  activeDishesCount: number;
  recentOrders: Array<{
    id: string;
    customer: string;
    status: FoodOrderStatus;
    itemsCount: number;
    totalPrice: number;
    createdAt: string;
  }>;
}

export interface ReportsData {
  revenue: Array<{ day: string; total: number }>;
  topDishes: Array<{ name: string; qty: number }>;
  hourly: Array<{ hour: number; count: number }>;
  payout: {
    gross: number;
    commission: number;
    net: number;
    orders: number;
    commissionRate: number;
  };
}

// ─── Vendor API ────────────────────────────────────────────────────

export const foodApi = {
  getRestaurant: () => api.get<ApiResponse<Restaurant>>('/food/vendor/restaurant'),
  updateRestaurant: (
    data: Partial<
      Pick<Restaurant, 'name' | 'phone' | 'address' | 'lat' | 'lng' | 'hours' | 'deliveryRadiusKm' | 'commissionRate' | 'notifications'>
    >
  ) => api.patch<ApiResponse<Restaurant>>('/food/vendor/restaurant', data),
  toggleOpen: () => api.patch<ApiResponse<Restaurant>>('/food/vendor/restaurant/toggle-open'),

  getDashboard: () => api.get<ApiResponse<DashboardData>>('/food/vendor/dashboard'),
  getReports: (range: 7 | 30) =>
    api.get<ApiResponse<ReportsData>>('/food/vendor/reports', { params: { range } }),

  getCategories: () => api.get<ApiResponse<MenuCategory[]>>('/food/vendor/categories'),
  createCategory: (data: { name: string; sortOrder?: number }) =>
    api.post<ApiResponse<MenuCategory>>('/food/vendor/categories', data),
  updateCategory: (id: string, data: Partial<{ name: string; sortOrder: number }>) =>
    api.patch<ApiResponse<MenuCategory>>(`/food/vendor/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete<ApiResponse<{ deleted: boolean }>>(`/food/vendor/categories/${id}`),

  getDishes: () => api.get<ApiResponse<Dish[]>>('/food/vendor/dishes'),
  createDish: (data: {
    name: string;
    description?: string;
    price: number;
    prepMinutes?: number;
    categoryId?: string;
    tags?: string[];
  }) => api.post<ApiResponse<Dish>>('/food/vendor/dishes', data),
  updateDish: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      price: number;
      prepMinutes: number;
      categoryId: string;
      tags: string[];
      isAvailable: boolean;
    }>
  ) => api.patch<ApiResponse<Dish>>(`/food/vendor/dishes/${id}`, data),
  deleteDish: (id: string) => api.delete<ApiResponse<{ deleted: boolean }>>(`/food/vendor/dishes/${id}`),

  getOrders: () => api.get<ApiResponse<FoodOrder[]>>('/food/vendor/orders'),
  getOrder: (id: string) => api.get<ApiResponse<FoodOrder>>(`/food/vendor/orders/${id}`),
  acceptOrder: (id: string) => api.patch<ApiResponse<FoodOrder>>(`/food/vendor/orders/${id}/accept`),
  advanceOrder: (id: string) => api.patch<ApiResponse<FoodOrder>>(`/food/vendor/orders/${id}/advance`),
  rejectOrder: (id: string, reason: string) =>
    api.patch<ApiResponse<FoodOrder>>(`/food/vendor/orders/${id}/reject`, { reason }),
};
