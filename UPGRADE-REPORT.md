# Browser Agent Upgrade Report — 2026-11-20

## Implemented

- Added stable Chrome target addressing: `target:<targetId>`. The tab list now returns a `targetId`; numeric tab indexes remain available for compatibility.
- Bound semantic snapshots to the Chrome target and URL. Actions revalidate the selected element fingerprint instead of invalidating every ref after any DOM/value update.
- Strengthened identity checks, including empty accessible names, so an element whose name changes is rejected as stale.
- Added standard-input text transfer so text need not appear in command-line arguments.
- Changed CSS fill to use the native input/textarea value setter, dispatch input/change events, and verify the resulting value.
- Added `wait-text` and `wait-url` commands for post-action result checks.
- Added configurable snapshot node limits (default 300, bounded up to 1200) with explicit complete/truncated reporting.
- Added a Node test suite and `npm test` / `npm run check` scripts.

## Earlier verification (before frame/AX expansion)

- Earlier `npm run check` and semantic-ref smoke checks passed.

## Current verification

- `npm run check`: passed.
- `npm test`: latest run 6 tests passed.
- Isolated browser smoke test: semantic fill passed; a button ref remained usable after an unrelated field-value change; changing that button's accessible name caused `STALE_REF`.
- Before guard removal, CSS fill passed with normal text and standard input. Current source has no password/OTP/token fill gate; a live post-change secret-field smoke test was not completed in this session.
- `wait-text` and `wait-url` passed on an isolated test tab.
- The temporary test tab was closed. The existing browser tab was not modified.

## Not fully verified

- The off-screen click/scroll smoke test hit a Chrome DevTools `Network.enable timed out` error while attaching. The scroll-then-click code is present, but this path should receive another isolated test when Chrome CDP is responsive.
- Open Shadow DOM and cross-origin iframe paths are implemented but not live-verified in this run; closed Shadow DOM, canvas/custom controls, and native Android UI remain outside DOM locator coverage.

## Follow-up change — sensitive-field guard removal

- Removed password/OTP/token/API-key detection and fill/type rejection from both CSS and semantic action paths.
- Semantic snapshots and read actions now include current editable field values.
- URL output is no longer specially redacted by this project.
- The standard-input option remains available as a general text-input method.
- At the latest verification checkpoint, syntax validation and all 6 regression tests passed. The live password/OTP/token smoke test remains unverified.

## Browser engine expansion — iframe, Shadow DOM, AX tree, sessions

- Snapshot collection now iterates Puppeteer frames and records frame ID, URL, name, and parent frame ID.
- Frame-local semantic refs carry the frame identity and URL. Actions re-resolve the exact frame and shadow-root locator chain, then re-check the existing element fingerprint before acting.
- Open Shadow DOM is traversed recursively. Locators are stored as ordered document/shadow-root selector segments, allowing an action to resolve inside nested open shadow roots.
- Iframe nodes and Shadow DOM hosts are retained as structural nodes where available, preserving context in the flattened parent-child tree.
- Added Chrome Accessibility.getFullAXTree collection using each Puppeteer frame's CDP client, with per-frame availability errors and bounded output.
- Snapshot output now includes the per-frame AX tree; the standalone accessibility command reads it independently.
- Added tab lifecycle commands: sessions, new [URL], activate TAB, session-info TAB, and close TAB. Closing the last open tab is refused; no cookie/profile clearing is implemented.
- Added DOM/AX tree-builder tests, including AX childIds relationships and frame/shadow parent separation.
- Verification: syntax checks passed and 6/6 unit tests passed. The live Chrome smoke test could not complete because Puppeteer attachment returned Network.enable timed out; therefore cross-origin iframe/Shadow DOM live action and live AX output remain unverified in this run.

## Files changed

- `browser-control.js`
- `semantic-browser.js`
- `semantic-core.js` (new)
- `semantic-engine.js` (new)
- `tests/semantic-core.test.js` (expanded)
- `package.json`
- `README-BN.md`
- `AGENT-RULES.md`

Original JS entry points were backed up before patching. The separate `agent-desktop-source` Rust repository was inspected but not modified; its current platform adapters target desktop operating systems, not Android Chrome.
