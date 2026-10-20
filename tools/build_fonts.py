#!/usr/bin/env python3
"""Собирает шрифты алфавитов D&D: OTF, TTF и WOFF2 → fonts/.
Буквы стоят на своих местах русской раскладки (а–я; заглавные и строчные одинаковые), плюс пробел и простая пунктуация.

Два вида шрифтов:
  1. «Книжные» (Draconic, Elvish, Dwarvish, Infernal) — оригинальные глифы из PHB/BGDIA, векторы из translator/glyphs.json
     (сначала tools/vectorize_glyphs.py).
  2. «Знаковые» (Infernal Gothic, Dwarvish Runes, Elvish Script, Draconic Cuneiform, Celestial, Druidic) — те же знаки Юникода,
     что переводчик выводит как текст; контуры берутся из шрифтов Noto (tools/font-src/*.woff, лицензия SIL OFL 1.1).
Нужно: pip install fonttools brotli.  Запуск из корня репозитория: python3 tools/build_fonts.py"""
import json, os, glob
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPM, SB = 1000, 70                                      # единиц на em; боковой зазор у «книжных» шрифтов
L = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
BOOK = {                                                # файл → (семейство, набор в glyphs.json)
    'DnDBase-Draconic': ('DnD Base Draconic', 'dragon'),
    'DnDBase-Elvish': ('DnD Base Elvish', 'elf'),
    'DnDBase-Dwarvish': ('DnD Base Dwarvish', 'dwarf'),
    'DnDBase-Infernal': ('DnD Base Infernal', 'infernal'),
}
FS = 'tools/font-src/noto-sans-%s-400-normal.woff'
UNI = {                                                 # файл → (семейство, таблица в translator-data.json, исходные шрифты по порядку поиска)
    'DnDBase-InfernalGothic': ('DnD Base Infernal Gothic', 'infernalGlyphs', ['math-latin']),
    'DnDBase-DwarvishRunes': ('DnD Base Dwarvish Runes', 'dwarfGlyphs', ['runic-runic']),
    'DnDBase-ElvishScript': ('DnD Base Elvish Script', 'elfGlyphs', ['greek', 'coptic-coptic', 'math-latin']),
    'DnDBase-DraconicCuneiform': ('DnD Base Draconic Cuneiform', 'dragonGlyphs', ['cuneiform-cuneiform']),
    'DnDBase-Celestial': ('DnD Base Celestial', 'celestialGlyphs', ['imperial-aramaic-imperial-aramaic', 'inscriptional-pahlavi-inscriptional-pahlavi']),
    'DnDBase-Druidic': ('DnD Base Druidic', 'druidicGlyphs', ['shavian-shavian']),
}
PUNCT = {'.': 'period', ',': 'comma', '-': 'hyphen', ':': 'colon', '!': 'exclam'}

def fix_dir(rec, ccw):                                  # внешние контуры: против часовой в CFF, по часовой в TrueType
    a = AreaPen(); rec.replay(a)
    if (a.value > 0) == ccw: return rec
    out = RecordingPen(); rec.replay(ReverseContourPen(out)); return out

def bounds(rec):
    bp = BoundsPen(None); rec.replay(bp); return bp.bounds

class Cubic(BasePen):                                   # TrueType-кривые → кубические (BasePen раскладывает qCurveTo сам)
    def __init__(self, rec, gs): super().__init__(gs); self.rec = rec
    def _moveTo(self, p): self.rec.moveTo(p)
    def _lineTo(self, p): self.rec.lineTo(p)
    def _curveToOne(self, a, b, c): self.rec.curveTo(a, b, c)
    def _closePath(self): self.rec.closePath()
    def _endPath(self): self.rec.endPath()

def punct(kind):                                        # знаки препинания: простые формы в единицах шрифта
    r = RecordingPen()
    def box(x0, y0, x1, y1): r.moveTo((x0, y0)); r.lineTo((x1, y0)); r.lineTo((x1, y1)); r.lineTo((x0, y1)); r.closePath()
    if kind == '.': box(0, 0, 90, 90)
    if kind == ',':
        for i, pt in enumerate([(0, 0), (0, 90), (90, 90), (90, 0), (40, -140), (-10, -140), (30, 0)]): (r.moveTo if i == 0 else r.lineTo)(pt)
        r.closePath()
    if kind == '-': box(0, 230, 260, 290)
    if kind == ':': box(0, 0, 90, 90); box(0, 330, 90, 420)
    if kind == '!': box(0, 0, 90, 90); box(5, 190, 85, 640)
    return r

def emit(fname, family, rec, adv, cmap, extra_name=None, license_note=None):
    """Пишет .otf, .ttf и .woff2 из набора контуров rec (имя → RecordingPen), ширин adv и cmap."""
    order = list(rec)
    ys = [b[i] for n, rc in rec.items() if rc is not None and (b := bounds(rc)) for i in (1, 3)]
    asc, desc = round(max(ys) + 80), round(min(ys) - 80)
    nd = RecordingPen(); nd.moveTo((60, 0)); nd.lineTo((60, 700)); nd.lineTo((540, 700)); nd.lineTo((540, 0)); nd.closePath()
    nd.moveTo((120, 60)); nd.lineTo((480, 60)); nd.lineTo((480, 640)); nd.lineTo((120, 640)); nd.closePath(); rec['.notdef'] = nd
    meta = {'familyName': family, 'styleName': 'Regular', 'uniqueFontIdentifier': family + ' Regular', 'fullName': family + ' Regular', 'psName': fname, 'version': 'Version 1.0',
            'copyright': extra_name or 'Глифы алфавитов из книг D&D 5e (Wizards of the Coast), для личного использования.'}
    if license_note: meta.update({'licenseDescription': license_note, 'licenseInfoURL': 'https://scripts.sil.org/OFL'})
    for ext in ('otf', 'ttf'):
        fb = FontBuilder(UPM, isTTF=(ext == 'ttf')); fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap)
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
        fb.setupHorizontalMetrics({n: (adv[n], round(bounds(rec[n])[0]) if rec[n] is not None and bounds(rec[n]) else 0) for n in order})
        fb.setupHorizontalHeader(ascent=asc, descent=desc, lineGap=0); fb.setupNameTable(meta)
        fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0, usWinAscent=asc, usWinDescent=-desc, sxHeight=500, sCapHeight=700, fsType=0)
        fb.setupPost(); out = os.path.join(root, 'fonts', f'{fname}.{ext}'); fb.save(out)
        if ext == 'otf': f = TTFont(out); f.flavor = 'woff2'; f.save(os.path.join(root, 'fonts', f'{fname}.woff2'))
    return len(order), asc, desc

