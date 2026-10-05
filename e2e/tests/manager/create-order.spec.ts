import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS, PASSENGER_PHONE } from '../../support/env';

interface Order { id: string; status: string; pickupAddress: string }

test('call-centre order: create for a passenger, open it, cancel it', async ({ page, request }) => {
  const api = new PanelApi(request, PANELS.manager);
  const pickup = `E2E olib ketish ${Date.now()}`;

  await page.goto('/create-order');
  await page.getByPlaceholder('+998 90 123 45 67').fill(PASSENGER_PHONE);
  await page.getByPlaceholder('Olib ketish manzilini kiriting').fill(pickup);
  await page.getByPlaceholder('40.0956').fill('41.0110');
  await page.getByPlaceholder('70.9432').fill('70.1420');
  await page.getByPlaceholder('Tashlab ketish manzilini kiriting').fill('E2E tashlab ketish');
  await page.getByPlaceholder('40.1050').fill('41.0250');
  await page.getByPlaceholder('70.9510').fill('70.1600');
  const tariff = page.getByLabel('Tarif *');
  await expect(tariff).toBeEnabled();
  await tariff.selectOption({ index: 1 });

  const created = page.waitForResponse((r) => r.url().includes('/orders/dispatch') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Buyurtma yaratish' }).click();
  const response = await created;
  expect(response.status(), await response.text()).toBeLessThan(300);
  const order = (await response.json()).data as Order;
  await expectToast(page, 'Buyurtma yaratildi');

  try {
    await page.goto(`/orders/${order.id}`);
    await expect(page.getByText(pickup)).toBeVisible();

    await page.getByRole('button', { name: 'Bekor qilish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bekor qilish' }).click();
    await expectToast(page, `Buyurtma #${order.id.slice(-6).toUpperCase()} bekor qilindi`);
    await expect.poll(async () => (await api.get<Order>(`/orders/${order.id}`)).status).toBe('cancelled');
  } finally {
    // Never leave a live order searching for a driver.
    const current = await api.get<Order>(`/orders/${order.id}`);
    if (current.status !== 'cancelled') await api.patch(`/orders/${order.id}/cancel`, { reason: 'E2E cleanup' });
  }
});
