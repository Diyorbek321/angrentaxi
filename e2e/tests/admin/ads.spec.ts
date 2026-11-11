import { test, expect, expectToast } from '../../support/fixtures';
import { PanelApi, PassengerApi } from '../../support/api';
import { PANELS, uniqueName } from '../../support/env';

// 2:1 PNG (64×32) — the banner the admin uploads through the form.
const BANNER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAATklEQVR4nO3PUQkAIBTAwBfBysaynSH8OITBAtxmnf11wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjx2Ado4UJcTXCHHAAAAAElFTkSuQmCC',
  'base64',
);

interface Banner {
  id: string;
  title: string;
  impressions: number;
  clicks: number;
}

test('ads: admin uploads a banner, the passenger sees and counts it, expiry and the switch hide it', async ({
  page,
  request,
}) => {
  const admin = new PanelApi(request, PANELS.admin);
  const passenger = new PassengerApi(request);
  const title = uniqueName('banner');
  const activeIds = async () => (await passenger.get<Banner[]>('/ads/active')).map((b) => b.id);

  // ── Create through the form: multipart goes browser → panel proxy → backend.
  await page.goto('/dashboard/ads');
  await page.getByRole('button', { name: "Banner qo'shish" }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'banner.png',
    mimeType: 'image/png',
    buffer: BANNER_PNG,
  });
  await dialog.getByLabel('Nomi (faqat admin uchun)').fill(title);
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expectToast(page, "Banner qo'shildi");

  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  // The thumbnail streams from object storage through the public image route.
  const thumb = row.locator('img');
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  const banner = (await admin.get<Banner[]>('/ads')).find((b) => b.title === title);
  expect(banner, 'created banner is listed').toBeDefined();
  const id = banner!.id;

  try {
    // ── Passenger app: the banner is live and its impression/click are counted.
    expect(await activeIds()).toContain(id);
    expect((await passenger.rawPost(`/ads/${id}/impression`, {})).status()).toBe(204);
    expect((await passenger.rawPost(`/ads/${id}/click`, {})).status()).toBe(204);

    await page.reload();
    await expect(row.getByRole('cell').nth(3)).toHaveText('1');
    await expect(row.getByRole('cell').nth(5)).toHaveText('100%');

    // ── The switch in the row takes it off the carousel.
    await row.getByRole('switch').click();
    await expectToast(page, "Banner o'chirildi");
    await expect.poll(activeIds).not.toContain(id);
    // A stale client can no longer inflate the report of a switched-off banner.
    expect((await passenger.rawPost(`/ads/${id}/impression`, {})).status()).toBe(404);

    // ── Switched back on but past its window: still hidden.
    await admin.patch(`/ads/${id}`, {
      isActive: true,
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2026-02-01T00:00:00Z',
    });
    expect(await activeIds()).not.toContain(id);

    // ── Delete through the UI.
    await page.reload();
    await row.getByRole('button', { name: /o'chirish$/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click();
    await expectToast(page, "Banner o'chirildi");
    await expect(row).toHaveCount(0);
  } finally {
    await admin.tryDelete(`/ads/${id}`);
  }
});
