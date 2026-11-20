const puppeteer = require('puppeteer-core');

(async () => {
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: process.env.CDP_URL || 'http://127.0.0.1:9224',
      defaultViewport: null
    });

    const tabs = await browser.pages();
    const testPage = await browser.newPage();
    await testPage.goto('about:blank', { waitUntil: 'domcontentloaded' });
    const check = await testPage.evaluate(() => ({
      readyState: document.readyState,
      url: location.href
    }));

    console.log(JSON.stringify({
      status: 'BROWSER_AUTOMATION_READY',
      browser: await browser.version(),
      openTabCount: tabs.length,
      controlTest: check
    }, null, 2));

    await testPage.close();
  } catch (error) {
    console.error('Browser automation check failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (browser) browser.disconnect();
  }
})();