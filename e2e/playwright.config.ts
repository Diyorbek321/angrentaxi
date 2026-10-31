import { defineConfig, devices } from '@playwright/test';
import { PANELS, authFile, type PanelName } from './support/env';

const panelProject = (name: PanelName) => ({
  name,
  testDir: `./tests/${name}`,
  dependencies: ['setup'],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: PANELS[name].baseURL,
    storageState: authFile(name),
  },
});

export default defineConfig({
  // Panels run `next dev`, which compiles a route on first visit — the first
  // hit on a page can take several seconds.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Tests share one backend and the vendor accounts' catalogues; running them
  // in parallel would let one test's order land on another's board.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    panelProject('admin'),
    panelProject('manager'),
    panelProject('market'),
    panelProject('restaurant'),
  ],
});
