'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { fingerprint, fingerprintMismatch } = require('./semantic-core');
const { nodeKey, buildNodeTree, buildAccessibilityTree } = require('./semantic-engine');

const BASE = path.join(process.env.HOME, 'phone-browser-agent');
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9224';
const CDP_PORT = Number(new URL(CDP_URL).port) || 9224;
const MAX_NODES = Math.min(1200, Math.max(100, Number(process.env.BROWSER_MAX_NODES) || 300));
const MAX_TEXT = 180;
const MAX_AX_NODES = Math.min(1200, Math.max(100, Number(process.env.BROWSER_AX_MAX_NODES) || 300));
const MAX_DOM_SCAN = Math.max(2000, MAX_NODES * 30);

function snapPath(key) {
  const safe = String(key).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(BASE, 'semantic-snapshot-' + safe + '.json');
}

function targetIdOf(page) {
  return page.target()._targetId || null;
}

function cleanTree(n) {
  return {
    ref: n.ref, tag: n.tag, role: n.role, name: n.name, text: n.text,
    value: n.value, attributes: { ...n.attributes }, state: n.state,
    clickable: n.clickable, editable: n.editable, focusable: n.focusable,
    visible: n.visible, frameId: n.frameId, frameUrl: n.frameUrl, frameName: n.frameName, parentFrameId: n.parentFrameId,
    locator: n.locator, children: (n.children || []).map(cleanTree)
  };
}

function run(cmd, args, timeout = 8000) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || cmd + ' failed').trim());
  return (r.stdout || '').trim();
}

function ensureCdp() {
  const check = () => {
    try {
      const r = spawnSync('curl', ['--fail', '--silent', '--show-error', '--max-time', '2', CDP_URL + '/json/version'], { encoding: 'utf8', timeout: 3000 });
      return r.status === 0 && r.stdout.includes('webSocketDebuggerUrl');
    } catch {
      return false;
    }
  };
  if (check()) return true;

  const f = path.join(BASE, 'device.txt');
  if (!fs.existsSync(f)) throw new Error('No saved ADB device. Run start-bridge.sh first.');
  const dev = fs.readFileSync(f, 'utf8').trim();
  if (!dev) throw new Error('Saved ADB device address is empty.');

  run('adb', ['-s', dev, 'get-state'], 4000);
  run('adb', ['-s', dev, 'shell', 'monkey', '-p', 'com.android.chrome', '1'], 10000);
  run('adb', ['forward', '--remove', 'tcp:' + CDP_PORT], 3000);
  run('adb', ['-s', dev, 'forward', 'tcp:' + CDP_PORT, 'localabstract:chrome_devtools_remote'], 5000);

  for (let i = 0; i < 5; i++) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
    if (check()) return true;
  }
  throw new Error('Chrome DevTools did not respond. Check Wireless debugging and Chrome.');
}

