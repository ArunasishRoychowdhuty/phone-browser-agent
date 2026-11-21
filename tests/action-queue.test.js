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
