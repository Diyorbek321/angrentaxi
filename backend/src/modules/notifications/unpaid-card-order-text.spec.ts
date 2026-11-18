import { unpaidCardOrderCancelledText } from './misc-notification-texts';

describe('unpaidCardOrderCancelledText', () => {
  it('uz va ru, daqiqa matnda', () => {
    expect(unpaidCardOrderCancelledText(15).body).toContain('15 daqiqa');
    expect(unpaidCardOrderCancelledText(15, 'ru').body).toContain('15 мин');
    expect(unpaidCardOrderCancelledText(15, 'ru').title).toBe('Заказ отменён');
  });
});
