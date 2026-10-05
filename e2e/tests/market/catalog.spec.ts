import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS, uniqueName } from '../../support/env';

interface Category { id: string; name: string }
interface Product { id: string; name: string; price: number; stock: number; status: string; categoryId: string | null }

test.describe('market — catalogue', () => {
  let api: PanelApi;
  const created = { categories: [] as string[], products: [] as string[] };

  test.beforeEach(({ request }) => {
    api = new PanelApi(request, PANELS.market);
  });

  test.afterEach(async () => {
    for (const id of created.products.splice(0)) await api.tryDelete(`/market/vendor/products/${id}`);
    for (const id of created.categories.splice(0)) await api.tryDelete(`/market/vendor/categories/${id}`);
  });

  const findCategory = async (name: string) =>
    (await api.get<Category[]>('/market/vendor/categories')).find((c) => c.name === name);
  const findProduct = async (name: string) =>
    (await api.get<Product[]>('/market/vendor/products')).find((p) => p.name === name);

  test('category: create, rename, delete', async ({ page }) => {
    const name = uniqueName('Kategoriya');
    const renamed = `${name} yangi`;

    await page.goto('/dashboard/categories');
    await page.getByRole('button', { name: 'Kategoriya', exact: true }).click();
    await page.getByLabel('Kategoriya nomi').fill(name);
    await page.getByRole('button', { name: 'Saqlash' }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    const category = await findCategory(name);
    expect(category, 'category saved').toBeDefined();
    created.categories.push(category!.id);

    await page.getByRole('button', { name: `${name} kategoriyasini tahrirlash` }).click();
    await page.getByLabel('Kategoriya nomi').fill(renamed);
    await page.getByRole('button', { name: 'Saqlash' }).click();
    await expect(page.getByText(renamed, { exact: true })).toBeVisible();
    expect((await findCategory(renamed))?.id).toBe(category!.id);

    await page.getByRole('button', { name: `${renamed} kategoriyasini o'chirish` }).click();
    await page.getByRole('button', { name: "O'chirish", exact: true }).click();
    await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
    expect(await findCategory(renamed)).toBeUndefined();
  });

  test('product: add with category, edit price, hide from sale', async ({ page }) => {
    const category = await api.post<Category>('/market/vendor/categories', { name: uniqueName('Kat'), emoji: '🧪' });
    created.categories.push(category.id);
    const name = uniqueName('Mahsulot');

    await page.goto('/dashboard/products');
    await page.getByRole('button', { name: "Mahsulot qo'shish" }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nomi').fill(name);
    await dialog.getByLabel("Narx (so'm)").fill('12500');
    await dialog.getByLabel('Zaxira').fill('7');
    await dialog.getByLabel('Kategoriya').selectOption(category.id);
    await dialog.getByRole('button', { name: "Qo'shish" }).click();
    await expectToast(page, "Mahsulot qo'shildi");

    const product = await findProduct(name);
    expect(product, 'product saved').toMatchObject({ price: 12500, stock: 7, categoryId: category.id, status: 'active' });
    created.products.push(product!.id);

    await page.getByLabel('Mahsulot qidirish').fill(name);
    await page.getByRole('button', { name: `${name} narxi — tahrirlash` }).locator('visible=true').click();
    await page.getByLabel(`${name} narxi`, { exact: true }).locator('visible=true').fill('13900');
    await page.getByRole('button', { name: 'Saqlash' }).locator('visible=true').click();
    await expectToast(page, 'Saqlandi');
    expect((await findProduct(name))?.price).toBe(13900);

    await page.getByRole('button', { name: 'Sotuvdan yashirish' }).locator('visible=true').click();
    await expect.poll(async () => (await findProduct(name))?.status).toBe('hidden');
  });
});
