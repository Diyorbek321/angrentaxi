/**
 * Shaharlararo dispetcher API'si. `lib/api.ts` 1000 qatordan oshgan — yangi
 * bo'lim alohida, o'sha `apiClient` (proxy + 401 refresh) orqali.
 */
import { apiClient, type ApiResponse } from './api';
import type { IntercityBookingManage, IntercityTripPage, IntercityTripStatus } from './intercity';

export interface IntercityTripsQuery {
  /** `YYYY-MM-DD`, Toshkent kuni. */
  date?: string;
  status?: IntercityTripStatus;
  page?: number;
  limit?: number;
}

export async function getIntercityTrips(query: IntercityTripsQuery): Promise<IntercityTripPage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== ''));
  const res = await apiClient.get<ApiResponse<IntercityTripPage>>('/intercity/trips/manage', { params });
  return res.data.data;
}

/** Qatnovning barcha bandlari (bekor qilinganlari ham) — dispetcher uchun. */
export async function getIntercityTripBookings(tripId: string): Promise<IntercityBookingManage[]> {
  const res = await apiClient.get<ApiResponse<IntercityBookingManage[]>>(
    `/intercity/trips/${encodeURIComponent(tripId)}/bookings/manage`,
  );
  return res.data.data;
}

/**
 * Dispetcher bandni bekor qiladi: joylar shu tranzaksiyada qatnovga qaytadi,
 * yo'lovchiga push ketadi. Umumiy `PATCH /orders/:id/cancel` intercity'ni
 * rad etadi (`INTERCITY_USE_INTERCITY_ENDPOINT`).
 */
export async function cancelIntercityBooking(orderId: string, reason: string): Promise<IntercityBookingManage> {
  const res = await apiClient.post<ApiResponse<IntercityBookingManage>>(
    `/intercity/bookings/${encodeURIComponent(orderId)}/cancel/manage`,
    { reason },
  );
  return res.data.data;
}
