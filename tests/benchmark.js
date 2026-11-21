'use strict';

const { parseArgs } = require('../browser-control');
const { fingerprintMismatch } = require('../semantic-core');
const { ActionQueue } = require('../browser-daemon');

console.log('=== Phone Browser Agent Performance Benchmark ===\n');

// 1. Argument Parsing Benchmark
{
  const testArgs = ['fill-ref', 'target:12345678-abcd', '@s1:e5', 'Benchmark sample input text'];
  const iterations = 50000;
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    parseArgs(testArgs);
  }
  const dt = performance.now() - t0;
  const opsSec = Math.round((iterations / dt) * 1000);
  console.log(`[1] CLI Argument Parsing: ${iterations.toLocaleString()} ops in ${dt.toFixed(2)}ms (${opsSec.toLocaleString()} ops/sec)`);
}

// 2. Fingerprint Validation Benchmark
{
  const base = {
    tag: 'button', roleAttr: 'button', id: 'submit-btn',
    name: 'Submit Application', nameAttr: null, type: 'submit'
  };
  const actual = { ...base };
  const iterations = 100000;
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    fingerprintMismatch(actual, base);
  }
  const dt = performance.now() - t0;
  const opsSec = Math.round((iterations / dt) * 1000);
  console.log(`[2] Fingerprint Identity Match: ${iterations.toLocaleString()} ops in ${dt.toFixed(2)}ms (${opsSec.toLocaleString()} ops/sec)`);
}

// 3. ActionQueue Concurrency Throughput Benchmark
(async () => {
  const queue = new ActionQueue();
  const tasksCount = 5000;
  const t0 = performance.now();
  const promises = [];
  for (let i = 0; i < tasksCount; i++) {
    const tabKey = 'tab_' + (i % 5);
    promises.push(queue.enqueue(tabKey, async () => i * 2));
  }
  await Promise.all(promises);
  const dt = performance.now() - t0;
  const opsSec = Math.round((tasksCount / dt) * 1000);
  console.log(`[3] ActionQueue Concurrency: ${tasksCount.toLocaleString()} queued tasks in ${dt.toFixed(2)}ms (${opsSec.toLocaleString()} tasks/sec)\n`);
  console.log('✅ All benchmarks completed successfully.');
})();
