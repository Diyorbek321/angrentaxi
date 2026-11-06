import { parseEnvBoolean } from './env-boolean.util';

describe('parseEnvBoolean', () => {
  it.each(['true', 'TRUE', ' true ', '1', true])('%p → true', (raw) => {
    expect(parseEnvBoolean(raw)).toBe(true);
  });

  it.each(['false', 'False', '0', '', '  ', 'no', 'off', false, undefined, null])('%p → false', (raw) => {
    expect(parseEnvBoolean(raw)).toBe(false);
  });

  it("tushunarsiz qiymat o'zgarmay qaytadi (validatsiya rad etadi)", () => {
    expect(parseEnvBoolean('yes please')).toBe('yes please');
    expect(parseEnvBoolean(2)).toBe(2);
  });
});
