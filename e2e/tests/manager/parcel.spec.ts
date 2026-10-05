import { request as playwrightRequest } from '@playwright/test';
import { test, expect, expectToast } from '../../support/fixtures';
import { DriverApi, PanelApi, PassengerApi } from '../../support/api';
import { PANELS, authFile } from '../../support/env';

interface Order { id: string; status: string; deliveryPin?: string | null }
interface Tariff { id: string; serviceType: string }

const PARCEL = { recipientPhone: '+998901112233', recipientName: 'Ona', itemDescription: 'E2E kalitlar', size: 'small' };

/**
 * Posilka (v2): the sender orders like a passenger, gets a 4-digit PIN, and
 * the driver cannot complete the ride without it. Passenger and driver act
 * through the API (their mobile apps); the dispatcher through the panel.
 */
test.describe('parcel delivery', () => {
  let passenger: PassengerApi;
  let driver: DriverApi;
  let parcelTariffId: string;
  const created: string[] = [];

  test.beforeEach(async ({ request }) => {
    passenger = new PassengerApi(request);
    driver = new DriverApi(request);
    const adminRequest = await playwrightRequest.newContext({ storageState: authFile('admin') });
    const tariffs = await new PanelApi(adminRequest, PANELS.admin).get<Tariff[]>('/tariffs/all');
    await adminRequest.dispose();
    const parcel = tariffs.find((t) => t.serviceType === 'parcel');
    expect(parcel, 'Posilka tariff (migration 014)').toBeDefined();
    parcelTariffId = parcel!.id;
  });

  // A test that fails mid-ride would leave the driver "busy" (one active order
  // per driver) and block every later test — cancel whatever did not finish.
  test.afterEach(async ({ request }) => {
    const manager = new PanelApi(request, PANELS.manager);
    for (const id of created.splice(0)) {
      const { status } = await passenger.get<Order>(`/orders/${id}`);
      if (status !== 'completed' && status !== 'cancelled') {
        await manager.patch(`/orders/${id}/cancel`, { reason: 'E2E cleanup' });
      }
    }
  });

  async function parcelOnTheWay(): Promise<Order & { deliveryPin: string }> {
    const order = await passenger.placeParcelOrder(parcelTariffId, PARCEL);
    created.push(order.id);
    expect(order.deliveryPin, 'sender gets the PIN').toMatch(/^\d{4}$/);
    // Matching flips the order to SEARCHING asynchronously.
    await expect.poll(async () => (await passenger.get<Order>(`/orders/${order.id}`)).status).toBe('searching');
    await driver.patch(`/orders/${order.id}/accept`);
    // "Arrived" is only accepted within 500 m of the pickup.
    await driver.post('/drivers/location', { lat: 41.011, lng: 70.142, orderId: order.id });
    await driver.patch(`/orders/${order.id}/arrived`);
    await driver.patch(`/orders/${order.id}/start`);
    return order as Order & { deliveryPin: string };
  }

  test('only the right PIN completes it; the driver never sees the PIN', async () => {
    const order = await parcelOnTheWay();

    expect((await passenger.get<Order>(`/orders/${order.id}`)).deliveryPin).toBe(order.deliveryPin);
    expect((await driver.get<Order>(`/orders/${order.id}`)).deliveryPin).toBeUndefined();

    const noPin = await driver.rawPatch(`/orders/${order.id}/complete`);
    expect(noPin.status()).toBe(400);

    const wrong = String((Number(order.deliveryPin) + 1) % 10_000).padStart(4, '0');
    const wrongPin = await driver.rawPatch(`/orders/${order.id}/complete`, { deliveryPin: wrong });
    expect(wrongPin.status()).toBe(400);
    expect(await wrongPin.text()).toContain('Qolgan urinishlar: 4');

    const done = await driver.patch<Order>(`/orders/${order.id}/complete`, { deliveryPin: order.deliveryPin });
    expect(done.status).toBe('completed');
  });

  test('after five wrong PINs it locks, and the dispatcher completes it from the panel', async ({ page }) => {
    const order = await parcelOnTheWay();
    const wrong = String((Number(order.deliveryPin) + 1) % 10_000).padStart(4, '0');

    for (let i = 0; i < 5; i++) await driver.rawPatch(`/orders/${order.id}/complete`, { deliveryPin: wrong });
    const locked = await driver.rawPatch(`/orders/${order.id}/complete`, { deliveryPin: order.deliveryPin });
    expect(locked.status(), 'even the right PIN is refused once locked').toBe(403);

    await page.goto(`/orders/${order.id}`);
    // The dispatcher sees who receives it, to phone them before completing.
    await expect(page.getByText(PARCEL.itemDescription)).toBeVisible();
    await expect(page.locator(`a[href="tel:${PARCEL.recipientPhone}"]`)).toBeVisible();
    await page.getByRole('button', { name: 'Yakunlash' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Yakunlash' }).click();
    await expectToast(page, `Buyurtma #${order.id.slice(-6).toUpperCase()} yakunlandi`);
    await expect.poll(async () => (await passenger.get<Order>(`/orders/${order.id}`)).status).toBe('completed');
  });

  test('a parcel needs the parcel tariff, and its details are validated', async () => {
    const route = { pickupLat: 41.011, pickupLng: 70.142, dropoffLat: 41.025, dropoffLng: 70.16, paymentMethod: 'cash' };

    const badPhone = await passenger.rawPost('/orders', {
      ...route, tariffId: parcelTariffId, serviceType: 'parcel', details: { ...PARCEL, recipientPhone: '123' },
    });
    expect(badPhone.status()).toBe(400);

    const parcelAsTaxi = await passenger.rawPost('/orders', { ...route, tariffId: parcelTariffId, serviceType: 'taxi' });
    expect(parcelAsTaxi.status(), 'parcel tariff cannot carry a plain ride (would skip the PIN)').toBe(400);
  });
});
