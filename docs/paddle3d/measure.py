"""Measure each material on its own visible footprint, locating regions from the render's mask
rather than from hardcoded boxes (per grimoire/review/divine_eye_microscope.md)."""
from PIL import Image
import numpy as np, sys
W, tag = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "material-0")
a = np.array(Image.open(f"{W}/renders/{tag}.png").convert("RGB")).astype(int)
m = a.mean(2) < 245
ys, xs = np.where(m); y0, y1 = ys.min(), ys.max(); H = y1 - y0
def band(fy0, fy1, inset):
    o = []
    for y in range(int(y0 + fy0 * H), int(y0 + fy1 * H)):
        r = np.where(m[y])[0]
        if len(r) < 8: continue
        lo, hi = r.min(), r.max(); w = hi - lo
        o.append(a[y, lo + int(w * inset[0]) : lo + max(lo + 1, int(w * inset[1])) if False else hi - int(w * (1 - inset[1]))])
    return np.concatenate(o) if o else np.zeros((1, 3))
def med(fy0, fy1, i0, i1):
    o = []
    for y in range(int(y0 + fy0 * H), int(y0 + fy1 * H)):
        r = np.where(m[y])[0]
        if len(r) < 8: continue
        lo, hi = r.min(), r.max(); w = hi - lo
        o.append(a[y, lo + int(w * i0): lo + int(w * i1)])
    c = np.concatenate([x for x in o if len(x)]) if o else np.zeros((1, 3))
    return np.median(c, 0).astype(int)
tgt = {"face": (59, 71, 71), "guard": (56, 67, 68), "gold": (182, 153, 92), "grip": (229, 212, 183)}
got = {
    "face":  med(0.60, 0.68, 0.12, 0.40),   # clean plate below the decal, inboard of the guard
    "guard": med(0.30, 0.45, 0.005, 0.030), # the rim band itself
    "gold":  med(0.688, 0.697, 0.25, 0.75), # the collar's middle ring
    "grip":  med(0.80, 0.88, 0.25, 0.75),
}
tot = 0
for k in tgt:
    d = np.array(got[k]) - np.array(tgt[k]); e = float(np.abs(d).mean()); tot += e
    print(f"{k:6s} target {tgt[k]}  render {tuple(int(v) for v in got[k])}  meanAbsDelta {e:5.1f}")
print(f"overall meanAbsDelta {tot/len(tgt):.1f}")
