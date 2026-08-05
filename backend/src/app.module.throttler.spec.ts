import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';
import { AppModule } from './app.module';
import { AuthController } from './modules/auth/auth.controller';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard';

interface ClassProvider {
  provide?: unknown;
  useClass?: unknown;
  useValue?: unknown;
}

interface DynamicModuleLike {
  module?: { name?: string };
  providers?: ClassProvider[];
}

// Pulls the throttler names out of the ThrottlerModule.forRoot() options that
// AppModule imports, so the tests below assert against the real config rather
// than a hardcoded copy of it.
function configuredThrottlerNames(): string[] {
  const imports = (Reflect.getMetadata('imports', AppModule) ?? []) as DynamicModuleLike[];
  const throttlerModule = imports.find(
    (imported) => imported?.module?.name === 'ThrottlerModule',
  );
  const optionsProvider = throttlerModule?.providers?.find(
    (provider) => provider?.provide === 'THROTTLER:MODULE_OPTIONS',
  );
  const options = optionsProvider?.useValue as Array<{ name?: string }> | undefined;

  return (options ?? []).map((option) => option.name).filter((name): name is string => !!name);
}

// Regression guard: ThrottlerModule.forRoot() configures limits but enforces
// nothing on its own. Before this was added, every @Throttle decorator in the
// codebase was dead code.
describe('AppModule rate limiting', () => {
  const providers = (Reflect.getMetadata('providers', AppModule) ?? []) as ClassProvider[];

  it('registers a throttler guard as a global APP_GUARD', () => {
    const guardProvider = providers.find((provider) => provider?.provide === APP_GUARD);

    expect(guardProvider).toBeDefined();
    expect(guardProvider!.useClass).toBe(HttpThrottlerGuard);
    expect(HttpThrottlerGuard.prototype).toBeInstanceOf(ThrottlerGuard);
  });

  it('configures the named throttlers that route-level @Throttle decorators target', () => {
    expect(configuredThrottlerNames()).toEqual(
      expect.arrayContaining(['short', 'medium', 'long']),
    );
  });

  // @Throttle stores metadata under `THROTTLER:LIMIT<name>`; the guard only
  // reads names it was configured with, so an unknown name (the original
  // 'default') is silently ignored and the route keeps the global limit.
  describe('auth endpoint overrides use real throttler names', () => {
    const names = configuredThrottlerNames();

    it.each([
      ['sendOtp', 5],
      ['verifyOtp', 10],
    ])('%s is limited to %i requests per minute', (handlerName, expectedLimit) => {
      const handler = (AuthController.prototype as unknown as Record<string, object>)[
        handlerName
      ];

      const overriddenName = names.find(
        (name) => Reflect.getMetadata(`THROTTLER:LIMIT${name}`, handler) !== undefined,
      );

      expect(overriddenName).toBeDefined();
      expect(Reflect.getMetadata(`THROTTLER:LIMIT${overriddenName}`, handler)).toBe(
        expectedLimit,
      );
      expect(Reflect.getMetadata(`THROTTLER:TTL${overriddenName}`, handler)).toBe(60000);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBeUndefined();
    });
  });
});

describe('HttpThrottlerGuard', () => {
  const guard = new HttpThrottlerGuard([], {} as never, {} as never);
  const contextOfType = (type: string) =>
    ({ getType: () => type }) as unknown as ExecutionContext;

  it('throttles HTTP requests', async () => {
    await expect(guard['shouldSkip'](contextOfType('http'))).resolves.toBe(false);
  });

  it('skips websocket traffic, which has no HTTP response to write headers to', async () => {
    await expect(guard['shouldSkip'](contextOfType('ws'))).resolves.toBe(true);
  });
});
