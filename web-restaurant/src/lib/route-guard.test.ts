import { describe, expect, it } from 'vitest';
import { isProtectedPath, resolveRouteGuard, sanitizeNextPath } from './route-guard';

describe('isProtectedPath', () => {
  it('matches a protected segment and everything under it', () => {
    expect(isProtectedPath('/dashboard')).toBe(true);
    expect(isProtectedPath('/dashboard/orders')).toBe(true);
    expect(isProtectedPath('/dashboard/orders/abc-123')).toBe(true);
  });

  it('does not match a path that merely starts with the same letters', () => {
    // Without the boundary check, '/dashboard-public' would be swept up too.
    expect(isProtectedPath('/dashboard-public')).toBe(false);
  });

  it('leaves public routes alone', () => {
    expect(isProtectedPath('/login')).toBe(false);
  });
});

describe('resolveRouteGuard', () => {
  it('redirects an anonymous visitor off a protected route and remembers where they were going', () => {
    expect(resolveRouteGuard('/dashboard/orders', false)).toEqual({
      action: 'redirect',
      to: '/login',
      withNext: true,
    });
  });

  it('lets a visitor with a session cookie through', () => {
    expect(resolveRouteGuard('/dashboard/orders', true)).toEqual({ action: 'continue' });
  });

  it('keeps a signed-in user off the login form', () => {
    expect(resolveRouteGuard('/login', true)).toEqual({ action: 'redirect', to: '/dashboard' });
  });

  it('lets an anonymous user reach the login form', () => {
    expect(resolveRouteGuard('/login', false)).toEqual({ action: 'continue' });
  });

  it('sends the root path to the right place for each state', () => {
    expect(resolveRouteGuard('/', true)).toEqual({ action: 'redirect', to: '/dashboard' });
    expect(resolveRouteGuard('/', false)).toEqual({ action: 'redirect', to: '/login' });
  });
});

describe('sanitizeNextPath', () => {
  it('keeps a plain same-origin path', () => {
    expect(sanitizeNextPath('/dashboard/orders?status=new')).toBe('/dashboard/orders?status=new');
  });

  it('refuses protocol-relative and absolute URLs', () => {
    // Both are valid redirect targets for a browser and would send the user
    // off-site with a legitimate-looking login link.
    expect(sanitizeNextPath('//evil.example')).toBe('/dashboard');
    expect(sanitizeNextPath('https://evil.example/steal')).toBe('/dashboard');
    expect(sanitizeNextPath('/\\evil.example')).toBe('/dashboard');
  });

  it('falls back when the parameter is missing', () => {
    expect(sanitizeNextPath(null)).toBe('/dashboard');
    expect(sanitizeNextPath('')).toBe('/dashboard');
  });
});
