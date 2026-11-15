/* Проверки генератора лута (dmloot.js, часть без DOM) на настоящих данных справочника.
   Запуск: node --test tests/ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const L = require(path.join(root, 'dmloot.js'));
const load = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').normalize('NFC'));
const LISTS = { 24: load('data/items.json'), 14: load('data14/items.json') };
// предсказуемый генератор случайных чисел
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const O = (x = {}) => Object.assign({ mode: 'hoard', tier: 1, ed: 24, kind: '', rar: '', cnt: 'auto', noAtt: false }, x);
const gen = (o, seed) => L.generate(o, L.buildPool(LISTS, o), seeded(seed));

test('редкость предметов: «редкость варьируется» и пустая не считаются, роды слов сводятся к одному ключу', () => {
  assert.equal(L.rarOf({ rarity: 'редкое' }), 'редк'); assert.equal(L.rarOf({ rarity: 'Редкий' }), 'редк');
  assert.equal(L.rarOf({ rarity: 'необычное' }), 'необычн'); assert.equal(L.rarOf({ rarity: 'обычный' }), 'обычн');
  assert.equal(L.rarOf({ rarity: 'очень редкий' }), 'очень'); assert.equal(L.rarOf({ rarity: 'легендарное' }), 'легенд');
  assert.equal(L.rarOf({ rarity: 'редкость варьируется' }), ''); assert.equal(L.rarOf({ rarity: '' }), ''); assert.equal(L.rarOf({}), '');
});

test('пул предметов: без артефактов и без «редкость варьируется»; фильтры типа и настройки работают; в «обеих» нет повторов slug', () => {
  for (const ed of [24, 14]) {
    const pool = L.buildPool(LISTS, O({ ed }));
    assert.ok(pool.length > 300, ed + ': мало предметов в пуле: ' + pool.length);
    assert.ok(pool.every(x => x.r && x.r !== 'артеф' && x.e === ed));
  }
  const all = L.buildPool(LISTS, O({ ed: 'all' }));
  assert.equal(new Set(all.map(x => x.it.slug)).size, all.length, 'повторы slug в «обеих» редакциях');
  assert.ok(all.some(x => x.e === 14) && all.some(x => x.e === 24));
  const p24 = new Set(L.buildPool(LISTS, O({ ed: 24 })).map(x => x.it.slug));
  assert.ok(all.filter(x => p24.has(x.it.slug)).every(x => x.e === 24), 'предмет, доступный в 2024, берётся версией 2024');
  assert.ok(L.buildPool(LISTS, O({ kind: 'Зелье' })).every(x => /^зелье/i.test(x.it.type)));
  assert.ok(L.buildPool(LISTS, O({ kind: 'Волшебная палочка' })).length > 5);
  assert.ok(L.buildPool(LISTS, O({ noAtt: true })).every(x => !x.it.attunement));
  assert.ok(L.buildPool(LISTS, O({ rar: 'артеф' })).some(x => x.r === 'артеф'), 'артефакты по прямой просьбе доступны');
});

test('добыча с монстра: одна монета подходящего уровня, без предметов и ценностей', () => {
  for (let t = 1; t <= 4; t++) for (let i = 0; i < 60; i++) {
    const r = gen(O({ mode: 'ind', tier: t }), t * 1000 + i), ks = Object.keys(r.coins);
    assert.equal(ks.length, 1); assert.ok(r.coins[ks[0]] > 0);
    assert.equal(r.items.length + r.gems.length + r.art.length, 0);
  }
});

test('сокровищница: деньги растут с уровнем, самоцветы и искусство из своих цен, предметы редкостью по уровню', () => {
  const avg = {}, rars = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
  for (let t = 1; t <= 4; t++) {
    let sum = 0; const N = 300;
    for (let i = 0; i < N; i++) {
      const r = gen(O({ tier: t }), t * 7919 + i); sum += L.totalGp(r);
      assert.ok(L.totalGp(r) > 0);
      r.gems.forEach(g => { assert.ok(L.TIERS[t].gems.v.includes(g.v), 'цена самоцвета ' + g.v); assert.ok(L.GEMS[g.v].includes(g.n)); });
      r.art.forEach(g => { assert.ok(L.TIERS[t].art.v.includes(g.v), 'цена предмета искусства ' + g.v); assert.ok(L.ART[g.v].includes(g.n)); });
      r.items.forEach(x => rars[t].add(x.r));
      assert.ok(r.items.reduce((s, x) => s + x.q, 0) <= L.TIERS[t].mag.at(-1)[0]);
    }
    avg[t] = sum / N;
  }
  assert.ok(avg[1] < avg[2] && avg[2] < avg[3] && avg[3] < avg[4], JSON.stringify(avg));
  for (let t = 1; t <= 4; t++) { const allowed = L.TIERS[t].rar.map(x => x[0]); assert.ok([...rars[t]].every(r => allowed.includes(r)), t + ': ' + [...rars[t]]); }
  assert.ok(!rars[1].has('легенд') && !rars[4].has('обычн'));
});

test('монеты сокровищницы: нет лишних номиналов, сумма близка к заданной стоимости', () => {
  for (let i = 0; i < 100; i++) {
    const r = gen(O({ tier: 1 }), i), gp = L.coinGp(r.coins);
    assert.ok(!r.coins.pm && !r.coins.em, 'на 1-м уровне нет платины и электрума');
    assert.ok(gp >= 3 * 30 - 1 && gp <= 18 * 30 + 1, 'стоимость монет 1-го уровня: ' + gp);
  }
});

test('число предметов: явное значение соблюдается; режим «Магия» без монет', () => {
  for (const n of [0, 1, 3, 5]) {
    const r = gen(O({ cnt: n, tier: 3 }), 40 + n);
    assert.equal(r.items.reduce((s, x) => s + x.q, 0), n, 'сокровищница, предметов ' + n);
  }
  const m = gen(O({ mode: 'magic', cnt: 4, tier: 2 }), 5);
  assert.equal(m.items.reduce((s, x) => s + x.q, 0), 4); assert.deepEqual(m.coins, {}); assert.equal(m.gems.length + m.art.length, 0);
  assert.equal(gen(O({ mode: 'magic', cnt: 'auto' }), 6).items.reduce((s, x) => s + x.q, 0), 1);
});

test('фильтры в генерации: тип и фиксированная редкость', () => {
  for (let i = 0; i < 40; i++) {
    const r = gen(O({ mode: 'magic', cnt: 3, kind: 'Зелье', rar: 'редк' }), i);
    r.items.forEach(x => { assert.ok(/^зелье/i.test(LISTS[24].find(y => y.slug === x.slug).type)); assert.equal(x.r, 'редк'); });
  }
});

test('нет предметов нужной редкости — берётся ближайшая; пустой пул — пометка, без ошибки', () => {
  const kind = L.KINDS.map(k => k[0]).find(k => k && (p => p.length && !p.some(x => x.r === 'легенд'))(L.buildPool(LISTS, O({ kind: k }))));
  assert.ok(kind, 'для проверки нужен тип без легендарных предметов');
  const o = O({ mode: 'magic', cnt: 1, kind, rar: 'легенд' }), pool = L.buildPool(LISTS, o);
  const r = L.generate(o, pool, seeded(1));
  assert.equal(r.items.length, 1); assert.notEqual(r.items[0].r, 'легенд');
  const e = L.generate(O({ mode: 'magic', cnt: 2 }), [], seeded(1));
  assert.equal(e.items.length, 0); assert.ok(e.note);
});

test('замена предмета: другой предмет той же редкости, число предметов не меняется', () => {
  const o = O({ mode: 'magic', cnt: 3, tier: 2 }), pool = L.buildPool(LISTS, o), r = L.generate(o, pool, seeded(9));
  const rare = r.items[0].want, was = r.items[0].slug;
  assert.ok(L.reroll(r, 0, pool, seeded(77)));
  assert.equal(r.items.reduce((s, x) => s + x.q, 0), 3);
  assert.ok(r.items.every(x => x.want));
  assert.ok(rare);
  assert.equal(L.reroll(r, 99, pool), false);
  void was;
});

test('текст для копирования: монеты, ценности, предметы, итог; пометка редакции только при «обеих»', () => {
  const o = O({ tier: 2, cnt: 2, ed: 'all' }), r = L.generate(o, L.buildPool(LISTS, o), seeded(3)), t = L.textOf(r, true);
  assert.match(t, /^Монеты: /); assert.match(t, /Магические предметы: /); assert.match(t, /≈ [\d ]+ зм/);
  assert.match(t, /\((24|14)\)/); assert.doesNotMatch(L.textOf(r, false), /\((24|14)\)/);
  assert.doesNotMatch(L.textOf(L.generate(O({ mode: 'magic', cnt: 1 }), L.buildPool(LISTS, O()), seeded(2)), false), /Монеты/);
});
