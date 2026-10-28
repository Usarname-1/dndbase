/* Проверки адресов страниц: разбор и сборка адресов, заголовки и описания, список раздела.
   Запуск: node --test tests/*.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8'), ctx);
const core = n => vm.runInContext(n, ctx);
const { hh, parseRel, ORDERS } = { hh: core('hh'), parseRel: core('parseRel'), ORDERS: core('ORDERS') };

test('адрес записи: 2024 без префикса, 2014 с «14/», везде слэш на конце', () => {
  assert.equal(hh(24), './'); assert.equal(hh(14), '14/');
  assert.equal(hh(24, 'spells'), 'spells/'); assert.equal(hh(14, 'spells'), '14/spells/');
  assert.equal(hh(24, 'spells', 'fireball'), 'spells/fireball/'); assert.equal(hh(14, 'bestiary', 'goblin'), '14/bestiary/goblin/');
});

test('parseRel разбирает то, что собрал hh, и отвергает адреса, которых на сайте нет', () => {
  for (const e of [24, 14]) for (const k of ORDERS[e]) {
    assert.deepEqual({ ...parseRel(hh(e, k)) }, { e, k, slug: '' });
    assert.deepEqual({ ...parseRel(hh(e, k, 'x_y-1')) }, { e, k, slug: 'x_y-1' });
  }
  assert.deepEqual({ ...parseRel('') }, { e: 24, k: '', slug: '' });
  assert.deepEqual({ ...parseRel('14/') }, { e: 14, k: '', slug: '' });
  assert.deepEqual({ ...parseRel('translator/doc/') }, { e: 24, k: 'translator', slug: 'doc' });
  assert.equal(parseRel('species/')?.k, 'species'); assert.equal(parseRel('14/species/'), null);   // у 2014 раздел называется race
  assert.equal(parseRel('race/'), null); assert.equal(parseRel('14/race/')?.k, 'race');
  assert.equal(parseRel('nope/'), null); assert.equal(parseRel('spells/a/b/'), null); assert.equal(parseRel('dmscreen/x/'), null);
});

test('для каждой записи каждого раздела есть страница, а в списке раздела — ссылка на неё', () => {
  const missing = [];
  for (const e of [24, 14]) for (const k of ORDERS[e]) {
    const d = JSON.parse(fs.readFileSync(path.join(root, e === 14 ? 'data14' : 'data', k + '.json'), 'utf8'));
    const list = fs.readFileSync(path.join(root, hh(e, k), 'index.html'), 'utf8');
    assert.equal((list.match(/<li><a href=/g) || []).length, d.length, `${e}/${k}: ссылок в списке не столько, сколько записей`);
    for (const m of d) if (!fs.existsSync(path.join(root, hh(e, k, m.slug), 'index.html'))) missing.push(`${e}/${k}/${m.slug}`);
  }
  assert.deepEqual(missing, []);
});

test('описание записи: содержит название и укладывается в длину сниппета', () => {
  const entryDesc = core('entryDesc'), d = JSON.parse(fs.readFileSync(path.join(root, 'data', 'spells.json'), 'utf8'));
  for (const m of d.slice(0, 80)) { const t = entryDesc(24, 'spells', m); assert.ok(t.includes(m.name_ru) && t.length >= 70 && t.length <= 175, m.slug + ': ' + t.length); }
});
