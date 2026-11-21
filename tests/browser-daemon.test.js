'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { isDaemonAlive, sendToDaemon } = require('../browser-client');
const { executeAction, resolvePage } = require('../browser-actions');

test('resolvePage resolves target and tab correctly', () => {
  const fakePages = [
    { target: () => ({ _targetId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }) },
    { target: () => ({ _targetId: '12345678-90ab-cdef-1234-567890abcdef' }) }
  ];

  const byTarget = resolvePage(fakePages, 'target:a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  assert.equal(byTarget.tab, 0);
  assert.equal(byTarget.requestedTarget, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

  const byIndex = resolvePage(fakePages, '1');
  assert.equal(byIndex.tab, 1);
  assert.equal(byIndex.snapshotKey, '1');

  assert.throws(() => resolvePage(fakePages, '99'), /Invalid tab index/);
  assert.throws(() => resolvePage(fakePages, 'target:invalid-not-hex'), /Invalid target ID/);
});

test('browser-client correctly detects when daemon is offline', async () => {
  // Point to a non-existent port / socket temporarily
  const originalSock = process.env.BROWSER_DAEMON_SOCK;
  const originalPort = process.env.BROWSER_DAEMON_PORT;
  process.env.BROWSER_DAEMON_SOCK = '/tmp/nonexistent-daemon-' + Date.now() + '.sock';
  process.env.BROWSER_DAEMON_PORT = '49999';

  try {
    const alive = await isDaemonAlive(80);
    assert.equal(alive, false);
  } finally {
    process.env.BROWSER_DAEMON_SOCK = originalSock || '';
    process.env.BROWSER_DAEMON_PORT = originalPort || '';
  }
});

test('browser-client sends request to mock HTTP server and parses response', async () => {
  const testPort = 48888;
  const originalPort = process.env.BROWSER_DAEMON_PORT;
  const originalSock = process.env.BROWSER_DAEMON_SOCK;
  process.env.BROWSER_DAEMON_SOCK = '/tmp/no-such-socket-' + Date.now() + '.sock';
  process.env.BROWSER_DAEMON_PORT = String(testPort);

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'OK' }));
      return;
    }
    if (req.url === '/exec' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const payload = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          exitCode: 0,
          stdout: 'MOCK_OUTPUT for ' + payload.action + '\n',
          stderr: '',
          result: { status: 'MOCK_OK', action: payload.action }
        }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise(r => server.listen(testPort, '127.0.0.1', r));

  try {
    const alive = await isDaemonAlive(500);
    assert.equal(alive, true);

    const res = await sendToDaemon({ action: 'list' }, 3000);
    assert.equal(res.ok, true);
    assert.equal(res.exitCode, 0);
    assert.match(res.stdout, /MOCK_OUTPUT for list/);
    assert.equal(res.result.action, 'list');
  } finally {
    await new Promise(r => server.close(r));
    process.env.BROWSER_DAEMON_SOCK = originalSock || '';
    process.env.BROWSER_DAEMON_PORT = originalPort || '';
  }
});

test('executeAction gracefully logs to custom logger', async () => {
  const logs = [];
  const fakeLogger = {
    log: (...args) => logs.push(args.join(' ')),
    error: (...args) => logs.push('ERR: ' + args.join(' '))
  };

  const fakeBrowser = {
    pages: async () => [
      {
        url: () => 'https://example.com',
        title: async () => 'Example Domain',
        target: () => ({ _targetId: 'target-mock-1' })
      }
    ]
  };

  await executeAction(fakeBrowser, { action: 'list', isSemantic: false }, fakeLogger);
  assert.equal(logs.length, 1);
  const parsed = JSON.parse(logs[0]);
  assert.equal(parsed.tab, 0);
  assert.equal(parsed.targetId, 'target-mock-1');
  assert.equal(parsed.url, 'https://example.com');
  assert.equal(parsed.title, 'Example Domain');
});