async function inspectFrame(frame, nodeLimit) {
  return frame.evaluate((maxNodes, maxText, maxScan) => {
    const norm = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, maxText);
    const visible = el => {
      try {
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
          Number(style.opacity || 1) !== 0 && el.getClientRects().length > 0;
      } catch { return false; }
    };
    const roleOf = el => {
      const explicit = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
      if (explicit) return explicit;
      const tag = el.localName, type = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'a' && el.hasAttribute('href')) return 'link';
      if (tag === 'button' || tag === 'summary') return 'button';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'select') return el.multiple ? 'listbox' : 'combobox';
      if (tag === 'input') {
        if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'range') return 'slider';
        if (type === 'number') return 'spinbutton';
        if (type === 'search') return 'searchbox';
        if (type === 'hidden') return 'none';
        if (type === 'file') return 'button';
        return 'textbox';
      }
      if (/^h[1-6]$/.test(tag)) return 'heading';
      if (tag === 'nav') return 'navigation';
      if (tag === 'main') return 'main';
      if (tag === 'form') return 'form';
      if (tag === 'ul' || tag === 'ol') return 'list';
      if (tag === 'li') return 'listitem';
      if (tag === 'option') return 'option';
      if (tag === 'img') return 'img';
      if (tag === 'table') return 'table';
      if (tag === 'tr') return 'row';
      if (tag === 'th') return 'columnheader';
      if (tag === 'td') return 'cell';
      if (tag === 'header') return 'banner';
      if (tag === 'footer') return 'contentinfo';
      if (tag === 'article') return 'article';
      if (tag === 'section') return 'region';
      if (tag === 'label') return 'label';
      if (tag === 'iframe') return 'iframe';
      if (tag === 'p') return 'paragraph';
      return 'generic';
    };
    const nameOf = el => {
      const aria = el.getAttribute('aria-label'); if (aria) return norm(aria);
      if (el.labels && el.labels.length) {
        const t = Array.from(el.labels).map(x => norm(x.innerText || x.textContent)).filter(Boolean).join(' ');
        if (t) return norm(t);
      }
      if (el.localName === 'img') return norm(el.getAttribute('alt') || el.getAttribute('title'));
      if (el.localName === 'input' && ['submit', 'button', 'reset'].includes((el.type || '').toLowerCase())) return norm(el.value);
      const title = el.getAttribute('title'); if (title) return norm(title);
      return norm(el.innerText || el.textContent);
    };
    const clickRoles = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem',
      'menuitemcheckbox', 'menuitemradio', 'option', 'combobox', 'listbox', 'slider', 'treeitem', 'gridcell']);
    const structuralRoles = new Set(['main', 'navigation', 'banner', 'contentinfo', 'form', 'list',
      'listitem', 'article', 'region', 'heading', 'paragraph', 'table', 'row', 'columnheader', 'cell', 'img', 'iframe']);
    const cssPath = (el, root) => {
      if (el.id) {
        const idSelector = '#' + CSS.escape(el.id);
        try { if (root.querySelectorAll(idSelector).length === 1) return idSelector; } catch { }
      }
      const parts = []; let cur = el;
      while (cur && cur.nodeType === 1 && cur !== root) {
        const parent = cur.parentElement;
        if (!parent) { parts.unshift(cur.localName); break; }
        const siblings = Array.from(parent.children).filter(x => x.localName === cur.localName);
        parts.unshift(cur.localName + ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')');
        cur = parent;
      }
      return parts.join(' > ');
    };
    const locatorOf = el => {
      const segments = []; let current = el;
      for (let depth = 0; depth < 20 && current; depth++) {
        const root = current.getRootNode();
        if (root instanceof ShadowRoot) {
          segments.unshift(cssPath(current, root));
          current = root.host;
        } else {
          segments.unshift(cssPath(current, document));
          break;
        }
      }
      return segments.filter(Boolean);
    };
    const candidates = [], seen = new Set();
    let scanned = 0, truncated = false;
    const walk = root => {
      let elements;
      try { elements = Array.from(root.querySelectorAll('*')); } catch { return; }
      for (const el of elements) {
        scanned++;
        if (scanned > maxScan || candidates.length >= maxNodes) { truncated = true; return; }
        const isVisible = visible(el);
        if (isVisible) {
          const role = roleOf(el), tag = el.localName, type = (el.getAttribute('type') || '').toLowerCase();
          const editable = (['input', 'textarea'].includes(tag) && type !== 'hidden' &&
            !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'].includes(type)) ||
            el.isContentEditable || ['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(role);
          const clickable = clickRoles.has(role) || ['a', 'button', 'summary'].includes(tag) ||
            (tag === 'input' && ['button', 'submit', 'reset', 'image', 'checkbox', 'radio', 'file'].includes(type)) ||
            tag === 'label' || el.hasAttribute('onclick');
          const childElements = Array.from(el.children).filter(visible);
          let name = nameOf(el);
          if (childElements.length > 0 && structuralRoles.has(role) && !el.getAttribute('aria-label') && !el.getAttribute('title')) name = '';
          const semantic = clickable || editable || structuralRoles.has(role) || Boolean(el.shadowRoot) ||
            (name && childElements.length === 0 && !['script', 'style', 'noscript'].includes(tag));
          if (semantic) {
            const locator = locatorOf(el), key = JSON.stringify(locator);
            if (locator.length && !seen.has(key)) {
              seen.add(key);
              const attributes = {
                id: el.id || undefined, nameAttr: el.getAttribute('name') || undefined,
                type: el.getAttribute('type') || undefined, placeholder: el.getAttribute('placeholder') || undefined,
                href: el.href || undefined, title: el.getAttribute('title') || undefined,
                roleAttr: el.getAttribute('role') || undefined, autocomplete: el.getAttribute('autocomplete') || undefined
              };
              const state = {};
              if ('disabled' in el) state.disabled = Boolean(el.disabled);
              if (el.getAttribute('aria-disabled') === 'true') state.disabled = true;
              if ('required' in el) state.required = Boolean(el.required);
              if ('readOnly' in el) state.readOnly = Boolean(el.readOnly);
              if ('checked' in el) state.checked = Boolean(el.checked);
              if ('selected' in el) state.selected = Boolean(el.selected);
              if (el.hasAttribute('aria-expanded')) state.expanded = el.getAttribute('aria-expanded') === 'true';
              if (el.hasAttribute('aria-checked')) state.checked = el.getAttribute('aria-checked') === 'true';
              if (el.hasAttribute('aria-pressed')) state.pressed = el.getAttribute('aria-pressed') === 'true';
              if (el.hasAttribute('aria-selected')) state.selected = el.getAttribute('aria-selected') === 'true';
              if (el.hasAttribute('aria-invalid')) state.invalid = el.getAttribute('aria-invalid') !== 'false';
              state.focused = document.activeElement === el;
              const focusable = Boolean(editable || clickable || el.tabIndex >= 0);
              const root = el.getRootNode();
              const parent = el.parentElement || (root instanceof ShadowRoot ? root.host : null);
              candidates.push({
                locator, parentLocator: parent ? locatorOf(parent) : null, tag, role, name, text: name,
                value: ('value' in el) ? norm(el.value) : (el.isContentEditable ? norm(el.innerText) : undefined),
                attributes, state, clickable: Boolean(clickable), editable: Boolean(editable), focusable, visible: true
              });
            }
          }
        }
        if (el.shadowRoot) walk(el.shadowRoot);
        if (truncated) return;
      }
    };
    walk(document);
    return {
      url: location.href, title: document.title, timestamp: Date.now(), domElementCount: scanned,
      maxNodesReached: truncated, nodes: candidates
    };
  }, nodeLimit, MAX_TEXT, MAX_DOM_SCAN);
}

