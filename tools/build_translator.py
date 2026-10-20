#!/usr/bin/env python3
"""Собирает translator.js: вшивает таблицы алфавитов, звучания и воровского жаргона в translator.tpl.js.
Таблицы лежат в tools/translator-data.json (взяты из youngdrug6666-ship-it/tracker, translator.html).
Запуск из корня репозитория: python3 tools/build_translator.py"""
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
d = json.load(open(os.path.join(root, 'tools', 'translator-data.json'), encoding='utf-8'))
arr = lambda t: [t.get(c, '') for c in L]
G = {k[:-6]: arr(v) for k, v in d.items() if k.endswith('Glyphs')}
S = {k[:-5]: arr(v) for k, v in d.items() if k.endswith('Sound')}
T = [[w['ru'], w['cant'], w['glyph']] for w in d['thiefWords']]
dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
data = f"const G = {dump(G)};\n  const S = {dump(S)};\n  const T = {dump(T)};"
tpl = open(os.path.join(root, 'translator.tpl.js'), encoding='utf-8').read()
assert '/*__DATA__*/' in tpl
open(os.path.join(root, 'translator.js'), 'w', encoding='utf-8').write(tpl.replace('/*__DATA__*/', data))
print('translator.js собран:', {k: len(v) for k, v in G.items()}, len(S), 'звучаний,', len(T), 'слов жаргона')
