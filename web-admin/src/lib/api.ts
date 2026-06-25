import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      Cookies.remove('access_token');
      Cookies.remove('admin_user');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

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

  verifyOtp: (phone: string, code: string) =>
    api.post<ApiResponse<{ accessToken: string; user: AdminUser }>>('/auth/verify-otp', {
      phone,
      code,
    }),

  getMe: () => api.get<ApiResponse<AdminUser>>('/users/me'),

  logout: () => api.post<void>('/auth/logout').catch(() => {}),
};

// ─── Users ────────────────────────────────────────────────────────

export interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  status: 'active' | 'blocked';
  createdAt: string;
  totalOrders?: number;
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

  block: (id: string) => api.patch<ApiResponse<User>>(`/users/${id}/block`),

  unblock: (id: string) => api.patch<ApiResponse<User>>(`/users/${id}/unblock`),
};

// ─── Drivers ──────────────────────────────────────────────────────

export interface Driver {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  status: string;
  isOnline: boolean;
  rating: number;
  totalTrips: number;
  carModel: string;
  carNumber: string;
  carColor: string;
  licenseNumber: string;
  createdAt: string;
  balance?: number;
}

export interface DriverTrip {
  id: string;
  fromAddress: string;
  toAddress: string;
  price: number;
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

  block: (id: string) => api.patch<ApiResponse<User>>(`/users/${id}/block`),

  unblock: (id: string) => api.patch<ApiResponse<User>>(`/users/${id}/unblock`),
};

// ─── Orders ───────────────────────────────────────────────────────

export interface Order {
  id: string;
  shortId: string;
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
  };
  fromAddress: string;
  toAddress: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  status: string;
  price: number;
  distance: number;
  duration: number;
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
  isActive?: boolean;
}

export const tariffsApi = {
  getAll: () => api.get<ApiResponse<Tariff[]>>('/tariffs'),

  getById: (id: string) => api.get<ApiResponse<Tariff>>(`/tariffs/${id}`),

  create: (data: TariffCreateInput) => api.post<ApiResponse<Tariff>>('/tariffs', data),

  update: (id: string, data: Partial<TariffCreateInput>) =>
    api.patch<ApiResponse<Tariff>>(`/tariffs/${id}`, data),

  toggleActive: (id: string) =>
    api.patch<ApiResponse<Tariff>>(`/tariffs/${id}`, { isActive: true }),

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
