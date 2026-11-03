#!/usr/bin/env python3
"""RNA Router Tray Indicator — kecil, background, cek status server."""
import os, urllib.request, threading, time
try:
    from pystray import Icon, Menu, MenuItem
    from PIL import Image, ImageDraw
except ImportError:
    print("Install: pip install pystray Pillow")
    raise SystemExit(1)

def make_icon():
    img = Image.new("RGBA", (64, 64), (10, 15, 28))
    draw = ImageDraw.Draw(img)
    draw.ellipse((16, 16, 48, 48), fill=(0, 234, 253))
    return img

status_text = "RNA Router: Checking..."

def check():
    global status_text
    try:
        urllib.request.urlopen("http://localhost:3000/api/v1/models", timeout=2)
        status_text = "RNA Router: ONLINE"
    except Exception:
        status_text = "RNA Router: OFFLINE"

def setup_menu(icon):
    def open_usage(icon, item):
        os.system("xdg-open http://localhost:3000/usage >/dev/null 2>&1 &")
    def stop_server(icon, item):
        os.system("bash /home/user/RNA-Router/cli.js stop >/dev/null 2>&1")
    def start_server(icon, item):
        os.system("nohup bash /home/user/RNA-Router/cli.js start --bg >/dev/null 2>&1 &")
    return Menu(
        MenuItem("Status: " + status_text, lambda i, i2: None, enabled=False),
        MenuItem("Usage Analytics", open_usage),
        MenuItem("Start Server", start_server),
        MenuItem("Stop Server", stop_server),
        MenuItem("Keluar", lambda i, item: icon.stop()),
    )

def run():
    icon = Icon("rna", icon=make_icon(), menu=setup_menu)
    def loop():
        while True:
            check()
            time.sleep(5)
    threading.Thread(target=loop, daemon=True).start()
    icon.run()

if __name__ == "__main__":
    run()
