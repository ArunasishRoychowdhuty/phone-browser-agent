#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

BASE="$HOME/phone-browser-agent"
DEVICE_FILE="$BASE/device.txt"

get_device() {
  local dev=""
  if [[ -f "$DEVICE_FILE" ]]; then
    dev="$(cat "$DEVICE_FILE" 2>/dev/null || true)"
    if [[ -n "$dev" ]] && [[ "$(adb -s "$dev" get-state 2>/dev/null || true)" == "device" ]]; then
      echo "$dev"
      return 0
    fi
  fi
  dev="$(adb devices | awk '$2=="device" {print $1; exit}')"
  if [[ -n "$dev" ]]; then
    echo "$dev"
    return 0
  fi
  echo "No live ADB device. Start keepalive.py and keep Wireless debugging enabled." >&2
  return 1
}

usage() {
  echo "Usage:"
  echo "  phone-ui.sh status"
  echo "  phone-ui.sh tap X Y"
  echo "  phone-ui.sh swipe X1 Y1 X2 Y2 [DURATION_MS]"
  echo "  phone-ui.sh type TEXT..."
  echo "  phone-ui.sh key KEYCODE"
  echo "  phone-ui.sh screenshot [OUTPUT_PNG]"
}

[[ $# -ge 1 ]] || { usage; exit 2; }
ACTION="$1"; shift
DEVICE="$(get_device)"

case "$ACTION" in
  status)
    echo "ADB_DEVICE=$DEVICE"
    echo "ADB_STATE=$(adb -s "$DEVICE" get-state)"
    adb -s "$DEVICE" shell wm size
    echo "CDP:"
    curl --fail --silent --show-error --max-time 3 http://127.0.0.1:9224/json/version || true
    ;;
  tap)
    [[ $# -eq 2 ]] || { usage; exit 2; }
    adb -s "$DEVICE" shell input tap "$1" "$2"
    ;;
  swipe)
    [[ $# -ge 4 ]] || { usage; exit 2; }
    DURATION="${5:-400}"
    adb -s "$DEVICE" shell input swipe "$1" "$2" "$3" "$4" "$DURATION"
    ;;
  type)
    [[ $# -ge 1 ]] || { usage; exit 2; }
    VALUE="$*"
    ENCODED="${VALUE// /%s}"
    adb -s "$DEVICE" shell input text "$ENCODED"
    ;;
  key)
    [[ $# -eq 1 ]] || { usage; exit 2; }
    adb -s "$DEVICE" shell input keyevent "$1"
    ;;
  screenshot)
    OUT="${1:-$BASE/screenshot.png}"
    mkdir -p "$(dirname "$OUT")"
    adb -s "$DEVICE" exec-out screencap -p > "$OUT"
    echo "SCREENSHOT=$OUT"
    ;;
  *)
    usage
    exit 2
    ;;
esac
