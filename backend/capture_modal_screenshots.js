/**
 * Capture screenshots of the refreshed Module 3 Modals
 * to verify they match the Brightloop design system theme.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = 'http://localhost:5500';
const ARTIFACT_DIR = '/Users/datchu/.gemini/antigravity/brain/226c3223-7844-4976-a906-fb7ec661932b';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Capturing screenshots of modals...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // 1. Login as Admin
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-email', { timeout: 5000 });
  await page.type('#login-email', 'admin@brightloop.com');
  await page.type('#login-password', 'Admin@123!');
  await page.click('#login-btn');
  await page.waitForSelector('.sidebar', { timeout: 5000 });
  await sleep(400);

  // 2. Open Create Subscription Modal
  await page.click('#nav-subscriptions');
  await sleep(400);
  await page.evaluate(() => Module3.openCreateSubscriptionModal());
  await page.waitForSelector('#sub-customer-id', { timeout: 5000 });
  await sleep(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_create_subscription.png') });
  console.log('Saved screenshot_create_subscription.png');

  // Close modal
  await page.evaluate(() => Modal.close());
  await sleep(300);

  // 3. Open Generate Quotation Modal
  await page.click('#nav-quotations');
  await sleep(400);
  await page.evaluate(() => Module3.openCreateQuotationModal());
  await page.waitForSelector('#quote-customer-id', { timeout: 5000 });
  await sleep(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_generate_quotation.png') });
  console.log('Saved screenshot_generate_quotation.png');

  // Close modal
  await page.evaluate(() => Modal.close());
  await sleep(300);

  // 4. Open Create Template Modal
  await page.evaluate(() => Module3.openCreateTemplateModal());
  await page.waitForSelector('#tpl-name', { timeout: 5000 });
  await sleep(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_create_template.png') });
  console.log('Saved screenshot_create_template.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
