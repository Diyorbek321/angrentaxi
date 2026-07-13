import { resolveDbSynchronize } from './db-synchronize.util';

describe('resolveDbSynchronize', () => {
  describe('development', () => {
    it('defaults ON when DB_SYNC is unset', () => {
      expect(resolveDbSynchronize('development', undefined)).toBe(true);
    });

    it('stays ON when DB_SYNC is set to an unrelated value', () => {
      expect(resolveDbSynchronize('development', 'true')).toBe(true);
    });

    it('turns OFF when DB_SYNC is explicitly "false"', () => {
      expect(resolveDbSynchronize('development', 'false')).toBe(false);
    });
  });

  describe('production', () => {
    it('defaults OFF when DB_SYNC is unset', () => {
      expect(resolveDbSynchronize('production', undefined)).toBe(false);
    });

    it('turns ON only when DB_SYNC is explicitly "true"', () => {
      expect(resolveDbSynchronize('production', 'true')).toBe(true);
    });

    it('stays OFF when DB_SYNC is set to an unrelated value', () => {
      expect(resolveDbSynchronize('production', 'false')).toBe(false);
      expect(resolveDbSynchronize('production', 'yes')).toBe(false);
    });
  });

  it('treats an unset NODE_ENV like non-production (defaults ON)', () => {
    expect(resolveDbSynchronize(undefined, undefined)).toBe(true);
  });
});
