import { dbSessionTimezoneExtra } from './db-session-timezone';

describe('dbSessionTimezoneExtra', () => {
  it('Postgres sessiyasiga berilgan timezone ni o\'rnatadi', () => {
    expect(dbSessionTimezoneExtra('Asia/Tashkent')).toEqual({ options: '-c timezone=Asia/Tashkent' });
  });

  it('standart holatda Node jarayonining timezone ini oladi', () => {
    const nodeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(dbSessionTimezoneExtra()).toEqual({ options: `-c timezone=${nodeZone}` });
  });
});
