# Browser Agent Upgrade Report — 2026-11-21

## P1 & P2 Complete Upgrade Suite

### P1 Implementations
1. **Semantic Alias Parsing**:
   - Refactored `parseArgs` in `browser-control.js`.
   - Correctly maps `click-ref`, `fill-ref`, `type-ref`, `read-ref`, `press-ref`, `check-ref`, `uncheck-ref`, `select-ref`.
   - Properly extracts `refArg` and slices `rest` arguments without dropping input values.
   - Preserves `--stdin` text extraction across all commands.
2. **Contenteditable & Custom Dropdown Support**:
   - Deep detection of `contenteditable` attributes and rich text wrappers (`role: textbox`, `editable: true`).
   - Implemented synthetic input events and rich text insertion for `fill` and `type`.
   - Added two-phase custom dropdown resolver: automated trigger expansion (`aria-expanded`), options lookup across `role="option"`, `li`, `.dropdown-item`, selection click, and verification.
3. **Per-Tab Action Queue & Concurrency Control**:
   - Engineered resident `ActionQueue` in `browser-daemon.js`.
   - Enforces strict FIFO serialized execution for actions on the same browser tab, preventing click/fill race conditions.
   - Allows independent tabs to execute actions concurrently in parallel.
   - Timeout and fault isolation prevent hanging actions from blocking subsequent queued requests.
4. **Action Execution Automatic Verification**:
   - Integrated pre-action and post-action state tracking (`urlChanged`, `titleChanged`, `matchedValue`, `checked`, `selected`).
   - Returns structured `verification` object in execution responses.
5. **Actionable References from AX Tree**:
   - Augmented `inspectAccessibility` to tag interactive accessibility nodes with actionable references (`@ax:snapId:n<nodeId>`).
   - Integrated CDP `DOM.resolveNode` backend resolver to execute actions directly on accessibility nodes without DOM selector translation.
6. **Iframe-Aware `wait-text` and `wait-url`**:
   - Implemented recursive frame scanning (`waitForTextInFrames`, `waitForUrlInFrames`) supporting embedded payment frames, OAuth popups, and nested widgets.
7. **Robust Identity Validation for DOM References**:
   - Enhanced `fingerprintMismatch` in `semantic-core.js` to normalize whitespace and URLs.
   - Tolerates benign dynamic label updates (e.g., loading states, cart counter badges) when strong ID or name attributes match, eliminating spurious `STALE_REF` rejections.
8. **Isolated Browser Contexts & Session Lifecycle**:
   - Added `context-new [URL]`, `context-list`, and `context-close [ID]` commands using Puppeteer isolated browser contexts for multi-account sandboxing.

### P2 Implementations
9. **Android Text Input & Unicode Handling**:
   - Integrated Chrome DevTools Protocol `Input.insertText` for reliable Unicode, Bangla, Hindi, and emoji insertion on Android Chromium without keycode layout mismatch.
10. **Adaptive Snapshot for Large Pages**:
    - Implemented intelligent viewport intersection scoring (100 for visible interactive, 80 for offscreen interactive, 60 for landmarks).
    - Preserves high-value actionable controls on massive DOM trees (10,000+ nodes) within bounded memory limits.
11. **Comprehensive Regression Suite**:
    - Expanded test suite from 10 to 25 automated tests covering alias parsing, queues, contenteditable, iframe waiting, robust identity, and contexts.
    - 25/25 passing (`npm test`).
12. **Performance Benchmark & Dependency Cleanup**:
    - Removed unused `playwright-core` dependency from `package.json`.
    - Added `npm run bench` measuring:
      - CLI Argument Parsing: ~340,000 ops/sec
      - Fingerprint Identity Matching: ~780,000 ops/sec
      - ActionQueue Concurrency: ~52,000 tasks/sec

## Follow-up corrective fixes — 2026-11-21

### Correctness fixes applied
- AX references now resolve backend DOM nodes through Puppeteer's frame main-realm adoptBackendNode() API and use the resulting ElementHandle. The previous code incorrectly passed a raw CDP RemoteObject to evaluateHandle().
- AX references are now checked against the saved tab key, Chrome target ID, page URL, frame ID, and frame URL before action. Missing/detached frames are rejected instead of silently falling back to the main frame.
- AX actionable references are generated only for supported interactive roles; generic non-interactive AX nodes no longer receive clickable references.
- context-list now returns a stable context ID. context-close accepts the context ID and retains numeric-index support for backward compatibility.
- ActionQueue timeout behavior now reports timeout to the caller while holding that tab's queue until the original Puppeteer/CDP operation actually settles. This prevents the next action from racing an operation that was not cancelled by Promise.race().
- Browser daemon queue keys now normalize numeric tab indexes to stable Chrome target IDs. Calls addressed by tab index and by target ID therefore enter the same per-tab queue, and queued commands retain the resolved target identity if tab ordering changes.
- Click and keypress responses no longer claim the intended page action was verified merely because an event was dispatched. They report CLICK_SENT / KEY_SENT with verification.verified=false; callers must check the expected result using wait-text, wait-url, or a fresh snapshot.
- Custom dropdown selection now checks observable selected state or an exact trigger-value/label match before reporting CUSTOM_DROPDOWN_SELECTED. Otherwise it returns CUSTOM_DROPDOWN_ACTION_SENT with verified=false.

### Additional regression coverage
- Added AX reference adoption and stale-URL tests.
- Added a test that generic AX nodes do not receive actionable references.
- Added ActionQueue timeout serialization and numeric-index/target-ID queue normalization tests.
- Updated isolated context lifecycle coverage to close by context ID.

### Latest local verification on Moto G64 / Termux
- npm run check: passed.
- npm test: 30/30 tests passed.
- npm run bench: completed successfully.
  - Repeated local runs varied: CLI parsing 145,804–340,376 ops/sec.
  - Repeated local runs varied: fingerprint matching 233,200–1,070,215 ops/sec.
  - Repeated local runs varied: ActionQueue throughput 13,191–72,343 tasks/sec.
- These are local synthetic microbenchmarks, not end-to-end browser latency measurements.
- Live Chrome integration was not run during this corrective pass because Browser Daemon was stopped and http://127.0.0.1:9224/json/version was not listening. Cross-origin iframe, live AX node actions, custom dropdown interaction, and Android Unicode input still require a live Chrome test.
