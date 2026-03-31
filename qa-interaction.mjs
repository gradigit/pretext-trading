import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:3001/';
const DIR = '/tmp/pretext-qa';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Screenshot: initial state
  await page.screenshot({ path: `${DIR}/interact-1-initial.png` });

  // Test scroll (pan right)
  await page.mouse.move(960, 400);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/interact-2-scrolled.png` });

  // Test zoom in (Ctrl+wheel)
  for (let i = 0; i < 5; i++) {
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/interact-3-zoomed-in.png` });

  // Test crosshair
  await page.mouse.move(600, 300);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/interact-4-crosshair.png` });

  // Test pair switching
  await page.selectOption('select:first-of-type', 'ETHUSDT');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/interact-5-eth.png` });

  // Test interval switching
  await page.selectOption('select:last-of-type', '15m');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/interact-6-15m.png` });

  console.log(`JS errors: ${errors.length ? errors.join('; ') : 'NONE'}`);
  console.log('Screenshots saved to /tmp/pretext-qa/interact-*.png');

  await browser.close();
}

run().catch(console.error);
