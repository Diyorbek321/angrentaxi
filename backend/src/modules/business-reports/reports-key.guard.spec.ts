import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportsKeyGuard } from './reports-key.guard';

describe('ReportsKeyGuard', () => {
  const KEY = 'k'.repeat(40);
  const guard = (key: string) =>
    new ReportsKeyGuard({ get: (_: string, fallback: string) => key || fallback } as unknown as ConfigService);
  const ctx = (header?: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-reports-key': header } }) }),
    }) as ExecutionContext;

  it('lets the right key through', () => {
    expect(guard(KEY).canActivate(ctx(KEY))).toBe(true);
  });

  it.each([
    ['a wrong key', KEY, 'x'.repeat(40)],
    ['a missing header', KEY, undefined],
    ['an array header', KEY, [KEY]],
    ['no key configured', '', ''],
    ['a too-short configured key', 'short', 'short'],
  ])('rejects %s', (_label, configured, given) => {
    expect(() => guard(configured as string).canActivate(ctx(given))).toThrow(UnauthorizedException);
  });
});
