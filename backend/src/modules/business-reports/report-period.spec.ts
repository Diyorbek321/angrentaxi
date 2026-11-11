import { addDays, previousWeek, tashkentToday, yesterday } from './report-period';

describe('report-period', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('uses the Tashkent date, not UTC, for "today"', () => {
    // 2026-10-27 20:30 UTC = 2026-10-28 01:30 Toshkent
    expect(tashkentToday(new Date('2026-10-27T20:30:00Z'))).toBe('2026-10-28');
    expect(tashkentToday(new Date('2026-10-28T18:59:00Z'))).toBe('2026-10-28');
  });

  it('yesterday is a single Tashkent day', () => {
    expect(yesterday(new Date('2026-10-28T03:00:00Z'))).toEqual({
      from: '2026-10-27',
      to: '2026-10-28',
    });
  });

  it('previousWeek is Monday..Sunday before the current week', () => {
    // 2026-10-26 dushanba
    expect(previousWeek(new Date('2026-10-26T03:00:00Z'))).toEqual({
      from: '2026-10-19',
      to: '2026-10-26',
    });
    // Chorshanba ham o'sha o'tgan haftani beradi
    expect(previousWeek(new Date('2026-10-28T03:00:00Z'))).toEqual({
      from: '2026-10-19',
      to: '2026-10-26',
    });
  });
});
