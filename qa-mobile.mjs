import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:3001/';
const DIR = '/tmp/pretext-qa';

async function run() {
  const browser = await chromium.launch({ headless: true });

  // iPhone 14 Pro Max (430x932) at 3x device pixel ratio for crisp screenshot
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000);

  await page.screenshot({ path: `${DIR}/mobile-hires.png`, fullPage: false });

  const stats = await page.$eval('#stats', el => el.textContent);
  console.log('Mobile stats:', stats);
  console.log('Errors:', errors.length ? errors.join('; ') : 'NONE');

  // Also grab desktop hires
  const ctx2 = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page2 = await ctx2.newPage();
  await page2.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page2.waitForTimeout(6000);
  await page2.screenshot({ path: `${DIR}/desktop-hires.png`, fullPage: false });
  const stats2 = await page2.$eval('#stats', el => el.textContent);
  console.log('Desktop stats:', stats2);

  await browser.close();
}

run().catch(console.error);
