'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fingerprintMismatch, normalizeText, normalizeUrl } = require('../semantic-core');

test('fingerprintMismatch tolerates benign dynamic label updates when strong ID matches', () => {
  const base = {
    tag: 'button',
    roleAttr: 'button',
    id: 'btn-save',
    name: 'Save',
    nameAttr: null,
    type: 'button',
    placeholder: null,
    href: null,
    autocomplete: null
  };

  // Same button, but text changed to "Save (saving...)" during async operation
  const dynamicSaving = { ...base, name: 'Save (saving...)' };
  assert.equal(fingerprintMismatch(dynamicSaving, base), null);

  // Cart button with badge update: "Cart (1)" vs "Cart"
  const cartBase = { ...base, id: 'cart-btn', name: 'Cart' };
  const cartUpdated = { ...cartBase, name: 'Cart (3)' };
  assert.equal(fingerprintMismatch(cartUpdated, cartBase), null);
});

test('fingerprintMismatch normalizes whitespace and URLs', () => {
  const base = {
    tag: 'a',
    id: 'nav-link',
    name: 'Home  Page',
    href: 'https://example.com/about/'
  };

  const actual = {
    tag: 'a',
    id: 'nav-link',
    name: 'Home Page',
    href: 'https://example.com/about'
  };

  assert.equal(fingerprintMismatch(actual, base), null);
});

test('fingerprintMismatch rejects genuine identity mutations', () => {
  const base = {
    tag: 'button',
    id: 'btn-submit',
    name: 'Submit'
  };

  // Tag changed
  assert.equal(fingerprintMismatch({ ...base, tag: 'input' }, base), 'tag');

  // ID changed
  assert.equal(fingerprintMismatch({ ...base, id: 'btn-cancel' }, base), 'id');

  // Name completely replaced
  assert.equal(fingerprintMismatch({ ...base, name: 'Delete All' }, base), 'name');
});
