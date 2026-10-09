#!/usr/bin/env python3
"""Копирует в репозиторий картинки из зеркал 5etools и пересжимает их.

Для каждой записи из data/ и data14/ картинка ищется по английскому названию
(книга не важна) в таком порядке:
    1. арт из репозитория той же редакции;
    2. арт из репозитория другой редакции (одно и то же существо/предмет);
    3. только для монстров — токен (круглый портрет) той же, затем другой редакции.
Название сравнивается без регистра, акцентов и знаков препинания; пробуются
варианты с «s» на конце и без, а также без суффикса «+1, +2, +3» и без скобок.
Нечёткого сравнения нет намеренно: оно путает «Giant Strength» и «Storm Giant Strength».

Результат:
    img/<ред>/<раздел>/<slug>.webp          арт
    img/<ред>/bestiary-token/<slug>.webp    токены монстров
    img/manifest.json  {"24": {"bestiary": [...], "bestiary~t": [...], ...}, "14": {...}}
    ("~t" в имени раздела — токены)

Запуск (пути к клонам репозиториев картинок):
    git clone --depth 1 https://github.com/5etools-mirror-3/5etools-img
    git clone --depth 1 https://github.com/5etools-mirror-3/5etools-2014-img
    python3 tools/build_images.py ../5etools-img ../5etools-2014-img

Перезапуск безопасен: уже готовые файлы пропускаются (--force пересоберёт всё).
Зависимость: pip install pillow
"""
import json, os, re, argparse, unicodedata
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_SIDE = 640      # длинная сторона арта, px
TOKEN_SIDE = 400    # токены
QUALITY = 72        # webp

# раздел данных -> папка в репозитории картинок
SECTIONS = {
    24: {'bestiary': 'bestiary', 'spells': 'spells', 'class': 'classes', 'species': 'races',
         'backgrounds': 'backgrounds', 'feats': 'feats', 'items': 'items'},
    14: {'bestiary': 'bestiary', 'spells': 'spells', 'class': 'classes', 'race': 'races',
         'backgrounds': 'backgrounds', 'feats': 'feats', 'items': 'items'},
}
SWAP = {'species': 'race', 'race': 'species'}      # одноимённые разделы в разных редакциях
DATA_DIR = {24: 'data', 14: 'data14'}
# какие источники предпочитать, если одно имя встречается в нескольких книгах
PRIO = {
    24: ['XMM', 'XPHB', 'XDMG', 'XGE', 'TCE', 'MPMM', 'FTD', 'BGG'],
    14: ['MM', 'PHB', 'DMG', 'VGM', 'MTF', 'MPMM', 'XGE', 'TCE', 'FTD', 'GGR', 'EGW', 'SCAG'],
}
# кириллические двойники латинских букв (в данных встречаются опечатки вроде «Сranium»)
LOOK = str.maketrans('САЕОРХасеорх', 'CAEOPXaceopx')


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').translate(LOOK))
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]+', '', s)


def keys_for(name):
    """варианты ключа в порядке предпочтения"""
    name = name or ''
    bases = [name,
             re.sub(r'\s*\(.*?\)', '', name),                    # без скобок
             re.sub(r'[,\s]*\+\d.*$', '', name)]                  # без «+1, +2, +3»
    out = []
    for b in bases:
        k = norm(b)
        if not k:
            continue
        for v in (k, k[:-1] if k.endswith('s') else k + 's'):
            if v not in out:
                out.append(v)
    return out


def index_folder(base, edition, tokens=False):
    """нормализованное имя -> лучший путь к файлу"""
    pr = {c: i for i, c in enumerate(PRIO[edition])}
    best = {}
    if tokens:
        base = os.path.join(base, 'tokens')
    if not os.path.isdir(base):
        return best
    for src in sorted(os.listdir(base)):
        sd = os.path.join(base, src)
        if (src == 'tokens' and not tokens) or not os.path.isdir(sd):
            continue
        for f in sorted(os.listdir(sd)):
            if not f.endswith('.webp'):
                continue
            key = norm(f[:-5])
            rank = pr.get(src, 99)
            if key not in best or rank < best[key][0]:
                best[key] = (rank, os.path.join(sd, f))
    return {k: v[1] for k, v in best.items()}


def lookup(ix, name):
    for k in keys_for(name):
        if k in ix:
            return ix[k]
    return None


def convert(job):
    src, dst, side, force = job
    if os.path.exists(dst) and not force:
        return dst, os.path.getsize(dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with Image.open(src) as im:
        im.load()
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() or im.mode == 'P' else 'RGB')
        im.thumbnail((side, side), Image.LANCZOS)
        tmp = dst + '.tmp'
        im.save(tmp, 'WEBP', quality=QUALITY, method=4)
    os.replace(tmp, dst)          # атомарно: оборванный запуск не оставит битых файлов
    return dst, os.path.getsize(dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('img24')
    ap.add_argument('img14')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    repos = {24: a.img24, 14: a.img14}

    art, tok = {}, {}
    for ed in (24, 14):
        for sec, folder in SECTIONS[ed].items():
            art[(ed, sec)] = index_folder(os.path.join(repos[ed], folder), ed)
        tok[ed] = index_folder(os.path.join(repos[ed], 'bestiary'), ed, tokens=True)

    jobs, manifest, stat = [], {}, {}
    for ed in (24, 14):
        other = 14 if ed == 24 else 24
        manifest[str(ed)] = {}
        for sec in SECTIONS[ed]:
            p = os.path.join(ROOT, DATA_DIR[ed], sec + '.json')
            if not os.path.exists(p):
                continue
            with open(p, encoding='utf-8') as f:
                data = json.load(f)
            osec = SWAP.get(sec, sec)
            got, got_t, n_own, n_cross = [], [], 0, 0
            for m in data:
                name = m.get('name_en')
                if not name:
                    continue
                src = lookup(art[(ed, sec)], name)
                if src:
                    n_own += 1
                else:
                    src = lookup(art.get((other, osec), {}), name)
                    n_cross += bool(src)
                if src:
                    jobs.append((src, os.path.join(ROOT, 'img', str(ed), sec, m['slug'] + '.webp'), MAX_SIDE, a.force))
                    got.append(m['slug'])
                elif sec == 'bestiary':
                    src = lookup(tok[ed], name) or lookup(tok[other], name)
                    if src:
                        jobs.append((src, os.path.join(ROOT, 'img', str(ed), 'bestiary-token', m['slug'] + '.webp'), TOKEN_SIDE, a.force))
                        got_t.append(m['slug'])
            manifest[str(ed)][sec] = sorted(set(got))
            if got_t:
                manifest[str(ed)][sec + '~t'] = sorted(set(got_t))
            print(f'{ed} {sec}: арт {len(got)} (своя ред. {n_own}, другая {n_cross})'
                  + (f', токены {len(got_t)}' if got_t else '') + f' из {len(data)}')

    total = 0
    with ProcessPoolExecutor() as ex:
        for _, size in ex.map(convert, jobs, chunksize=16):
            total += size
    with open(os.path.join(ROOT, 'img', 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
    print(f'файлов: {len(jobs)}, итого {total / 1e6:.0f} МБ')


if __name__ == '__main__':
    main()
