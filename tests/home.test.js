/* Проверки главной: числа записей не устарели, у каждого пункта оглавления есть число, ссылки ведут в существующие разделы.
   Запуск: node --test tests/*.test.js. Если число устарело — node tools/build_home.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const { counts, line } = require(path.join(root, 'tools', 'build_home.js'));

test('числа записей на главной совпадают с данными (иначе запустите node tools/build_home.js)', () => {
  assert.ok(app.includes(line(counts())));
});

test('каждый пункт оглавления получает число, а ключ есть в данных обеих редакций (кроме «Правил и статей» 2014)', () => {
  const card = html.match(/<div id="card">([\s\S]*?)<\/article><\/div>/)[1];
  const keys = [...card.matchAll(/data-n="([a-z]+)"/g)].map(m => m[1]);
  assert.ok(keys.length >= 9);
  const c = counts();
  for (const k of keys) {
    assert.ok(k in c[24] || k == 'articles', '2024: нет данных для ' + k);
    assert.ok(k in c[14] || (k == 'species' && 'race' in c[14]), '2014: нет данных для ' + k);
  }
});

test('на главной есть форма поиска, переключатель редакций и ссылки на инструменты', () => {
  const card = html.match(/<div id="card">([\s\S]*?)<\/article><\/div>/)[1];
  assert.match(card, /id="hs"/);
  assert.match(card, /data-e="14"/); assert.match(card, /data-e="24"/);
  for (const s of ['dmscreen', 'sheet', 'translator']) assert.ok(card.includes('data-s="' + s + '"'), s);
});
