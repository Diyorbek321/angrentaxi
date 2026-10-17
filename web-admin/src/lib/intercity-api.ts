/**
 * Shaharlararo boshqaruv API'si (backend/src/modules/intercity). `lib/api.ts`
 * 800 qatordan oshgan — yangi bo'limlar alohida faylda, o'sha axios
 * instansiyasi (proxy + 401 refresh) orqali.
 */
import api, { type ApiResponse } from './api';
import type {
  IntercityPoint,
  IntercityPointForm,
  IntercityRoute,
  IntercityRouteForm,
  IntercitySettings,
  IntercityZone,
  IntercityZoneForm,
} from './intercity';

type RouteUpdate = Partial<Omit<IntercityRouteForm, 'originPointId' | 'destinationPointId'>> & {
  isActive?: boolean;
};

export const intercityApi = {
  getPoints: () => api.get<ApiResponse<IntercityPoint[]>>('/intercity/points/manage'),
  createPoint: (dto: IntercityPointForm & { isActive?: boolean }) =>
    api.post<ApiResponse<IntercityPoint>>('/intercity/points/manage', dto),
  updatePoint: (id: string, dto: Partial<IntercityPointForm> & { isActive?: boolean }) =>
    api.patch<ApiResponse<IntercityPoint>>(`/intercity/points/manage/${id}`, dto),

  getZones: (pointId: string) =>
    api.get<ApiResponse<IntercityZone[]>>(`/intercity/points/manage/${pointId}/zones`),
  createZone: (pointId: string, dto: IntercityZoneForm & { sortOrder?: number; isActive?: boolean }) =>
    api.post<ApiResponse<IntercityZone>>(`/intercity/points/manage/${pointId}/zones`, dto),
  updateZone: (id: string, dto: Partial<IntercityZoneForm> & { isActive?: boolean }) =>
    api.patch<ApiResponse<IntercityZone>>(`/intercity/zones/manage/${id}`, dto),

  getRoutes: () => api.get<ApiResponse<IntercityRoute[]>>('/intercity/routes/manage'),
  createRoute: (dto: IntercityRouteForm & { isActive?: boolean }) =>
    api.post<ApiResponse<IntercityRoute>>('/intercity/routes/manage', dto),
  updateRoute: (id: string, dto: RouteUpdate) =>
    api.patch<ApiResponse<IntercityRoute>>(`/intercity/routes/manage/${id}`, dto),

  getSettings: () => api.get<ApiResponse<IntercitySettings>>('/settings/intercity'),
  updateSettings: (dto: Partial<IntercitySettings>) =>
    api.patch<ApiResponse<IntercitySettings>>('/settings/intercity', dto),
};
