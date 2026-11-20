# Browser Agent Rules — Semantic First

## Default observe/act/verify loop

1. Read the browser tab list and record its targetId. Prefer target:<targetId> for all commands; numeric tab indexes are only a fallback.
2. Run node browser-control.js snapshot 'target:<targetId>' before interacting with a page. Snapshot covers the top document, reachable frames, open Shadow DOM and a per-frame Chrome Accessibility Tree.
3. Select a fresh @snapshot:eN ref by role/name/text and state. Preserve parent-child context when disambiguating repeated controls.
4. Check disabled, visible, editable, checked, selected and expanded state before choosing an action.
5. Use click-ref, fill-ref, type-ref, press-ref, check-ref, uncheck-ref or select-ref for semantic actions.
6. Run a new snapshot after an action and verify the resulting page state. A previous ref is revalidated against its target identity; unrelated text/value changes alone do not invalidate every ref.

## Fallback ladder

1. Semantic DOM snapshot and ref actions.
2. CSS selector or text/role-derived query using the existing Puppeteer controller.
3. CDP DOM/page inspection where supported.
4. Screenshot only for visual-only controls, canvas, inaccessible surfaces, or when the prior methods cannot identify the target.

## Safety and reliability

- The model must not invent selectors, refs, element IDs, or coordinates.
- A ref is valid only for the snapshot that produced it. A stale/ambiguous target requires a fresh snapshot.
- Do not click disabled or hidden elements.
- The fill/type actions work with any editable field; this project adds no password/OTP/token-specific blocking.
- No form submission or irreversible action without explicit user intent and confirmation where required.
- The click helper scrolls the target into view, checks the current DOM hit-test, then derives the click point from the live element box; it never infers X/Y from a screenshot.
- Use wait-text or wait-url after actions to verify the intended page result.
- Resolve refs using their saved frameId + frame URL + shadow locator chain; reject refs when the frame is detached, navigated, or the locator no longer resolves.
- Cross-origin frames are inspected through their own browser frame context, not by injecting into the top document or bypassing origin policy.
- Closed Shadow DOM, canvas, browser chrome and native Android UI are outside DOM locator coverage; use an explicit visual/accessibility fallback only when available.
- Use sessions/new/activate/session-info/close for tab lifecycle only. Do not clear cookies, site storage, or user profile data as part of session management.
- If the snapshot omits a control, do not guess. Use the next fallback method and report limitations.

## Termux entry points

- Start bridge: ~/phone-browser-agent/start-bridge.sh
- Semantic snapshot: node ~/phone-browser-agent/browser-control.js snapshot 'target:<targetId>'
- Semantic ref click: node ~/phone-browser-agent/browser-control.js click-ref 'target:<targetId>' '@snapshot:e1'
- Explicit visual fallback: node ~/phone-browser-agent/browser-control.js screenshot 'target:<paste-targetId>'
