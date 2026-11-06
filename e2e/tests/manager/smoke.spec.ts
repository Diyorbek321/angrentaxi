import { test, openPage } from '../../support/fixtures';

// Every page of the panel opens for a logged-in user without a browser error or
// a failed request. Catches broken routes, crashing components and API calls
// the role is not allowed to make.
const PAGES = [
  '/dispatch',
  '/dispatch/overview',
  '/dispatch/drivers',
  '/dispatch/exceptions',
  '/dispatch/finance',
  '/dispatch/lost-items',
  '/dispatch/promo-codes',
  '/dispatch/bonuses',
  '/dispatch/tariffs',
  '/dispatch/support',
  '/dispatch/shift-report',
  '/dispatch/audit-log',
  '/orders',
  '/create-order',
];

for (const path of PAGES) {
  test(`opens ${path}`, async ({ page }) => {
    await openPage(page, path);
  });
}
