import { test as base, expect, type Page } from '@playwright/test';

export interface PageIssues {
  list: string[];
  /** Responses a test triggers on purpose (e.g. a validation 400) — URL substrings. */
  allow: (fragment: string) => void;
}

// Noise that says nothing about the panel: dev-server HMR chatter and the
// browser's own favicon probe.
const IGNORED = [/_next\/webpack-hmr/, /favicon\.ico/, /\[Fast Refresh\]/, /Download the React DevTools/];

function watch(page: Page): PageIssues {
  const list: string[] = [];
  const allowed: string[] = [];
  const ignored = (text: string) =>
    IGNORED.some((re) => re.test(text)) || allowed.some((fragment) => text.includes(fragment));

  page.on('pageerror', (err) => list.push(`page error: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // A failed request also logs a console error; the response handler below
    // already reports it with the URL, which is the useful half.
    if (/Failed to load resource/.test(text)) return;
    if (!ignored(text)) list.push(`console error: ${text}`);
  });
  page.on('response', (res) => {
    const line = `HTTP ${res.status()} ${res.request().method()} ${res.url()}`;
    if (res.status() >= 400 && !ignored(line)) list.push(line);
  });
  page.on('requestfailed', (req) => {
    const reason = req.failure()?.errorText ?? '';
    // Navigating away aborts in-flight polls — expected, not a fault.
    // ERR_NETWORK_CHANGED comes from the host's network interfaces, not the app.
    if (reason.includes('ERR_ABORTED') || reason.includes('ERR_NETWORK_CHANGED')) return;
    const line = `request failed: ${req.method()} ${req.url()} ${reason}`;
    if (!ignored(line)) list.push(line);
  });

  return { list, allow: (fragment) => allowed.push(fragment) };
}

export const test = base.extend<{ issues: PageIssues }>({
  issues: [
    async ({ page }, use) => {
      const issues = watch(page);
      await use(issues);
      expect(issues.list, 'browser errors / failed requests during the test').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Opens a panel page and checks it rendered as itself — not bounced to login, not stuck loading. */
export async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page, `${path} redirected`).toHaveURL(new RegExp(`${path.replace(/[/]/g, '\\/')}(\\?.*)?$`));
  // Every panel announces its session/loading gate with role=status; once the
  // page is up the main landmark holds the content.
  await expect(page.locator('main')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

/**
 * Asserts a toast appeared. Some panels render the text twice (visibly and in an
 * aria-live region), and the admin panel prefixes the title with a screen-reader
 * tone label ("Muvaffaqiyat:"), so match a substring and take the first copy.
 */
export async function expectToast(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible();
}
