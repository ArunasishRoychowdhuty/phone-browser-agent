'use strict';

const FINGERPRINT_FIELDS = ['tag', 'roleAttr', 'id', 'nameAttr', 'type', 'placeholder', 'autocomplete'];

function normalizeText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url, 'http://localhost');
    return (u.pathname.replace(/\/+$/, '') + u.search + u.hash).toLowerCase();
  } catch {
    return String(url).replace(/\/+$/, '').toLowerCase();
  }
}

function fingerprint(node) {
  const a = node.attributes || {};
  return {
    tag: node.tag,
    roleAttr: a.roleAttr || null,
    name: normalizeText(node.name || ''),
    id: a.id || null,
    nameAttr: a.nameAttr || null,
    type: a.type || null,
    placeholder: a.placeholder || null,
    href: a.href || null,
    autocomplete: a.autocomplete || null,
    isContentEditable: Boolean(node.isContentEditable || a.contenteditable)
  };
}

/**
 * Robust identity validation between actual live element and snapshot fingerprint.
 * Distinguishes genuine DOM mutations from benign cosmetic/dynamic label changes.
 */
function fingerprintMismatch(actual, expected) {
  // 1. Tag must strictly match
  if (actual.tag && expected.tag && actual.tag !== expected.tag) {
    return 'tag';
  }

  // 2. Strong identity fields: id and nameAttr
  if (actual.id && expected.id && actual.id !== expected.id) {
    return 'id';
  }
  if (actual.nameAttr && expected.nameAttr && actual.nameAttr !== expected.nameAttr) {
    return 'nameAttr';
  }

  // 3. Other core attributes
  for (const key of ['roleAttr', 'type', 'placeholder', 'autocomplete']) {
    const actVal = actual[key] ?? null;
    const expVal = expected[key] ?? null;
    if (actVal !== null && expVal !== null && actVal !== expVal) {
      return key;
    }
  }

  // 4. URL / href comparison with normalization
  if (actual.href || expected.href) {
    const actHref = normalizeUrl(actual.href);
    const expHref = normalizeUrl(expected.href);
    if (actHref && expHref && actHref !== expHref) {
      return 'href';
    }
  }

  // 5. Accessible name / label comparison
  const actName = normalizeText(actual.name);
  const expName = normalizeText(expected.name);

  if (actName !== expName) {
    // If one is empty and the other isn't, or completely different text
    if (!actName && expName) return 'name';
    if (actName && !expName) return 'name';

    // Allow benign dynamic text changes (e.g. "Save" -> "Save (loading)", "Cart (1)" -> "Cart (2)")
    // ONLY IF both share strong identity (same id, or same nameAttr, or both start/end with core text)
    const hasStrongIdentity = (actual.id && actual.id === expected.id) ||
                              (actual.nameAttr && actual.nameAttr === expected.nameAttr);

    const isSubtext = actName.startsWith(expName) || expName.startsWith(actName) ||
                      actName.includes(expName) || expName.includes(actName);

    if (hasStrongIdentity && isSubtext) {
      // Benign dynamic label update, identity preserved
      return null;
    }

    return 'name';
  }

  return null;
}

module.exports = {
  fingerprint,
  fingerprintMismatch,
  normalizeText,
  normalizeUrl
};
