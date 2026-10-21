#!/usr/bin/env python3
"""Делит длинные составные статьи раздела «Правила и статьи» (2014) на отдельные части по заголовкам.
Правила:
  • статьи короче MIN_ARTICLE не трогаем;
  • часть начинается с заголовка самого крупного уровня, который встречается в статье минимум дважды;
  • части короче MIN_PART присоединяются к предыдущей (самая первая — к следующей);
  • часть длиннее MAX_PART делится ещё раз по заголовкам следующего уровня.
Каждая часть — отдельная запись: slug «<статья>--<номер>», name_ru — заголовок части, parent / parent_name — статья,
part — номер, parts — список всех частей статьи (для вкладок). Скрипт можно запускать повторно: перед делением
части склеиваются обратно, поэтому параметры можно менять. Запуск: python3 tools/split_articles.py"""
import json, os, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data14', 'articles.json')
MIN_ARTICLE, MIN_PART, MAX_PART = 12000, 2500, 30000
size = lambda bs: len(json.dumps(bs, ensure_ascii=False))
PART_KEYS = ('parent', 'parent_name', 'part', 'parts')

def cut(blocks, title, level_floor=0):
    """Список (заголовок, блоки). Делит по самому крупному уровню (> level_floor), встречающемуся ≥ 2 раз."""
    lv = collections.Counter(b.get('level') for b in blocks if b['type'] == 'heading' and (b.get('level') or 0) > level_floor)
    cand = [l for l, c in lv.items() if c >= 2]
    if not cand:
        return [(title, blocks)], level_floor
    L = min(cand)
    parts, cur, t = [], [], title
    for b in blocks:
        if b['type'] == 'heading' and b.get('level') == L:
            if cur: parts.append((t, cur)); cur = []
            t = b['text']
        cur.append(b)
    parts.append((t, cur))
    out = []
    for t, bs in parts:
        if out and size(bs) < MIN_PART: out[-1] = (out[-1][0], out[-1][1] + bs)
        else: out.append((t, bs))
    if len(out) > 1 and size(out[0][1]) < MIN_PART:
        out[1] = (out[1][0], out[0][1] + out[1][1]); out.pop(0)
    return out, L

def split(m):
    if size(m['blocks']) < MIN_ARTICLE: return None
    top, L = cut(m['blocks'], m['name_ru'])
    if len(top) < 2: return None
    res = []
    for t, bs in top:
        if size(bs) > MAX_PART:
            sub, _ = cut(bs, t, L)
            if len(sub) > 1:
                res += [(t if i == 0 else f'{t} — {st}', sb) for i, (st, sb) in enumerate(sub)]
                continue
        res.append((t, bs))
    return res

def main():
    src = json.load(open(PATH, encoding='utf-8'))
    # склеиваем обратно ранее разделённые статьи
    whole, order = {}, []
    for m in src:
        if 'parent' in m:
            p = m['parent']
            if p not in whole:
                whole[p] = {**{k: v for k, v in m.items() if k not in PART_KEYS}, 'slug': p, 'name_ru': m['parent_name'], 'blocks': []}
                order.append(p)
            whole[p]['blocks'] += m['blocks']
            if m['part'] == 1: whole[p]['name_en'] = m.get('name_en', '')
        else:
            whole[m['slug']] = m; order.append(m['slug'])
    out, n_split, n_parts = [], 0, 0
    for s in order:
        m = whole[s]
        parts = split(m)
        if not parts: out.append(m); continue
        n_split += 1; n_parts += len(parts)
        lst = [{'slug': f'{s}--{i + 1}', 'name': t} for i, (t, _) in enumerate(parts)]
        for i, (t, bs) in enumerate(parts):
            e = {k: v for k, v in m.items() if k not in ('blocks', 'name_ru', 'name_en', 'slug')}
            e.update(slug=f'{s}--{i + 1}', name_ru=t, name_en=m.get('name_en', '') if i == 0 else '', blocks=bs,
                     parent=s, parent_name=m['name_ru'], part=i + 1, parts=lst)
            out.append(e)
    json.dump(out, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'статей: {len(order)}, разделено: {n_split} → частей: {n_parts}; записей теперь: {len(out)}')

if __name__ == '__main__': main()
