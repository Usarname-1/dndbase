#!/usr/bin/env python3
"""Собирает компактные индексы для автоссылок-подсказок:
   data/links.json   (редакция 2024)
   data14/links.json (редакция 2014)
Запуск из корня репозитория:  python3 tools/build_links.py
Перезапускайте после любого изменения файлов в data/ и data14/.

Формат записи: [name_ru, name_en, kind, slug, head, body, flag]
kind: s=заклинания, c=классы (только 2024), g=глоссарий, m=бестиарий, i=предметы, f=черты, a=статьи
flag: 1 = состояние 2014 (ссылка ставится только после слова «состояние»)
      2 = общий термин правил из глоссария (однословные — только с Заглавной в середине предложения)
"""
import json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return json.load(f)


def clean(s):
    s = re.sub(r'\*+', '', str(s or ''))
    return re.sub(r'\s+', ' ', s).strip()


def cut(s, n):
    s = clean(s)
    if len(s) <= n:
        return s
    return re.sub(r'\s+\S*$', '', s[:n]) + '…'


def btext(b):
    return clean(b.get('text') or ' '.join(b.get('items', []) or []))


def first_text(blocks, n=230):
    for b in blocks or []:
        t = btext(b)
        if len(t) > 25:
            return cut(t, n)
    return ''


def gloss_text(blocks, n=260):
    ts = [t for t in (btext(b) for b in blocks or []) if t]
    if ts and ts[0].endswith(':'):
        ts = ts[1:]
    return cut(' '.join(ts[:3]), n)


def cast_short(c):
    c = clean(c)
    if re.match(r'(?i)^реакц', c): return 'Реакция'
    if re.match(r'(?i)^бонус', c): return 'Бонусное действие'
    return re.split(r',| или ', c)[0].strip()


def spell(m):
    head = ' · '.join(x for x in [clean(m.get('line')), cast_short(m.get('cast_time')),
                                   clean(m.get('range')).split(' (')[0], clean(m.get('duration'))] if x)
    return head, first_text(m.get('blocks'))


def monster(m):
    sl = (f"{m.get('size_text', '')} рой {m.get('swarm_of', '')}" if m.get('swarm')
          else f"{m.get('size_text', '')} {m.get('type') or ''}").strip()
    if m.get('tags'):
        sl += f" ({', '.join(m['tags'])})"
    if m.get('alignment_text'):
        sl += f", {m['alignment_text']}"
    hp = (m.get('hp') or {}).get('avg')
    body = ' · '.join(x for x in [f"КД {m['ac']}" if m.get('ac') not in (None, '') else '',
                                  f"ХП {hp}" if hp is not None else '',
                                  f"БО {m['cr']}" if m.get('cr') else ''] if x)
    return sl, body


def item(m):
    head = clean(m.get('line') or m.get('type'))
    txt = first_text(m.get('blocks'), 200)
    return head, ' · '.join(x for x in [clean(m.get('price')), txt] if x)


def feat(m):
    pre = clean(m.get('prerequisite'))
    return ('Треб.: ' + pre if pre else clean(m.get('category') or m.get('line'))), first_text(m.get('blocks'))


GLOSS_OK = {'Состояния'}
GLOSS_NAMES = {'Тёмное зрение', 'Слепое зрение', 'Истинное зрение', 'Чувство вибрации'}


def build(edition):
    d = 'data' if edition == 24 else 'data14'
    out = []

    def add(m, kind, fn, flag=0):
        if m.get('slug') == 'intro' or not m.get('name_ru'):
            return
        head, body = fn(m)
        out.append([m['name_ru'], m.get('name_en') or '', kind, m['slug'], head, body] + ([flag] if flag else []))

    if edition == 24:
        for m in load(f'{d}/glossary.json'):
            strict = m.get('group') in GLOSS_OK or m['name_ru'] in GLOSS_NAMES   # состояния и чувства
            m = dict(m, name_ru=m['name_ru'].replace('C', 'С'))                    # латинская C в «Cмерти»
            add(m, 'g', lambda m: (clean(m.get('group')), gloss_text(m.get('blocks'))), 0 if strict else 2)
    else:
        art = next(a for a in load(f'{d}/articles.json') if a['slug'] == 'sostoyaniya')
        bl = art['blocks']
        for i, b in enumerate(bl):
            if b.get('type') == 'heading' and b.get('level') == 4 and i + 1 < len(bl):
                out.append([b['text'], '', 'a', 'sostoyaniya', 'Состояние', cut(btext(bl[i + 1]), 260), 1])
    if edition == 24:
        def klass(m):
            ct = ' · '.join(f"{clean(c['label'])}: {clean(c['value'])}" for c in (m.get('core_traits') or [])[:2])
            return 'Класс', cut(ct, 200)
        for m in load(f'{d}/class.json'):
            add(m, 'c', klass, 2)
    for m in load(f'{d}/spells.json'):   add(m, 's', spell)
    for m in load(f'{d}/feats.json'):    add(m, 'f', feat)
    for m in load(f'{d}/items.json'):    add(m, 'i', item)
    for m in load(f'{d}/bestiary.json'): add(m, 'm', monster)
    return out


for ed, path in ((24, 'data/links.json'), (14, 'data14/links.json')):
    rows = build(ed)
    p = os.path.join(ROOT, path)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{path}: {len(rows)} записей, {os.path.getsize(p) / 1024:.0f} КБ')
