#!/usr/bin/env python3
"""Копирует в репозиторий картинки из зеркал 5etools и пересжимает их.

Берутся только те картинки, которые совпадают по английскому названию с записями
из data/ и data14/. Результат:
    img/24/<раздел>/<slug>.webp   (редакция 2024)
    img/14/<раздел>/<slug>.webp   (редакция 2014)
    img/manifest.json             {"24": {"bestiary": ["slug", ...], ...}, "14": {...}}

Запуск (пути к клонам репозиториев картинок):
    git clone --depth 1 https://github.com/5etools-mirror-3/5etools-img
    git clone --depth 1 https://github.com/5etools-mirror-3/5etools-2014-img
    python3 tools/build_images.py ../5etools-img ../5etools-2014-img

Перезапуск безопасен: уже готовые файлы пропускаются (--force пересоберёт всё).
Зависимость: pip install pillow
"""
import json, os, re, sys, argparse
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_SIDE = 640      # длинная сторона, px
QUALITY = 72        # webp

# раздел данных -> папка в репозитории картинок
SECTIONS = {
    24: {'bestiary': 'bestiary', 'spells': 'spells', 'class': 'classes', 'species': 'races',
         'backgrounds': 'backgrounds', 'feats': 'feats', 'items': 'items'},
    14: {'bestiary': 'bestiary', 'spells': 'spells', 'class': 'classes', 'race': 'races',
         'backgrounds': 'backgrounds', 'feats': 'feats', 'items': 'items'},
}
DATA_DIR = {24: 'data', 14: 'data14'}
# какие источники предпочитать, если одно имя встречается в нескольких книгах
PRIO = {
    24: ['XMM', 'XPHB', 'XDMG', 'XGE', 'TCE', 'MPMM', 'FTD', 'BGG'],
    14: ['MM', 'PHB', 'DMG', 'VGM', 'MTF', 'MPMM', 'XGE', 'TCE', 'FTD', 'GGR', 'EGW', 'SCAG'],
}


def norm(s):
    s = (s or '').lower().replace('’', "'").replace('‘', "'")
    return re.sub(r'[^a-z0-9]+', '', s)


def index_folder(base, edition):
    """нормализованное имя -> лучший путь к файлу"""
    pr = {c: i for i, c in enumerate(PRIO[edition])}
    best = {}
    if not os.path.isdir(base):
        return best
    for src in sorted(os.listdir(base)):
        sd = os.path.join(base, src)
        if src == 'tokens' or not os.path.isdir(sd):
            continue
        for f in sorted(os.listdir(sd)):
            if not f.endswith('.webp'):
                continue
            key = norm(f[:-5])
            rank = pr.get(src, 99)
            if key not in best or rank < best[key][0]:
                best[key] = (rank, os.path.join(sd, f))
    return {k: v[1] for k, v in best.items()}


def convert(job):
    src, dst, force = job
    if os.path.exists(dst) and not force:
        return dst, os.path.getsize(dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with Image.open(src) as im:
        im.load()
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() or im.mode == 'P' else 'RGB')
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
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

    jobs, manifest = [], {}
    for ed in (24, 14):
        manifest[str(ed)] = {}
        for sec, folder in SECTIONS[ed].items():
            p = os.path.join(ROOT, DATA_DIR[ed], sec + '.json')
            if not os.path.exists(p):
                continue
            with open(p, encoding='utf-8') as f:
                data = json.load(f)
            ix = index_folder(os.path.join(repos[ed], folder), ed)
            slugs = []
            for m in data:
                k = norm(m.get('name_en'))
                if k and k in ix:
                    dst = os.path.join(ROOT, 'img', str(ed), sec, m['slug'] + '.webp')
                    jobs.append((ix[k], dst, a.force))
                    slugs.append(m['slug'])
            manifest[str(ed)][sec] = sorted(set(slugs))
            print(f'{ed} {sec}: {len(slugs)} из {len(data)}')

    total = 0
    with ProcessPoolExecutor() as ex:
        for _, size in ex.map(convert, jobs, chunksize=16):
            total += size
    with open(os.path.join(ROOT, 'img', 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
    print(f'файлов: {len(jobs)}, итого {total / 1e6:.0f} МБ')


if __name__ == '__main__':
    main()
