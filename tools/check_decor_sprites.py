import json, re

src = open(r'web/app.js', encoding='utf-8').read()
block = re.search(r'function getAtlasFrameName.*?\}\)\[name\]', src, re.S).group(0)
ids = set(re.findall(r"'([0-9][0-9_a-z]+)'", block))
sprites = json.load(open(r'assets/voxel/atlas/argon_office_furniture.json', encoding='utf-8'))['sprites']
missing = sorted(i for i in ids if i not in sprites)
print('checked', len(ids), 'missing', missing)
