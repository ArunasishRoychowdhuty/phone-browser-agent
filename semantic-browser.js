#!/data/data/com.termux/files/usr/bin/node
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { isDaemonAlive, sendToDaemon } = require('./browser-client');
const {
  executeAction,
  ensureCdp,
  targetIdOf,
  cleanTree,
  snapPath,
  inspectFrame,
  inspectPage,
  inspectAccessibility,
  resolveElement,
  resolvePage,
  BASE,
  CDP_URL
} = require('./browser-actions');

function usage() {
  console.log([
    'Semantic Browser Agent (Android Chrome / Termux)',
    '  node semantic-browser.js sessions', 
    '  node semantic-browser.js new [URL]',
    '  node semantic-browser.js activate TAB',
    '  node semantic-browser.js session-info TAB',
    '  node semantic-browser.js close TAB',
    '  node semantic-browser.js snapshot TAB_INDEX',
    '  node semantic-browser.js accessibility TAB_INDEX',
    "  node semantic-browser.js read TAB_INDEX '@SNAPSHOT:eN'",
    "  node semantic-browser.js click TAB_INDEX '@SNAPSHOT:eN'",
    "  node semantic-browser.js fill TAB_INDEX '@SNAPSHOT:eN' 'text'",
    "  node semantic-browser.js type TAB_INDEX '@SNAPSHOT:eN' 'text'",
    "  node semantic-browser.js press TAB_INDEX '@SNAPSHOT:eN' Enter",
    "  node semantic-browser.js check TAB_INDEX '@SNAPSHOT:eN'",
    "  node semantic-browser.js uncheck TAB_INDEX '@SNAPSHOT:eN'",
    "  node semantic-browser.js select TAB_INDEX '@SNAPSHOT:eN' VALUE",
    '  node semantic-browser.js wait-text TAB TEXT [TIMEOUT_MS]',
    '  node semantic-browser.js wait-url TAB URL_PART [TIMEOUT_MS]',
    '  node semantic-browser.js screenshot TAB_INDEX [OUTPUT_PNG]',
    '  For fill/type, append --stdin and pipe text to keep it out of process arguments' 
  ].join('\n'));
}

async function main() {
  const [action, tabArg, refArg, ...rest] = process.argv.slice(2);
  if (!action) return usage();

  let stdinText = null;
  if (rest.includes('--stdin')) {
    try { stdinText = fs.readFileSync(0, 'utf8'); } catch {}
  }

  // 1. FAST PATH: Check if resident daemon is running
  try {
    const alive = await isDaemonAlive(180);
    if (alive) {
      const response = await sendToDaemon({
        action,
        tabArg,
        refArg,
        rest,
        stdinText,
        isSemantic: true
      });
      if (response.stdout) process.stdout.write(response.stdout);
      if (response.stderr) process.stderr.write(response.stderr);
      process.exitCode = response.exitCode !== undefined ? response.exitCode : (response.ok ? 0 : 1);
      return;
    }
  } catch (daemonErr) {
    // Daemon unreachable, fallback smoothly to standalone
  }

  // 2. FALLBACK PATH: Standalone direct connection
  let browser;
  try {
    ensureCdp();
    browser = await puppeteer.connect({
      browserURL: CDP_URL,
      defaultViewport: null,
      protocolTimeout: 60000
    });
    await executeAction(browser, {
      action,
      tabArg,
      refArg,
      rest,
      stdinText,
      isSemantic: true
    }, console);
  } catch (error) {
    console.error('SEMANTIC_BROWSER_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    if (browser) browser.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  cleanTree,
  snapPath,
  targetIdOf,
  inspectFrame,
  inspectPage,
  inspectAccessibility,
  resolveElement,
  resolvePage,
  ensureCdp,
  executeAction
};
