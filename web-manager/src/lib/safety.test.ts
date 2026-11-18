import { describe, expect, it } from 'vitest';
import { evidenceIsEmpty, sosNoteError, trackDistanceKm, trackPolyline, type OrderEvidence } from './safety';
import {
  acknowledgeSos,
  addSosAlert,
  EMPTY_SOS_ALARM,
  removeResolvedSos,
  shouldRing,
  startAlarmSound,
} from './sos-alarm';

describe('SOS signali (INCIDENT-POLICY §4)', () => {
  const a = { id: 'a1', orderId: 'o1' };
  const b = { id: 'b1', orderId: 'o2' };

  it("yangi signal — ovoz; takror hodisa ikkinchi qator qo'shmaydi", () => {
    const s1 = addSosAlert(EMPTY_SOS_ALARM, a);
    expect(shouldRing(s1)).toBe(true);
    expect(addSosAlert(s1, a)).toBe(s1);
    const s2 = addSosAlert(s1, b);
    expect(s2.unacked.map((x) => x.id)).toEqual(['b1', 'a1']);
  });

  it("qabul qilish ovozni to'xtatadi (bittasi yoki hammasi)", () => {
    const s = addSosAlert(addSosAlert(EMPTY_SOS_ALARM, a), b);
    expect(acknowledgeSos(s, 'a1').unacked).toEqual([b]);
    expect(shouldRing(acknowledgeSos(s))).toBe(false);
  });

  it("boshqa panelda yopilgan signal o'chadi", () => {
    const s = addSosAlert(EMPTY_SOS_ALARM, a);
    expect(shouldRing(removeResolvedSos(s, { id: 'a1', orderId: 'o1' }))).toBe(false);
  });

  it("id'siz payload e'tiborsiz; AudioContext yo'q muhitda ovoz no-op", () => {
    expect(addSosAlert(EMPTY_SOS_ALARM, { id: '', orderId: 'o' })).toBe(EMPTY_SOS_ALARM);
    expect(() => startAlarmSound()()).not.toThrow();
  });
});

describe('SOS izohi va dalillar', () => {
  it('izoh 3..500 belgi', () => {
    expect(sosNoteError('  ok ')).toBe('tooShort');
    expect(sosNoteError('Gaplashildi')).toBeNull();
    expect(sosNoteError('x'.repeat(501))).toBe('tooLong');
  });

  it("iz: buzuq nuqtalar tashlanadi, masofa hisoblanadi", () => {
    const pts = trackPolyline([
      { lat: 41, lng: 70, recordedAt: '' },
      { lat: Number.NaN, lng: 70, recordedAt: '' },
      { lat: 41.01, lng: 70, recordedAt: '' },
    ]);
    expect(pts).toEqual([
      [41, 70],
      [41.01, 70],
    ]);
    expect(trackDistanceKm(pts)).toBeCloseTo(1.11, 1);
    expect(trackDistanceKm([])).toBe(0);
  });

  it("bo'sh dalil", () => {
    const empty: OrderEvidence = {
      orderId: 'o',
      track: [],
      trackTruncated: false,
      chat: [],
      sos: [],
      ratings: [],
      calls: [],
      incidents: [],
    };
    expect(evidenceIsEmpty(empty)).toBe(true);
    expect(evidenceIsEmpty({ ...empty, calls: [{ callerRole: 'driver', createdAt: '' }] })).toBe(false);
  });
});
