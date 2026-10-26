import json, os
from PIL import Image

ROOT = r'\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\assets\argon'


def size_of(base, rel, report):
    p = os.path.join(base, rel)
    if not os.path.isfile(p):
        report['missing'].append(rel)
        return None
    try:
        with Image.open(p) as im:
            return im.size
    except Exception as e:
        report['bad'].append(f'{rel}: {e}')
        return None


def check_pair(base, it, report):
    sd = size_of(base, it['diffuse'], report)
    se = size_of(base, it['emission'], report)
    if sd and sd != (it['width'], it['height']):
        report['size_mismatch'].append(f"{it['id']}: manifest {it['width']}x{it['height']} vs file {sd[0]}x{sd[1]}")
    if sd and se and sd != se:
        report['size_mismatch'].append(f"{it['id']}: diffuse {sd} != emission {se}")
    if sd and se and sd == (it['width'], it['height']) and sd == se:
        report['ok'].append(it['id'])


def audit_batch2(base, manifest, report):
    fw, fh = manifest['frame_size']['width'], manifest['frame_size']['height']
    cols = sum(s['frames'] for s in manifest['states_column_order'])
    rows = len(manifest['directions_row_order'])
    exp = (cols * fw, rows * fh)
    for key, a in manifest['agents'].items():
        sd = size_of(base, a['sheet_diffuse'], report)
        se = size_of(base, a['sheet_emission'], report)
        if sd and sd != exp:
            report['size_mismatch'].append(f"{key} diffuse {sd} != expected {exp}")
        if sd and se and sd != se:
            report['size_mismatch'].append(f"{key} diffuse {sd} != emission {se}")
        if sd and se and sd == exp == se:
            report['ok'].append(key)
    size_of(base, manifest['shadow_file'], report)


def audit_batch5(base, manifest, report):
    for a in manifest['assets']:
        # Batch 5 manifest has no file paths; check for a matching file by id.
        hits = []
        for root, _, files in os.walk(base):
            for f in files:
                if f.lower().startswith(a['id'].lower()) and f.lower().endswith('.png'):
                    hits.append(os.path.join(root, f))
        if not hits:
            report['missing'].append(a['id'])
            continue
        report['ok'].append(a['id'])


BATCHES = [
    ('Batch2_Agents_Core', 'batch2_agents_manifest.json', audit_batch2),
    ('Batch3_Floor2_Identity_Props', 'batch3_floor2_manifest.json', None),
    ('Batch4_Tier2_3_Props', 'batch4_tier2_3_manifest.json', None),
    ('Batch5_Cybercat_and_Event_FX', 'batch5_manifest.json', audit_batch5),
]

for batch, mf, special in BATCHES:
    base = os.path.join(ROOT, batch)
    report = {'missing': [], 'bad': [], 'size_mismatch': [], 'ok': []}
    manifest = json.load(open(os.path.join(base, mf), encoding='utf-8'))
    if special:
        special(base, manifest, report)
    elif batch.startswith('Batch3'):
        for room in manifest['rooms'].values():
            for it in room['items']:
                check_pair(base, it, report)
    else:
        for zone in manifest['zones'].values():
            for it in zone['items']:
                check_pair(base, it, report)
    print(f"== {batch}: ok={len(report['ok'])} missing={len(report['missing'])} bad={len(report['bad'])} size_mismatch={len(report['size_mismatch'])}")
    for k in ('missing', 'bad', 'size_mismatch'):
        for line in report[k]:
            print(f"  [{k}] {line}")

print('== Batch1 (no manifest)')
b1 = os.path.join(ROOT, 'Batch1_Floor1_Core_Props', 'individual_png')
for f in sorted(os.listdir(b1)):
    with Image.open(os.path.join(b1, f)) as im:
        print(f"  B1 {f} {im.size}")

print('== Batch5 files')
b5 = os.path.join(ROOT, 'Batch5_Cybercat_and_Event_FX')
for root, _, files in os.walk(b5):
    for f in sorted(files):
        if f.endswith('.png'):
            print(f"  {os.path.relpath(os.path.join(root, f), b5)}")