async function inspectPage(page) {
  const frames = page.frames(), nodes = [], frameInfo = [], frameErrors = [];
  let domElementCount = 0, maxNodesReached = false;
  for (const frame of frames) {
    const frameId = String(frame._id || '');
    const info = { frameId, url: frame.url(), name: frame.name(), parentFrameId: frame.parentFrame() ? String(frame.parentFrame()._id || '') : null };
    frameInfo.push(info);
    try {
      const remaining = MAX_NODES - nodes.length;
      if (remaining <= 0) { maxNodesReached = true; continue; }
      const result = await inspectFrame(frame, remaining);
      domElementCount += result.domElementCount || 0;
      maxNodesReached = maxNodesReached || result.maxNodesReached;
      for (const node of result.nodes) {
        nodes.push({
          ...node, frameId, frameUrl: info.url, frameName: info.name, parentFrameId: info.parentFrameId,
          parentLocatorKey: node.parentLocator ? nodeKey(frameId, node.parentLocator) : null
        });
      }
    } catch (error) {
      frameErrors.push({ frameId, url: info.url, message: String(error.message || error).slice(0, 180) });
    }
  }
  return {
    url: page.url(), title: await page.title(), timestamp: Date.now(), domElementCount,
    maxNodesReached, nodes, frames: frameInfo, frameErrors
  };
}

