// Flutter web demo'ni berilgan qadamlar bo'yicha bosib, skrinshot oladi.
// node shoot.mjs <url> <steps.json> <outdir> [width height dpr]
import { chromium } from '/home/diyorbek/AngrenTaxi/e2e/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [url, stepsFile, out, w = '360', h = '780', dpr = '3'] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, isMobile: true, hasTouch: true,
  locale: 'uz-UZ', geolocation: { latitude: 41.0167, longitude: 70.1436 }, permissions: ['geolocation'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e.stack || e).slice(0, 600)));
page.on('console', (m) => { if (['error','warning'].includes(m.type())) console.log('CONSOLE', m.type(), m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('flutter-view, flt-glass-pane', { timeout: 60000 });
await page.waitForTimeout(3500);
for (const s of steps) {
  if (s.tap) { await page.touchscreen.tap(s.tap[0], s.tap[1]); }
  if (s.swipe) { const [x1,y1,x2,y2]=s.swipe; await page.mouse.move(x1,y1); await page.mouse.down(); for (let i=1;i<=20;i++){ await page.mouse.move(x1+(x2-x1)*i/20, y1+(y2-y1)*i/20); await page.waitForTimeout(25);} await page.mouse.up(); }
  if (s.type) { await page.keyboard.type(s.type, { delay: 40 }); }
  if (s.key) { await page.keyboard.press(s.key); }
  if (s.wait) { await page.waitForTimeout(s.wait); }
  if (s.shot) { await page.screenshot({ path: `${out}/${s.shot}.png` }); console.log('shot', s.shot); }
}
await browser.close();
