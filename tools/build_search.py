#!/usr/bin/env python3
"""Индекс глобального поиска: data/search.json (2024) и data14/search.json (2014).
Запись: [name_ru, name_en, раздел, slug, подпись]. Запуск: python3 tools/build_search.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECTIONS = {
    'data': ['bestiary', 'spells', 'class', 'species', 'backgrounds', 'feats', 'items', 'equipment', 'glossary'],
    'data14': ['bestiary', 'spells', 'class', 'race', 'backgrounds', 'feats', 'items', 'articles'],
}

def sub(k, m):
    if k == 'bestiary':
        return ('БО ' + str(m['cr'])) if m.get('cr') not in (None, '') else ''
    if k == 'spells':
        return (str(m['level']) + ' ур.') if m.get('level') else 'заговор'
    if k == 'items':
        return m.get('rarity') or ''
    if k == 'equipment':
        return m.get('cost') or ''
    if k == 'feats':
        return (m.get('category') or '').replace(' черта', '').replace('Черта ', '')
    if k == 'articles':
        return m.get('category_ru') or ''
    if k == 'race':
        return ' / '.join(m.get('sizes') or [])
    return ''

for d, keys in SECTIONS.items():
    out = []
    for k in keys:
        for m in json.load(open(os.path.join(ROOT, d, k + '.json'), encoding='utf-8')):
            if not m.get('slug') or not m.get('name_ru'):
                continue
            out.append([m['name_ru'], m.get('name_en') or '', k, m['slug'], sub(k, m)])
    p = os.path.join(ROOT, d, 'search.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(p, len(out), os.path.getsize(p) // 1024, 'КБ')
