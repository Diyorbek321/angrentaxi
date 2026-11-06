import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { API_URL, OTP_CODE, type PanelConfig } from './env';

// /auth/send-otp allows 5 calls per minute per IP, shared by every panel on
// this machine. A run that logs in to all four panels plus the passenger can
// trip it, so a 429 means "wait for the window to roll over", not "fail".
const THROTTLE_WAIT_MS = 61_000;
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Logs in through the panel's own login form, exactly as a person would. */
export async function loginThroughUi(page: Page, panel: PanelConfig): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await page.goto(`${panel.baseURL}/login`);

    const sendOtp = page.waitForResponse((r) => r.url().includes('/auth/send-otp'));
    // The phone field is the only input on the first step in every panel.
    await page.locator('form input').first().fill(panel.phone);
    await page.locator('form button[type=submit]').click();
    const response = await sendOtp;

    if (response.status() === 429) {
      if (attempt === MAX_ATTEMPTS) throw new Error('send-otp still throttled after waiting');
      await sleep(THROTTLE_WAIT_MS);
      continue;
    }
    expect(response.status(), 'send-otp').toBeLessThan(300);

    const codeInput = page.locator('input[placeholder="000000"]');
    await expect(codeInput).toBeVisible();
    await codeInput.fill(OTP_CODE);
    await page.locator('form button[type=submit]').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
    return;
  }
}

/** True when the stored session still opens this panel's role-only endpoint. */
export async function hasLiveSession(request: APIRequestContext, panel: PanelConfig): Promise<boolean> {
  const res = await request.get(`${panel.baseURL}${panel.sessionProbe}`, {
    headers: { Origin: panel.baseURL },
  });
  return res.ok();
}

export interface ApiTokens {
  accessToken: string;
  refreshToken?: string;
}

/** Backend login for an account that has no web panel (the passenger). */
export async function loginThroughApi(request: APIRequestContext, phone: string): Promise<ApiTokens> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const sent = await request.post(`${API_URL}/auth/send-otp`, { data: { phone } });
    if (sent.status() === 429) {
      if (attempt === MAX_ATTEMPTS) throw new Error('send-otp still throttled after waiting');
      await sleep(THROTTLE_WAIT_MS);
      continue;
    }
    expect(sent.status(), 'send-otp').toBeLessThan(300);

    const verified = await request.post(`${API_URL}/auth/verify-otp`, { data: { phone, code: OTP_CODE } });
    expect(verified.status(), 'verify-otp').toBeLessThan(300);
    const body = await verified.json();
    return { accessToken: body.data.accessToken, refreshToken: body.data.refreshToken };
  }
  throw new Error('unreachable');
}
