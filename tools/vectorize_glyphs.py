#!/usr/bin/env python3
"""Превращает растровые глифы (tools/glyph-src/<набор>-NN.png) в векторные.
Для каждого алфавита выравнивает толщину штриха (в исходниках часть букв нарисована в другом масштабе или в низком разрешении)
и пишет:
  translator/glyphs.json        — контуры для сайта (canvas Path2D и inline-SVG)
  translator/svg/<набор>-<буква>.svg — те же глифы отдельными файлами, их можно открыть и править в Inkscape / Figma
Нужно: pip install potracer opencv-python numpy.  Запуск из корня репозитория: python3 tools/vectorize_glyphs.py"""
import glob, json, os, statistics
import cv2, numpy as np, potrace

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
SETS = ['dragon', 'elf', 'dwarf', 'infernal']
NAMES = {'dragon': 'Драконий (иокхарик)', 'elf': 'Эльфийский', 'dwarf': 'Дварфийский', 'infernal': 'Инфернальный'}
TARGET_H = 640                                           # высота, до которой растягиваем перед трассировкой

def mask(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED).astype(np.float32)
    # чернила = непрозрачность × тёмность: «дырки» в буквах (у эльфийского, дварфийского, инфернального) нарисованы
    # непрозрачными белыми пикселями, по одной прозрачности они бы закрасились
    a = im[..., 3] * (1 - im[..., :3].mean(axis=2) / 255)
    u = max(2, int(np.ceil(TARGET_H / a.shape[0])))
    a = cv2.copyMakeBorder(a, 3, 3, 3, 3, cv2.BORDER_CONSTANT, value=0)   # поля, чтобы контур не прилипал к краю
    big = cv2.resize(a, None, fx=u, fy=u, interpolation=cv2.INTER_CUBIC)
    sigma = max(1.2, 0.30 * u)                           # чем ниже исходное разрешение, тем сильнее сглаживаем ступеньки
    big = cv2.GaussianBlur(big, (0, 0), sigma)
    return big > 110, u

def stroke(m, u):                                        # средняя толщина штриха (в пикселях исходника): 2·площадь / периметр
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    per = sum(cv2.arcLength(c, True) for c in cs)
    return 2 * m.sum() / per / u if per else 1

ELF_HIGH = 'уфхчшщъыьэюя'    # у этих эльфийских букв холст нарисован на 42 px выше остальных: базовая линия 127 вместо 169

def baseline(name, ch, h, m, u):
    """Где в холсте глифа (в пикселях исходника, от верха) проходит строка письма.
    Холсты драконьего и дварфийского одинаковы и уже хранят раскладку; у эльфийского раскладка сдвинута у второй половины алфавита;
    у инфернального холсты обрезаны как придётся, поэтому строка идёт по низу самой буквы."""
    if name == 'elf': return 127 if ch in ELF_HIGH else 169
    if name == 'infernal':
        ys = np.where(m.any(axis=1))[0]
        return ys.max() / u - 3 + 1
    return h

def trace(m, u, k):                                      # k — множитель нормализации; координаты выходят в «единицах нормализованного холста»
    pl = potrace.Bitmap(~m).trace(turdsize=int(4 * u), alphamax=1.0, opticurve=True, opttolerance=0.35)
    f = lambda p: f'{(p.x / u - 3) * k:.2f} {(p.y / u - 3) * k:.2f}'
    out = []
    for c in pl:
        out.append('M' + f(c.start_point))
        for s in c.segments:
            out.append(('L' + f(s.c) + 'L' + f(s.end_point)) if s.is_corner else ('C' + f(s.c1) + ' ' + f(s.c2) + ' ' + f(s.end_point)))
        out.append('Z')
    return ''.join(out)

data = {'v': 1, 'letters': L, 'sets': {}}
os.makedirs(os.path.join(root, 'translator', 'svg'), exist_ok=True)
for name in SETS:
    items = []
    for i, ch in enumerate(L):
        p = os.path.join(root, 'tools', 'glyph-src', f'{name}-{i + 1:02d}.png')
        m, u = mask(p); h, w = cv2.imread(p, cv2.IMREAD_UNCHANGED).shape[:2]
        items.append((ch, m, u, w, h, stroke(m, u)))
    # Масштаб выравниваем по группам холстов одной высоты: толщину штриха у отдельной буквы честно измерить нельзя
    # (у каллиграфических букв она меняется по длине), а вот медиана по группе надёжна.
    order = sorted(range(len(items)), key=lambda i: items[i][4]); groups, cur = [], [order[0]]
    for i in order[1:]:
        if items[i][4] > items[cur[-1]][4] * 1.15: groups.append(cur); cur = []
        cur.append(i)
    groups.append(cur)
    sw = statistics.median(x[5] for x in items); ks = [1.0] * len(items)
    if len(groups) > 1:
        for g in groups:
            kg = sw / statistics.median(items[i][5] for i in g)
            for i in g: ks[i] = kg
    em = statistics.median(x[4] * k for x, k in zip(items, ks))
    print(name, 'групп по высоте холста:', len(groups), [(len(g), round(ks[g[0]], 2)) for g in groups])
    gl = {}
    for (ch, m, u, w, h, s), k in zip(items, ks):
        d = trace(m, u, k)
        ys, xs = np.where(m)                                 # границы самой буквы без полей холста (нужны, например, для печати)
        bb = [round((xs.min() / u - 3) * k, 2), round((ys.min() / u - 3) * k, 2), round((xs.max() / u - 3) * k, 2), round((ys.max() / u - 3) * k, 2)]
        gl[ch] = {'w': round(w * k, 2), 'h': round(h * k, 2), 'y0': round(baseline(name, ch, h, m, u) * k, 2), 'bb': bb, 'd': d}
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {gl[ch]["w"]} {gl[ch]["h"]}" width="{gl[ch]["w"]}" height="{gl[ch]["h"]}"><path fill="currentColor" fill-rule="evenodd" d="{d}"/></svg>\n'
        open(os.path.join(root, 'translator', 'svg', f'{name}-{ch}.svg'), 'w', encoding='utf-8').write(svg)
    by = statistics.median(g['y0'] for g in gl.values())     # типичная высота строки в холсте: по ней глиф ставится в строку
    data['sets'][name] = {'name': NAMES[name], 'em': round(em, 2), 'by': round(by, 2), 'glyphs': gl}
json.dump(data, open(os.path.join(root, 'translator', 'glyphs.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('glyphs.json', os.path.getsize(os.path.join(root, 'translator', 'glyphs.json')) // 1024, 'KB')
