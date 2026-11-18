import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS, authFile } from '../../support/env';

interface PromoCode { id: string; code: string; isActive: boolean; discountPercent: number | null }

// Crosses two panels: managers create promo codes, only admins can switch them off.
test('promo code: manager creates it, admin deactivates it', async ({ page, request, browser }) => {
  const code = `E2E${Date.now().toString(36).toUpperCase()}`;
  const manager = new PanelApi(request, PANELS.manager);
  const find = async () => (await manager.get<PromoCode[]>('/promo-codes')).find((p) => p.code === code);

  await page.goto('/dispatch/promo-codes');
  await page.getByRole('button', { name: 'Yangi promo kod' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Kod').fill(code);
  await dialog.getByLabel('Chegirma (%)').fill('15');
  await dialog.getByLabel('Max ishlatish soni').fill('3');
  await dialog.getByRole('button', { name: /yaratish|saqlash/i }).click();
  await expectToast(page, `«${code}» promo kodi yaratildi`);
  expect(await find()).toMatchObject({ isActive: true, discountPercent: 15 });

  const adminContext = await browser.newContext({ storageState: authFile('admin') });
  try {
    const admin = await adminContext.newPage();
    await admin.goto(`${PANELS.admin.baseURL}/dashboard/promo-codes`);
    await admin.getByLabel('Promo kodlarni qidirish').fill(code);
    await admin.getByRole('row', { name: new RegExp(code) }).getByRole('button', { name: 'Faolsizlantirish' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Faolsizlantirish' }).click();
    await expectToast(admin, `«${code}» faolsizlantirildi`);
    await expect.poll(async () => (await find())?.isActive).toBe(false);
  } finally {
    await adminContext.close();
  }
});
