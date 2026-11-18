import { test, expect, expectToast } from '../../support/fixtures';
import { DriverApi, PanelApi } from '../../support/api';
import { DRIVER_PHONE, PANELS, uniqueName } from '../../support/env';

// The driver side runs through the API, as the driver app would; everything
// the admin does goes through the panel.

test('KYC: a document the driver uploads is opened and approved by the admin', async ({ page, request }) => {
  const driver = new DriverApi(request);
  const uploaded = await driver.uploadDocument('passport');
  expect(uploaded.reviewStatus).toBe('pending');

  await page.goto('/dashboard/driver-documents');
  // Oldest first: this run's upload is the newest passport row for the driver.
  const row = page.getByRole('row').filter({ hasText: DRIVER_PHONE }).filter({ hasText: 'Pasport' }).last();
  await row.getByRole('button', { name: "Ko'rib chiqish" }).click();

  const dialog = page.getByRole('dialog');
  // The scan streams through the backend from object storage — a broken read
  // shows up here as an image with no pixels.
  const scan = dialog.locator('img').first();
  await expect(scan).toBeVisible();
  await expect.poll(() => scan.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await dialog.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expectToast(page, 'Tasdiqlandi');
  await expect
    .poll(async () => (await driver.documents()).find((d) => d.id === uploaded.id)?.reviewStatus)
    .toBe('approved');
});

test('payout: driver asks to withdraw, admin approves and marks it paid', async ({ page, request }) => {
  const admin = new PanelApi(request, PANELS.admin);
  const driver = new DriverApi(request);
  const amount = 50_000;
  const destination = uniqueName('karta');

  // Top up exactly what is withdrawn, so the driver's balance ends where it began.
  const { id: driverId } = await driver.me();
  await admin.patch(`/drivers/${driverId}/balance`, { amount, note: 'E2E payout test' });
  const withdrawal = await driver.requestWithdrawal(amount, destination);
  const status = async () => (await driver.withdrawals()).find((w) => w.id === withdrawal.id)?.status;

  await page.goto('/dashboard/withdrawals');
  await page.getByRole('row').filter({ hasText: destination }).getByRole('button', { name: 'Tasdiqlash' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Tasdiqlash/ }).click();
  await expectToast(page, "So'rov tasdiqlandi");
  await expect.poll(status).toBe('approved');

  await page.getByRole('tab', { name: 'Tasdiqlangan' }).click();
  await page.getByRole('row').filter({ hasText: destination }).getByRole('button', { name: "To'landi deb belgilash" }).click();
  await page.getByRole('dialog').getByRole('button', { name: "To'landi deb belgilash" }).click();
  await expectToast(page, "To'langan deb belgilandi");
  await expect.poll(status).toBe('paid');
});
