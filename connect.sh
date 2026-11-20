#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

LOCAL_PORT="${CDP_PORT:-9224}"
DEVICE="$(python "$(dirname "$0")/discover-device.py")"

echo "Discovered Android device: $DEVICE"
adb start-server >/dev/null
adb connect "$DEVICE"
adb -s "$DEVICE" wait-for-device
adb -s "$DEVICE" shell monkey -p com.android.chrome 1 >/dev/null 2>&1 || true
sleep 2
adb forward --remove "tcp:$LOCAL_PORT" >/dev/null 2>&1 || true
adb -s "$DEVICE" forward "tcp:$LOCAL_PORT" localabstract:chrome_devtools_remote
curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:$LOCAL_PORT/json/version" >/dev/null
CDP_URL="http://127.0.0.1:$LOCAL_PORT" node "$(dirname "$0")/attach.js"
