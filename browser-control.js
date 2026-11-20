#!/data/data/com.termux/files/usr/bin/node
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = path.join(process.env.HOME, 'phone-browser-agent');
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9224';
const CDP_PORT = Number(new URL(CDP_URL).port) || 9224;

function usage() {
  console.log('Commands:');
  console.log('  node browser-control.js list');
  console.log('  node browser-control.js sessions');
  console.log('  node browser-control.js new [URL]');
  console.log('  node browser-control.js activate TAB');
  console.log('  node browser-control.js session-info TAB');
  console.log('  node browser-control.js close TAB');
  console.log('  node browser-control.js accessibility TAB');
  console.log('  Prefer target:<targetId> from list over unstable numeric tab indexes.');
  console.log('  node browser-control.js open TAB_INDEX URL');
  console.log('  node browser-control.js click TAB_INDEX CSS_SELECTOR');
  console.log('  node browser-control.js type TAB_INDEX CSS_SELECTOR TEXT');
  console.log('  node browser-control.js fill TAB_INDEX CSS_SELECTOR TEXT');
  console.log('  node browser-control.js read TAB_INDEX CSS_SELECTOR');
  console.log('  node browser-control.js snapshot TAB_INDEX                  # preferred: semantic DOM tree');
  console.log("  node browser-control.js click-ref TAB_INDEX '@SNAPSHOT:eN'");
  console.log("  node browser-control.js fill-ref TAB_INDEX '@SNAPSHOT:eN' 'text'");
  console.log("  node browser-control.js type-ref TAB_INDEX '@SNAPSHOT:eN' 'text'");
  console.log("  node browser-control.js read-ref TAB_INDEX '@SNAPSHOT:eN'");
  console.log('  node browser-control.js press-ref TAB_INDEX REF Enter');
  console.log('  node browser-control.js check-ref | uncheck-ref | select-ref TAB_INDEX REF VALUE');
  console.log('  node browser-control.js screenshot TAB_INDEX [OUTPUT_PNG]  # visual fallback only');
  console.log('  Use --stdin with type/fill to keep text out of process arguments.');
}

function command(name, args, timeout=8000) {
  const r = spawnSync(name, args, { encoding:'utf8', timeout });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || name + ' failed').trim());
  return (r.stdout || '').trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function targetIdOf(page) { return page.target()._targetId || null; }

function textFromArgs(args) {
  if (args[0] === '--stdin') return fs.readFileSync(0, 'utf8');
  return args.join(' ');
}

function ensureCdp() {
  const check = () => {
    try {
      const r = spawnSync('curl', ['--fail','--silent','--show-error','--max-time','2', CDP_URL + '/json/version'], {encoding:'utf8',timeout:3000});
      return r.status === 0 && r.stdout.includes('webSocketDebuggerUrl');
    } catch { return false; }
  };
  if (check()) return;

  const deviceFile = path.join(BASE, 'device.txt');
  if (!fs.existsSync(deviceFile)) throw new Error('No saved ADB device. Start start-bridge.sh first.');
  const device = fs.readFileSync(deviceFile, 'utf8').trim();
  if (!device) throw new Error('ADB device address file is empty.');
  command('adb', ['-s', device, 'get-state'], 3000);

  // Chrome is intentionally brought forward only when browser interaction is requested.
  command('adb', ['-s', device, 'shell', 'monkey', '-p', 'com.android.chrome', '1'], 10000);
  command('adb', ['forward', '--remove', 'tcp:9224'], 3000);
  command('adb', ['-s', device, 'forward', 'tcp:'+CDP_PORT, 'localabstract:chrome_devtools_remote'], 5000);

  for (let i=0; i<5; i++) {
    sleep(1000);
    if (check()) return;
  }
  throw new Error('Chrome DevTools did not respond after launching Chrome. Check Wireless debugging and Chrome.');
}

async function main() {
  const [action, tabArg, ...rest] = process.argv.slice(2);
  if (!action) { usage(); process.exitCode = 2; return; }
  const semanticAliases = {
    'sessions':'sessions', 'new':'new', 'activate':'activate',
    'session-info':'session-info', 'close':'close',
    'accessibility':'accessibility', 'ax':'accessibility',
    snapshot:'snapshot', 'read-ref':'read', 'click-ref':'click',
    'fill-ref':'fill', 'type-ref':'type', 'press-ref':'press',
    'check-ref':'check', 'uncheck-ref':'uncheck', 'select-ref':'select'
  };
  const hasSemanticRef = ['read','click','fill','type'].includes(action) &&
    String(rest[0] || '').startsWith('@');
  if (semanticAliases[action] || hasSemanticRef) {
    const script = path.join(BASE, 'semantic-browser.js');
    const delegatedAction = semanticAliases[action] || action;
    const childArgs = [script, delegatedAction];
    if (tabArg !== undefined) childArgs.push(tabArg);
    childArgs.push(...rest);
    const child = spawnSync(process.execPath, childArgs, {stdio:'inherit'});
    if (child.error) throw child.error;
    process.exitCode = child.status === null ? 1 : child.status;
    return;
  }
  let browser;
  try {
    ensureCdp();
    browser = await puppeteer.connect({
      browserURL: CDP_URL,
      defaultViewport: null,
      protocolTimeout: 60000
    });
    const pages = await browser.pages();

    if (action === 'list') {
      for (let i = 0; i < pages.length; i++) {
        console.log(JSON.stringify({tab:i,targetId:targetIdOf(pages[i]),url:pages[i].url(),title:await pages[i].title()}));
      }
      return;
    }

    const rawTab = String(tabArg || '');
    let tabIndex, page;
    if (rawTab.startsWith('target:')) {
      const targetId = rawTab.slice(7);
      if (!/^[a-f0-9-]{8,}$/i.test(targetId)) throw new Error('Invalid target ID.');
      page = pages.find(p => targetIdOf(p) === targetId);
      if (!page) throw new Error('Target not found. Run list and use a current target ID.');
      tabIndex = pages.indexOf(page);
    } else {
      tabIndex = Number(rawTab);
      if (!Number.isInteger(tabIndex) || tabIndex < 0 || tabIndex >= pages.length) {
        throw new Error('Invalid tab index. Current tab count: ' + pages.length);
      }
      page = pages[tabIndex];
    }
    page.setDefaultTimeout(15000);

    switch (action) {
      case 'open': {
        const url = rest.join(' ');
        if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) URLs are allowed.');
        await page.bringToFront();
        await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
        console.log(JSON.stringify({status:'OPENED',tab:tabIndex,url:page.url(),title:await page.title()}));
        break;
      }
      case 'click': {
        const selector = rest.join(' ');
        if (!selector) throw new Error('CSS selector required.');
        await page.bringToFront();
        await page.waitForSelector(selector,{visible:true});
        await page.click(selector,{timeout:15000});
        console.log(JSON.stringify({status:'CLICKED',tab:tabIndex,selector,url:page.url()}));
        break;
      }
      case 'type': {
        const selector = rest.shift();
        if (!selector || rest.length===0) throw new Error('CSS selector and text are required.');
        await page.bringToFront();
        await page.waitForSelector(selector,{visible:true});
        const value = textFromArgs(rest);
        if (!value) throw new Error('Text is required (use --stdin to read text from standard input).');
        await page.focus(selector);
        await page.keyboard.type(value);
        console.log(JSON.stringify({status:'TYPED',tab:tabIndex,selector,characters:value.length}));
        break;
      }
      case 'fill': {
        const selector = rest.shift();
        const value = textFromArgs(rest);
        if (!selector) throw new Error('CSS selector required.');
        if (rest.length===0) throw new Error('Text is required (use --stdin to intentionally clear a field).');
        await page.bringToFront();
        await page.waitForSelector(selector,{visible:true});
        const handle = await page.$(selector);
        if (!handle) throw new Error('Target disappeared before fill.');
        await handle.evaluate((el,text) => {
          if (el.disabled || el.readOnly) throw new Error('Target is disabled or read-only.');
          if (el.isContentEditable) {
            el.focus();
            el.textContent = text;
          } else {
            const proto = el.localName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
            if (!setter) throw new Error('Target is not a supported text field.');
            setter.call(el,text);
          }
          el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }, value);
        const verified = await handle.evaluate(el => el.isContentEditable ? el.innerText : el.value);
        if (String(verified) !== value) throw new Error('STATE_UNVERIFIED: field value did not match requested text.');
        console.log(JSON.stringify({status:'FILLED_VERIFIED',tab:tabIndex,selector,characters:value.length}));
        break;
      }
      case 'read': {
        const selector = rest.join(' ');
        if (!selector) throw new Error('CSS selector required.');
        const value = await page.$eval(selector,el=>({
          text:(['input','textarea','select'].includes(el.localName))?undefined:(el.innerText||el.textContent||'').trim(),
          value:(['input','textarea','select'].includes(el.localName))?el.value:undefined,
          href:el.href||undefined
        }));
        console.log(JSON.stringify({status:'READ',tab:tabIndex,selector,result:value}));
        break;
      }
      case 'screenshot': {
        const out=rest[0]||path.join(BASE,'tab-'+tabIndex+'.png');
        fs.mkdirSync(path.dirname(out),{recursive:true});
        await page.screenshot({path:out,fullPage:false});
        console.log(JSON.stringify({status:'SCREENSHOT',path:out,url:page.url()}));
        break;
      }
      default:
        usage();
        process.exitCode=2;
    }
  } catch(error) {
    console.error('BROWSER_CONTROL_ERROR:',error.message);
    process.exitCode=1;
  } finally {
    if(browser) browser.disconnect();
  }
}
main();
