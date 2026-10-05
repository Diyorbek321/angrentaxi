import { test, openPage } from '../../support/fixtures';

// Every page of the panel opens for a logged-in user without a browser error or
// a failed request. Catches broken routes, crashing components and API calls
// the role is not allowed to make.
const PAGES = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/users',
  '/dashboard/drivers',
  '/dashboard/driver-documents',
  '/dashboard/vendors',
  '/dashboard/moderation',
  '/dashboard/tariffs',
  '/dashboard/promo-codes',
  '/dashboard/bonuses',
  '/dashboard/withdrawals',
  '/dashboard/push-notifications',
  '/dashboard/reports',
  '/dashboard/staff',
  '/dashboard/global-settings',
  '/dashboard/settings',
];

for (const path of PAGES) {
  test(`opens ${path}`, async ({ page }) => {
    await openPage(page, path);
  });
}
