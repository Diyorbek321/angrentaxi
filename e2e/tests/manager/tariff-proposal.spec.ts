import { request as playwrightRequest } from '@playwright/test';
import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS, authFile, uniqueName } from '../../support/env';

interface Tariff { id: string; name: string; isActive: boolean }

// Crosses two panels: a manager can only PROPOSE a tariff; the admin approves
// it (which creates it), then deletes it again — an unused tariff.
test('tariff: manager proposes, admin approves, then deletes the unused tariff', async ({ page, browser }) => {
  const name = uniqueName('Tarif');
  // This test runs as the manager; admin-only calls need the admin's session.
  const adminRequest = await playwrightRequest.newContext({ storageState: authFile('admin') });
  const admin = new PanelApi(adminRequest, PANELS.admin);
  const findTariff = async () => (await admin.get<Tariff[]>('/tariffs/all')).find((t) => t.name === name);

  await page.goto('/dispatch/tariffs');
  await page.getByRole('button', { name: 'Yangi tarif taklif qilish' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Nomi').fill(name);
  await form.getByLabel('Boshlangʻich narx').fill('4000');
  await form.getByLabel('Km narxi').fill('1700');
  await form.getByLabel('Daqiqa narxi').fill('150');
  await form.getByLabel('Min narx').fill('6000');
  await form.getByRole('button', { name: 'Taklif yuborish' }).click();
  await expectToast(page, `«${name}» tarifi taklif qilindi`);

  const adminContext = await browser.newContext({ storageState: authFile('admin') });
  try {
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${PANELS.admin.baseURL}/dashboard/tariffs`);
    const proposal = adminPage.locator('li, tr, div').filter({ hasText: name }).filter({
      has: adminPage.getByRole('button', { name: 'Rad etish' }),
    }).last();
    await proposal.getByRole('button', { name: 'Tasdiqlash' }).click();
    await adminPage.getByRole('dialog').getByRole('button', { name: 'Tasdiqlash' }).click();
    await expectToast(adminPage, 'Taklif tasdiqlandi');
    await expect.poll(async () => (await findTariff())?.isActive).toBe(true);

    await adminPage.getByRole('button', { name: `${name} tarifini o'chirish` }).click();
    await adminPage.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click();
    await expectToast(adminPage, "Tarif o'chirildi");
    await expect.poll(findTariff).toBeUndefined();
  } finally {
    const leftover = await findTariff();
    if (leftover) await admin.tryDelete(`/tariffs/${leftover.id}`);
    await adminContext.close();
    await adminRequest.dispose();
  }
});
