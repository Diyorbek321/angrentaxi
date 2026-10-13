import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { PanelApi } from '../../support/api';
import { PANELS, authFile, uniqueName } from '../../support/env';
import { TINY_JPEG, naturalEdge } from '../../support/images';

interface Product { id: string; imageKey?: string | null }

test.describe('admin — moderatsiya', () => {
  let marketCtx: APIRequestContext;
  let market: PanelApi;
  const created: string[] = [];

  test.beforeAll(async () => {
    // Mahsulotni sotuvchi yaratadi — admin uni moderatsiyada ko'rishi kerak.
    marketCtx = await playwrightRequest.newContext({ storageState: authFile('market') });
    market = new PanelApi(marketCtx, PANELS.market);
  });

  test.afterAll(async () => {
    for (const id of created.splice(0)) await market.tryDelete(`/market/vendor/products/${id}`);
    await marketCtx.dispose();
  });

  test("mahsulot rasmi jadvalda ko'rinadi va kattalashtirib ochiladi", async ({ page }) => {
    const name = uniqueName('Moderatsiya');
    const product = await market.post<Product>('/market/vendor/products', { name, price: 1000, stock: 1, unit: 'dona' });
    created.push(product.id);
    const upload = await marketCtx.put(`${PANELS.market.baseURL}/api/proxy/market/vendor/products/${product.id}/image`, {
      headers: { Origin: PANELS.market.baseURL },
      multipart: { image: { name: 'image.jpg', mimeType: 'image/jpeg', buffer: TINY_JPEG } },
    });
    expect(upload.ok(), `rasm yuklash → ${upload.status()}`).toBe(true);
    const imageKey = ((await upload.json()) as { data: Product }).data.imageKey;
    expect(imageKey).toBeTruthy();

    await page.goto('/dashboard/moderation');
    await page.getByLabel('Moderatsiya navbatida qidirish').fill(name);
    const link = page.getByRole('link', { name: `${name} rasmini kattalashtirib ko'rish` });
    await expect(link).toHaveAttribute('href', `/api/proxy/media/${imageKey}`);
    expect(await naturalEdge(link.locator('img'))).toBe(16);
  });

  test("rasmsiz mahsulotda neytral belgi chiqadi", async ({ page }) => {
    const name = uniqueName('Rasmsiz');
    const product = await market.post<Product>('/market/vendor/products', { name, price: 1000, stock: 1, unit: 'dona' });
    created.push(product.id);

    await page.goto('/dashboard/moderation');
    await page.getByLabel('Moderatsiya navbatida qidirish').fill(name);
    await expect(page.getByRole('row').filter({ hasText: name }).getByLabel("Rasm yo'q")).toBeVisible();
  });
});
