'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForTextInFrames, waitForUrlInFrames } = require('../browser-actions');

test('waitForTextInFrames detects text inside child iframe', async () => {
  const mockPage = {
    frames: () => [
      {
        _id: 'frame-main',
        url: () => 'https://example.com/checkout',
        name: () => '',
        evaluate: async () => false
      },
      {
        _id: 'frame-payment-iframe',
        url: () => 'https://payment-gateway.example.com/embed',
        name: () => 'stripe-frame',
        evaluate: async (fn, arg) => {
          // simulates text inside iframe
          return arg === 'Payment Verified';
        }
      }
    ],
    mainFrame: function() { return this.frames()[0]; }
  };

  const result = await waitForTextInFrames(mockPage, 'Payment Verified', 2000);
  assert.equal(result.found, true);
  assert.equal(result.frameId, 'frame-payment-iframe');
  assert.equal(result.isIframe, true);
});

test('waitForUrlInFrames detects URL matching child iframe', async () => {
  const mockPage = {
    frames: () => [
      {
        _id: 'frame-main',
        url: () => 'https://example.com/app',
        name: () => ''
      },
      {
        _id: 'frame-oauth',
        url: () => 'https://accounts.google.com/o/oauth2/auth?client_id=123',
        name: () => 'oauth-popup'
      }
    ],
    mainFrame: function() { return this.frames()[0]; }
  };

  const result = await waitForUrlInFrames(mockPage, 'oauth2/auth', 2000);
  assert.equal(result.matched, true);
  assert.equal(result.frameId, 'frame-oauth');
  assert.equal(result.isIframe, true);
});

test('waitForTextInFrames throws timeout when text is missing in all frames', async () => {
  const mockPage = {
    frames: () => [
      {
        _id: 'f1',
        url: () => 'https://example.com',
        evaluate: async () => false
      }
    ],
    mainFrame: function() { return this.frames()[0]; }
  };

  await assert.rejects(
    () => waitForTextInFrames(mockPage, 'Nonexistent Text', 200),
    /Timeout waiting for text/
  );
});
