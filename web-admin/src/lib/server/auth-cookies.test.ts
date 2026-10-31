import { describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth-cookies';

// Browsers scope cookies by host, not port. Every panel runs on localhost in
// development, so a generic name like `access_token` set by one panel is sent
// to all the others and they open with the wrong role's session.
describe('session cookie names', () => {
  it('are namespaced to this panel', () => {
    expect(ACCESS_TOKEN_COOKIE).toBe('admin_token');
    expect(REFRESH_TOKEN_COOKIE).toBe('admin_refresh_token');
  });
});
