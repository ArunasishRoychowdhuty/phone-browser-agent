import socket
import time
from zeroconf import Zeroconf, ServiceBrowser

SERVICE = "_adb-tls-connect._tcp.local."

class Listener:
    def __init__(self):
        self.matches = []

    def add_service(self, zc, service_type, name):
        info = zc.get_service_info(service_type, name)
        if not info:
            return
        device_name = info.properties.get(b"name", b"").decode("utf-8", "ignore")
        if "moto g64" not in device_name.lower():
            return
        addresses = [socket.inet_ntoa(a) for a in info.addresses if len(a) == 4]
        for address in addresses:
            self.matches.append((address, info.port, device_name))

    def update_service(self, *args):
        pass

    def remove_service(self, *args):
        pass

zc = Zeroconf()
listener = Listener()
browser = ServiceBrowser(zc, SERVICE, listener)
time.sleep(5)
zc.close()

if not listener.matches:
    raise SystemExit("NO_ADB_CONNECT_SERVICE_FOUND")

address, port, name = listener.matches[-1]
print(f"{address}:{port}")
