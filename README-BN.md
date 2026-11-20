# Android Phone UI Bridge (Termux)

This bridge runs on the Moto G64 through Termux + Desktop Commander.

## Start / recover the connection

```bash
~/phone-browser-agent/start-bridge.sh
```

Keep Android Wireless Debugging enabled and keep the phone and Termux on the same Wi-Fi network. The keepalive tries mDNS first and then scans the phone's Wi-Fi address for the current ADB wireless-debugging port. The port can change after reconnects.

## Direct Android screen controls

```bash
# Check connection and screen resolution
~/phone-browser-agent/phone-ui.sh status

# Tap a physical-screen coordinate (1080 x 2400 on this device)
~/phone-browser-agent/phone-ui.sh tap 540 1200

# Swipe
~/phone-browser-agent/phone-ui.sh swipe 500 1700 500 600 450

# Type plain text (spaces supported; Android input limitations apply)
~/phone-browser-agent/phone-ui.sh type Hello%sworld

# Android key event, for example BACK=4, ENTER=66, HOME=3
~/phone-browser-agent/phone-ui.sh key 4

# Capture the current screen
~/phone-browser-agent/phone-ui.sh screenshot ~/phone-browser-agent/screen.png
```

## Chrome browser controls (Puppeteer / Chrome DevTools)

```bash
cd ~/phone-browser-agent

# List open tabs (output includes a stable Chrome targetId)
node browser-control.js list

# Prefer target:<targetId> over a tab index, because tab indexes can change
node browser-control.js snapshot 'target:<paste-targetId>'

# Navigate the selected Chrome tab
node browser-control.js open 'target:<paste-targetId>' https://example.com

# Click a CSS selector in the selected tab
node browser-control.js click 'target:<paste-targetId>' 'button[type="submit"]'

# Type into an input in the selected tab
node browser-control.js type 'target:<paste-targetId>' 'input[name="q"]' 'search text'

# Fill an input, replacing existing content
node browser-control.js fill 'target:<paste-targetId>' 'input[name="q"]' 'search text'

# Read an element
node browser-control.js read 'target:<paste-targetId>' 'h1'

# Screenshot a browser tab
node browser-control.js screenshot 'target:<paste-targetId>' ~/phone-browser-agent/browser.png
```

Browser actions run only in the explicitly selected target ID (recommended) or tab index (legacy) and selector. The browser controller reactivates Chrome and restores the local DevTools forward when needed. It does not create or submit account registrations automatically.

## Verified in setup

- Wireless ADB to the Moto G64: `device` state.
- Android screenshot capture: PNG saved successfully.
- Chrome DevTools: HTTP 200 / Chrome 157.
- Puppeteer keyboard typing: passed on an isolated local test page.
- Puppeteer click: passed on an isolated local test page.
- Browser tab enumeration with stable Chrome target IDs: passed.
- Target-bound semantic refs survive unrelated field-value changes; renamed targets are rejected as stale.
- `--stdin` text transfer passed for CSS fill; `wait-text` and `wait-url` passed on an isolated test tab.
- `npm run check` and `npm test` passed; বর্তমান regression suite-এ 6টি test আছে.

## Limits

- This adds a Termux CLI bridge; it does not add new native buttons to the Remote Desktop Commander plugin itself.
- ADB wireless-debugging ports are dynamic. The keepalive tries to rediscover them.
- Keep the phone awake and Wireless Debugging enabled for reliable automation.
- Never share ADB pairing codes, private credentials, or identity documents.

## Preferred: Semantic UI / DOM Tree (screenshot ছাড়া)

Browser automation-এর default পদ্ধতি structured snapshot। এটি top-level DOM-এর পাশাপাশি reachable iframe এবং open Shadow DOM traverse করে। প্রতিটি node-এর role/name, attributes, states, parent-child সম্পর্ক, frame identity এবং shadow locator থাকে। Chrome native Accessibility Tree-ও প্রতি frame-এ আলাদাভাবে সংগ্রহের চেষ্টা করা হয়। Editable field-এর বর্তমান value snapshot/read output-এ দেখা যেতে পারে; sensitive-field masking নেই।

কমান্ড:

    cd ~/phone-browser-agent
    node browser-control.js list
    node browser-control.js sessions
    node browser-control.js accessibility 'target:<paste-targetId>'

    # Browser tab/session lifecycle
    node browser-control.js new https://example.com
    node browser-control.js session-info 'target:<paste-targetId>'
    node browser-control.js activate 'target:<paste-targetId>'
    node browser-control.js close 'target:<paste-targetId>'
    node browser-control.js snapshot 'target:<paste-targetId>'

    # Snapshot থেকে পাওয়া fresh ref ব্যবহার
    node browser-control.js read-ref 'target:<paste-targetId>' '@SNAPSHOT:e3'
    node browser-control.js fill-ref 'target:<paste-targetId>' '@SNAPSHOT:e4' 'search text'
    node browser-control.js click-ref 'target:<paste-targetId>' '@SNAPSHOT:e5'

    # command-line argument-এর বদলে stdin থেকেও text পাঠানো যায়
    printf 'search text' | node browser-control.js fill 'target:<paste-targetId>' 'input[name="q"]' --stdin

    # Action-এর expected result-এর জন্য wait
    node semantic-browser.js wait-text 'target:<paste-targetId>' 'Expected result text' 10000
    node semantic-browser.js wait-url 'target:<paste-targetId>' 'expected-url-fragment' 10000

### Agent-এর action policy

1. snapshot → semantic ref নির্বাচন → action → নতুন snapshot দিয়ে effect verify।
2. Numeric tab index পরিবর্তন হতে পারে; list থেকে পাওয়া stable targetId ব্যবহার করো।
3. প্রতিটি ref নির্দিষ্ট Chrome target ও snapshot-এর সঙ্গে বাঁধা। URL বা target identity বদলালে পুরোনো ref reject হবে; unrelated field-value change হলেই সব ref অকারণে invalid হবে না।
4. প্রতিটি action-এর আগে disabled, visible, editable, checked, selected এবং read-only state যাচাই করো।
5. যেকোনো editable field-এ fill/type করা যায়; password/OTP/token field-এর জন্য custom block নেই।
6. Semantic click-এর আগে target-কে view-তে scroll করা হয়; তারপর live DOM hit-test ও bounding box দিয়ে click point নির্ধারিত হয়। Screenshot থেকে X/Y অনুমান করা হয় না।
7. Semantic ref না পাওয়া গেলে CSS selector/CDP fallback ব্যবহার করো। Canvas, closed Shadow DOM বা native Android UI-তে screenshot/accessibility fallback প্রয়োজন হতে পারে।

### সীমাবদ্ধতা

Open Shadow DOM traverse করা হয়; closed Shadow DOM, canvas/custom drawing, browser chrome এবং native Android UI DOM locator দিয়ে নিয়ন্ত্রণ করা যায় না। Cross-origin iframe-এ Puppeteer-এর frame context ব্যবহার করা হয়, browser origin policy bypass করা হয় না। কোনো frame-এর CDP/AX tree unavailable হলে frame-level status/error দেখানো হবে। Session management tab lifecycle (new/list/activate/info/close) সামলায়; cookies, login storage বা browser profile export/delete করে না.
