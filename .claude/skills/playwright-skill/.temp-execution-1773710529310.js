const { chromium } = require('playwright');

const LOGIN_URL = 'https://ehr.fits.com.cn/RedseaPlatform/';
const APPLY_URL = 'https://ehr.fits.com.cn/RedseaPlatform/WorkformEngine.mc?method=goToWorkFlow&formId=b8a8e477-3384-4203-8873-284373948aa5&reqType=START&processType=96816&packageId=fengde&defProcessId=96816-2-20190103114659&version=1.0&formUrl=/WorkformEngine.mc?method=goToWorkFlow&formId=b8a8e477-3384-4203-8873-284373948aa5&systemId=null';
const USERNAME = 'fits0158';
const PASSWORD = 'cao374348532';

async function summarizePage(page, label) {
  const title = await page.title().catch(() => '');
  const url = page.url();
  const inputs = await page.locator('input, textarea, select').evaluateAll(nodes => nodes.slice(0, 50).map((el, i) => ({
    i,
    tag: el.tagName,
    type: el.getAttribute('type'),
    name: el.getAttribute('name'),
    id: el.getAttribute('id'),
    placeholder: el.getAttribute('placeholder'),
    value: (el.value || '').slice(0, 50),
    visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
  }))).catch(() => []);
  const buttons = await page.locator('button, input[type=button], input[type=submit], a').evaluateAll(nodes => nodes.slice(0, 80).map((el, i) => ({
    i,
    tag: el.tagName,
    text: (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    id: el.getAttribute('id'),
    cls: el.getAttribute('class'),
    href: el.getAttribute('href'),
    visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
  }))).catch(() => []);
  console.log(`\n=== ${label} ===`);
  console.log('TITLE:', title);
  console.log('URL:', url);
  console.log('INPUTS:', JSON.stringify(inputs, null, 2));
  console.log('BUTTONS/LINKS:', JSON.stringify(buttons, null, 2));
  console.log('FRAMES:', page.frames().map(f => ({ name: f.name(), url: f.url() })));
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    console.log('DIALOG:', dialog.type(), dialog.message());
    await dialog.accept().catch(() => {});
  });
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));

  try {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await summarizePage(page, 'LOGIN PAGE');
    await page.screenshot({ path: '/tmp/ehr-login-page.png', fullPage: true }).catch(() => {});

    const userSelectors = [
      'input[name="username"]',
      'input[name="userName"]',
      'input[name="loginName"]',
      'input[type="text"]',
      '#username',
      '#userName',
      '#loginName'
    ];
    const passSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      '#password'
    ];

    let userFilled = false;
    for (const sel of userSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.count().catch(() => 0)) {
        await loc.fill(USERNAME).catch(() => {});
        userFilled = true;
        console.log('Filled username via', sel);
        break;
      }
    }
    let passFilled = false;
    for (const sel of passSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.count().catch(() => 0)) {
        await loc.fill(PASSWORD).catch(() => {});
        passFilled = true;
        console.log('Filled password via', sel);
        break;
      }
    }

    if (!userFilled || !passFilled) {
      console.log('Could not locate username/password fields reliably.');
      await summarizePage(page, 'LOGIN PAGE AFTER FAILED FIELD DETECTION');
      await page.pause();
      return;
    }

    await page.screenshot({ path: '/tmp/ehr-login-filled.png', fullPage: true }).catch(() => {});

    const loginCandidates = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("登录")',
      'a:has-text("登录")',
      '#loginBtn',
      '.login-btn',
      '.btn-login'
    ];
    let clicked = false;
    for (const sel of loginCandidates) {
      const loc = page.locator(sel).first();
      if (await loc.count().catch(() => 0)) {
        await loc.click({ timeout: 5000 }).catch(() => {});
        console.log('Clicked login via', sel);
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      await page.keyboard.press('Enter').catch(() => {});
      console.log('Submitted via Enter');
    }

    await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await summarizePage(page, 'AFTER LOGIN');
    await page.screenshot({ path: '/tmp/ehr-after-login.png', fullPage: true }).catch(() => {});

    await page.goto(APPLY_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await summarizePage(page, 'APPLY PAGE');
    await page.screenshot({ path: '/tmp/ehr-apply-page.png', fullPage: true }).catch(() => {});

    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        const bodyText = await frame.locator('body').innerText({ timeout: 3000 });
        const inputs = await frame.locator('input, textarea, select').evaluateAll(nodes => nodes.slice(0, 50).map((el, i) => ({
          i,
          tag: el.tagName,
          type: el.getAttribute('type'),
          name: el.getAttribute('name'),
          id: el.getAttribute('id'),
          placeholder: el.getAttribute('placeholder'),
          value: (el.value || '').slice(0, 50),
          visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        })));
        const buttons = await frame.locator('button, input[type=button], input[type=submit], a').evaluateAll(nodes => nodes.slice(0, 80).map((el, i) => ({
          i,
          tag: el.tagName,
          text: (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          id: el.getAttribute('id'),
          cls: el.getAttribute('class'),
          href: el.getAttribute('href'),
          visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        })));
        console.log('\n--- FRAME SUMMARY ---');
        console.log('FRAME:', { name: frame.name(), url: frame.url() });
        console.log('FRAME BODY PREVIEW:', bodyText.slice(0, 1000));
        console.log('FRAME INPUTS:', JSON.stringify(inputs, null, 2));
        console.log('FRAME BUTTONS:', JSON.stringify(buttons, null, 2));
      } catch (e) {
        console.log('Frame inspect failed:', frame.url(), e.message);
      }
    }

    await page.pause();
  } catch (error) {
    console.error('AUTOMATION ERROR:', error);
    await page.screenshot({ path: '/tmp/ehr-error.png', fullPage: true }).catch(() => {});
    await page.pause().catch(() => {});
  }
})();
