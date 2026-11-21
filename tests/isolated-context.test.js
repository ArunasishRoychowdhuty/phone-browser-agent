'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { executeAction } = require('../browser-actions');

test('executeAction handles context-new, context-list, and context-close lifecycle', async () => {
  let createdPages = [];
  const fakeContexts = [
    {
      id: 'default-ctx',
      isIncognito: () => false,
      pages: async () => [{ target: () => ({ _targetId: 't1' }), url: () => 'https://default.com' }]
    }
  ];

  const mockBrowser = {
    pages: async () => [],
    browserContexts: () => fakeContexts,
    createBrowserContext: async () => {
      const newCtx = {
        id: 'isolated-ctx-1',
        isIncognito: () => true,
        pages: async () => createdPages,
        newPage: async () => {
          const p = {
            target: () => ({ _targetId: 'target-iso-1' }),
            url: () => 'about:blank',
            title: async () => 'New Tab',
            goto: async (url) => { p._url = url; }
          };
          createdPages.push(p);
          return p;
        },
        close: async () => {
          const idx = fakeContexts.indexOf(newCtx);
          if (idx !== -1) fakeContexts.splice(idx, 1);
        }
      };
      fakeContexts.push(newCtx);
      return newCtx;
    }
  };

  const dummyLogger = { log: () => {} };

  // 1. Create isolated context
  const created = await executeAction(mockBrowser, {
    action: 'context-new',
    tabArg: 'https://example.com/isolated',
    isSemantic: true
  }, dummyLogger);

  assert.equal(created.status, 'CONTEXT_CREATED');
  assert.equal(created.contextId, 'isolated-ctx-1');
  assert.equal(created.targetId, 'target-iso-1');

  // 2. List contexts
  const listed = await executeAction(mockBrowser, {
    action: 'context-list',
    isSemantic: true
  }, dummyLogger);

  assert.equal(listed.status, 'CONTEXTS_LIST');
  assert.equal(listed.count, 2);

  // 3. Close isolated context
  const closed = await executeAction(mockBrowser, {
    action: 'context-close',
    tabArg: '1',
    isSemantic: true
  }, dummyLogger);

  assert.equal(closed.status, 'CONTEXT_CLOSED');
  assert.equal(fakeContexts.length, 1);
});
