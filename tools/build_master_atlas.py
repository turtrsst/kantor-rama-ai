import json, os
from PIL import Image

ROOT = r'\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai'
ARGON = os.path.join(ROOT, 'assets', 'argon')

# Collect all items
items = []

# Batch 1
b1_meta = json.load(open(os.path.join(ARGON, 'Batch1_Floor1_Core_Props', 'batch1_manifest.json'), encoding='utf-8'))
for p in b1_meta['props']:
    pid = p['id']
    diff_p = os.path.join(ARGON, 'Batch1_Floor1_Core_Props', 'individual_png', f"{pid}.png")
    em_p = os.path.join(ARGON, 'Batch1_Floor1_Core_Props', 'individual_emissions', f"{pid}_emission.png")
    # tiles
    st = p['size_tiles'].split('x')
    cols, rows = int(st[0]), int(st[1])
    items.append({
        'id': pid,
        'name': pid,
        'diffuse': diff_p,
        'emission': em_p if os.path.exists(em_p) else None,
        'cols': cols,
        'rows': rows,
        'w': p['dimensions']['width'],
        'h': p['dimensions']['height']
    })

# Batch 3
b3_meta = json.load(open(os.path.join(ARGON, 'Batch3_Floor2_Identity_Props', 'batch3_floor2_manifest.json'), encoding='utf-8'))
for rk, rm in b3_meta['rooms'].items():
    for it in rm['items']:
        iid = it['id']
        diff_p = os.path.join(ARGON, 'Batch3_Floor2_Identity_Props', it['diffuse'])
        em_p = os.path.join(ARGON, 'Batch3_Floor2_Identity_Props', it['emission'])
        cols = max(1, it['width'] // 32)
        rows = max(1, it['height'] // 32)
        items.append({
            'id': iid,
            'name': iid,
            'diffuse': diff_p,
            'emission': em_p if os.path.exists(em_p) else None,
            'cols': cols,
            'rows': rows,
            'w': it['width'],
            'h': it['height']
        })

# Batch 4
b4_meta = json.load(open(os.path.join(ARGON, 'Batch4_Tier2_3_Props', 'batch4_tier2_3_manifest.json'), encoding='utf-8'))
for zk, zn in b4_meta['zones'].items():
    for it in zn['items']:
        iid = it['id']
        diff_p = os.path.join(ARGON, 'Batch4_Tier2_3_Props', it['diffuse'])
        em_p = os.path.join(ARGON, 'Batch4_Tier2_3_Props', it['emission'])
        cols = max(1, it['width'] // 32)
        rows = max(1, it['height'] // 32)
        items.append({
            'id': iid,
            'name': iid,
            'diffuse': diff_p,
            'emission': em_p if os.path.exists(em_p) else None,
            'cols': cols,
            'rows': rows,
            'w': it['width'],
            'h': it['height']
        })

print(f"Total collected items for master atlas: {len(items)}")

# Layout in an atlas
# Atlas dimensions: let's pack into width = 512, row by row with 4px padding
ATLAS_W = 512
cur_x = 0
cur_y = 0
row_h = 0
padding = 4

atlas_sprites = {}
placed_items = []

for it in items:
    w, h = it['w'], it['h']
    if cur_x + w > ATLAS_W:
        cur_x = 0
        cur_y += row_h + padding
        row_h = 0
    placed_items.append((it, cur_x, cur_y))
    # pivot standard: center bottom of the prop
    pivot_x = w // 2
    pivot_y = h
    atlas_sprites[it['id']] = {
        'frame': { 'x': cur_x, 'y': cur_y, 'w': w, 'h': h },
        'pivot': { 'x': pivot_x, 'y': pivot_y },
        'grid_occupancy': { 'cols': it['cols'], 'rows': it['rows'] },
        'has_emission': it['emission'] is not None
    }
    cur_x += w + padding
    if h > row_h:
        row_h = h

ATLAS_H = cur_y + row_h + padding
print(f"Computed atlas size: {ATLAS_W}x{ATLAS_H}")

# Create master images
atlas_diffuse = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
atlas_emission = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))

for it, px, py in placed_items:
    with Image.open(it['diffuse']).convert("RGBA") as d_im:
        atlas_diffuse.paste(d_im, (px, py))
    if it['emission'] and os.path.exists(it['emission']):
        with Image.open(it['emission']).convert("RGBA") as e_im:
            atlas_emission.paste(e_im, (px, py))

# Save directly to assets/voxel/atlas
ATLAS_DIR = os.path.join(ROOT, 'assets', 'voxel', 'atlas')
os.makedirs(ATLAS_DIR, exist_ok=True)

# Nama argon_* agar tidak menimpa atlas legacy yang dipakai app.js.
diff_out = os.path.join(ATLAS_DIR, 'argon_office_furniture_diffuse.png')
em_out = os.path.join(ATLAS_DIR, 'argon_office_furniture_emission.png')
meta_out = os.path.join(ATLAS_DIR, 'argon_office_furniture.json')

atlas_diffuse.save(diff_out, "PNG")
atlas_emission.save(em_out, "PNG")

manifest_data = {
    "texture_file": "argon_office_furniture_diffuse.png",
    "emission_file": "argon_office_furniture_emission.png",
    "grid_size": 32,
    "sprites": atlas_sprites
}

with open(meta_out, 'w', encoding='utf-8') as f:
    json.dump(manifest_data, f, indent=2)

print(f"SUCCESS: Saved {len(atlas_sprites)} sprites to {meta_out}")
