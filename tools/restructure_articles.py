#!/usr/bin/env python3
"""Единовременное преобразование раздела «Правила и статьи» 2014 в стиле глоссария 2024.
  • статьи с правилами и терминами (действия, состояния, использование характеристик…) разбиваются на отдельные
    записи-термины → data14/glossary.json (group = название статьи);
  • конкретные яды и вещества из статей «Яды» и «Наркотики и вещества» становятся магическими предметами
    → дописываются в data14/items.json (id «art-…»), а виды ядов («Оружейный яд» и т. д.) — терминами глоссария;
  • остальные статьи (лор, бестиарий, расы, каталоги) остаются в data14/articles.json и делятся на части
    (tools/split_articles.py).
Скрипт меняет исходные данные и запускается один раз; потом пересоберите индексы:
  python3 tools/build_links.py && python3 tools/build_search.py"""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import split_articles
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data14')
ART, GLO, ITM = (os.path.join(D, f) for f in ('articles.json', 'glossary.json', 'items.json'))

# статьи, которые целиком превращаются в записи глоссария
GLOSSARY = ['actions', 'using_ability_scores', 'sostoyaniya', 'bolezni', 'madness', 'movement-and-position',
            'okruzhayuschaya_sreda_i_ukrytiya', 'ispolzovanie_zaklinanij', 'multiclassing', 'inspiration', 'languages',
            'food-drink-and-lodging', 'downtime-activities', 'main_formulas', 'mixing-potions', 'combat-encounter-difficulty',
            'ten-rules-to-remember', 'tiers_of_play_and_awarding_magic_items', 'ability_checks_and_hacking_tools', 'piety',
            'trade-goods-and-values', 'lifestyle_expenses', 'services']

EN = {'Бледная настойка': 'Pale Tincture', 'Дым жжённого отура': 'Burnt Othur Fumes', 'Злоба': 'Malice', 'Змеиный яд': 'Serpent Venom',
      'Кровь ассасина': "Assassin's Blood", 'Кровь ликантропа': 'Lycanthrope Blood', 'Масло таггита': 'Oil of Taggit',
      'Полуночные слёзы': 'Midnight Tears', 'Пыль мумии': 'Mummy Rot', 'Слизь ползающего падальщика': 'Carrion Crawler Mucus',
      'Ступор': 'Torpor', 'Сыворотка правды': 'Truth Serum', 'Фессалтоксин': 'Thessaltoxin', 'Эссенция эфира': 'Essence of Ether',
      'Яд виверны': 'Wyvern Poison', 'Яд дроу': 'Drow Poison', 'Яд лилового червя': 'Purple Worm Poison',
      'Дыхание Бизы': "Biza's Breath", 'Шёпот Иваны': "Ivana's Whisper", 'Противоядие': 'Antitoxin'}
SRC = {'DMG': "Dungeon Master's Guide 2014", 'IMR': 'Infernal Machine Rebuild', 'JRC': 'Journeys through the Radiant Citadel',
       'VRGR': "Van Richten's Guide to Ravenloft", 'EGW': "Explorer's Guide to Wildemount", 'RLW': 'Eberron: Rising from the Last War'}
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя', ['a','b','v','g','d','e','e','zh','z','i','j','k','l','m','n','o','p','r','s','t','u','f','h','c','ch','sh','sch','','y','','e','yu','ya']))
slugify = lambda s: re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', ''.join(TR.get(c, c) for c in s.lower().replace('’', '').replace("'", ''))).strip('-')) or 'x'
has_body = lambda bl: any(b['type'] != 'heading' for b in bl)

def whole_articles():
    """Статьи целиком (части склеиваются обратно)."""
    whole = collections.OrderedDict()
    for m in json.load(open(ART, encoding='utf-8')):
        if 'parent' in m:
            w = whole.setdefault(m['parent'], {**{k: v for k, v in m.items() if k not in split_articles.PART_KEYS}, 'slug': m['parent'], 'name_ru': m['parent_name'], 'blocks': []})
            w['blocks'] += m['blocks']
            if m['part'] == 1: w['name_en'] = m.get('name_en', '')
        else:
            whole[m['slug']] = m
    return whole

def terms(m):
    """[(название, раздел-2-го-уровня, блоки)]: термин = раздел 4-го уровня (если их нет — 2-го, затем 5-го)."""
    b, name = m['blocks'], m['name_ru']
    lv = {x.get('level') for x in b if x['type'] == 'heading'}
    T = 4 if 4 in lv else 2 if 2 in lv else 5 if 5 in lv else None
    if T is None: return [(name, None, b)]
    out, cur, l2 = [], [name, None, []], None
    def flush():
        if has_body(cur[2]): out.append(tuple(cur))
    for x in b:
        if x['type'] == 'heading' and x.get('level') is not None and x['level'] <= T:
            flush()
            if x['level'] == 2 and T == 4: l2 = x['text']
            cur = [x['text'], l2 if x['level'] != 2 else None, []]
            continue
        cur[2].append(x)
    flush()
    cnt = collections.Counter(t[0] for t in out)                     # повторяющиеся названия: «Сила — Проверки силы»
    res, seen = [], collections.Counter()
    for t, s, bs in out:
        if cnt[t] > 1:
            seen[t] += 1
            t = f'{s} — {t}' if s and s != t else f'{t} ({seen[t]})'
        res.append((t, s, bs))
    return res

