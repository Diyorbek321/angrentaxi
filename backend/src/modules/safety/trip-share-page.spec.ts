import { OrderStatus } from '../../database/entities/order.entity';
import { pickShareLang, renderShareErrorPage, renderSharePage } from './trip-share-page';

describe('trip-share-page', () => {
  const view = {
    status: OrderStatus.IN_PROGRESS,
    driverName: '<script>x</script>',
    carModel: 'Cobalt',
    carNumber: '10A123BC',
    dropoffAddress: 'Navoiy 5',
    location: { lat: 41.01, lng: 70.14 },
    expiresAt: null,
  };

  it('til: ?lang, keyin Accept-Language, standart uz', () => {
    expect(pickShareLang('ru')).toBe('ru');
    expect(pickShareLang(undefined, 'ru-RU,ru')).toBe('ru');
    expect(pickShareLang(undefined, undefined)).toBe('uz');
  });

  it("HTML qochiriladi, faol safarda o'zini yangilaydi, skript yo'q", () => {
    const html = renderSharePage('uz', view);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('openstreetmap.org/?mlat=41.01');
    expect(html).toContain('Safar davom etmoqda');
  });

  it("tugagan safar: yangilanish yo'q; xato sahifalari", () => {
    const html = renderSharePage('ru', { ...view, status: OrderStatus.COMPLETED, location: null, expiresAt: '2026-11-04T11:30:00.000Z' });
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).toContain('Поездка завершена');
    expect(renderShareErrorPage('uz', 'gone')).toContain('muddati tugagan');
    expect(renderShareErrorPage('ru', 'not_found')).toContain('не найдена');
  });
});
