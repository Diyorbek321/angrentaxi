import fs from 'node:fs';
import path from 'node:path';
import { test as setup, request as playwrightRequest } from '@playwright/test';
import { API_URL, PANELS, PASSENGER_PHONE, authFile, type PanelName } from '../support/env';
import { hasLiveSession, loginThroughApi, loginThroughUi, type ApiTokens } from '../support/login';

// Sessions are cached in .auth/ and reused while they still work. Logging in
// fresh on every run would burn the 5-per-minute OTP budget within one run.

for (const name of Object.keys(PANELS) as PanelName[]) {
  setup(`session: ${name}`, async ({ browser }) => {
    setup.setTimeout(240_000);
    const panel = PANELS[name];
    const file = authFile(name);

    if (fs.existsSync(file)) {
      const ctx = await playwrightRequest.newContext({ storageState: file });
      const live = await hasLiveSession(ctx, panel);
      await ctx.dispose();
      if (live) return;
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginThroughUi(page, panel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await context.storageState({ path: file });
    await context.close();
  });
}

setup('session: passenger', async () => {
  setup.setTimeout(240_000);
  const file = authFile('passenger');
  const ctx = await playwrightRequest.newContext();

  if (fs.existsSync(file)) {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8')) as ApiTokens;
    const probe = await ctx.get(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${cached.accessToken}` },
    });
    if (probe.ok()) {
      await ctx.dispose();
      return;
    }
  }

  const tokens = await loginThroughApi(ctx, PASSENGER_PHONE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(tokens));
  await ctx.dispose();
});
