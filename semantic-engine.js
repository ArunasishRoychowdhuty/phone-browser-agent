'use strict';

function nodeKey(frameId, locator) {
  return String(frameId) + '|' + JSON.stringify(locator || []);
}

function buildNodeTree(flatNodes) {
  const records = flatNodes.map(node => ({ ...node, children: [] }));
  const byKey = new Map(records.map(node => [
    nodeKey(node.frameId, node.locator),
    node
  ]));
  const roots = [];
  for (const node of records) {
    const parent = node.parentLocatorKey ? byKey.get(node.parentLocatorKey) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function axValue(entry) {
  if (!entry || typeof entry !== 'object') return entry ?? null;
  return Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : null;
}

function buildAccessibilityTree(rawNodes, maxNodes = 300) {
  const input = Array.isArray(rawNodes) ? rawNodes : [];
  const selected = input.slice(0, Math.max(1, maxNodes));
  const records = selected.map(node => ({
    nodeId: node.nodeId,
    parentId: node.parentId || null,
    ignored: Boolean(node.ignored),
    role: axValue(node.role),
    name: axValue(node.name),
    description: axValue(node.description),
    value: axValue(node.value),
    properties: Object.fromEntries((node.properties || []).map(p => [
      p.name, axValue(p.value)
    ])),
    backendDOMNodeId: node.backendDOMNodeId,
    children: []
  }));
  const byId = new Map(records.map(node => [node.nodeId, node]));
  const attached = new Set();
  for (const source of selected) {
    const parent = byId.get(source.nodeId);
    if (!parent) continue;
    for (const childId of source.childIds || []) {
      const child = byId.get(childId);
      if (child && !attached.has(childId)) {
        parent.children.push(child);
        attached.add(childId);
      }
    }
  }
  for (const node of records) {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent && !attached.has(node.nodeId)) {
      parent.children.push(node);
      attached.add(node.nodeId);
    }
  }
  const roots = records.filter(node => !attached.has(node.nodeId));
  return {
    nodeCount: records.length,
    sourceNodeCount: input.length,
    truncated: input.length > records.length,
    tree: roots
  };
}

module.exports = { nodeKey, buildNodeTree, buildAccessibilityTree };