async function inspectAccessibility(page) {
  const results = [];
  let remaining = MAX_AX_NODES;
  for (const frame of page.frames()) {
    const frameId = String(frame._id || '');
    const info = { frameId, url: frame.url(), name: frame.name() };
    try {
      if (!frameId) throw new Error('Chrome frame ID unavailable.');
      const client = frame.client;
      await client.send('Accessibility.enable').catch(() => { });
      if (remaining <= 0) {
        results.push({ ...info, status: 'LIMIT_REACHED', error: 'Page-wide AX node limit reached.', nodeCount: 0, tree: [] });
        continue;
      }
      const response = await client.send('Accessibility.getFullAXTree', { frameId });
      const built = buildAccessibilityTree(response.nodes || [], remaining);
      remaining -= built.nodeCount;
      results.push({ ...info, status: 'OK', ...built });
    } catch (error) {
      results.push({
        ...info, status: 'UNAVAILABLE',
        error: String(error.message || error).slice(0, 180), nodeCount: 0, tree: []
      });
    }
  }
  return {
    frames: results, totalNodes: results.reduce((sum, x) => sum + (x.nodeCount || 0), 0),
    complete: results.length > 0 && results.every(x => x.status === 'OK' && !x.truncated)
  };
}

async function resolveElement(frame, locator) {
  if (!Array.isArray(locator) || !locator.length) return null;
  const handle = await frame.evaluateHandle(segments => {
    let root = document, element = null;
    for (let i = 0; i < segments.length; i++) {
      try { element = root.querySelector(segments[i]); } catch { return null; }
      if (!element) return null;
      if (i < segments.length - 1) {
        if (!element.shadowRoot) return null;
        root = element.shadowRoot;
      }
    }
    return element;
  }, locator);
  const element = handle.asElement();
  if (!element) await handle.dispose();
  return element;
}

function resolvePage(pages, tabArg) {
  const rawTab = String(tabArg || '');
  const byTarget = rawTab.startsWith('target:');
  const requestedTarget = byTarget ? rawTab.slice(7) : null;
  let page, tab;
  if (byTarget) {
    if (!/^[a-f0-9-]{8,}$/i.test(requestedTarget)) throw new Error('Invalid target ID.');
    page = pages.find(p => targetIdOf(p) === requestedTarget);
    if (!page) throw new Error('Target not found. Run list and use a current target ID.');
    tab = pages.indexOf(page);
  } else {
    tab = Number(rawTab);
    if (!Number.isInteger(tab) || tab < 0 || tab >= pages.length) throw new Error('Invalid tab index. Tabs=' + pages.length);
    page = pages[tab];
  }
  return { page, tab, byTarget, requestedTarget, snapshotKey: byTarget ? 'target-' + requestedTarget : String(tabArg) };
}

