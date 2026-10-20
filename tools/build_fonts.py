#!/usr/bin/env python3
"""Собирает шрифты из векторных глифов (translator/glyphs.json): OTF, TTF и WOFF2 для каждого алфавита → fonts/.
Буквы стоят на своих местах русской раскладки (а–я, заглавные и строчные одинаковые), плюс пробел и простая пунктуация.
Нужно: pip install fonttools brotli.  Запуск из корня репозитория: python3 tools/build_fonts.py"""
import json, os
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPM, SB = 1000, 70                                      # единиц на em; боковой зазор между буквами
FAMILIES = {                                            # имя файла → (имя семейства, набор в glyphs.json)
    'DnDBase-Draconic': ('DnD Base Draconic', 'dragon'),
    'DnDBase-Elvish': ('DnD Base Elvish', 'elf'),
    'DnDBase-Dwarvish': ('DnD Base Dwarvish', 'dwarf'),
    'DnDBase-Infernal': ('DnD Base Infernal', 'infernal'),
}
data = json.load(open(os.path.join(root, 'translator', 'glyphs.json'), encoding='utf-8'))
L = data['letters']

def outline(g, s, ox, oy, dx):
    """Контур глифа в координатах шрифта (y вверх, 0 — базовая линия) как список команд пера."""
    rec = RecordingPen()
    parse_path(g['d'], TransformPen(rec, (s, 0, 0, -s, dx - ox * s, oy * s)))
    return rec

def fix_dir(rec, ccw):                                  # внешние контуры: против часовой в CFF, по часовой в TrueType
    a = AreaPen(); rec.replay(a)
    if (a.value > 0) == ccw: return rec
    out = RecordingPen(); rec.replay(ReverseContourPen(out)); return out

def shape(kind, s):                                     # знаки препинания: простые формы в единицах шрифта
    r = RecordingPen()
    def box(x0, y0, x1, y1):
        r.moveTo((x0, y0)); r.lineTo((x1, y0)); r.lineTo((x1, y1)); r.lineTo((x0, y1)); r.closePath()
    if kind == '.': box(0, 0, 90, 90)
    if kind == ',':
        for i, pt in enumerate([(0, 0), (0, 90), (90, 90), (90, 0), (40, -140), (-10, -140), (30, 0)]): (r.moveTo if i == 0 else r.lineTo)(pt)
        r.closePath()
    if kind == '-': box(0, 230, 260, 290)
    if kind == ':': box(0, 0, 90, 90); box(0, 330, 90, 420)
    if kind == '!': box(0, 0, 90, 90); box(5, 190, 85, 640)
    return r

def build(fname, family, key):
    S = data['sets'][key]; k = UPM / S['em']
    order, cmap, rec = ['.notdef', 'space'], {32: 'space', 0xA0: 'space'}, {}
    rec['.notdef'] = None; rec['space'] = None
    adv = {'.notdef': 600, 'space': 330}
    for ch in L:
        g = S['glyphs'][ch]; x0, y0, x1, y1 = g['bb']
        rec_ = outline(g, k, x0, g['y0'], SB * 1.0)
        name = 'u%04X' % ord(ch); order.append(name); rec[name] = rec_; adv[name] = round((x1 - x0) * k + 2 * SB)
        cmap[ord(ch)] = name; cmap[ord(ch.upper())] = name
    for ch, nm in {'.': 'period', ',': 'comma', '-': 'hyphen', ':': 'colon', '!': 'exclam'}.items():
        rec_ = RecordingPen(); sh = shape(ch, k)
        sh.replay(TransformPen(rec_, (1, 0, 0, 1, SB, 0)))
        bp = BoundsPen(None); rec_.replay(bp); order.append(nm); rec[nm] = rec_; adv[nm] = round(bp.bounds[2] + SB); cmap[ord(ch)] = nm
    ys = []
    for n, rc in rec.items():
        if rc is None: continue
        bp = BoundsPen(None); rc.replay(bp)
        if bp.bounds: ys += [bp.bounds[1], bp.bounds[3]]
    asc, desc = max(ys) + 80, min(ys) - 80
    # .notdef — рамка-прямоугольник
    nd = RecordingPen(); nd.moveTo((60, 0)); nd.lineTo((60, 700)); nd.lineTo((540, 700)); nd.lineTo((540, 0)); nd.closePath()
    nd.moveTo((120, 60)); nd.lineTo((480, 60)); nd.lineTo((480, 640)); nd.lineTo((120, 640)); nd.closePath(); rec['.notdef'] = nd
    meta = {'familyName': family, 'styleName': 'Regular', 'uniqueFontIdentifier': family + ' Regular', 'fullName': family + ' Regular',
            'psName': fname, 'version': 'Version 1.0', 'copyright': 'Глифы алфавитов из книг D&D 5e (Wizards of the Coast), для личного использования.'}
    for ext in ('otf', 'ttf'):
        fb = FontBuilder(UPM, isTTF=(ext == 'ttf')); fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap)
        met = {}
        if ext == 'otf':
            cs = {}
            for n in order:
                pen = T2CharStringPen(adv[n], None)
                if rec[n] is not None: fix_dir(rec[n], True).replay(pen)
                cs[n] = pen.getCharString()
            fb.setupCFF(fname, {'FullName': meta['fullName'], 'FamilyName': family, 'Weight': 'Regular'}, cs, {})
        else:
            gl = {}
            for n in order:
                pen = TTGlyphPen(None)
                if rec[n] is not None: fix_dir(rec[n], False).replay(Cu2QuPen(pen, 1.0, reverse_direction=False))
                gl[n] = pen.glyph()
            fb.setupGlyf(gl)
        for n in order:
            bp = BoundsPen(None)
            if rec[n] is not None: rec[n].replay(bp)
            met[n] = (adv[n], round(bp.bounds[0]) if bp.bounds else 0)
        fb.setupHorizontalMetrics(met); fb.setupHorizontalHeader(ascent=round(asc), descent=round(desc), lineGap=0)
        fb.setupNameTable({'familyName': family, 'styleName': 'Regular', 'uniqueFontIdentifier': meta['uniqueFontIdentifier'], 'fullName': meta['fullName'],
                           'psName': fname, 'version': meta['version'], 'copyright': meta['copyright']})
        fb.setupOS2(sTypoAscender=round(asc), sTypoDescender=round(desc), sTypoLineGap=0, usWinAscent=round(asc), usWinDescent=round(-desc), sxHeight=500, sCapHeight=700, fsType=0)
        fb.setupPost(); out = os.path.join(root, 'fonts', f'{fname}.{ext}'); fb.save(out)
        if ext == 'otf':
            from fontTools.ttLib import TTFont
            f = TTFont(out); f.flavor = 'woff2'; f.save(os.path.join(root, 'fonts', f'{fname}.woff2'))
    return len(order), round(asc), round(desc)

os.makedirs(os.path.join(root, 'fonts'), exist_ok=True)
for fname, (family, key) in FAMILIES.items():
    n, a, d = build(fname, family, key)
    print(f'{family}: {n} глифов, ascent {a}, descent {d}')
