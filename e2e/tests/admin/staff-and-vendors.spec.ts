import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS } from '../../support/env';

interface User { id: string; phone: string; permissions: string[] }
interface Store { id: string; name: string; status: string }

// Both tests act on seeded accounts the rest of the suite does not log in as,
// and put them back the way they found them.
const STAFF_PHONE = '+998933330002'; // "Manager Test"
const STORE_NAME = 'Yangi Bozor';

test('staff: admin revokes and restores a manager permission', async ({ page, request }) => {
  const api = new PanelApi(request, PANELS.admin);
  const { users } = await api.get<{ users: User[] }>('/users?role=manager&limit=100');
  const target = users.find((u) => u.phone === STAFF_PHONE);
  expect(target, `seeded manager ${STAFF_PHONE}`).toBeDefined();
  const original = target!.permissions;
  const permissionsNow = async () => (await api.get<User>(`/users/${target!.id}`)).permissions;

  try {
    // Make sure the checkbox below starts ticked.
    const withPromo = original.includes('promo_manage') ? original : [...original, 'promo_manage'];
    await api.patch(`/users/${target!.id}/permissions`, { permissions: withPromo });

    await page.goto('/dashboard/staff');
    await page.getByLabel('Xodimlarni qidirish').fill('Manager Test');
    await page.getByRole('row', { name: /Manager Test/ }).getByRole('button', { name: 'Ruxsatlarni tahrirlash' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel("Promo kodlarni ko'rish va yaratish").uncheck();
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expectToast(page, 'Ruxsatlar yangilandi');
    await expect.poll(permissionsNow).not.toContain('promo_manage');
  } finally {
    await api.patch(`/users/${target!.id}/permissions`, { permissions: original });
  }
});

test('vendors: admin closes a store and opens it again', async ({ page, request }) => {
  const api = new PanelApi(request, PANELS.admin);
  const storeStatus = async () =>
    (await api.get<Store[]>('/market/admin/stores')).find((s) => s.name === STORE_NAME)?.status;
  const before = await storeStatus();
  expect(before, `seeded store ${STORE_NAME}`).toBeDefined();

  await page.goto('/dashboard/vendors');
  await page.getByLabel('Sotuvchilarni qidirish').fill(STORE_NAME);
  const row = page.getByRole('row', { name: new RegExp(STORE_NAME) });

  if (before !== 'active') {
    await row.getByRole('button', { name: 'Ochish' }).click();
    await expect.poll(storeStatus).toBe('active');
  }

  await row.getByRole('button', { name: 'Yopish' }).click();
  await expectToast(page, `«${STORE_NAME}» yopildi`);
  await expect.poll(storeStatus).toBe('closed');

  await row.getByRole('button', { name: 'Ochish' }).click();
  await expectToast(page, `«${STORE_NAME}» ochildi`);
  await expect.poll(storeStatus).toBe('active');
});
