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

// ─── Market domain types ──────────────────────────────────────────

export type DeliveryMode = 'self' | 'platform';
export type ProductUnit = 'dona' | 'kg' | 'litr';
export type ProductStatus = 'active' | 'out' | 'hidden';
export type MarketOrderStatus = 'new' | 'packing' | 'shipped' | 'delivered' | 'cancelled';

export interface Store {
  id: string;
  ownerUserId: string;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  workingHoursStart: string;
  workingHoursEnd: string;
  deliveryMode: DeliveryMode;
  lowStockThreshold: number;
  status: 'active' | 'closed';
}

export interface MarketCategory {
  id: string;
  storeId: string;
  name: string;
  emoji: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  unit: ProductUnit;
  status: ProductStatus;
  emoji: string;
  hue: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  packed: boolean;
}

export interface MarketOrder {
  id: string;
  storeId: string;
  customerId: string;
  status: MarketOrderStatus;
  items: OrderItem[];
  deliveryMode: DeliveryMode;
  deliveryAddress: string;
  customerPhone: string | null;
  totalPrice: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { firstName: string | null; lastName: string | null; phone: string };
}

export interface StockMovement {
  id: string;
  productId: string;
  delta: number;
  note: string | null;
  createdAt: string;
  product: { name: string; emoji: string; hue: number; unit: ProductUnit };
}

export interface DashboardData {
  storeName: string;
  lowStockThreshold: number;
  todayOrdersCount: number;
  todayRevenue: number;
  outOfStockCount: number;
  activeProductsCount: number;
  hiddenProductsCount: number;
  lowStock: Array<{ id: string; name: string; stock: number; unit: ProductUnit }>;
  recentOrders: Array<{
    id: string;
    customer: string;
    status: MarketOrderStatus;
    itemsCount: number;
    totalPrice: number;
    createdAt: string;
  }>;
  bestSellers: Array<{ name: string; sold: number }>;
}

export interface ReportsData {
  weeklyRevenue: Array<{ day: string; total: number }>;
  categoryBreakdown: Array<{ name: string; total: number; pct: number }>;
  bestSellers: Array<{ name: string; sold: number }>;
  stockTurnover: number;
}

// ─── Vendor API ────────────────────────────────────────────────────

export const marketApi = {
  getStore: () => api.get<ApiResponse<Store>>('/market/vendor/store'),
  updateStore: (data: Partial<Pick<Store, 'name' | 'phone' | 'address' | 'lat' | 'lng' | 'workingHoursStart' | 'workingHoursEnd' | 'deliveryMode' | 'lowStockThreshold'>>) =>
    api.patch<ApiResponse<Store>>('/market/vendor/store', data),

  getDashboard: () => api.get<ApiResponse<DashboardData>>('/market/vendor/dashboard'),
  getReports: () => api.get<ApiResponse<ReportsData>>('/market/vendor/reports'),

  getCategories: () => api.get<ApiResponse<MarketCategory[]>>('/market/vendor/categories'),
  createCategory: (data: { name: string; emoji?: string; sortOrder?: number }) =>
    api.post<ApiResponse<MarketCategory>>('/market/vendor/categories', data),
  updateCategory: (id: string, data: Partial<{ name: string; emoji: string; sortOrder: number; isActive: boolean }>) =>
    api.patch<ApiResponse<MarketCategory>>(`/market/vendor/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete<ApiResponse<{ deleted: boolean }>>(`/market/vendor/categories/${id}`),

  getProducts: () => api.get<ApiResponse<Product[]>>('/market/vendor/products'),
  createProduct: (data: {
    name: string;
    sku?: string;
    price: number;
    stock: number;
    unit: ProductUnit;
    categoryId?: string;
    emoji?: string;
  }) => api.post<ApiResponse<Product>>('/market/vendor/products', data),
  updateProduct: (
    id: string,
    data: Partial<{
      name: string;
      sku: string;
      price: number;
      stock: number;
      unit: ProductUnit;
      status: ProductStatus;
      categoryId: string;
      emoji: string;
    }>
  ) => api.patch<ApiResponse<Product>>(`/market/vendor/products/${id}`, data),
  bulkUpdateProducts: (productIds: string[], status: ProductStatus) =>
    api.patch<ApiResponse<{ updated: number }>>('/market/vendor/products/bulk-status', { productIds, status }),
  deleteProduct: (id: string) => api.delete<ApiResponse<{ deleted: boolean }>>(`/market/vendor/products/${id}`),

  getStockMovements: () => api.get<ApiResponse<StockMovement[]>>('/market/vendor/stock/movements'),

  getOrders: (status?: MarketOrderStatus) =>
    api.get<ApiResponse<MarketOrder[]>>('/market/vendor/orders', { params: status ? { status } : undefined }),
  getOrder: (id: string) => api.get<ApiResponse<MarketOrder>>(`/market/vendor/orders/${id}`),
  togglePackItem: (orderId: string, index: number) =>
    api.patch<ApiResponse<MarketOrder>>(`/market/vendor/orders/${orderId}/items/${index}/toggle-pack`),
  advanceOrder: (orderId: string) =>
    api.patch<ApiResponse<MarketOrder>>(`/market/vendor/orders/${orderId}/advance`),
};
