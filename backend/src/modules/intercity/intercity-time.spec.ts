import { parseTashkentDate, tashkentDateOf, tashkentDayRange } from './intercity-time';

describe('intercity-time', () => {
  describe('tashkentDayRange', () => {
    it("Toshkent kuni UTC'da 19:00 dan 19:00 gacha (UTC+5)", () => {
      expect(tashkentDayRange('2026-10-17')).toEqual({
        from: new Date('2026-10-16T19:00:00.000Z'),
        to: new Date('2026-10-17T19:00:00.000Z'),
      });
    });

    it('oy va yil chegarasi', () => {
      expect(tashkentDayRange('2027-01-01')).toEqual({
        from: new Date('2026-12-31T19:00:00.000Z'),
        to: new Date('2027-01-01T19:00:00.000Z'),
      });
    });
  });

  describe('parseTashkentDate', () => {
    it('YYYY-MM-DD qabul qilinadi', () => {
      expect(parseTashkentDate('2026-10-17')).toBe('2026-10-17');
    });

    it.each(['2026-13-01', '2026-02-30', '17-10-2026', '2026-10-17T00:00', '', 'abc'])(
      'noto\'g\'ri sana: %s',
      (value) => {
        expect(parseTashkentDate(value)).toBeNull();
      },
    );
  });

  describe('tashkentDateOf', () => {
    it("UTC 19:00 dan keyin Toshkentda ertangi kun", () => {
      expect(tashkentDateOf(new Date('2026-10-16T18:59:59.000Z'))).toBe('2026-10-16');
      expect(tashkentDateOf(new Date('2026-10-16T19:00:00.000Z'))).toBe('2026-10-17');
    });
  });
});
