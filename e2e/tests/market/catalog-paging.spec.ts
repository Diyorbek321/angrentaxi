import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS, uniqueName } from '../../support/env';
import { bigPhoto, naturalEdge } from '../../support/images';

interface Product { id: string; name: string; status: string; imageKey?: string | null }
interface ProductPage {
  products: Product[];
  total: number;
  counts: Record<'all' | 'active' | 'out' | 'hidden', number>;
}

test.describe('market — katalog server tomonida sahifalanadi', () => {
  let api: PanelApi;
  const created: string[] = [];

  test.beforeEach(({ request }) => {
    api = new PanelApi(request, PANELS.market);
  });

  test.afterEach(async () => {
    for (const id of created.splice(0)) await api.tryDelete(`/market/vendor/products/${id}`);
  });

  const createProduct = async (name: string) => {
    const p = await api.post<Product>('/market/vendor/products', { name, price: 5000, stock: 3, unit: 'dona' });
    created.push(p.id);
    return p;
  };

  test('tab sonlari, holat filtri, qidiruv va sahifa almashtirish serverdan', async ({ page }) => {
    const name = uniqueName('Tugagan');
    const product = await createProduct(name);
    await api.patch(`/market/vendor/products/${product.id}`, { status: 'out' });
    const stats = await api.get<ProductPage>('/market/vendor/products/browse?page=1&limit=1');

    const browse = page.waitForResponse((r) => r.url().includes('/market/vendor/products/browse'));
    await page.goto('/dashboard/products');
    await browse;

    // Tab sonlari butun katalog bo'yicha — faqat ko'rinib turgan sahifa emas.
    await expect(page.getByRole('tab', { name: /Barchasi/ })).toContainText(String(stats.counts.all));
    await expect(page.getByText(new RegExp(`^1–${Math.min(25, stats.total)} / ${stats.total}$`)).first()).toBeVisible();

    if (stats.total > 25) {
      await page.getByRole('button', { name: /Keyingi/ }).first().click();
      await expect(page.getByText(new RegExp(`^26–\\d+ / ${stats.total}$`)).first()).toBeVisible();
    }

    // Holat tabi so'rovga `status=out` qo'shadi va 1-sahifaga qaytadi.
    const outReq = page.waitForRequest((r) => r.url().includes('status=out') && r.url().includes('page=1'));
    await page.getByRole('tab', { name: /Tugagan/ }).click();
    await outReq;
    await expect(page.getByText(name).locator('visible=true')).toBeVisible();

    // Qidiruv serverga yozish to'xtagach ketadi.
    const searchReq = page.waitForRequest((r) => new URL(r.url()).searchParams.get('search') === name);
    await page.getByLabel('Mahsulot qidirish').fill(name);
    await searchReq;
    await expect(page.getByText(/^1–1 \/ 1$/).first()).toBeVisible();
    await expect(page.getByText("Filtr qo'llangan: 1 ta mahsulot topildi")).toBeVisible();
  });

  test('rasm yuklash: katta foto brauzerda 1200 px JPEG ga kichraytirilib saqlanadi', async ({ page }) => {
    const name = uniqueName('Rasmli');
    await createProduct(name);

    await page.goto('/dashboard/products');
    const photo = await bigPhoto(page);
    expect(photo.byteLength, 'manba foto backend chegarasidan katta').toBeGreaterThan(2 * 1024 * 1024);

    await page.getByLabel('Mahsulot qidirish').fill(name);
    await page.getByRole('button', { name: `${name} rasmini o'zgartirish` }).locator('visible=true').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'telefon.jpg', mimeType: 'image/jpeg', buffer: photo });

    const upload = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith('/image'));
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    expect((await upload).status(), 'backend 2 MB chegarasi rad etmadi').toBe(200);
    await expectToast(page, 'Rasm yangilandi');

    const saved = (await api.get<ProductPage>(`/market/vendor/products/browse?search=${encodeURIComponent(name)}`)).products[0];
    expect(saved.imageKey).toMatch(/^catalog\/[0-9a-f-]{36}\.jpg$/);

    // Jadvaldagi belgi endi rasm; u 1200 px dan katta emas va brauzerda keshlanadi.
    const res = await page.request.get(`/api/proxy/media/${saved.imageKey}`);
    expect(res.headers()['cache-control']).toContain('immutable');
    expect(res.headers()['content-type']).toBe('image/jpeg');
    expect((await res.body()).byteLength, 'saqlangan fayl 2 MB dan kichik').toBeLessThan(2 * 1024 * 1024);
    const thumb = page.getByRole('button', { name: `${name} rasmini o'zgartirish` }).locator('visible=true').locator('img');
    expect(await naturalEdge(thumb)).toBe(1200);
  });
});
