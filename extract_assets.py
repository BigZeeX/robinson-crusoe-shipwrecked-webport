import os, struct, json, re

extracted_dir = '/root/java-web-port/extracted'
public_data = '/root/java-web-port/public/data'
os.makedirs(public_data, exist_ok=True)

# 1. Parse D0
d0_path = os.path.join(extracted_dir, 'data/D0')
with open(d0_path, 'rb') as f:
    d = f.read()

counts = struct.unpack('<15H', d[:30])
offset = 30
sheets = []
for sheet_idx, count in enumerate(counts):
    sprites = []
    for s_idx in range(count):
        sx, sy, w, h, ox, oy = struct.unpack_from('<6h', d, offset)
        offset += 12
        sprites.append({
            'id': s_idx,
            'sheet': sheet_idx,
            'image': f'BS{sheet_idx}.png',
            'sx': int(sx),
            'sy': int(sy),
            'w': int(w),
            'h': int(h),
            'ox': int(ox),
            'oy': int(oy)
        })
    sheets.append(sprites)

with open(os.path.join(public_data, 'sprites.json'), 'w') as f:
    json.dump({
        'counts': list(counts),
        'sheets': sheets
    }, f, indent=2)

print('Saved sprites.json')

# 2. Parse strings from D0
def parse_all_strings(d, start_offset):
    p = start_offset
    strings = []
    while p < len(d):
        chars = []
        while p < len(d):
            b = d[p]; p += 1
            if b == 0:
                break
            ch = b & 0x7F
            if b & 0x80:
                if p < len(d):
                    b2 = d[p]; p += 1
                    ch |= (b2 & 0x7F) << 7
                    if b2 & 0x80 and p < len(d):
                        b3 = d[p]; p += 1
                        ch |= (b3 & 0x7F) << 14
            chars.append(chr(ch))
        s = ''.join(chars)
        if s:
            strings.append(s)
    return strings

all_strings = parse_all_strings(d, 9366)
with open(os.path.join(public_data, 'strings.json'), 'w') as f:
    json.dump({
        'strings': all_strings
    }, f, indent=2)

print(f'Saved strings.json ({len(all_strings)} strings)')

# 3. Parse objects.csv
csv_path = os.path.join(extracted_dir, 'objects.csv')
with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
    csv_rows = [line.strip().split(';') for line in f if line.strip()]

objects = []
num_objects = len(csv_rows[0])
for col in range(num_objects):
    col_data = [row[col] if col < len(row) else '' for row in csv_rows]
    
    # Recipe in row 8
    recipe_str = col_data[8] if len(col_data) > 8 else '-1'
    recipe = []
    if recipe_str and recipe_str != '-1':
        for part in recipe_str.split('#'):
            if '|' in part:
                iid, qty = part.split('|')
                try:
                    recipe.append({'id': int(iid), 'count': int(qty)})
                except:
                    pass
    
    # Required tool in row 9
    tool_str = col_data[9] if len(col_data) > 9 else '-1'
    tool = []
    if tool_str and tool_str != '-1':
        for part in tool_str.split('#'):
            if '|' in part:
                tid, tqty = part.split('|')
                try:
                    tool.append({'id': int(tid), 'count': int(tqty)})
                except:
                    pass

    def to_int(v, default=0):
        try: return int(v)
        except: return default

    obj = {
        'id': col,
        'row0': to_int(col_data[0]),
        'row1': to_int(col_data[1]),
        'row2': to_int(col_data[2]),
        'hunger': to_int(col_data[3]),
        'energy': to_int(col_data[4]),
        'row5': to_int(col_data[5]),
        'health': to_int(col_data[6]),
        'isCraftable': to_int(col_data[7]) == 1,
        'recipe': recipe,
        'tool': tool,
        'row10': to_int(col_data[10]),
        'row11': to_int(col_data[11]),
        'row12': to_int(col_data[12]),
    }
    objects.append(obj)

with open(os.path.join(public_data, 'objects.json'), 'w') as f:
    json.dump({
        'objects': objects
    }, f, indent=2)

print(f'Saved objects.json ({len(objects)} objects)')
