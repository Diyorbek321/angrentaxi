import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS } from '../../support/env';

interface Tariff { id: string; name: string; isActive: boolean; serviceType: string }

test('tariffs page lists inactive and delivery tariffs too, not only active taxi ones', async ({ page, request }) => {
  const admin = new PanelApi(request, PANELS.admin);
  const all = await admin.get<Tariff[]>('/tariffs/all');
  const delivery = all.find((t) => t.serviceType === 'food');
  expect(delivery, 'seeded food delivery tariff').toBeDefined();

  await page.goto('/dashboard/tariffs');
  await expect(page.getByRole('button', { name: `${delivery!.name} tarifini o'chirish` })).toBeVisible();
});

test('deleting a tariff that orders use is refused, and the panel says why', async ({ page, request, issues }) => {
  const admin = new PanelApi(request, PANELS.admin);
  const standard = (await admin.get<Tariff[]>('/tariffs/all')).find((t) => t.name === 'Standard');
  expect(standard, 'seeded Standard tariff').toBeDefined();
  issues.allow(`/api/proxy/tariffs/${standard!.id}`); // the 409 is the point of this test

  await page.goto('/dashboard/tariffs');
  await page.getByRole('button', { name: "Standard tarifini o'chirish" }).click();
  await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click();
  await expectToast(page, 'faolsizlantiring');
  expect((await admin.get<Tariff[]>('/tariffs/all')).some((t) => t.id === standard!.id)).toBe(true);
});
