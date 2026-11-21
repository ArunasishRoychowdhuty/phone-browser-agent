'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { executeAction, inspectAccessibility, BASE } = require('../browser-actions');

function makeElementHandle() {
  const attrs = { role: 'button', 'aria-label': 'Submit' };
  const el = {
    localName: 'button',
    type: 'button',
    id: 'submit',
    name: '',
    value: '',
    readOnly: false,
    disabled: false,
    labels: [],
    innerText: 'Submit',
    textContent: 'Submit',
    isContentEditable: false,
    getAttribute: name => attrs[name] || null,
    getClientRects: () => [{ width: 90, height: 32 }]
  };
  return {
    evaluate: async fn => fn(el),
    dispose: async () => {},
    focus: async () => {},
    boundingBox: async () => ({ x: 0, y: 0, width: 90, height: 32 })
  };
}

function makePage(targetId, url, frame, handle, adoptedIds) {
  const page = {
    target: () => ({ _targetId: targetId }),
    url: () => url,
    title: async () => 'AX test page',
    frames: () => [frame],
    mainFrame: () => frame,
    setDefaultTimeout: () => {},
    evaluate: async () => null
  };
  frame.mainRealm = () => ({
    adoptBackendNode: async backendNodeId => {
      adoptedIds.push(backendNodeId);
      return {
        asElement: () => handle,
        dispose: async () => {}
      };
    }
  });
  return page;
}

test('AX reference uses Puppeteer backend-node adoption and reads the actual element', async () => {
  const targetId = 'aabb1234-5566-7788-99aa-bbccddeeff00';
  const url = 'https://example.com/ax';
  const frameId = 'frame-ax-1';
  const ref = '@ax:s_ax_test:nbutton';
  const snapshotKey = 'target-' + targetId;
  const snapshotPath = path.join(BASE, 'semantic-snapshot-' + snapshotKey + '.json');
  const adoptedIds = [];
  const handle = makeElementHandle();
  const frame = {
    _id: frameId,
    url: () => url,
    name: () => '',
    parentFrame: () => null
  };
  const page = makePage(targetId, url, frame, handle, adoptedIds);

  fs.mkdirSync(BASE, { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify({
    snapshotId: 's_ax_test',
    tab: snapshotKey,
    targetId,
    url,
    axRefs: {
      [ref]: {
        ref,
        backendDOMNodeId: 987,
        role: 'button',
        name: 'Submit',
        frameId,
        frameUrl: url
      }
    },
    refs: {}
  }));

  try {
    const result = await executeAction({ pages: async () => [page] }, {
      action: 'read',
      tabArg: 'target:' + targetId,
      refArg: ref,
      rest: [],
      isSemantic: true
    }, { log: () => {} });

    assert.equal(result.status, 'READ_OK');
    assert.equal(result.element.name, 'Submit');
    assert.deepEqual(adoptedIds, [987]);
  } finally {
    try { fs.unlinkSync(snapshotPath); } catch {}
  }
});

test('AX reference rejects a page URL change before resolving the node', async () => {
  const targetId = '22334455-6677-8899-aabb-ccddeeff0011';
  const ref = '@ax:s_ax_stale:nbutton';
  const snapshotKey = 'target-' + targetId;
  const snapshotPath = path.join(BASE, 'semantic-snapshot-' + snapshotKey + '.json');
  const adoptedIds = [];
  const handle = makeElementHandle();
  const frame = {
    _id: 'frame-stale',
    url: () => 'https://example.com/new-url',
    name: () => '',
    parentFrame: () => null
  };
  const page = makePage(targetId, 'https://example.com/new-url', frame, handle, adoptedIds);
  fs.mkdirSync(BASE, { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify({
    snapshotId: 's_ax_stale',
    tab: snapshotKey,
    targetId,
    url: 'https://example.com/old-url',
    axRefs: {
      [ref]: {
        ref,
        backendDOMNodeId: 123,
        role: 'button',
        name: 'Submit',
        frameId: 'frame-stale',
        frameUrl: 'https://example.com/new-url'
      }
    },
    refs: {}
  }));

  try {
    await assert.rejects(
      () => executeAction({ pages: async () => [page] }, {
        action: 'read',
        tabArg: 'target:' + targetId,
        refArg: ref,
        rest: [],
        isSemantic: true
      }, { log: () => {} }),
      /page URL changed/
    );
    assert.deepEqual(adoptedIds, []);
  } finally {
    try { fs.unlinkSync(snapshotPath); } catch {}
  }
});

test('AX snapshot creates actionable refs only for interactive roles', async () => {
  const frame = {
    _id: 'frame-tree',
    url: () => 'https://example.com',
    name: () => '',
    client: {
      send: async method => {
        if (method === 'Accessibility.enable') return {};
        if (method === 'Accessibility.getFullAXTree') {
          return { nodes: [
            { nodeId: 'root', role: { value: 'RootWebArea' }, name: { value: 'Page' }, childIds: ['generic', 'button'] },
            { nodeId: 'generic', parentId: 'root', role: { value: 'generic' }, name: { value: 'Wrapper' }, backendDOMNodeId: 1 },
            { nodeId: 'button', parentId: 'root', role: { value: 'button' }, name: { value: 'Submit' }, backendDOMNodeId: 2 }
          ] };
        }
        throw new Error('Unexpected CDP method: ' + method);
      }
    }
  };

  const result = await inspectAccessibility({ frames: () => [frame] }, 'ax_tree_test');
  assert.equal(Object.keys(result.axRefs).length, 1);
  assert.ok(result.axRefs['@ax:ax_tree_test:nbutton']);
  assert.equal(result.axRefs['@ax:ax_tree_test:ngeneric'], undefined);
});
