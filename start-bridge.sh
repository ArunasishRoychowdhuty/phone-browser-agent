#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
BASE="$HOME/phone-browser-agent"
mkdir -p "$BASE"
PIDFILE="$BASE/keeper.pid"
if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "KEEPER_ALREADY_RUNNING PID=$(cat "$PIDFILE")"
else
  nohup python "$BASE/keepalive.py" > "$BASE/keeper.stdout" 2>&1 < /dev/null &
  echo $! > "$PIDFILE"
  echo "KEEPER_STARTED PID=$(cat "$PIDFILE")"
fi
for i in $(seq 1 30); do
  if [[ -f "$BASE/status.txt" ]] && grep -qE 'READY|ADB_ONLY' "$BASE/status.txt"; then
    break
  fi
  sleep 1
done
echo "BRIDGE_STATUS:"
cat "$BASE/status.txt" 2>/dev/null || echo "WAITING"
echo "DEVICE:"
cat "$BASE/device.txt" 2>/dev/null || echo "not discovered yet"
