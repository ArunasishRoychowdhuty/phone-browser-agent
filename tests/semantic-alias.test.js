'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('../browser-control');

test('browser-control argument parser handles semantic alias actions with correct rest slicing', () => {
  const c1 = parseArgs(['click-ref', 'target:123', '@s1:e5']);
  assert.equal(c1.action, 'click');
  assert.equal(c1.refArg, '@s1:e5');
  assert.deepEqual(c1.rest, []);
  assert.equal(c1.isSemantic, true);

  const f1 = parseArgs(['fill-ref', 'target:123', '@s1:e5', 'hello world']);
  assert.equal(f1.action, 'fill');
  assert.equal(f1.refArg, '@s1:e5');
  assert.deepEqual(f1.rest, ['hello world']);
  assert.equal(f1.isSemantic, true);

  const p1 = parseArgs(['press-ref', '0', '@s1:e9', 'Enter']);
  assert.equal(p1.action, 'press');
  assert.equal(p1.refArg, '@s1:e9');
  assert.deepEqual(p1.rest, ['Enter']);
  assert.equal(p1.isSemantic, true);

  const s1 = parseArgs(['select-ref', 'target:456', '@s1:e2', 'option-value']);
  assert.equal(s1.action, 'select');
  assert.equal(s1.refArg, '@s1:e2');
  assert.deepEqual(s1.rest, ['option-value']);
  assert.equal(s1.isSemantic, true);

  const ch1 = parseArgs(['check-ref', 'target:123', '@s1:e4']);
  assert.equal(ch1.action, 'check');
  assert.equal(ch1.refArg, '@s1:e4');
  assert.deepEqual(ch1.rest, []);
  assert.equal(ch1.isSemantic, true);

  const un1 = parseArgs(['uncheck-ref', 'target:123', '@s1:e4']);
  assert.equal(un1.action, 'uncheck');
  assert.equal(un1.refArg, '@s1:e4');
  assert.deepEqual(un1.rest, []);
  assert.equal(un1.isSemantic, true);

  const r1 = parseArgs(['read-ref', 'target:123', '@s1:e1']);
  assert.equal(r1.action, 'read');
  assert.equal(r1.refArg, '@s1:e1');
  assert.deepEqual(r1.rest, []);
  assert.equal(r1.isSemantic, true);
});

test('browser-control argument parser detects @refs in standard action commands', () => {
  const c2 = parseArgs(['click', 'target:123', '@s1:e5']);
  assert.equal(c2.action, 'click');
  assert.equal(c2.refArg, '@s1:e5');
  assert.deepEqual(c2.rest, []);
  assert.equal(c2.isSemantic, true);

  const f2 = parseArgs(['fill', 'target:123', '@s1:e5', 'sample text']);
  assert.equal(f2.action, 'fill');
  assert.equal(f2.refArg, '@s1:e5');
  assert.deepEqual(f2.rest, ['sample text']);
  assert.equal(f2.isSemantic, true);
});

test('browser-control argument parser preserves low-level CSS actions', () => {
  const cssClick = parseArgs(['click', '0', '#submit-button']);
  assert.equal(cssClick.action, 'click');
  assert.equal(cssClick.refArg, undefined);
  assert.deepEqual(cssClick.rest, ['#submit-button']);
  assert.equal(cssClick.isSemantic, false);

  const cssType = parseArgs(['type', '0', 'input.search', 'query']);
  assert.equal(cssType.action, 'type');
  assert.equal(cssType.refArg, undefined);
  assert.deepEqual(cssType.rest, ['input.search', 'query']);
  assert.equal(cssType.isSemantic, false);
});

test('browser-control argument parser handles session and lifecycle commands', () => {
  const sess = parseArgs(['sessions']);
  assert.equal(sess.action, 'sessions');
  assert.equal(sess.isSemantic, true);

  const ax = parseArgs(['ax', 'target:123']);
  assert.equal(ax.action, 'accessibility');
  assert.equal(ax.isSemantic, true);

  const waitTxt = parseArgs(['wait-text', 'target:123', 'Payment Successful', '5000']);
  assert.equal(waitTxt.action, 'wait-text');
  assert.deepEqual(waitTxt.rest, ['Payment Successful', '5000']);
  assert.equal(waitTxt.isSemantic, true);

  const ctx = parseArgs(['context-new', 'https://example.com']);
  assert.equal(ctx.action, 'context-new');
  assert.equal(ctx.isSemantic, true);
});
