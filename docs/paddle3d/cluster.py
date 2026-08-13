import sys, json
S = sys.argv[3]
sys.path.insert(0, f"{S}/forge/stage4_review"); sys.path.insert(0, f"{S}/forge")
from diagnose_render import load_image, build_foreground_mask, srgb_to_lab, lab_kmeans_palette, lab_distance
from pathlib import Path
spec = json.load(open(f"{sys.argv[1]}/object-sculpt-spec.json"))
w,h,px,_ = load_image(Path(sys.argv[2])); mask,_,_ = build_foreground_mask(w,h,px)
cl = lab_kmeans_palette([srgb_to_lab((r,g,b)) for (r,g,b,a),k in zip(px,mask) if k], k=5)
worst = 0
for c in spec["componentTree"]:
    rec = c.get("colorMaterialRecipe")
    if not rec: continue
    t = rec["dominantAlbedo"]; t = t[t.index("(")+1:t.index(")")]
    r,g,b = (int(float(p)) for p in t.split(",")[:3])
    d = min(lab_distance(srgb_to_lab((r,g,b)), x["center"]) for x in cl)
    worst = max(worst, d)
    print(f"  {c['id']:18s} deltaE {d:6.2f}")
print("max", round(worst,2), "threshold 20.0", "PASS" if worst <= 20 else "FAIL")
