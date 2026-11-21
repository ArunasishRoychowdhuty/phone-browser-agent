#!/data/data/com.termux/files/usr/bin/node
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { isDaemonAlive, sendToDaemon } = require('./browser-client');
const { executeAction, ensureCdp, BASE, CDP_URL } = require('./browser-actions');

function usage() {
  console.log('Commands:');
  console.log('  node browser-control.js list');
  console.log('  node browser-control.js sessions');
  console.log('  node browser-control.js new [URL]');
  console.log('  node browser-control.js activate TAB');
  console.log('  node browser-control.js session-info TAB');
  console.log('  node browser-control.js close TAB');
  console.log('  node browser-control.js accessibility TAB');
  console.log('  node browser-control.js wait-text TAB EXPECTED [TIMEOUT_MS]');
  console.log('  node browser-control.js wait-url TAB EXPECTED [TIMEOUT_MS]');
  console.log('  node browser-control.js context-new [URL]');
  console.log('  node browser-control.js context-list');
  console.log('  node browser-control.js context-close CONTEXT_ID');
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
  console.log("  node browser-control.js press-ref TAB_INDEX '@SNAPSHOT:eN' Enter");
  console.log("  node browser-control.js check-ref | uncheck-ref TAB_INDEX '@SNAPSHOT:eN'");
  console.log("  node browser-control.js select-ref TAB_INDEX '@SNAPSHOT:eN' VALUE");
  console.log('  node browser-control.js screenshot TAB_INDEX [OUTPUT_PNG]  # visual fallback only');
  console.log('  Use --stdin with type/fill to keep text out of process arguments.');
}

function parseArgs(argv) {
  const [action, tabArg, ...rest] = argv;
  if (!action) return null;

  const refActionMap = {
    'read-ref': 'read',
    'click-ref': 'click',
    'fill-ref': 'fill',
    'type-ref': 'type',
    'press-ref': 'press',
    'check-ref': 'check',
    'uncheck-ref': 'uncheck',
    'select-ref': 'select'
  };

  const sessionActions = new Set([
    'sessions', 'new', 'activate', 'session-info', 'close',
    'accessibility', 'ax', 'snapshot', 'wait-text', 'wait-url',
    'context-new', 'context-list', 'context-close'
  ]);

  let delegatedAction = action;
  let isSemantic = false;
  let refArg = undefined;
  let remainingArgs = [...rest];

  if (refActionMap[action]) {
    delegatedAction = refActionMap[action];
    isSemantic = true;
    refArg = remainingArgs[0];
    remainingArgs = remainingArgs.slice(1);
  } else if (sessionActions.has(action)) {
    isSemantic = true;
    if (action === 'ax') delegatedAction = 'accessibility';
  } else if (['read', 'click', 'fill', 'type', 'press', 'check', 'uncheck', 'select'].includes(action)) {
    if (String(remainingArgs[0] || '').startsWith('@')) {
      isSemantic = true;
      refArg = remainingArgs[0];
      remainingArgs = remainingArgs.slice(1);
    } else {
      isSemantic = false;
    }
  }

  let stdinText = null;
  const stdinIdx = remainingArgs.indexOf('--stdin');
  if (stdinIdx !== -1) {
    remainingArgs.splice(stdinIdx, 1);
    try { stdinText = fs.readFileSync(0, 'utf8'); } catch {}
  }

  return {
    action: delegatedAction,
    originalAction: action,
    tabArg,
    refArg,
    rest: remainingArgs,
    stdinText,
    isSemantic
  };
}

async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (!parsed) {
    usage();
    process.exitCode = 2;
    return;
  }

  const { action, tabArg, refArg, rest, stdinText, isSemantic } = parsed;

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
        isSemantic
      });
      if (response.stdout) process.stdout.write(response.stdout);
      if (response.stderr) process.stderr.write(response.stderr);
      process.exitCode = response.exitCode !== undefined ? response.exitCode : (response.ok ? 0 : 1);
      return;
    }
  } catch (daemonErr) {
    // Daemon unreachable, fallback smoothly to standalone direct connection
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
      isSemantic
    }, console);
  } catch (error) {
    console.error('BROWSER_CONTROL_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    if (browser) browser.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };
