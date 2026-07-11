import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      Cookies.remove('access_token');
      Cookies.remove('restaurant_user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

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

  verifyOtp: (phone: string, code: string) =>
    api.post<ApiResponse<{ accessToken: string; user: VendorUser }>>('/auth/verify-otp', {
      phone,
      code,
    }),
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
