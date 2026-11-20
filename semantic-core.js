'use strict';

const FINGERPRINT_FIELDS = ['tag','roleAttr','id','nameAttr','type','placeholder','href','autocomplete'];

function fingerprint(node) {
  const a = node.attributes || {};
  return {
    tag: node.tag,
    roleAttr: a.roleAttr || null,
    name: node.name || '',
    id: a.id || null,
    nameAttr: a.nameAttr || null,
    type: a.type || null,
    placeholder: a.placeholder || null,
    href: a.href || null,
    autocomplete: a.autocomplete || null
  };
}

function fingerprintMismatch(actual, expected) {
  for (const key of FINGERPRINT_FIELDS) {
    if ((actual[key] ?? null) !== (expected[key] ?? null)) return key;
  }
  if (String(actual.name || '') !== String(expected.name || '')) return 'name';
  return null;
}

module.exports = { fingerprint, fingerprintMismatch };
