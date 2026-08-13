"""Capture turntable + map-stripped renders of the paddle review page."""
import sys
from playwright.sync_api import sync_playwright

out_dir, angles, tag = sys.argv[1], [int(a) for a in sys.argv[2].split(",")], sys.argv[3]
strip = len(sys.argv) > 4 and sys.argv[4] == "strip"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1100, "height": 1100}, device_scale_factor=1)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:3000/paddle-3d", wait_until="networkidle")
    pg.wait_for_function("window.__paddleReady === true", timeout=30000)
    pg.wait_for_timeout(1800)
    el = pg.locator("#paddle-review-canvas")
    for a in angles:
        pg.evaluate(f"window.__paddleSetAzimuth({a})")
        pg.wait_for_timeout(220)
        el.screenshot(path=f"{out_dir}/{tag}-{a}.png")
        print(f"{out_dir}/{tag}-{a}.png")
    if strip:
        pg.evaluate("window.__paddleStripMaps(true)")
        for a in angles:
            pg.evaluate(f"window.__paddleSetAzimuth({a})")
            pg.wait_for_timeout(220)
            el.screenshot(path=f"{out_dir}/{tag}-clay-{a}.png")
            print(f"{out_dir}/{tag}-clay-{a}.png")
    if errs:
        print("PAGE ERRORS:", *errs[:6], sep="\n  ")
    b.close()

