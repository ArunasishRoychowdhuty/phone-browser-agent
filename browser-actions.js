'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { fingerprint, fingerprintMismatch, normalizeText } = require('./semantic-core');
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
    isContentEditable: n.isContentEditable, customDropdown: n.customDropdown,
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
    const inViewport = rect => {
      return rect.bottom > 0 && rect.right > 0 &&
        rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
        rect.left < (window.innerWidth || document.documentElement.clientWidth);
    };
    const roleOf = el => {
      const explicit = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
      if (explicit) return explicit;
      const tag = el.localName, type = (el.getAttribute('type') || '').toLowerCase();
      if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '') return 'textbox';
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
      if (tag === 'dialog') return 'dialog';
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
    const structuralRoles = new Set(['main', 'navigation', 'banner', 'contentinfo', 'form', 'dialog', 'list',
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
        if (scanned > maxScan) { truncated = true; return; }
        const isVisible = visible(el);
        if (isVisible) {
          const role = roleOf(el), tag = el.localName, type = (el.getAttribute('type') || '').toLowerCase();
          const isContentEditable = Boolean(el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '');
          const isCustomDropdown = Boolean(role === 'combobox' || role === 'listbox' || el.getAttribute('aria-haspopup') === 'listbox' || el.getAttribute('aria-haspopup') === 'true');
          const editable = (['input', 'textarea'].includes(tag) && type !== 'hidden' &&
            !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'].includes(type)) ||
            isContentEditable || ['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(role);
          const clickable = clickRoles.has(role) || ['a', 'button', 'summary'].includes(tag) ||
            (tag === 'input' && ['button', 'submit', 'reset', 'image', 'checkbox', 'radio', 'file'].includes(type)) ||
            tag === 'label' || el.hasAttribute('onclick') || isCustomDropdown;
          const childElements = Array.from(el.children).filter(visible);
          let name = nameOf(el);
          if (childElements.length > 0 && structuralRoles.has(role) && !el.getAttribute('aria-label') && !el.getAttribute('title')) name = '';
          const semantic = clickable || editable || structuralRoles.has(role) || Boolean(el.shadowRoot) ||
            (name && childElements.length === 0 && !['script', 'style', 'noscript'].includes(tag));

          if (semantic) {
            const locator = locatorOf(el), key = JSON.stringify(locator);
            if (locator.length && !seen.has(key)) {
              seen.add(key);

              // Adaptive scoring for large-page intelligent truncation
              let rect = { top: 0, left: 0, bottom: 0, right: 0 };
              try { rect = el.getBoundingClientRect(); } catch {}
              const isView = inViewport(rect);
              let score = 20; // default base score
              if (isView && (clickable || editable)) score = 100;
              else if (clickable || editable) score = 80;
              else if (isView && structuralRoles.has(role)) score = 60;
              else if (structuralRoles.has(role)) score = 40;

              const attributes = {
                id: el.id || undefined, nameAttr: el.getAttribute('name') || undefined,
                type: el.getAttribute('type') || undefined, placeholder: el.getAttribute('placeholder') || undefined,
                href: el.href || undefined, title: el.getAttribute('title') || undefined,
                roleAttr: el.getAttribute('role') || undefined, autocomplete: el.getAttribute('autocomplete') || undefined,
                contenteditable: isContentEditable ? 'true' : undefined
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
                score,
                locator, parentLocator: parent ? locatorOf(parent) : null, tag, role, name, text: name,
                value: ('value' in el) ? norm(el.value) : (isContentEditable ? norm(el.innerText || el.textContent) : undefined),
                attributes, state, clickable: Boolean(clickable), editable: Boolean(editable), focusable,
                isContentEditable, customDropdown: isCustomDropdown, visible: true
              });
            }
          }
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);

    // Adaptive pruning: if candidates exceed maxNodes, keep highest scored elements
    let sortedNodes = candidates;
    if (candidates.length > maxNodes) {
      truncated = true;
      sortedNodes = candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, maxNodes);
    }

    return {
      url: location.href, title: document.title, timestamp: Date.now(), domElementCount: scanned,
      maxNodesReached: truncated, nodes: sortedNodes
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

async function inspectAccessibility(page, snapId = 'ax') {
  const results = [];
  const axRefs = {};
  let remaining = MAX_AX_NODES;

  for (const frame of page.frames()) {
    const frameId = String(frame._id || '');
    const info = { frameId, url: frame.url(), name: frame.name() };
    try {
      if (!frameId) throw new Error('Chrome frame ID unavailable.');
      const client = frame.client || (await page.target().createCDPSession());
      await client.send('Accessibility.enable').catch(() => { });
      if (remaining <= 0) {
        results.push({ ...info, status: 'LIMIT_REACHED', error: 'Page-wide AX node limit reached.', nodeCount: 0, tree: [] });
        continue;
      }
      const response = await client.send('Accessibility.getFullAXTree', { frameId });
      const rawNodes = response.nodes || [];
      const built = buildAccessibilityTree(rawNodes, remaining);

      // Attach actionable references to interactive AX nodes
      const actionableRoles = new Set([
        'button', 'link', 'checkbox', 'radio', 'switch', 'tab',
        'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
        'combobox', 'listbox', 'textbox', 'searchbox', 'spinbutton',
        'slider', 'treeitem', 'gridcell'
      ]);
      function tagAxRefs(nodes) {
        for (const n of nodes) {
          if (n.backendDOMNodeId && actionableRoles.has(n.role)) {
            const ref = '@ax:' + snapId + ':n' + n.nodeId;
            n.ref = ref;
            axRefs[ref] = {
              ref,
              nodeId: n.nodeId,
              backendDOMNodeId: n.backendDOMNodeId,
              role: n.role,
              name: n.name,
              frameId,
              frameUrl: info.url
            };
          }
          if (n.children && n.children.length) tagAxRefs(n.children);
        }
      }
      tagAxRefs(built.tree);

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
    frames: results,
    totalNodes: results.reduce((sum, x) => sum + (x.nodeCount || 0), 0),
    complete: results.length > 0 && results.every(x => x.status === 'OK' && !x.truncated),
    axRefs
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
  if (!pages || !pages.length) throw new Error('No open browser pages found.');
  const rawTab = String(tabArg ?? '');
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

async function waitForTextInFrames(page, expected, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const frame of page.frames()) {
      try {
        const found = await frame.evaluate(needle => {
          const body = document.body || document.documentElement;
          return body ? (body.innerText || body.textContent || '').includes(needle) : false;
        }, expected);
        if (found) {
          return {
            found: true,
            frameId: String(frame._id || ''),
            frameUrl: frame.url(),
            isIframe: frame !== page.mainFrame()
          };
        }
      } catch {}
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for text "${expected}" across ${page.frames().length} frames after ${timeoutMs}ms.`);
}

async function waitForUrlInFrames(page, expected, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const frame of page.frames()) {
      if (frame.url().includes(expected)) {
        return {
          matched: true,
          frameId: String(frame._id || ''),
          frameUrl: frame.url(),
          isIframe: frame !== page.mainFrame()
        };
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for URL containing "${expected}" across ${page.frames().length} frames after ${timeoutMs}ms.`);
}

async function executeAction(browser, payload, logger = console) {
  const { action, tabArg, refArg, rest = [], stdinText = null, isSemantic = false } = payload;
  const pages = await browser.pages();

  // 1. ISOLATED BROWSER CONTEXT & SESSION LIFECYCLE (Item 8)
  if (action === 'context-new') {
    const url = String(tabArg || rest[0] || '');
    if (url && !/^https?:\/\//i.test(url)) throw new Error('Only http(s) URLs are allowed for new context.');
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const output = {
      status: 'CONTEXT_CREATED',
      contextId: context.id || 'ctx_' + Date.now().toString(36),
      targetId: targetIdOf(page),
      url: page.url(),
      title: await page.title()
    };
    logger.log(JSON.stringify(output, null, 2));
    return output;
  }

  if (action === 'context-list') {
    const contexts = browser.browserContexts();
    const list = [];
    for (let i = 0; i < contexts.length; i++) {
      const c = contexts[i];
      const cPages = await c.pages();
      list.push({
        contextIndex: i,
        contextId: c.id || (i === 0 ? 'default' : null),
        isDefault: c.isIncognito ? !c.isIncognito() : (i === 0),
        pageCount: cPages.length,
        pages: cPages.map(p => ({ targetId: targetIdOf(p), url: p.url() }))
      });
    }
    const output = { status: 'CONTEXTS_LIST', count: list.length, contexts: list };
    logger.log(JSON.stringify(output, null, 2));
    return output;
  }

  if (action === 'context-close') {
    const contexts = browser.browserContexts();
    const requested = String(tabArg || rest[0] || '1');
    let idx = contexts.findIndex((context, index) =>
      index > 0 && context.id && String(context.id) === requested
    );

    // Backward compatibility: accept a numeric context index.
    if (idx < 0 && /^\d+$/.test(requested)) idx = Number(requested);

    if (!Number.isInteger(idx) || idx <= 0 || idx >= contexts.length) {
      throw new Error('Refusing to close default context or unknown context ID/index: ' + requested);
    }

    const contextId = contexts[idx].id || null;
    await contexts[idx].close();
    const output = {
      status: 'CONTEXT_CLOSED',
      contextId,
      contextIndex: idx,
      remainingContexts: contexts.length - 1
    };
    logger.log(JSON.stringify(output));
    return output;
  }

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

        // Android / Unicode typing enhancement (Item 9)
        await page.focus(selector);
        if (/[^\x00-\x7F]/.test(value)) {
          const client = page.client || (await page.target().createCDPSession());
          await client.send('Input.insertText', { text: value });
        } else {
          await page.type(selector, value, { delay: 5 });
        }
        logger.log(JSON.stringify({ status: 'TYPED', tab: tabIndex, selector, characters: value.length, url: page.url() }));
        return { status: 'TYPED', tab: tabIndex, selector, characters: value.length, url: page.url() };
      }
      case 'fill': {
        const selector = rest.shift();
        if (!selector || (rest.length === 0 && stdinText === null)) throw new Error('CSS selector and text are required.');
        await page.bringToFront();
        await page.waitForSelector(selector, { visible: true });
        const value = stdinText !== null ? stdinText : (rest[0] === '--stdin' ? stdinText : rest.join(' '));
        await page.$eval(selector, (el, text) => {
          if (el.isContentEditable) {
            el.focus();
            el.innerText = text;
          } else {
            const proto = el.localName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (!setter) throw new Error('No native value setter for ' + el.localName);
            setter.call(el, text);
          }
          try {
            if (typeof InputEvent !== 'undefined') {
              el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
            } else if (typeof Event !== 'undefined') {
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } catch {}
          try {
            if (typeof Event !== 'undefined') {
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } catch {}
        }, value);
        const actual = await page.$eval(selector, el => ('value' in el ? el.value : el.innerText));
        if (String(actual) !== value) throw new Error('CSS fill verification failed: value mismatch');
        logger.log(JSON.stringify({ status: 'FILLED', tab: tabIndex, selector, characters: value.length, url: page.url() }));
        return { status: 'FILLED', tab: tabIndex, selector, characters: value.length, url: page.url() };
      }
      case 'read': {
        const selector = rest.join(' ');
        if (!selector) throw new Error('CSS selector required.');
        await page.waitForSelector(selector, { visible: true });
        const value = await page.$eval(selector, el => ({
          tag: el.localName,
          type: el.type || undefined,
          value: ('value' in el) ? el.value : undefined,
          text: (el.innerText || el.textContent || '').trim().slice(0, 1000),
          checked: ('checked' in el) ? el.checked : undefined,
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
    const snapId = 's' + Date.now().toString(36);
    const raw = await inspectPage(page);
    const ax = await inspectAccessibility(page, snapId);
    const refs = {};

    const records = raw.nodes.map((n, index) => {
      const ref = '@' + snapId + ':e' + (index + 1);
      refs[ref] = {
        locator: n.locator, frameId: n.frameId, frameUrl: n.frameUrl,
        fingerprint: fingerprint(n), role: n.role, name: n.name, tag: n.tag,
        clickable: n.clickable, editable: n.editable, focusable: n.focusable,
        isContentEditable: n.isContentEditable, customDropdown: n.customDropdown
      };
      return { ...n, ref, children: [] };
    });
    const roots = buildNodeTree(records);

    // Save snapshot with both DOM refs and Actionable AX refs (Item 5)
    fs.writeFileSync(snapPath(snapshotKey), JSON.stringify({
      snapshotId: snapId, tab: snapshotKey,
      targetId: pageTargetId, url: raw.url, title: raw.title, timestamp: raw.timestamp,
      frames: raw.frames, refs, axRefs: ax.axRefs || {}
    }, null, 2), { mode: 0o600 });

    const output = {
      status: 'SNAPSHOT_OK', snapshotId: snapId, tab, tabIndex: tab,
      targetId: pageTargetId, url: raw.url, title: raw.title, nodeCount: records.length,
      complete: !raw.maxNodesReached && !raw.frameErrors.length,
      truncated: raw.maxNodesReached, limit: MAX_NODES,
      interactiveCount: records.filter(n => n.clickable || n.editable).length,
      axInteractiveCount: Object.keys(ax.axRefs || {}).length,
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
      accessibility: await inspectAccessibility(page, 'ax')
    };
    logger.log(JSON.stringify(output, null, 2));
    return output;
  }

  // IFRAME-AWARE WAIT-TEXT & WAIT-URL (Item 6)
  if (action === 'wait-text' || action === 'wait-url') {
    const args = [refArg, ...rest].filter(x => x !== undefined);
    const last = args[args.length - 1];
    const timeout = args.length > 1 && Number(last) >= 100 && Number(last) <= 60000 ? Number(args.pop()) : 10000;
    const expected = args.join(' ').trim();
    if (!expected) throw new Error('Expected text or URL fragment is required.');

    let matchInfo;
    if (action === 'wait-text') {
      matchInfo = await waitForTextInFrames(page, expected, timeout);
    } else {
      matchInfo = await waitForUrlInFrames(page, expected, timeout);
    }

    const output = {
      status: action === 'wait-text' ? 'TEXT_FOUND' : 'URL_MATCHED',
      targetId: pageTargetId, timeoutMs: timeout, characters: expected.length,
      frameId: matchInfo.frameId, frameUrl: matchInfo.frameUrl, isIframe: matchInfo.isIframe, url: page.url()
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

  // SEMANTIC REF RESOLUTION (DOM REFS & AX REFS)
  const file = snapPath(snapshotKey);
  if (!fs.existsSync(file)) throw new Error('No semantic snapshot for this tab. Run snapshot first.');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));

  let ref = null;
  let isAxRef = false;
  let handle = null;
  let frame = null;

  if (refArg && refArg.startsWith('@ax:')) {
    // Actionable AX Reference Resolution (Item 5)
    isAxRef = true;
    if (saved.tab !== snapshotKey || (saved.targetId && saved.targetId !== pageTargetId)) {
      throw new Error('STALE_REF: accessibility snapshot belongs to a different browser target. Take a fresh snapshot.');
    }
    if (saved.url !== page.url()) {
      throw new Error('STALE_REF: page URL changed since the accessibility snapshot. Take a fresh snapshot.');
    }

    const axRef = (saved.axRefs || {})[refArg];
    if (!axRef || !axRef.backendDOMNodeId) {
      throw new Error('Unknown or non-actionable AX ref: ' + refArg + '. Run snapshot to generate current AX refs.');
    }
    frame = page.frames().find(candidate => String(candidate._id || '') === String(axRef.frameId || ''));
    if (!frame) throw new Error('STALE_REF: accessibility frame was detached or replaced. Take a fresh snapshot.');
    if (frame.url() !== axRef.frameUrl) {
      throw new Error('STALE_REF: accessibility frame URL changed. Take a fresh snapshot.');
    }

    try {
      // Adopt the backend node into this frame's main realm. Passing the raw CDP
      // RemoteObject to evaluateHandle would serialize it as a plain object.
      const adopted = await frame.mainRealm().adoptBackendNode(axRef.backendDOMNodeId);
      handle = adopted.asElement();
      if (!handle) {
        await adopted.dispose();
        throw new Error('AX backend node did not resolve to an element.');
      }
    } catch (err) {
      throw new Error('STALE_REF: AX node element is no longer attached in DOM (' + err.message + '). Take a fresh snapshot.');
    }
    ref = {
      role: axRef.role,
      name: axRef.name,
      tag: 'ax-element',
      clickable: true,
      editable: ['textbox', 'searchbox', 'combobox'].includes(axRef.role),
      fingerprint: { name: axRef.name }
    };
  } else {
    // Standard DOM Snapshot Reference Resolution
    if (!refArg || !saved.refs[refArg]) throw new Error('Unknown ref. Take a new snapshot and use a current ref.');
    if (saved.tab !== snapshotKey || (saved.targetId && saved.targetId !== pageTargetId)) throw new Error('STALE_REF: browser target changed. Take a new snapshot for this tab.');
    if (saved.url !== page.url()) throw new Error('STALE_REF: page URL changed. Take a new snapshot.');
    ref = saved.refs[refArg];
    frame = page.frames().find(candidate => String(candidate._id || '') === String(ref.frameId || ''));
    if (!frame) throw new Error('STALE_REF: frame was detached or replaced. Take a new snapshot.');
    if (frame.url() !== ref.frameUrl) throw new Error('STALE_REF: frame URL changed. Take a new snapshot.');
    handle = await resolveElement(frame, ref.locator);
    if (!handle) throw new Error('STALE_REF: DOM/shadow locator no longer resolves. Take a new snapshot.');
  }

  // Pre-action state snapshot for automatic verification (Item 4)
  const preState = {
    url: page.url(),
    title: await page.title(),
    activeTag: await page.evaluate(() => document.activeElement ? document.activeElement.localName : null)
  };

  const actual = await handle.evaluate(el => {
    const norm = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const type = (el.type || '').toLowerCase();
    const controlValue = (['submit', 'button', 'reset'].includes(type) && el.value) ? el.value : null;
    const name = norm(el.getAttribute('aria-label') ||
      (el.labels && Array.from(el.labels).map(x => norm(x.innerText || x.textContent)).filter(Boolean).join(' ')) ||
      controlValue || el.innerText || el.textContent || el.getAttribute('title'));
    const isContentEditable = Boolean(el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '');
    const isCustomDropdown = Boolean(el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'listbox' || el.getAttribute('aria-haspopup') === 'listbox');

    return {
      tag: el.localName, roleAttr: el.getAttribute('role') || null, name,
      id: el.id || null, nameAttr: el.getAttribute('name') || null, type: el.getAttribute('type') || null,
      placeholder: el.getAttribute('placeholder') || null, href: el.href || null,
      autocomplete: el.getAttribute('autocomplete') || null, ariaLabel: el.getAttribute('aria-label') || null,
      visible: !!(el.getClientRects().length && (typeof getComputedStyle !== 'undefined' ? (getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none') : true)),
      disabled: !!(('disabled' in el && el.disabled) || el.getAttribute('aria-disabled') === 'true'),
      readOnly: !!el.readOnly, value: ('value' in el) ? el.value : (isContentEditable ? el.innerText : undefined),
      checked: ('checked' in el) ? !!el.checked : (el.getAttribute('aria-checked') === 'true'),
      isContentEditable,
      isCustomDropdown
    };
  });

  if (!isAxRef) {
    const expected = ref.fingerprint;
    const mismatch = fingerprintMismatch(actual, expected);
    if (mismatch) throw new Error('STALE_REF: target identity changed (' + mismatch + '). Take a fresh snapshot.');
  }

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
    if (!ref.clickable && !actual.isCustomDropdown) throw new Error('This ref is not marked clickable.');
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

    // Dispatching a click is not proof that the intended business action completed.
    // Report observable navigation/title changes, but require a postcondition check
    // (wait-text, wait-url, or a fresh snapshot) before claiming success.
    const postUrl = page.url();
    const postTitle = await page.title();
    const urlChanged = preState.url !== postUrl;
    const titleChanged = preState.title !== postTitle;
    const output = {
      status: 'CLICK_SENT', ref: refArg, method: 'DOM-box hit test', url: postUrl, title: postTitle,
      verification: {
        verified: false,
        dispatched: true,
        urlChanged,
        titleChanged,
        currentUrl: postUrl,
        nextStep: 'Check the expected result with wait-text, wait-url, or a fresh snapshot.'
      }
    };
    logger.log(JSON.stringify(output));
    return output;
  }

  if (action === 'fill' || action === 'type') {
    const isEditable = actual.isContentEditable || ref.isContentEditable ||
      Boolean(ref.tag && ['input', 'textarea'].includes(ref.tag)) ||
      Boolean(ref.role && ref.role.match(/textbox|searchbox|combobox/));

    if (!isEditable) throw new Error('Ref is not an editable field or contenteditable element.');

    const useStdin = rest[0] === '--stdin' || stdinText !== null;
    const value = useStdin ? (stdinText !== null ? stdinText : fs.readFileSync(0, 'utf8')) : rest.join(' ');
    if (!value && action === 'type') throw new Error('Typed text must not be empty.');
    if (!useStdin && !value) throw new Error('Text is required (use --stdin to intentionally clear a field).');

    await page.bringToFront();
    await handle.focus();

    if (action === 'type') {
      // Android & Unicode Input Handling (Item 9)
      if (/[^\x00-\x7F]/.test(value)) {
        try {
          const client = frame.client || (await page.target().createCDPSession());
          await client.send('Input.insertText', { text: value });
        } catch {
          await page.keyboard.type(value, { delay: 5 });
        }
      } else {
        await page.keyboard.type(value, { delay: 5 });
      }
    } else {
      // Contenteditable & Standard Native Fill (Item 2)
      await handle.evaluate((el, text) => {
        if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '') {
          el.focus();
          el.innerText = text;
        } else {
          const proto = el.localName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (!setter) throw new Error('No native value setter.');
          setter.call(el, text);
        }
        try {
          if (typeof InputEvent !== 'undefined') {
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
          } else if (typeof Event !== 'undefined') {
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch {}
        try {
          if (typeof Event !== 'undefined') {
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } catch {}
      }, value);
    }

    // Verify value
    const after = await handle.evaluate(el => (('value' in el) ? el.value : (el.innerText || el.textContent)));
    if (String(after).trim() !== value.trim()) {
      throw new Error('STATE_UNVERIFIED: field value did not match requested text.');
    }

    const output = {
      status: action.toUpperCase() + '_VERIFIED', ref: refArg, characters: value.length,
      verification: {
        verified: true,
        action,
        matchedValue: true,
        currentValue: String(after).trim()
      }
    };
    logger.log(JSON.stringify(output));
    return output;
  }

  if (action === 'press') {
    const key = rest.join(' '); if (!key) throw new Error('Key is required.');
    await page.bringToFront(); await handle.focus(); await page.keyboard.press(key);
    await new Promise(r => setTimeout(r, 150));
    const output = {
      status: 'KEY_SENT', ref: refArg, key,
      verification: {
        verified: false,
        dispatched: true,
        keySent: key,
        url: page.url(),
        nextStep: 'Check the resulting page or control state with a fresh snapshot.'
      }
    };
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
      await new Promise(r => setTimeout(r, 150));
    }
    const checked = await handle.evaluate(el => ('checked' in el) ? !!el.checked : el.getAttribute('aria-checked') === 'true');
    if (checked !== wanted) throw new Error('STATE_UNVERIFIED: checked state did not match.');
    const output = {
      status: 'STATE_VERIFIED', ref: refArg, checked,
      verification: { verified: true, checked }
    };
    logger.log(JSON.stringify(output));
    return output;
  }

  // CUSTOM DROPDOWN & NATIVE SELECT SUPPORT (Item 2)
  if (action === 'select') {
    const isNativeSelect = actual.tag === 'select';
    const isCustom = actual.isCustomDropdown || ref.customDropdown || ['combobox', 'listbox'].includes(ref.role);

    if (!isNativeSelect && !isCustom) {
      throw new Error('Ref is not a native select or custom dropdown element.');
    }

    const value = rest.join(' ');
    if (!value) throw new Error('Option value or text is required.');

    if (isNativeSelect) {
      await handle.select(value);
      const verified = await handle.evaluate(el => Array.from(el.selectedOptions || []).map(o => o.value));
      if (!verified.includes(value)) throw new Error('STATE_UNVERIFIED: requested option is not selected.');
      const output = {
        status: 'SELECTED_VERIFIED', ref: refArg, selected: verified,
        verification: { verified: true, type: 'native-select', selected: verified }
      };
      logger.log(JSON.stringify(output));
      return output;
    } else {
      // Custom Dropdown Workflow (click trigger -> wait options -> click option -> verify)
      await page.bringToFront();
      const expanded = await handle.evaluate(el => el.getAttribute('aria-expanded') === 'true');
      if (!expanded) {
        await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
        await handle.click();
        await new Promise(r => setTimeout(r, 250));
      }

      const optionHandle = await frame.evaluateHandle((needle) => {
        const norm = s => String(s || '').trim().toLowerCase();
        const search = norm(needle);
        const candidates = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li, .dropdown-item, [data-value]'));
        for (const opt of candidates) {
          const val = norm(opt.getAttribute('data-value') || opt.getAttribute('value') || '');
          const txt = norm(opt.innerText || opt.textContent || '');
          if (val === search || txt === search || txt.includes(search)) return opt;
        }
        return null;
      }, value);

      const optionEl = optionHandle.asElement();
      if (!optionEl) {
        await optionHandle.dispose();
        throw new Error(`Custom dropdown option "${value}" not found in open menu.`);
      }

      const optionBefore = await optionEl.evaluate(el => ({
        text: String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
        value: el.getAttribute('data-value') || el.getAttribute('value') || '',
        selected: el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true',
        label: el.getAttribute('aria-label') || ''
      }));
      await optionEl.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
      await optionEl.click();
      await new Promise(r => setTimeout(r, 200));

      const optionAfter = await optionEl.evaluate(el => ({
        selected: el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true',
        classTokens: Array.from(el.classList || []).map(token => String(token).toLowerCase())
      })).catch(() => null);
      const triggerAfter = await handle.evaluate(el => ({
        value: ('value' in el) ? String(el.value || '') : '',
        text: String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
        ariaValueText: el.getAttribute('aria-valuetext') || '',
        expanded: el.getAttribute('aria-expanded')
      }));
      await optionHandle.dispose();

      const normalize = text => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const requested = normalize(value);
      const optionLabel = normalize(optionBefore.label || optionBefore.text || optionBefore.value);
      const triggerText = normalize([triggerAfter.value, triggerAfter.text, triggerAfter.ariaValueText].join(' '));
      const selectedClassTokens = new Set(['selected', 'active', 'checked', 'is-selected', 'is-active']);
      const optionClassSelected = Boolean(optionAfter && optionAfter.classTokens.some(token => selectedClassTokens.has(token)));
      const triggerValue = normalize(triggerAfter.value);
      const triggerLabel = normalize(triggerAfter.ariaValueText);
      const triggerTextMatches = Boolean(
        (optionLabel && (triggerText === optionLabel || triggerLabel === optionLabel)) ||
        (requested && (triggerValue === requested || triggerText === requested || triggerLabel === requested))
      );
      const verified = Boolean((optionAfter && optionAfter.selected) || optionClassSelected || triggerTextMatches);

      const output = {
        status: verified ? 'CUSTOM_DROPDOWN_SELECTED' : 'CUSTOM_DROPDOWN_ACTION_SENT',
        ref: refArg, selected: value,
        verification: {
          verified,
          type: 'custom-dropdown',
          selected: verified ? (optionBefore.label || optionBefore.text || value) : null,
          optionStillVisible: Boolean(optionAfter),
          triggerExpanded: triggerAfter.expanded
        }
      };
      logger.log(JSON.stringify(output));
      return output;
    }
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
  waitForTextInFrames,
  waitForUrlInFrames,
  ensureCdp,
  BASE,
  CDP_URL,
  CDP_PORT
};
