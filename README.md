# Phone Browser Agent

Automated Chrome DevTools Protocol (CDP) and Android mobile browser agent for semantic web interactions, form filling, and platform automation.

## Features

- **Semantic Browser Engine (`semantic-browser.js`, `semantic-engine.js`)**: Real-time DOM snapshot parsing, shadow DOM traversal, interactive element detection, and accessibility node extraction.
- **Chrome CDP Bridge (`browser-control.js`, `keepalive.py`)**: Persistent WebSocket connection to Android Chrome over local or wireless ADB.
- **Automation Scripts (`automation-scripts/`)**: Specialized workflow automation scripts for freelancing platforms, portfolio management, and multi-step onboarding.
- **Session & Profile Management (`saved-sessions/`)**: Centralized profile manifests and platform activity tracking.

## Architecture

- **`keepalive.py`**: Background bridge manager keeping Chrome CDP debugger active.
- **`semantic-browser.js`**: Core semantic evaluator providing AI agents with compact accessibility snapshots.
- **`browser-control.js`**: Direct CDP client executing clicks, typing, navigation, and frame handling.
- **`README-BN.md`**: Complete Bangla documentation and usage guide.
