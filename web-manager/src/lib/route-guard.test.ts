import { describe, expect, it } from 'vitest';
import { isProtectedPath, resolveRouteGuard, sanitizeNextPath } from './route-guard';

describe('isProtectedPath', () => {
  it('matches a protected segment and everything under it', () => {
    expect(isProtectedPath('/dispatch')).toBe(true);
    expect(isProtectedPath('/dispatch/finance')).toBe(true);
    expect(isProtectedPath('/orders/abc-123')).toBe(true);
    expect(isProtectedPath('/create-order')).toBe(true);
  });

  it('does not match a path that merely starts with the same letters', () => {
    // Without the boundary check, '/dispatcher-public' would be swept up too.
    expect(isProtectedPath('/dispatcher-public')).toBe(false);
    expect(isProtectedPath('/orders-archive')).toBe(false);
  });

  it('leaves public routes alone', () => {
    expect(isProtectedPath('/login')).toBe(false);
  });
});

describe('resolveRouteGuard', () => {
  it('redirects an anonymous visitor off a protected route and remembers where they were going', () => {
    expect(resolveRouteGuard('/dispatch/finance', false)).toEqual({
      action: 'redirect',
      to: '/login',
      withNext: true,
    });
  });

  it('lets a visitor with a session cookie through', () => {
    expect(resolveRouteGuard('/dispatch/finance', true)).toEqual({ action: 'continue' });
  });

  it('keeps a signed-in user off the login form', () => {
    expect(resolveRouteGuard('/login', true)).toEqual({ action: 'redirect', to: '/dispatch' });
  });

  it('lets an anonymous user reach the login form', () => {
    expect(resolveRouteGuard('/login', false)).toEqual({ action: 'continue' });
  });

  it('sends the root path to the right place for each state', () => {
    expect(resolveRouteGuard('/', true)).toEqual({ action: 'redirect', to: '/dispatch' });
    expect(resolveRouteGuard('/', false)).toEqual({ action: 'redirect', to: '/login' });
  });

  it('ignores routes it does not own', () => {
    expect(resolveRouteGuard('/some-public-page', false)).toEqual({ action: 'continue' });
  });
});

describe('sanitizeNextPath', () => {
  it('keeps a plain same-origin path', () => {
    expect(sanitizeNextPath('/orders/42?tab=map')).toBe('/orders/42?tab=map');
  });

  it('refuses protocol-relative and absolute URLs', () => {
    // Both are valid redirect targets for a browser and would send the user
    // off-site with a legitimate-looking login link.
    expect(sanitizeNextPath('//evil.example')).toBe('/dispatch');
    expect(sanitizeNextPath('https://evil.example/steal')).toBe('/dispatch');
    expect(sanitizeNextPath('/\\evil.example')).toBe('/dispatch');
  });

  it('falls back when the parameter is missing', () => {
    expect(sanitizeNextPath(null)).toBe('/dispatch');
    expect(sanitizeNextPath('')).toBe('/dispatch');
  });
});
