/* Проверки оригинальных глифов (translator/glyphs.json и translator/svg): все буквы алфавита одной высоты и стоят на одной линии.
   Если упало — после правки tools/vectorize_glyphs.py пересоберите: python3 tools/vectorize_glyphs.py */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'translator', 'glyphs.json'), 'utf8'));
const L = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

test('в каждом наборе есть все 33 буквы', () => {
  assert.deepEqual(Object.keys(data.sets).sort(), ['dragon', 'dwarf', 'elf', 'infernal']);
  for (const [n, S] of Object.entries(data.sets)) assert.equal(Object.keys(S.glyphs).join(''), L, n);
});

test('буквы одного набора одной высоты и стоят на одной базовой линии, с одинаковыми боковыми полями', () => {
  for (const [n, S] of Object.entries(data.sets)) {
    const gs = Object.values(S.glyphs), hs = gs.map(g => g.bb[3] - g.bb[1]), med = hs.slice().sort((a, b) => a - b)[hs.length >> 1];
    for (const g of gs) {
      assert.equal(g.h, S.em, n + ': высота ячейки');
      assert.equal(g.y0, S.by, n + ': базовая линия одна');
      assert.equal(g.bb[3], g.y0, n + ': низ чернил на базовой линии');
      assert.equal(g.bb[0], gs[0].bb[0], n + ': левое поле одинаково');
      assert.ok(Math.abs(g.w - (g.bb[2] + g.bb[0])) < .02, n + ': правое поле равно левому');
    }
    for (const h of hs) assert.ok(Math.abs(h - med) / med < .05, `${n}: высота букв ${h} далека от медианы ${med}`);
    assert.ok(S.by - med >= 0 && S.by <= S.em, n + ': буква целиком помещается в ячейку');
  }
});

test('svg-файлы букв совпадают с glyphs.json', () => {
  for (const [n, S] of Object.entries(data.sets)) for (const [l, g] of Object.entries(S.glyphs)) {
    const svg = fs.readFileSync(path.join(root, 'translator', 'svg', `${n}-${l}.svg`), 'utf8');
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    assert.ok(vb && +vb[1] === g.w && +vb[2] === g.h, `${n}-${l}: viewBox`);      // числа, а не строки: Python пишет 17.0, JSON — 17
    assert.ok(svg.includes(`d="${g.d}"`), `${n}-${l}: контур`);
  }
});