def punctuation(rec, adv, cmap):
    for ch, nm in PUNCT.items():
        r = RecordingPen(); punct(ch).replay(TransformPen(r, (1, 0, 0, 1, SB, 0)))
        rec[nm] = r; adv[nm] = round(bounds(r)[2] + SB); cmap[ord(ch)] = nm

def build_book(fname, family, key, data):
    S = data['sets'][key]; k = UPM / S['em']
    rec, adv, cmap = {'.notdef': None, 'space': None}, {'.notdef': 600, 'space': 330}, {32: 'space', 0xA0: 'space'}
    for ch in L:
        g = S['glyphs'][ch]; x0 = g['bb'][0]; r = RecordingPen()
        parse_path(g['d'], TransformPen(r, (k, 0, 0, -k, SB - x0 * k, g['y0'] * k)))
        n = 'u%04X' % ord(ch); rec[n] = r; adv[n] = round((g['bb'][2] - x0) * k + 2 * SB); cmap[ord(ch)] = cmap[ord(ch.upper())] = n
    punctuation(rec, adv, cmap)
    return emit(fname, family, rec, adv, cmap)

def build_uni(fname, family, table, srcs, tbl):
    fonts = [(TTFont(os.path.join(root, FS % s)), s) for s in srcs]
    def find(cp):
        for f, s in fonts:
            if cp in f.getBestCmap(): return f, f.getBestCmap()[cp]
        raise SystemExit(f'{family}: знака U+{cp:04X} нет ни в одном исходном шрифте')
    def draw(cp):                                       # контур знака в единицах шрифта (кубические кривые) и его ширина
        f, gn = find(cp); k = UPM / f['head'].unitsPerEm; r = RecordingPen()
        gs = f.getGlyphSet(); gs[gn].draw(TransformPen(Cubic(r, gs), (k, 0, 0, k, 0, 0))); return r, round(f['hmtx'][gn][0] * k)
    rec, adv, cmap = {'.notdef': None, 'space': None}, {'.notdef': 600, 'space': 330}, {32: 'space', 0xA0: 'space'}
    for ch in L:
        seq = tbl[table].get(ch, ''); n = 'u%04X' % ord(ch)
        if not seq: rec[n] = None; adv[n] = 0; cmap[ord(ch)] = cmap[ord(ch.upper())] = n; continue      # у друидического «ъ» и «ь» знака нет: пустой глиф
        r, w = draw(ord(seq[0]))
        for m in seq[1:]:                                # надстрочный знак (у эльфийских «ъ» и «ь»): по центру над основой
            mr, _ = draw(ord(m)); bb, mb = bounds(r), bounds(mr)
            dx = (bb[0] + bb[2]) / 2 - (mb[0] + mb[2]) / 2; dy = max(0, bb[3] + 40 - mb[1])
            mr.replay(TransformPen(r, (1, 0, 0, 1, dx, dy)))
        rec[n] = r; adv[n] = w; cmap[ord(ch)] = cmap[ord(ch.upper())] = n
    punctuation(rec, adv, cmap)
    notes = '; '.join(sorted({str(x) for f, _ in fonts for x in [f['name'].getDebugName(0)]}))
    return emit(fname, family, rec, adv, cmap,
                extra_name='Знаки D&D-алфавита; контуры из шрифтов Noto. ' + notes,
                license_note='This Font Software is licensed under the SIL Open Font License, Version 1.1 (see OFL-Noto.txt). ' + notes)

def write_license():                                    # перечень авторских строк использованных Noto-шрифтов + текст OFL
    srcs = sorted(glob.glob(os.path.join(root, 'tools', 'font-src', '*.woff')))
    cr = sorted({TTFont(s)['name'].getDebugName(0) for s in srcs})
    body = open(os.path.join(root, 'tools', 'font-src', 'OFL.txt'), encoding='utf-8').read()
    head = 'Шрифты DnD Base *Gothic, *Runes, *Script, *Cuneiform, *Celestial, *Druidic содержат контуры из шрифтов Noto:\n\n' + '\n'.join(cr) + '\n\n'
    open(os.path.join(root, 'fonts', 'OFL-Noto.txt'), 'w', encoding='utf-8').write(head + body)

if __name__ == '__main__':
    os.makedirs(os.path.join(root, 'fonts'), exist_ok=True)
    data = json.load(open(os.path.join(root, 'translator', 'glyphs.json'), encoding='utf-8'))
    tbl = json.load(open(os.path.join(root, 'tools', 'translator-data.json'), encoding='utf-8'))
    for fname, (family, key) in BOOK.items(): print(family, '→', build_book(fname, family, key, data))
    for fname, (family, table, srcs) in UNI.items(): print(family, '→', build_uni(fname, family, table, srcs, tbl))
    write_license()
