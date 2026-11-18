import { test, openPage } from '../../support/fixtures';

// Every page of the panel opens for a logged-in user without a browser error or
// a failed request. Catches broken routes, crashing components and API calls
// the role is not allowed to make.
const PAGES = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/products',
  '/dashboard/categories',
  '/dashboard/stock',
  '/dashboard/reports',
  '/dashboard/settings',
];

for (const path of PAGES) {
  test(`opens ${path}`, async ({ page }) => {
    await openPage(page, path);
  });
}
