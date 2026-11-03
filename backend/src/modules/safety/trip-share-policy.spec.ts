import { OrderStatus } from '../../database/entities/order.entity';
import {
  hashShareToken,
  isShareableStatus,
  isShareLinkExpired,
  isWellFormedShareToken,
  newShareToken,
  publicDriverName,
  shareLinkExpiresAt,
} from './trip-share-policy';

describe('trip-share-policy (INCIDENT-POLICY §4)', () => {
  const updatedAt = new Date('2026-11-04T10:00:00Z');

  it('token: tasodifiy, shakli to\'g\'ri, xesh barqaror va tokendan farqli', () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).not.toBe(b);
    expect(isWellFormedShareToken(a)).toBe(true);
    expect(isWellFormedShareToken('short')).toBe(false);
    expect(isWellFormedShareToken(`${a.slice(0, 42)}/..`)).toBe(false);
    expect(hashShareToken(a)).toHaveLength(64);
    expect(hashShareToken(a)).toBe(hashShareToken(a));
    expect(hashShareToken(a)).not.toContain(a);
  });

  it('faqat haydovchi biriktirilgan faol safar ulashiladi', () => {
    expect(isShareableStatus(OrderStatus.ACCEPTED)).toBe(true);
    expect(isShareableStatus(OrderStatus.IN_PROGRESS)).toBe(true);
    expect(isShareableStatus(OrderStatus.SEARCHING)).toBe(false);
    expect(isShareableStatus(OrderStatus.COMPLETED)).toBe(false);
  });

  it("muddat: safar davom etsa ochiq; tugagach + grace daqiqa", () => {
    expect(shareLinkExpiresAt({ status: OrderStatus.IN_PROGRESS, completedAt: null, updatedAt }, 30)).toBeNull();
    const completedAt = new Date('2026-11-04T11:00:00Z');
    expect(shareLinkExpiresAt({ status: OrderStatus.COMPLETED, completedAt, updatedAt }, 30)?.toISOString()).toBe(
      '2026-11-04T11:30:00.000Z',
    );
    const cancelled = { status: OrderStatus.CANCELLED, completedAt: null, cancelledAt: null, updatedAt };
    expect(shareLinkExpiresAt(cancelled, 30)?.toISOString()).toBe('2026-11-04T10:30:00.000Z');
    expect(isShareLinkExpired(cancelled, 30, new Date('2026-11-04T10:29:00Z'))).toBe(false);
    expect(isShareLinkExpired(cancelled, 30, new Date('2026-11-04T10:31:00Z'))).toBe(true);
  });

  it('haydovchi ismi: ism + familiya bosh harfi', () => {
    expect(publicDriverName('Alisher', 'Karimov')).toBe('Alisher K.');
    expect(publicDriverName('Alisher', null)).toBe('Alisher');
    expect(publicDriverName(null, null)).toBe('—');
  });
});
