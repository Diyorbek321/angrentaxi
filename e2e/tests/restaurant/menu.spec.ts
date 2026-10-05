import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS, uniqueName } from '../../support/env';

interface Category { id: string; name: string }
interface Dish { id: string; name: string; price: number; isAvailable: boolean; categoryId: string | null }

test.describe('restaurant — menu', () => {
  let api: PanelApi;
  const created = { categories: [] as string[], dishes: [] as string[] };

  test.beforeEach(({ request }) => {
    api = new PanelApi(request, PANELS.restaurant);
  });

  test.afterEach(async () => {
    for (const id of created.dishes.splice(0)) await api.tryDelete(`/food/vendor/dishes/${id}`);
    for (const id of created.categories.splice(0)) await api.tryDelete(`/food/vendor/categories/${id}`);
  });

  const findCategory = async (name: string) =>
    (await api.get<Category[]>('/food/vendor/categories')).find((c) => c.name === name);
  const findDish = async (name: string) =>
    (await api.get<Dish[]>('/food/vendor/dishes')).find((d) => d.name === name);

  test('category: create, rename, delete', async ({ page }) => {
    const name = uniqueName('Bolim');
    const renamed = `${name} yangi`;

    await page.goto('/dashboard/categories');
    await page.getByLabel('Yangi kategoriya').fill(name);
    await page.getByRole('button', { name: "Qo'shish" }).click();
    await expectToast(page, `«${name}» qo‘shildi`);
    const category = await findCategory(name);
    expect(category, 'category saved').toBeDefined();
    created.categories.push(category!.id);

    await page.getByRole('button', { name: `${name} — nomini o'zgartirish` }).click();
    await page.getByRole('dialog').getByLabel('Nomi').fill(renamed);
    await page.getByRole('dialog').getByRole('button', { name: 'Saqlash' }).click();
    await expectToast(page, 'Nomi yangilandi');
    expect((await findCategory(renamed))?.id).toBe(category!.id);

    await page.getByRole('button', { name: `${renamed} — o'chirish` }).click();
    await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click();
    await expectToast(page, `«${renamed}» o‘chirildi`);
    expect(await findCategory(renamed)).toBeUndefined();
  });

  test('dish: add, change price, mark sold out, delete', async ({ page }) => {
    const category = await api.post<Category>('/food/vendor/categories', { name: uniqueName('Kat') });
    created.categories.push(category.id);
    const name = uniqueName('Taom');

    await page.goto('/dashboard/menu');
    await page.getByRole('button', { name: 'Yangi taom' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nomi').fill(name);
    await dialog.getByLabel("Narxi (so'm)").fill('27000');
    await dialog.getByLabel('Kategoriya').selectOption(category.id);
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expectToast(page, "Taom qo'shildi");

    const dish = await findDish(name);
    expect(dish, 'dish saved').toMatchObject({ price: 27000, categoryId: category.id, isAvailable: true });
    created.dishes.push(dish!.id);

    await page.getByRole('button', { name: `${name} — narxini o'zgartirish` }).click();
    await page.getByLabel(`${name} — yangi narx (so'm)`).fill('29000');
    await page.getByRole('button', { name: 'Narxni saqlash' }).click();
    await expectToast(page, `${name} — narx yangilandi`);
    expect((await findDish(name))?.price).toBe(29000);

    await page.getByRole('button', { name: `${name} — tugagan deb belgilash` }).click();
    await expect(page.getByRole('button', { name: `${name} — mavjud deb belgilash` })).toBeVisible();
    expect((await findDish(name))?.isAvailable).toBe(false);

    await page.getByRole('button', { name: `${name} — o'chirish` }).click();
    await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click();
    await expectToast(page, `${name} o‘chirildi`);
    expect(await findDish(name)).toBeUndefined();
  });
});
