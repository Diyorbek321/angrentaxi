import { test, expect } from '../../support/fixtures';
import { PanelApi, PassengerApi } from '../../support/api';
import { PANELS, uniqueName } from '../../support/env';

interface Store { id: string }
interface Product { id: string; name: string; stock: number }
interface Order { id: string; status: string; items: { packed: boolean }[] }

test.describe('market — order lifecycle', () => {
  let api: PanelApi;
  let product: Product;

  test.beforeEach(async ({ request }) => {
    api = new PanelApi(request, PANELS.market);
    product = await api.post<Product>('/market/vendor/products', {
      name: uniqueName('Buyurtma mahsuloti'),
      price: 8000,
      stock: 10,
      unit: 'dona',
    });
  });

  test.afterEach(async () => {
    // A product with order history may refuse deletion; hiding it keeps it
    // out of the storefront either way.
    if (!(await api.tryDelete(`/market/vendor/products/${product.id}`))) {
      await api.patch(`/market/vendor/products/${product.id}`, { status: 'hidden' });
    }
  });

  test('passenger order goes new → packing → shipped → delivered', async ({ page, request }) => {
    const store = await api.get<Store>('/market/vendor/store');
    const order = await new PassengerApi(request).placeMarketOrder(store.id, [{ productId: product.id, qty: 2 }]);
    expect(order.status).toBe('new');
    const orderStatus = async () => (await api.get<Order>(`/market/vendor/orders/${order.id}`)).status;

    // Ordering reserves stock straight away.
    const products = await api.get<Product[]>('/market/vendor/products');
    expect(products.find((p) => p.id === product.id)?.stock).toBe(8);

    await page.goto('/dashboard/orders');
    const shortId = `#${order.id.slice(0, 6)}`;
    const row = page.locator('li').filter({ hasText: shortId }).locator('visible=true');
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: "Yig'ishni boshlash" }).click();
    await expect.poll(orderStatus).toBe('packing');

    await row.getByText(shortId).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText(`Buyurtma ${shortId}`)).toBeVisible();
    await expect(drawer.getByText("Yig'ildi: 0/1")).toBeVisible();
    await drawer.getByRole('button', { name: new RegExp(product.name) }).click();
    await expect(drawer.getByText("Yig'ildi: 1/1")).toBeVisible();
    expect((await api.get<Order>(`/market/vendor/orders/${order.id}`)).items[0].packed).toBe(true);

    await drawer.getByRole('button', { name: 'Yuborildi deb belgilash' }).click();
    await expect.poll(orderStatus).toBe('shipped');

    await row.getByRole('button', { name: 'Yetkazildi deb belgilash' }).click();
    await expect.poll(orderStatus).toBe('delivered');
  });
});