def entries_from_bold(blocks, price):
    """Конкретные вещества: абзац с «**Название (вид) (ИСТОЧНИК).**» открывает запись, дальше — её описание."""
    head = re.compile(r'^\*\*(.+?)\*\*\.?\s*(.*)$', re.S)
    out, cur = [], None
    for b in blocks:
        t = b.get('text') or ''
        mm = head.match(t) if b['type'] == 'paragraph' and not t.startswith('**Читайте также') else None
        if mm:
            raw = mm.group(1).strip().rstrip('.')
            parens = re.findall(r'\(([^)]*)\)', raw)
            nm = re.sub(r'\s*\([^)]*\)', '', raw).strip()
            src = [p for p in parens if re.fullmatch(r'[A-Z]{2,5}', p.strip())]
            kind = [p for p in parens if p not in src]
            cur = {'name': nm, 'kind': kind[0] if kind else '', 'src': src[0] if src else '', 'blocks': []}
            if mm.group(2).strip(): cur['blocks'].append({'type': 'paragraph', 'text': mm.group(2).strip()})
            out.append(cur)
        elif cur is not None and not (b['type'] == 'paragraph' and t.startswith('**Читайте также')):
            cur['blocks'].append(b)
    return out

def main():
    if os.path.exists(GLO):
        sys.exit('data14/glossary.json уже есть — скрипт одноразовый (повторный запуск не нужен).')
    whole = whole_articles()
    glossary, taken = [], set()
    def add_term(name, group, blocks, art):
        name = name[:1].upper() + name[1:]
        s = slugify(name)
        while s in taken: s += '-2'
        taken.add(s)
        glossary.append({'section': 'glossary', 'id': f'art-{len(glossary) + 1}', 'slug': s, 'url': art['url'], 'name_ru': name, 'name_en': '',
                         'edition': '2014', 'sources': art.get('sources') or [], 'group': group_of(group), 'blocks': blocks})
    group_of = lambda g: g
    for s in GLOSSARY:
        a = whole.pop(s)
        for name, l2, bs in terms(a): add_term(name, a['name_ru'], bs, a)

    items = [i for i in json.load(open(ITM, encoding='utf-8')) if not str(i.get('id', '')).startswith('art-')]
    names = {i['name_ru'] for i in items}
    def add_items(a, blocks, prices, kind_default):
        for e in entries_from_bold(blocks, prices):
            if e['name'] in names: print('  пропущен (уже есть в предметах):', e['name']); continue
            kind = (e['kind'] or kind_default).lower()
            pk, pr = prices.get(e['name'].lower(), ('', ''))
            if pr.strip() in ('—', '-', '–'): pr = ''
            nums = [int(x.replace(' ', '')) for x in re.findall(r'\d[\d ]*\d|\d', pr)] if pr else []
            typ = f'Яд ({kind})' if kind_default == 'яд' else 'Вещество'
            en = EN.get(e['name'], '')
            src = SRC.get(e['src'] or 'DMG')                          # без пометки — из Руководства мастера
            items.append({'section': 'items', 'id': f"art-{slugify(en or e['name'])}", 'slug': slugify(en or e['name']), 'url': a['url'], 'name_ru': e['name'], 'name_en': en,
                          'edition': '2014', 'sources': [src] if src else (a.get('sources') or []), 'line': typ, 'price': pr or None,
                          'price_gp': nums[0] if len(nums) == 1 else None, 'price_min_gp': nums[0] if nums else None, 'price_max_gp': nums[-1] if nums else None,
                          'blocks': e['blocks'], 'rarity': None, 'type': typ, 'attunement': None, 'attunement_by': []})
            names.add(e['name'])
    def price_table(blocks, ni, pi, ki=None):
        for b in blocks:
            if b['type'] == 'table':
                return {r[ni].lower(): ((r[ki] if ki is not None else ''), r[pi]) for r in b['rows'][1:] if len(r) > max(ni, pi)}
        return {}
    # --- яды
    a = whole.pop('poisons'); b = a['blocks']
    first = next(i for i, x in enumerate(b) if x['type'] == 'paragraph' and x['text'].startswith('**') and '(' in x['text'][:60] and i > 8)
    add_items(a, b[first:], price_table(b, 0, 2, 1), 'яд')
    for i in range(2, 6):                                            # виды ядов
        t = b[i]['text']; mm = re.match(r'^\*\*(.+?)\.\*\*\s*(.*)$', t, re.S)
        add_term(f'{mm.group(1)} яд'.lower().capitalize(), 'Яды', [{'type': 'paragraph', 'text': mm.group(2)}], a)
    intro = b[0:2] + [x for x in b[6:first] if x['type'] == 'table'] + [x for x in b[first:] if (x.get('text') or '').startswith('**Читайте также')]
    add_term('Яды', 'Яды', intro, a)
    # --- наркотики и вещества
    a = whole.pop('drugs-and-substances'); b = a['blocks']
    first = next(i for i, x in enumerate(b) if x['type'] == 'paragraph' and x['text'].startswith('**'))
    add_items(a, b[first:], price_table(b, 0, 1), 'вещество')
    add_term('Наркотики и вещества', 'Наркотики и вещества', [x for x in b[:first] if x['type'] != 'heading'] + [x for x in b if (x.get('text') or '').startswith('**Читайте также')], a)

    json.dump(glossary, open(GLO, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(items, open(ITM, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(list(whole.values()), open(ART, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'глоссарий: {len(glossary)} записей, предметов добавлено: {sum(1 for i in items if str(i["id"]).startswith("art-"))}, статей осталось: {len(whole)}')
    split_articles.main()

if __name__ == '__main__': main()
