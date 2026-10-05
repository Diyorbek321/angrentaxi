import fs from 'node:fs';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { API_URL, authFile, type PanelConfig } from './env';
import type { ApiTokens } from './login';

// Angren city centre — inside the dispatch area, so a courier can be offered.
export const DELIVERY_POINT = { deliveryAddress: "E2E test manzil, Angren", deliveryLat: 41.0167, deliveryLng: 70.1436 };

async function data<T>(res: APIResponse, what: string): Promise<T> {
  const text = await res.text();
  expect(res.ok(), `${what} → ${res.status()} ${text.slice(0, 300)}`).toBe(true);
  return (JSON.parse(text) as { data: T }).data;
}

/**
 * Calls the backend through a panel's own /api/proxy, carrying the panel's
 * httpOnly session cookies — the same path the panel's pages use.
 */
export class PanelApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly panel: PanelConfig,
  ) {}

  private url(path: string) {
    return `${this.panel.baseURL}/api/proxy${path}`;
  }

  private get headers() {
    return { Origin: this.panel.baseURL };
  }

  async get<T>(path: string): Promise<T> {
    return data<T>(await this.request.get(this.url(path), { headers: this.headers }), `GET ${path}`);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return data<T>(await this.request.post(this.url(path), { headers: this.headers, data: body }), `POST ${path}`);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return data<T>(await this.request.patch(this.url(path), { headers: this.headers, data: body }), `PATCH ${path}`);
  }

  /** Best-effort cleanup: a leftover row must not fail an otherwise green test. */
  async tryDelete(path: string): Promise<boolean> {
    const res = await this.request.delete(this.url(path), { headers: this.headers });
    return res.ok();
  }
}

/** The passenger, talking to the backend directly as the mobile app does. */
export class PassengerApi {
  private readonly token: string;

  constructor(private readonly request: APIRequestContext) {
    const tokens = JSON.parse(fs.readFileSync(authFile('passenger'), 'utf8')) as ApiTokens;
    this.token = tokens.accessToken;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request.post(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      data: body,
    });
    return data<T>(res, `POST ${path}`);
  }

  placeMarketOrder(storeId: string, items: { productId: string; qty: number }[]) {
    return this.post<{ id: string; status: string; totalPrice: number }>('/market/orders', {
      storeId,
      items,
      ...DELIVERY_POINT,
      paymentMethod: 'cash',
    });
  }

  placeFoodOrder(restaurantId: string, items: { dishId: string; qty: number }[]) {
    return this.post<{ id: string; status: string; totalPrice: number }>('/food/orders', {
      restaurantId,
      items,
      ...DELIVERY_POINT,
      paymentMethod: 'cash',
    });
  }
}