async function executeAction(browser, payload, logger = console) {
  const { action, tabArg, refArg, rest = [], stdinText = null, isSemantic = false } = payload;
  const pages = await browser.pages();

  // Low-level CDP Actions (when not semantic)
  if (!isSemantic) {
    if (action === 'list') {
      for (let i = 0; i < pages.length; i++) {
        logger.log(JSON.stringify({ tab: i, targetId: targetIdOf(pages[i]), url: pages[i].url(), title: await pages[i].title() }));
      }
      return { status: 'OK' };
    }

    const { page, tab: tabIndex } = resolvePage(pages, tabArg);
    page.setDefaultTimeout(15000);

    switch (action) {
      case 'open': {
        const url = rest.join(' ');
        if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) URLs are allowed.');
        await page.bringToFront();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        logger.log(JSON.stringify({ status: 'OPENED', tab: tabIndex, url: page.url(), title: await page.title() }));
        return { status: 'OPENED', tab: tabIndex, url: page.url() };
      }
      case 'click': {
        const selector = rest.join(' ');
        if (!selector) throw new Error('CSS selector required.');
        await page.bringToFront();
        await page.waitForSelector(selector, { visible: true });
        await page.click(selector, { timeout: 15000 });
        logger.log(JSON.stringify({ status: 'CLICKED', tab: tabIndex, selector, url: page.url() }));
        return { status: 'CLICKED', tab: tabIndex, selector, url: page.url() };
      }
      case 'type': {
        const selector = rest.shift();
        if (!selector || (rest.length === 0 && stdinText === null)) throw new Error('CSS selector and text are required.');
        await page.bringToFront();
        await page.waitForSelector(selector, { visible: true });
        const value = stdinText !== null ? stdinText : (rest[0] === '--stdin' ? stdinText : rest.join(' '));
        if (!value) throw new Error('Text is required (use --stdin to read text from standard input).');
        await page.focus(selector);
        await page.keyboard.type(value);
        logger.log(JSON.stringify({ status: 'TYPED', tab: tabIndex, selector, characters: value.length }));
        return { status: 'TYPED', tab: tabIndex, selector, characters: value.length };
      }
      case 'fill': {
        const selector = rest.shift();
        const value = stdinText !== null ? stdinText : (rest[0] === '--stdin' ? stdinText : rest.join(' '));
        if (!selector) throw new Error('CSS selector required.');
        if (value === null || value === undefined) throw new Error('Text is required (use --stdin to intentionally clear a field).');
        await page.bringToFront();
        await page.waitForSelector(selector, { visible: true });
        const handle = await page.$(selector);
        if (!handle) throw new Error('Target disappeared before fill.');
        await handle.evaluate((el, text) => {
          if (el.disabled || el.readOnly) throw new Error('Target is disabled or read-only.');
          if (el.isContentEditable) {
            el.focus();
            el.textContent = text;
          } else {
            const proto = el.localName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (!setter) throw new Error('Target is not a supported text field.');
            setter.call(el, text);
          }
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, value);
        const verified = await handle.evaluate(el => el.isContentEditable ? el.innerText : el.value);
        if (String(verified) !== value) throw new Error('STATE_UNVERIFIED: field value did not match requested text.');
        logger.log(JSON.stringify({ status: 'FILLED_VERIFIED', tab: tabIndex, selector, characters: value.length }));
        return { status: 'FILLED_VERIFIED', tab: tabIndex, selector, characters: value.length };
      }
      case 'read': {
        const selector = rest.join(' ');
        if (!selector) throw new Error('CSS selector required.');
        const value = await page.$eval(selector, el => ({
          text: (['input', 'textarea', 'select'].includes(el.localName)) ? undefined : (el.innerText || el.textContent || '').trim(),
          value: (['input', 'textarea', 'select'].includes(el.localName)) ? el.value : undefined,
          href: el.href || undefined
        }));
        logger.log(JSON.stringify({ status: 'READ', tab: tabIndex, selector, result: value }));
        return { status: 'READ', tab: tabIndex, selector, result: value };
      }
      case 'screenshot': {
        const out = rest[0] || path.join(BASE, 'tab-' + tabIndex + '.png');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        await page.screenshot({ path: out, fullPage: false });
        logger.log(JSON.stringify({ status: 'SCREENSHOT', path: out, url: page.url() }));
        return { status: 'SCREENSHOT', path: out, url: page.url() };
      }
      default:
        throw new Error('Unknown command: ' + action);
    }
  }

  // Semantic Browser Actions
  if (action === 'list' || action === 'sessions') {
    const tabs = [];
    for (let i = 0; i < pages.length; i++) {
      const frames = pages[i].frames();
      tabs.push({
        tab: i, targetId: targetIdOf(pages[i]), url: pages[i].url(),
        title: await pages[i].title(), frameCount: frames.length,
        frames: frames.map(f => ({ frameId: String(f._id || ''), url: f.url(), name: f.name() }))
      });
    }
    const output = { status: 'SESSIONS_OK', count: tabs.length, tabs };
    logger.log(JSON.stringify(output, null, 2));
    return output;
  }

  if (action === 'new') {
    const url = String(tabArg || '');
    if (url && !/^https?:\/\//i.test(url)) throw new Error('Only http(s) URLs are allowed for a new session.');
    const created = await browser.newPage();
    if (url) await created.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const output = {
      status: 'SESSION_CREATED', targetId: targetIdOf(created),
      url: created.url(), title: await created.title()
    };
    logger.log(JSON.stringify(output));
    return output;
  }

  const { page, tab, snapshotKey } = resolvePage(pages, tabArg);
  const pageTargetId = targetIdOf(page);
  page.setDefaultTimeout(12000);

  if (action === 'activate') {
    await page.bringToFront();
    const output = { status: 'SESSION_ACTIVATED', tab, targetId: pageTargetId, url: page.url() };
    logger.log(JSON.stringify(output));
    return output;
  }

  if (action === 'session-info') {
    const frames = page.frames();
    const output = {
      status: 'SESSION_INFO', tab, targetId: pageTargetId, url: page.url(),
      title: await page.title(), closed: page.isClosed(), viewport: page.viewport(),
      frameCount: frames.length, frames: frames.map(f => ({
        frameId: String(f._id || ''), url: f.url(),
        name: f.name(), parentFrameId: f.parentFrame() ? String(f.parentFrame()._id || '') : null
      }))
    };
    logger.log(JSON.stringify(output, null, 2));
    return output;
  }

  if (action === 'close') {
    if (pages.length <= 1) throw new Error('Refusing to close the last open browser tab.');
    await page.close({ runBeforeUnload: false });
    const oldFile = snapPath(snapshotKey);
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    const output = { status: 'SESSION_CLOSED', targetId: pageTargetId, remainingTabs: pages.length - 1 };
    logger.log(JSON.stringify(output));
    return output;
  }

  if (action === 'snapshot') {
    const raw = await inspectPage(page);
    const ax = await inspectAccessibility(page);
    const snapId = 's' + raw.timestamp.toString(36), refs = {};
    const records = raw.nodes.map((n, index) => {
      const ref = '@' + snapId + ':e' + (index + 1);
      refs[ref] = {
        locator: n.locator, frameId: n.frameId, frameUrl: n.frameUrl,
        fingerprint: fingerprint(n), role: n.role, name: n.name, tag: n.tag,
        clickable: n.clickable, editable: n.editable, focusable: n.focusable
      };
      return { ...n, ref, children: [] };
    });
    const roots = buildNodeTree(records);
    fs.writeFileSync(snapPath(snapshotKey), JSON.stringify({
      snapshotId: snapId, tab: snapshotKey,
      targetId: pageTargetId, url: raw.url, title: raw.title, timestamp: raw.timestamp,
      frames: raw.frames, refs
    }, null, 2), { mode: 0o600 });

    const output = {
      status: 'SNAPSHOT_OK', snapshotId: snapId, tab, tabIndex: tab,
      targetId: pageTargetId, url: raw.url, title: raw.title, nodeCount: records.length,
      complete: !raw.maxNodesReached && !raw.frameErrors.length,
      truncated: raw.maxNodesReached, limit: MAX_NODES, interactiveCount: records.filter(n => n.clickable || n.editable).length,
      domElementCount: raw.domElementCount, maxNodesReached: raw.maxNodesReached,
      frames: raw.frames, frameErrors: raw.frameErrors,
      accessibility: {
        totalNodes: ax.totalNodes, complete: ax.complete,
        frames: ax.frames.map(f => ({
          frameId: f.frameId, url: f.url, name: f.name, status: f.status,
          nodeCount: f.nodeCount, sourceNodeCount: f.sourceNodeCount, truncated: f.truncated, error: f.error, tree: f.tree
        }))
      },
      tree: roots.map(cleanTree)
    };
    logger.log(JSON.stringify(output, null, 2));
    return output;
  }

  if (action === 'accessibility' || action === 'ax') {
    const output = {
      status: 'ACCESSIBILITY_TREE', targetId: pageTargetId,
      accessibility: await inspectAccessibility(page)
    };
    logger.log(JSON.stringify(output, null, 2));
    return output;
  }

  if (action === 'wait-text' || action === 'wait-url') {
    const args = [refArg, ...rest].filter(x => x !== undefined);
    const last = args[args.length - 1];
    const timeout = args.length > 1 && Number(last) >= 100 && Number(last) <= 60000 ? Number(args.pop()) : 10000;
    const expected = args.join(' ').trim();
    if (!expected) throw new Error('Expected text or URL fragment is required.');
    if (action === 'wait-text') {
      await page.waitForFunction(needle => !!document.body && (document.body.innerText || '').includes(needle),
        { timeout }, expected);
    } else {
      await page.waitForFunction(part => location.href.includes(part), { timeout }, expected);
    }
    const output = {
      status: action === 'wait-text' ? 'TEXT_FOUND' : 'URL_MATCHED',
      targetId: pageTargetId, timeoutMs: timeout, characters: expected.length, url: page.url()
    };
    logger.log(JSON.stringify(output));
    return output;
  }

  if (action === 'screenshot') {
    const out = rest[0] || path.join(BASE, 'semantic-tab-' + tab + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: false });
    const output = { status: 'SCREENSHOT_SAVED', path: out, url: page.url() };
    logger.log(JSON.stringify(output));
    return output;
  }

  const file = snapPath(snapshotKey);
  if (!fs.existsSync(file)) throw new Error('No semantic snapshot for this tab. Run snapshot first.');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!refArg || !saved.refs[refArg]) throw new Error('Unknown ref. Take a new snapshot and use a current ref.');
  if (saved.tab !== snapshotKey || (saved.targetId && saved.targetId !== pageTargetId)) throw new Error('STALE_REF: browser target changed. Take a new snapshot for this tab.');
  if (saved.url !== page.url()) throw new Error('STALE_REF: page URL changed. Take a new snapshot.');
  const ref = saved.refs[refArg];
  const frame = page.frames().find(candidate => String(candidate._id || '') === String(ref.frameId || ''));
  if (!frame) throw new Error('STALE_REF: frame was detached or replaced. Take a new snapshot.');
  if (frame.url() !== ref.frameUrl) throw new Error('STALE_REF: frame URL changed. Take a new snapshot.');
  const handle = await resolveElement(frame, ref.locator);
  if (!handle) throw new Error('STALE_REF: DOM/shadow locator no longer resolves. Take a new snapshot.');
  const actual = await handle.evaluate(el => {
    const norm = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const type = (el.type || '').toLowerCase();
    const controlValue = (['submit', 'button', 'reset'].includes(type) && el.value) ? el.value : null;
    const name = norm(el.getAttribute('aria-label') ||
      (el.labels && Array.from(el.labels).map(x => norm(x.innerText || x.textContent)).filter(Boolean).join(' ')) ||
      controlValue || el.innerText || el.textContent || el.getAttribute('title'));
    return {
      tag: el.localName, roleAttr: el.getAttribute('role') || null, name,
      id: el.id || null, nameAttr: el.getAttribute('name') || null, type: el.getAttribute('type') || null,
      placeholder: el.getAttribute('placeholder') || null, href: el.href || null,
      autocomplete: el.getAttribute('autocomplete') || null, ariaLabel: el.getAttribute('aria-label') || null,
      visible: !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'),
      disabled: !!(('disabled' in el && el.disabled) || el.getAttribute('aria-disabled') === 'true'),
      readOnly: !!el.readOnly, value: ('value' in el) ? el.value : undefined,
      checked: ('checked' in el) ? !!el.checked : (el.getAttribute('aria-checked') === 'true')
    };
  });
  const expected = ref.fingerprint;
  const mismatch = fingerprintMismatch(actual, expected);
  if (mismatch) throw new Error('STALE_REF: target identity changed (' + mismatch + '). Take a fresh snapshot.');
  if (!actual.visible) throw new Error('Element is not visible.');
  if (actual.disabled && ['click', 'fill', 'type', 'check', 'select'].includes(action)) throw new Error('Element is disabled.');
  if (actual.readOnly && ['fill', 'type'].includes(action)) throw new Error('Element is read-only.');

  if (action === 'read') {
    const reported = { ...actual };
    const output = { status: 'READ_OK', ref: refArg, element: reported };
    logger.log(JSON.stringify(output, null, 2));
    return output;
  }
  if (action === 'click') {
    if (!ref.clickable) throw new Error('This ref is not marked clickable.');
    await page.bringToFront();
    await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
    const box = await handle.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) throw new Error('Element has no visible DOM box.');
    const hit = await handle.evaluate(el => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === el || el.contains(top));
    });
    if (!hit) throw new Error('CLICK_BLOCKED: another element covers the target center.');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await new Promise(resolve => setTimeout(resolve, 250));
    const output = { status: 'CLICK_SENT', ref: refArg, method: 'DOM-box hit test', url: page.url(), title: await page.title() };
    logger.log(JSON.stringify(output));
    return output;
  }
  if (action === 'fill' || action === 'type') {
    if (!ref.tag || (!['input', 'textarea'].includes(ref.tag) && !ref.role.match(/textbox|searchbox|combobox/)))
      throw new Error('Ref is not an editable field.');
    const useStdin = rest[0] === '--stdin' || stdinText !== null;
    const value = useStdin ? (stdinText !== null ? stdinText : fs.readFileSync(0, 'utf8')) : rest.join(' ');
    if (!value && action === 'type') throw new Error('Typed text must not be empty.');
    if (!useStdin && !value) throw new Error('Text is required (use --stdin to intentionally clear a field).');
    if (action === 'type') {
      await page.bringToFront();
      await handle.focus();
      await page.keyboard.type(value, { delay: 5 });
    } else {
      await handle.evaluate((el, text) => {
        if (el.isContentEditable) { el.focus(); el.textContent = text; }
        else {
          const proto = el.localName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (!setter) throw new Error('No native value setter.');
          setter.call(el, text);
        }
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
    }
    const after = await handle.evaluate(el => (('value' in el) ? el.value : el.innerText));
    if (String(after) !== value) throw new Error('STATE_UNVERIFIED: field value did not match requested text.');
    const output = { status: action.toUpperCase() + '_VERIFIED', ref: refArg, characters: value.length };
    logger.log(JSON.stringify(output));
    return output;
  }
  if (action === 'press') {
    const key = rest.join(' '); if (!key) throw new Error('Key is required.');
    await page.bringToFront(); await handle.focus(); await page.keyboard.press(key);
    const output = { status: 'KEY_SENT', ref: refArg, key };
    logger.log(JSON.stringify(output));
    return output;
  }
  if (action === 'check' || action === 'uncheck') {
    if (!['checkbox', 'radio', 'switch'].includes(ref.role)) throw new Error('Ref is not a checkbox, radio, or switch.');
    const wanted = action === 'check';
    if (actual.checked !== wanted) {
      await page.bringToFront();
      await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
      const box = await handle.boundingBox();
      if (!box || box.width <= 0 || box.height <= 0) throw new Error('Checkbox has no visible DOM box.');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    const checked = await handle.evaluate(el => ('checked' in el) ? !!el.checked : el.getAttribute('aria-checked') === 'true');
    if (checked !== wanted) throw new Error('STATE_UNVERIFIED: checked state did not match.');
    const output = { status: 'STATE_VERIFIED', ref: refArg, checked };
    logger.log(JSON.stringify(output));
    return output;
  }
  if (action === 'select') {
    if (ref.tag !== 'select' && !['combobox', 'listbox'].includes(ref.role)) throw new Error('Ref is not a select/listbox.');
    const value = rest.join(' '); if (!value) throw new Error('Option value is required.');
    const selected = await handle.select(value);
    const verified = await handle.evaluate(el => Array.from(el.selectedOptions || []).map(o => o.value));
    if (!verified.includes(value)) throw new Error('STATE_UNVERIFIED: requested option is not selected.');
    const output = { status: 'SELECTED_VERIFIED', ref: refArg, selected: verified };
    logger.log(JSON.stringify(output));
    return output;
  }

  throw new Error('Unknown command: ' + action);
}

module.exports = {
  executeAction,
  inspectFrame,
  inspectPage,
  inspectAccessibility,
  resolveElement,
  resolvePage,
  cleanTree,
  snapPath,
  targetIdOf,
  ensureCdp,
  BASE,
  CDP_URL,
  CDP_PORT
};
