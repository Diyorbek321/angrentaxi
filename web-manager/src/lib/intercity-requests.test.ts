import { describe, expect, it } from 'vitest';
import {
  INTERCITY_REQUEST_STATUSES,
  INTERCITY_REQUEST_STATUS_BADGE,
  intercityRequestStatusLabels,
  formatRequestWindow,
  requestKindLabel,
  requestRouteName,
} from './intercity-requests';

describe('formatRequestWindow', () => {
  it('Toshkent vaqti (UTC+5), bir kun ichida', () => {
    expect(formatRequestWindow('2026-10-18T09:00:00.000Z', '2026-10-18T11:00:00.000Z')).toBe('18.10 · 14:00–16:00');
  });

  it('kun chegarasidan o\'tsa — oxiriga ham sana', () => {
    expect(formatRequestWindow('2026-10-18T17:00:00.000Z', '2026-10-18T21:00:00.000Z')).toBe(
      '18.10 · 22:00 – 19.10 · 02:00',
    );
  });

  it('UTC bo\'yicha boshqa kun, Toshkentda bir kun', () => {
    expect(formatRequestWindow('2026-10-17T20:00:00.000Z', '2026-10-17T22:00:00.000Z')).toBe('18.10 · 01:00–03:00');
  });

  it("noto'g'ri sana — chiziqcha", () => {
    expect(formatRequestWindow('nope', '2026-10-18T11:00:00.000Z')).toBe('—');
  });
});

describe('yorliqlar', () => {
  it('har holatda yorliq va badge bor', () => {
    for (const status of INTERCITY_REQUEST_STATUSES) {
      expect(intercityRequestStatusLabels()[status]).toBeTruthy();
      expect(INTERCITY_REQUEST_STATUS_BADGE[status]).toBeTruthy();
    }
  });

  it("joy / butun mashina va yo'nalish", () => {
    expect(requestKindLabel({ kind: 'seat', seats: 2 })).toBe('2 joy');
    expect(requestKindLabel({ kind: 'whole_car', seats: 4 })).toBe('Butun mashina');
    expect(requestRouteName({ originName: 'Angren', destinationName: null })).toBe('Angren → —');
  });
});
