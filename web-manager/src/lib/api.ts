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
  baseFare: number;
  perKm: number;
  perMinute: number;
  minFare: number;
  currency: string;
}

export interface OrderAddress {
  address: string;
  coordinates: Coordinates;
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
  pickupAddress: OrderAddress;
  dropoffAddress: OrderAddress;
  estimatedPrice: number;
  finalPrice: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
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
  pickupAddress: string;
  pickupCoordinates: Coordinates;
  dropoffAddress: string;
  dropoffCoordinates: Coordinates;
  tariffId: string;
  paymentMethod: PaymentMethod;
  note?: string;
}

export interface CalculatePricePayload {
  pickupCoordinates: Coordinates;
  dropoffCoordinates: Coordinates;
  tariffId: string;
}

export interface CalculatePriceResponse {
  estimatedPrice: number;
  estimatedDistance: number;
  estimatedDuration: number;
  currency: string;
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

  const res = await apiClient.get<ApiResponse<PaginatedResponse<Order>>>('/orders', {
    params,
  });
  return res.data.data;
}

export async function getOrderById(id: string): Promise<Order> {
  const res = await apiClient.get<ApiResponse<Order>>(`/orders/${id}`);
  return res.data.data;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await apiClient.post<ApiResponse<Order>>('/orders', payload);
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

export async function assignDriver(orderId: string, driverId: string): Promise<Order> {
  const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${orderId}/accept`, {
    driverId,
  });
  return res.data.data;
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

export async function reassignDriver(orderId: string, driverId: string): Promise<Order> {
  const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${orderId}/reassign`, {
    driverId,
  });
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
