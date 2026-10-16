/**
 * Shaharlararo dispetcher API'si. `lib/api.ts` 1000 qatordan oshgan — yangi
 * bo'lim alohida, o'sha `apiClient` (proxy + 401 refresh) orqali.
 */
import { apiClient, type ApiResponse } from './api';
import type { IntercityTripPage, IntercityTripStatus } from './intercity';

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
