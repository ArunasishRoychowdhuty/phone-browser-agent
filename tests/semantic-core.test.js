'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fingerprint, fingerprintMismatch } = require('../semantic-core');
const { nodeKey, buildNodeTree, buildAccessibilityTree } = require('../semantic-engine');

test('fingerprint matches an unchanged target', () => {
  const node = { tag:'button', name:'Continue', attributes:{ id:'go', type:'button' } };
  const fp = fingerprint(node);
  assert.equal(fingerprintMismatch({ ...fp }, fp), null);
});

test('unrelated page updates do not invalidate a matching target', () => {
  const fp = { tag:'button', roleAttr:null, name:'Continue', id:'go', nameAttr:null,
    type:'button', placeholder:null, href:null, autocomplete:null };
  assert.equal(fingerprintMismatch({ ...fp }, fp), null);
});

test('changed target name or identity is rejected', () => {
  const fp = { tag:'button', roleAttr:null, name:'Continue', id:'go', nameAttr:null,
    type:'button', placeholder:null, href:null, autocomplete:null };
  assert.equal(fingerprintMismatch({ ...fp, name:'Delete' }, fp), 'name');
  assert.equal(fingerprintMismatch({ ...fp, id:'other' }, fp), 'id');
  assert.equal(fingerprintMismatch({ ...fp, name:'Added label' }, { ...fp, name:'' }), 'name');
});


test('DOM tree keeps frame boundaries and shadow locator parents distinct', () => {
  const frameA = 'frame-a';
  const frameB = 'frame-b';
  const roots = buildNodeTree([
    { frameId:frameA, locator:['#host'], parentLocatorKey:null, name:'Host' },
    { frameId:frameA, locator:['#host','button'], parentLocatorKey:nodeKey(frameA,['#host']), name:'Inside shadow' },
    { frameId:frameB, locator:['button'], parentLocatorKey:null, name:'Inside iframe' }
  ]);
  assert.equal(roots.length, 2);
  const host = roots.find(node => node.frameId === frameA);
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0].name, 'Inside shadow');
});

test('Chrome accessibility nodes form a bounded role/name/state tree', () => {
  const result = buildAccessibilityTree([
    { nodeId:'1', role:{value:'RootWebArea'}, name:{value:'Demo'}, childIds:['2'] },
    { nodeId:'2', parentId:'1', role:{value:'button'}, name:{value:'Continue'},
      properties:[{name:'disabled',value:{value:false}}] },
    { nodeId:'3', parentId:'1', role:{value:'link'}, name:{value:'More'} }
  ], 2);
  assert.equal(result.nodeCount, 2);
  assert.equal(result.truncated, true);
  assert.equal(result.tree[0].children[0].role, 'button');
  assert.equal(result.tree[0].children[0].properties.disabled, false);
});

test('Chrome AX childIds build parent-child links when parentId is omitted', () => {
  const result = buildAccessibilityTree([
    { nodeId:'root', role:{value:'RootWebArea'}, name:{value:'Page'}, childIds:['child'] },
    { nodeId:'child', role:{value:'button'}, name:{value:'Submit'}, childIds:[] }
  ], 10);
  assert.equal(result.tree.length, 1);
  assert.equal(result.tree[0].children[0].name, 'Submit');
});
