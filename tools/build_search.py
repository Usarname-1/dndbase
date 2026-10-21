#!/usr/bin/env python3
"""Индекс глобального поиска.
  data/search.json, data14/search.json — названия: [name_ru, name_en, раздел, slug, подпись];
  data/text/<раздел>.json, data14/text/<раздел>.json — полный текст записей для поиска «по тексту»: список строк,
  порядок тот же, что у записей этого раздела в search.json.
Запуск: python3 tools/build_search.py"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECTIONS = {
    'data': ['bestiary', 'spells', 'class', 'species', 'backgrounds', 'feats', 'items', 'equipment', 'glossary'],
    'data14': ['bestiary', 'spells', 'class', 'race', 'backgrounds', 'feats', 'items', 'glossary', 'articles'],
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
    if k == 'glossary':
        return m.get('group') or ''
    if k == 'articles':
        return (m['parent_name'] + ' · ' + str(m['part']) + '/' + str(len(m['parts']))) if m.get('parent') else (m.get('category_ru') or '')
    if k == 'race':
        return ' / '.join(m.get('sizes') or [])
    return ''

# служебные поля, которых нет в тексте карточки
SKIP = {'type', 'kind', 'key', 'id', 'slug', 'section', 'edition', 'sources', 'url', 'url_2024', 'id_2024', 'homebrew',
        'name_ru', 'name_en', 'alignment', 'saves_proficient', 'comp', 'cr', 'sizes', 'speed', 'abilities', 'swarm', 'named_npc'}

def texts(o, out):
    if isinstance(o, str):
        out.append(o)
    elif isinstance(o, list):
        for x in o:
            texts(x, out)
    elif isinstance(o, dict):
        for k, v in o.items():
            if k not in SKIP:
                texts(v, out)

def flat(m):
    parts = []
    texts(m, parts)
    t = ' '.join(p for p in parts if len(p.strip()) > 1 and not re.fullmatch(r'[\d\s.,+\-–−/()%]*', p))
    return re.sub(r'\s+', ' ', t.replace('*', '')).strip()

for d, keys in SECTIONS.items():
    out = []
    os.makedirs(os.path.join(ROOT, d, 'text'), exist_ok=True)
    for k in keys:
        tx = []
        for m in json.load(open(os.path.join(ROOT, d, k + '.json'), encoding='utf-8')):
            if not m.get('slug') or not m.get('name_ru'):
                continue
            out.append([m['name_ru'], m.get('name_en') or '', k, m['slug'], sub(k, m)])
            tx.append(flat(m))
        tp = os.path.join(ROOT, d, 'text', k + '.json')
        json.dump(tx, open(tp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print('  ', tp, len(tx), os.path.getsize(tp) // 1024, 'КБ')
    p = os.path.join(ROOT, d, 'search.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(p, len(out), os.path.getsize(p) // 1024, 'КБ')
