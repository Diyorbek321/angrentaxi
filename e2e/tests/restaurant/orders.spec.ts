import type { APIRequestContext } from '@playwright/test';
import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi, PassengerApi } from '../../support/api';
import { PANELS, uniqueName } from '../../support/env';

interface Restaurant { id: string; status: string }
interface Dish { id: string; name: string }
interface Order { id: string; status: string }

test.describe('restaurant — order lifecycle', () => {
  let api: PanelApi;
  let restaurant: Restaurant;
  let dish: Dish;

  test.beforeEach(async ({ request }) => {
    api = new PanelApi(request, PANELS.restaurant);
    restaurant = await api.get<Restaurant>('/food/vendor/restaurant');
    // Orders only reach an open restaurant; leave it the way we found it.
    if (restaurant.status !== 'active') await api.patch('/food/vendor/restaurant/toggle-open');
    dish = await api.post<Dish>('/food/vendor/dishes', { name: uniqueName('Buyurtma taomi'), price: 21000 });
  });

  test.afterEach(async () => {
    await api.tryDelete(`/food/vendor/dishes/${dish.id}`);
    if (restaurant.status !== 'active') await api.patch('/food/vendor/restaurant/toggle-open');
  });

  const placeOrder = (request: APIRequestContext) =>
    new PassengerApi(request).placeFoodOrder(restaurant.id, [{ dishId: dish.id, qty: 1 }]);

  test('passenger order goes new → preparing → ready → delivered', async ({ page, request }) => {
    const order = await placeOrder(request);
    expect(order.status).toBe('new');
    const orderStatus = async () => (await api.get<Order>(`/food/vendor/orders/${order.id}`)).status;
    const card = page.getByRole('article', { name: `Buyurtma №${order.id.slice(0, 6)}` });

    await page.goto('/dashboard/orders');
    await page.getByRole('tab', { name: /Yangi/ }).click();
    await card.getByRole('button', { name: 'Qabul qilish' }).click();
    await expect.poll(orderStatus).toBe('preparing');

    await page.getByRole('tab', { name: /Tayyorlanmoqda/ }).click();
    await card.getByRole('button', { name: 'Tayyor deb belgilash' }).click();
    await expect.poll(orderStatus).toBe('ready');

    await page.getByRole('tab', { name: /^Tayyor(?!lanmoqda)/ }).click();
    await card.getByRole('button', { name: 'Yetkazildi deb belgilash' }).click();
    await expect.poll(orderStatus).toBe('delivered');
  });

  test('restaurant rejects a new order with a reason', async ({ page, request }) => {
    const order = await placeOrder(request);
    const shortId = order.id.slice(0, 6);

    await page.goto('/dashboard/orders');
    await page.getByRole('tab', { name: /Yangi/ }).click();
    await page.getByRole('button', { name: `#${shortId} buyurtmasini rad etish` }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Oshxona band').check();
    await dialog.getByRole('button', { name: 'Rad etish' }).click();
    await expectToast(page, 'Buyurtma rad etildi');
    await expect.poll(async () => (await api.get<Order>(`/food/vendor/orders/${order.id}`)).status).toBe('cancelled');
  });
});
