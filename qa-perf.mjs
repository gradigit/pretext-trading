import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:3001/';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000); // Let initial data load + render

  // Force continuous renders by scrolling
  console.log('Starting scroll interaction...');
  await page.mouse.move(960, 400);

  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);

  const stats = await page.$eval('#stats', el => el.textContent);
  console.log('After scrolling:', stats);

  await page.screenshot({ path: '/tmp/pretext-qa/perf-scroll.png' });

  // Check FPS with mouse movement (crosshair)
  for (let i = 0; i < 50; i++) {
    await page.mouse.move(400 + i * 20, 300 + Math.sin(i) * 100);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1000);

  const stats2 = await page.$eval('#stats', el => el.textContent);
  console.log('After crosshair:', stats2);

  await browser.close();
}

run().catch(console.error);
