'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { executeAction, BASE } = require('../browser-actions');

test('executeAction handles contenteditable elements and automatic verification', async () => {
  let innerTextVal = 'Original Rich Text';
  const mockElement = {
    localName: 'div',
    getAttribute: (attr) => attr === 'aria-label' ? 'Editor body' : (attr === 'contenteditable' ? 'true' : null),
    isContentEditable: true,
    getClientRects: () => [{ width: 200, height: 50 }],
    focus: () => {},
    scrollIntoView: () => {},
    boundingBox: async () => ({ x: 10, y: 10, width: 200, height: 50 }),
    evaluate: async (fn, arg) => {
      if (typeof fn === 'function') {
        const fakeEl = {
          localName: 'div',
          isContentEditable: true,
          getAttribute: (attr) => attr === 'aria-label' ? 'Editor body' : (attr === 'contenteditable' ? 'true' : null),
          innerText: innerTextVal,
          focus: () => {},
          dispatchEvent: () => {},
          getClientRects: () => [{ width: 200, height: 50 }]
        };
        const res = fn(fakeEl, arg);
        if (arg !== undefined) innerTextVal = arg;
        return res !== undefined ? res : (('value' in fakeEl) ? fakeEl.value : innerTextVal);
      }
      return innerTextVal;
    }
  };

  const mockFrame = {
    _id: 'frame_1',
    url: () => 'https://example.com/editor',
    client: { send: async () => {} },
    evaluateHandle: async () => ({
      asElement: () => mockElement,
      dispose: async () => {}
    })
  };

  const targetHex = '11223344-5566-7788-99aa-bbccddeeff00';
  const mockPage = {
    target: () => ({ _targetId: targetHex }),
    url: () => 'https://example.com/editor',
    title: async () => 'Rich Text Editor',
    frames: () => [mockFrame],
    mainFrame: () => mockFrame,
    bringToFront: async () => {},
    setDefaultTimeout: () => {},
    evaluate: async () => 'div'
  };

  const mockBrowser = {
    pages: async () => [mockPage]
  };

  // Mock snapshot file
  fs.mkdirSync(BASE, { recursive: true });
  const snapFile = path.join(BASE, 'semantic-snapshot-target-' + targetHex + '.json');
  fs.writeFileSync(snapFile, JSON.stringify({
    snapshotId: 's_test_1',
    tab: 'target-' + targetHex,
    targetId: targetHex,
    url: 'https://example.com/editor',
    title: 'Rich Text Editor',
    refs: {
      '@s_test_1:e1': {
        locator: ['div.ProseMirror'],
        frameId: 'frame_1',
        frameUrl: 'https://example.com/editor',
        role: 'textbox',
        name: 'Editor body',
        tag: 'div',
        isContentEditable: true,
        clickable: true,
        editable: true,
        fingerprint: {
          tag: 'div',
          roleAttr: null,
          name: 'Editor body',
          id: null,
          nameAttr: null,
          type: null,
          placeholder: null,
          href: null,
          autocomplete: null,
          isContentEditable: true
        }
      }
    }
  }));

  const dummyLogger = { log: () => {} };

  // 1. Fill contenteditable with Unicode text (Bangla + English)
  const res = await executeAction(mockBrowser, {
    action: 'fill',
    tabArg: 'target:' + targetHex,
    refArg: '@s_test_1:e1',
    rest: ['আমার সোনার বাংলা — Hello ERA'],
    isSemantic: true
  }, dummyLogger);

  assert.equal(res.status, 'FILL_VERIFIED');
  assert.equal(res.verification.verified, true);
  assert.equal(res.verification.matchedValue, true);
  assert.equal(res.verification.currentValue, 'আমার সোনার বাংলা — Hello ERA');

  // Clean up mock snapshot file
  try { fs.unlinkSync(snapFile); } catch {}
});
