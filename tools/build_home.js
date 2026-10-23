#!/usr/bin/env node
/* Пересобирает числа записей на главной (HOMEN в index.html) из data/*.json и data14/*.json.
   Запуск после правки данных: node tools/build_home.js  (tests/home.test.js проверяет, что числа не устарели) */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const KEYS = { 24: ['bestiary', 'spells', 'class', 'species', 'backgrounds', 'feats', 'items', 'equipment', 'glossary'],
  14: ['bestiary', 'spells', 'class', 'race', 'backgrounds', 'feats', 'items', 'equipment', 'glossary', 'articles'] };
const counts = () => Object.fromEntries(Object.entries(KEYS).map(([ed, ks]) => [ed, Object.fromEntries(ks.map(k =>
  [k, JSON.parse(fs.readFileSync(path.join(root, ed == 14 ? 'data14' : 'data', k + '.json'), 'utf8')).length]))]));
const line = c => 'const HOMEN=' + JSON.stringify(c) + ';/*home-counts*/';
module.exports = { counts, line };
if (require.main === module) {
  const f = path.join(root, 'index.html'), html = fs.readFileSync(f, 'utf8');
  const out = html.replace(/const HOMEN=.*;\/\*home-counts\*\//, line(counts()));
  if (out !== html) { fs.writeFileSync(f, out); console.log('index.html: числа на главной обновлены'); } else console.log('index.html: числа на главной актуальны');
}
