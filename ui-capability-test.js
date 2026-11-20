const puppeteer = require('puppeteer-core');
const say = (...x) => { console.log(...x); };
(async () => {
  let browser, page;
  try {
    browser = await puppeteer.connect({browserURL:'http://127.0.0.1:9224', protocolTimeout:8000});
    say('STEP_CONNECTED', await browser.version());
    const pages = await browser.pages();
    say('STEP_PAGES', pages.length, pages.map(p=>p.url()));
    page = pages.find(p=>p.url().startsWith('https://example.com/'));
    if (!page) throw new Error('Assistant-created example.com test tab missing; no user tab will be altered.');
    page.setDefaultTimeout(8000);
    say('STEP_TEST_TAB');
    await page.evaluate(() => {
      document.body.innerHTML = '<main style="font:18px sans-serif;padding:24px"><input id="f" style="font-size:18px;padding:12px"><button id="b" style="font-size:18px;padding:12px" onclick="document.querySelector(\'#r\').textContent=\'CLICK_OK\'">Click test</button><p id="r"></p></main>';
      document.querySelector('#f').focus();
    });
    say('STEP_FORM_READY');
    await page.keyboard.type('REMOTE_TYPE_OK');
    say('STEP_TYPED');
    await page.click('#b');
    say('STEP_CLICKED');
    const result = await page.evaluate(() => ({typed:document.querySelector('#f').value,clicked:document.querySelector('#r').textContent}));
    say('RESULT', JSON.stringify(result));
    if (result.typed !== 'REMOTE_TYPE_OK' || result.clicked !== 'CLICK_OK') throw new Error('Value/click assertion failed');
    await page.close();
    page = null;
    say('UI_BROWSER_CONTROL_PASS');
  } catch(e) {
    console.error('UI_BROWSER_CONTROL_FAIL', e.message);
    process.exitCode=1;
  } finally {
    if(page) await page.close().catch(()=>{});
    if(browser) browser.disconnect();
  }
})();