import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:3001/';
const SCREENSHOT_DIR = '/tmp/pretext-qa';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // Desktop test (1920x1080)
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    const errors = [];
    const consoleMsgs = [];

    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleMsgs.push(msg.text());
    });

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errors.push(`Navigation: ${e.message}`));
    await page.waitForTimeout(5000); // Let chart render + data load

    await page.screenshot({ path: `${SCREENSHOT_DIR}/desktop-full.png`, fullPage: false });

    // Check if art div has content
    const artContent = await page.$eval('#art', el => el.innerHTML.length);
    const statsContent = await page.$eval('#stats', el => el.textContent);
    const controlsVisible = await page.$eval('#controls', el => getComputedStyle(el).display !== 'none');
    const rowCount = await page.$$eval('#art .r', rows => rows.length);
    const hasSpans = await page.$eval('#art', el => el.querySelectorAll('span').length);

    results.push({
      test: 'Desktop 1920x1080',
      errors,
      consoleMsgs,
      artContentLength: artContent,
      statsText: statsContent,
      controlsVisible,
      rowCount,
      spanCount: hasSpans,
    });

    await ctx.close();
  }

  // Mobile test (iPhone 14 - 390x844)
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    const consoleMsgs = [];

    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleMsgs.push(msg.text());
    });

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errors.push(`Navigation: ${e.message}`));
    await page.waitForTimeout(5000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-full.png`, fullPage: false });

    const artContent = await page.$eval('#art', el => el.innerHTML.length);
    const statsContent = await page.$eval('#stats', el => el.textContent);
    const rowCount = await page.$$eval('#art .r', rows => rows.length);
    const hasSpans = await page.$eval('#art', el => el.querySelectorAll('span').length);

    // Check for overflow
    const bodyOverflow = await page.evaluate(() => {
      return {
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
        overflow: document.body.scrollWidth > document.body.clientWidth,
      };
    });

    results.push({
      test: 'Mobile iPhone 14 (390x844)',
      errors,
      consoleMsgs,
      artContentLength: artContent,
      statsText: statsContent,
      rowCount,
      spanCount: hasSpans,
      bodyOverflow,
    });

    await ctx.close();
  }

  // Tablet test (768x1024)
  {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await ctx.newPage();
    const errors = [];

    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errors.push(`Navigation: ${e.message}`));
    await page.waitForTimeout(5000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/tablet-full.png`, fullPage: false });

    const rowCount = await page.$$eval('#art .r', rows => rows.length);
    const hasSpans = await page.$eval('#art', el => el.querySelectorAll('span').length);

    results.push({
      test: 'Tablet 768x1024',
      errors,
      rowCount,
      spanCount: hasSpans,
    });

    await ctx.close();
  }

  await browser.close();

  // Report
  console.log('\n=== QA REPORT ===\n');
  for (const r of results) {
    console.log(`--- ${r.test} ---`);
    console.log(`  Errors: ${r.errors?.length ? r.errors.join('; ') : 'NONE'}`);
    if (r.consoleMsgs?.length) console.log(`  Console errors: ${r.consoleMsgs.join('; ')}`);
    console.log(`  Rows rendered: ${r.rowCount}`);
    console.log(`  Spans (chars): ${r.spanCount}`);
    if (r.artContentLength !== undefined) console.log(`  Art innerHTML length: ${r.artContentLength}`);
    if (r.statsText) console.log(`  Stats: ${r.statsText}`);
    if (r.controlsVisible !== undefined) console.log(`  Controls visible: ${r.controlsVisible}`);
    if (r.bodyOverflow) {
      console.log(`  Body overflow: ${r.bodyOverflow.overflow ? 'YES (PROBLEM)' : 'no'}`);
      console.log(`  scrollWidth: ${r.bodyOverflow.scrollWidth}, clientWidth: ${r.bodyOverflow.clientWidth}`);
    }
    console.log('');
  }
}

import { mkdirSync } from 'fs';
mkdirSync(SCREENSHOT_DIR, { recursive: true });
run().catch(console.error);
