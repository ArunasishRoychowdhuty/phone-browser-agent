import re, socket, subprocess, time, urllib.request
from pathlib import Path
from zeroconf import Zeroconf, ServiceBrowser

BASE = Path.home() / "phone-browser-agent"
SERVICE = "_adb-tls-connect._tcp.local."
LOCAL_PORT = 9224
LOG = BASE / "keeper.log"
STATUS = BASE / "status.txt"
DEVICE_FILE = BASE / "device.txt"

def log(message):
    line = time.strftime("[%Y-%m-%d %H:%M:%S] ") + message
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")

def run(args, timeout=4):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)

def adb_state(device):
    try:
        r = run(["adb", "-s", device, "get-state"], 3)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""

def wlan_ip():
    try:
        r = run(["ifconfig"], 3)
        m = re.search(r"wlan0.*?inet\s+([0-9.]+)", r.stdout, re.DOTALL)
        if m:
            return m.group(1)
        r = run(["ifconfig", "wlan0"], 3)
        m = re.search(r"inet\s+([0-9.]+)", r.stdout)
        return m.group(1) if m else None
    except Exception:
        return None

class Listener:
    def __init__(self):
        self.items = []
    def add_service(self, zc, service_type, name):
        info = zc.get_service_info(service_type, name)
        if not info:
            return
        model = info.properties.get(b"name", b"").decode("utf-8", "ignore")
        if "moto g64" not in model.lower():
            return
        for raw in info.addresses:
            if len(raw) == 4:
                self.items.append((socket.inet_ntoa(raw), info.port, model))
    def update_service(self, *args): pass
    def remove_service(self, *args): pass

def mdns_device():
    zc = Zeroconf()
    listener = Listener()
    ServiceBrowser(zc, SERVICE, listener)
    time.sleep(2.5)
    zc.close()
    if not listener.items:
        return None
    ip = wlan_ip()
    items = [x for x in listener.items if not ip or x[0] == ip]
    if not items:
        items = listener.items
    address, port, _ = items[-1]
    return f"{address}:{port}"

def scan_device():
    ip = wlan_ip()
    if not ip:
        log("Wi-Fi interface has no IPv4 address.")
        return None
    log(f"mDNS unavailable; scanning ADB candidates on {ip}.")
    try:
        r = run(["nmap", "-Pn", "-n", "-p35000-45000", "--open",
                 "-T5", "--min-rate", "4000", "--max-retries", "0", ip], 25)
    except Exception as e:
        log(f"Port scan failed: {e}")
        return None
    ports = re.findall(r"^(\d+)/tcp\s+open", r.stdout, re.M)
    for port in ports:
        device = f"{ip}:{port}"
        try:
            connect = run(["adb", "connect", device], 2)
            if adb_state(device) == "device":
                log(f"ADB endpoint found: {device}")
                return device
        except Exception:
            pass
        try:
            run(["adb", "disconnect", device], 1)
        except Exception:
            pass
    return None

def cdp_ok():
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{LOCAL_PORT}/json/version", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False

def forward(device):
    run(["adb", "forward", "--remove", f"tcp:{LOCAL_PORT}"], 2)
    r = run(["adb", "-s", device, "forward", f"tcp:{LOCAL_PORT}",
             "localabstract:chrome_devtools_remote"], 4)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip() or "ADB forward failed")
    if not cdp_ok():
        try:
            p = run(["adb", "-s", device, "shell", "pidof", "com.android.chrome"], 3)
            if not p.stdout.strip():
                run(["adb", "-s", device, "shell", "monkey", "-p", "com.android.chrome", "1"], 5)
                time.sleep(2)
                run(["adb", "-s", device, "forward", f"tcp:{LOCAL_PORT}",
                     "localabstract:chrome_devtools_remote"], 4)
        except Exception:
            pass
    return cdp_ok()

def main():
    BASE.mkdir(parents=True, exist_ok=True)
    run(["adb", "start-server"], 5)
    current = None
    log("Phone UI bridge keeper started.")
    while True:
        try:
            if current and adb_state(current) == "device":
                if not cdp_ok():
                    try:
                        if forward(current):
                            log(f"Chrome DevTools restored for {current}.")
                    except Exception as e:
                        log(f"Forward retry: {e}")
                if cdp_ok():
                    STATUS.write_text(f"READY: {current}; ADB + Chrome CDP at 127.0.0.1:{LOCAL_PORT}", encoding="utf-8")
                    DEVICE_FILE.write_text(current, encoding="utf-8")
                else:
                    STATUS.write_text(f"ADB_ONLY: {current}; Chrome DevTools not responding.", encoding="utf-8")
                time.sleep(5)
                continue

            if current:
                log(f"ADB endpoint went offline: {current}")
                current = None

            candidate = mdns_device()
            if not candidate:
                candidate = scan_device()

            if candidate:
                try:
                    run(["adb", "connect", candidate], 4)
                    if adb_state(candidate) == "device":
                        current = candidate
                        DEVICE_FILE.write_text(current, encoding="utf-8")
                        log(f"ADB connected: {current}")
                        if forward(current):
                            STATUS.write_text(f"READY: {current}; ADB + Chrome CDP at 127.0.0.1:{LOCAL_PORT}", encoding="utf-8")
                            log(f"READY: ADB + Chrome CDP at {current}")
                        else:
                            STATUS.write_text(f"ADB_ONLY: {current}; Chrome DevTools not responding.", encoding="utf-8")
                    else:
                        log(f"Candidate did not reach device state: {candidate}")
                except Exception as e:
                    log(f"Connect failed for {candidate}: {e}")
            if not current:
                STATUS.write_text("WAITING: Wireless debugging is on, but no ADB endpoint was found. Keep Wi-Fi and Wireless debugging on.", encoding="utf-8")
                time.sleep(5)
        except Exception as e:
            log(f"Keeper retry: {e}")
            STATUS.write_text(f"RETRYING: {e}", encoding="utf-8")
            time.sleep(5)

if __name__ == "__main__":
    main()
