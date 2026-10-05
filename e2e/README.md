# E2E tests

Real-browser tests (Playwright) for the four web panels — admin, manager,
market (do'kon) and restaurant. They click through the UI the way a person
does and check the result in the backend.

## Running

The stack must already be up: Postgres + Redis (`docker compose up -d postgres redis`),
the backend (`npm run start:dev` in `backend/`) and the four panels (`npm run dev`
in each `web-*` folder). The backend needs `OTP_BYPASS_ENABLED=true` — the tests
log in with the bypass code.

```bash
cd e2e
npm install
npx playwright install chromium   # once
npm test                          # everything (~2 min)
npm run test:market               # one panel: admin | manager | market | restaurant
npm run report                    # HTML report with screenshots/traces of failures
```

## What is covered

| Panel | Tests |
|---|---|
| all four | every page opens with no browser error and no failed request (smoke) |
| market | category create/rename/delete; product add, price edit, hide; passenger order → packing → packed → shipped → delivered, stock reserved |
| restaurant | category create/rename/delete; dish add, price edit, sold out, delete; passenger order → preparing → ready → delivered; reject with reason |
| manager | call-centre order create → open → cancel; promo code created by manager, deactivated by admin |
| admin | revoke/restore a manager permission; close/reopen a store |

## Things to know

- **Data.** Tests run against whatever database the backend uses (the local dev
  one by default) and use seeded accounts. Everything a test creates is named
  `E2E …` and removed afterwards; orders cannot be deleted, so finished or
  cancelled `E2E` orders stay in history.
- **Login limit.** `/auth/send-otp` allows 5 calls per minute per IP. Sessions are
  cached in `.auth/` and reused, so normally no login happens at all; if one is
  throttled the setup waits a minute and retries.
- **Other stacks.** URLs and phone numbers come from `support/env.ts` and can be
  overridden with `E2E_*` environment variables.
- **Memory.** Four `next dev` servers + backend + browser need a lot of RAM; on
  an 8 GB machine the kernel may kill a panel. If a whole panel's tests fail
  with `ECONNREFUSED`, restart that panel.
