/**
 * Hodisalar API'si (INCIDENT-POLICY §3). `lib/api.ts` 1000 qatordan oshgan —
 * alohida, o'sha `apiClient` (proxy + 401 refresh) orqali.
 */
import { apiClient, type ApiResponse } from './api';
import type {
  IncidentDetail,
  IncidentItem,
  IncidentPage,
  IncidentStatus,
  IncidentVertical,
  ResolvePayload,
} from './incidents';

export interface IncidentsQuery {
  status?: IncidentStatus | 'active';
  category?: string;
  vertical?: IncidentVertical;
  page?: number;
  limit?: number;
}

export async function getIncidents(query: IncidentsQuery): Promise<IncidentPage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
  const res = await apiClient.get<ApiResponse<IncidentPage>>('/manager/incidents', { params });
  return res.data.data;
}

export async function getIncidentOpenCount(): Promise<{ count: number; escalated: number }> {
  const res = await apiClient.get<ApiResponse<{ count: number; escalated: number }>>('/manager/incidents/open-count');
  return res.data.data;
}

export async function getIncident(id: string): Promise<IncidentDetail> {
  const res = await apiClient.get<ApiResponse<IncidentDetail>>(`/manager/incidents/${encodeURIComponent(id)}`);
  return res.data.data;
}

export async function getOrderIncidents(vertical: IncidentVertical, orderId: string): Promise<IncidentItem[]> {
  const res = await apiClient.get<ApiResponse<IncidentItem[]>>(
    `/manager/incidents/by-order/${vertical}/${encodeURIComponent(orderId)}`,
  );
  return res.data.data;
}

export async function assignIncidentToMe(id: string): Promise<IncidentItem> {
  const res = await apiClient.post<ApiResponse<IncidentItem>>(`/manager/incidents/${encodeURIComponent(id)}/assign`);
  return res.data.data;
}

export async function resolveIncident(id: string, payload: ResolvePayload): Promise<IncidentItem> {
  const res = await apiClient.post<ApiResponse<IncidentItem>>(
    `/manager/incidents/${encodeURIComponent(id)}/resolve`,
    payload,
  );
  return res.data.data;
}

export async function createIncident(input: {
  vertical: IncidentVertical;
  orderId: string;
  category: string;
  description: string;
  subject?: 'driver' | 'vendor' | 'customer';
}): Promise<IncidentItem> {
  const res = await apiClient.post<ApiResponse<IncidentItem>>('/manager/incidents', input);
  return res.data.data;
}

/** Foto — sessiya cookie bilan blob, `<img>` uchun object URL. Chaqiruvchi `revokeObjectURL` qiladi. */
export async function getIncidentPhotoUrl(id: string, index: number): Promise<string> {
  const res = await apiClient.get<Blob>(`/manager/incidents/${encodeURIComponent(id)}/photos/${index}`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(res.data);
}
