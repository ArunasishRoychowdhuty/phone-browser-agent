'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ActionQueue } = require('../browser-daemon');

test('ActionQueue executes actions on the SAME tab strictly in sequence', async () => {
  const queue = new ActionQueue();
  const executionOrder = [];

  const task1 = () => new Promise(resolve => {
    setTimeout(() => {
      executionOrder.push('t1_finish');
      resolve('res1');
    }, 40);
  });

  const task2 = () => new Promise(resolve => {
    setTimeout(() => {
      executionOrder.push('t2_finish');
      resolve('res2');
    }, 10);
  });

  // Enqueue both on 'target:tabA' at the exact same time
  const p1 = queue.enqueue('target:tabA', task1);
  const p2 = queue.enqueue('target:tabA', task2);

  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(r1, 'res1');
  assert.equal(r2, 'res2');
  // Even though task2 has shorter timeout (10ms vs 40ms), task1 must finish first!
  assert.deepEqual(executionOrder, ['t1_finish', 't2_finish']);
});

test('ActionQueue executes actions on DIFFERENT tabs concurrently', async () => {
  const queue = new ActionQueue();
  const executionOrder = [];

  const taskA = () => new Promise(resolve => {
    setTimeout(() => {
      executionOrder.push('tabA_finish');
      resolve('A');
    }, 50);
  });

  const taskB = () => new Promise(resolve => {
    setTimeout(() => {
      executionOrder.push('tabB_finish');
      resolve('B');
    }, 10);
  });

  // Enqueue on different tabs
  const pA = queue.enqueue('target:tabA', taskA);
  const pB = queue.enqueue('target:tabB', taskB);

  const [rA, rB] = await Promise.all([pA, pB]);

  assert.equal(rA, 'A');
  assert.equal(rB, 'B');
  // Tab B runs in parallel and finishes first because it is on a separate queue!
  assert.deepEqual(executionOrder, ['tabB_finish', 'tabA_finish']);
});

test('ActionQueue continues executing subsequent tasks if a previous task fails', async () => {
  const queue = new ActionQueue();

  const failTask = () => new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Task 1 deliberate error')), 10);
  });

  const successTask = () => new Promise(resolve => {
    setTimeout(() => resolve('Task 2 success'), 10);
  });

  const p1 = queue.enqueue('target:tabC', failTask);
  const p2 = queue.enqueue('target:tabC', successTask);

  await assert.rejects(p1, { message: 'Task 1 deliberate error' });
  const r2 = await p2;
  assert.equal(r2, 'Task 2 success');
});


test('ActionQueue keeps the tab locked after caller timeout until the CDP task settles', async () => {
  const queue = new ActionQueue();
  const order = [];

  const first = queue.enqueue('target:tab-timeout', () => new Promise(resolve => {
    setTimeout(() => {
      order.push('first_task_finished');
      resolve('late-result');
    }, 70);
  }), 8);

  await assert.rejects(first, /Action timeout/);
  order.push('caller_observed_timeout');

  const second = queue.enqueue('target:tab-timeout', async () => {
    order.push('second_task_started');
    return 'second-result';
  }, 500);

  assert.equal(await second, 'second-result');
  assert.deepEqual(order, [
    'caller_observed_timeout',
    'first_task_finished',
    'second_task_started'
  ]);
});

test('BrowserDaemon canonicalizes numeric and target-ID tab selectors to one queue', async () => {
  const BrowserDaemon = require('../browser-daemon');
  const daemon = new BrowserDaemon();
  const targetId = 'aabbccdd-1122-3344-5566-77889900aabb';
  const page = { target: () => ({ _targetId: targetId }) };

  daemon.getBrowser = async () => ({ pages: async () => [page] });
  const observed = [];
  daemon.executePayload = async payload => {
    observed.push(payload.tabArg);
    await new Promise(resolve => setTimeout(resolve, 10));
    return { tabArg: payload.tabArg };
  };

  const [fromIndex, fromTarget] = await Promise.all([
    daemon.handleExec({ action: 'snapshot', tabArg: 0 }),
    daemon.handleExec({ action: 'snapshot', tabArg: 'target:' + targetId })
  ]);

  assert.equal(fromIndex.tabArg, 'target:' + targetId);
  assert.equal(fromTarget.tabArg, 'target:' + targetId);
  assert.deepEqual(observed, ['target:' + targetId, 'target:' + targetId]);
});
