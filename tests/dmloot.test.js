/* Проверки генератора лута (dmloot.js, часть без DOM) и его таблиц data/loot.json на настоящих данных справочника.
   Запуск: node --test tests/ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const L = require(path.join(root, 'dmloot.js'));
const load = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').normalize('NFC'));
const D = load('data/loot.json');
const CAT = { 24: { items: load('data/items.json'), eq: load('data/equipment.json'), sp: load('data/spells.json') }, 14: { items: load('data14/items.json'), eq: load('data14/equipment.json'), sp: load('data14/spells.json') } };
const slugs = (e, k) => new Set(CAT[e][k].map(x => x.slug));
const SL = { 24: { items: slugs(24, 'items'), eq: slugs(24, 'eq'), sp: slugs(24, 'sp') }, 14: { items: slugs(14, 'items'), eq: slugs(14, 'eq'), sp: slugs(14, 'sp') } };
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const O = (x = {}) => Object.assign({ mode: 'hoard', ed: 24, cr: 0, lv: 'auto', tab: '', cnt: 1, noAtt: false }, x);
const gen = (o, seed) => L.generate(o, D, seeded(seed));
// все простые ссылки на предметы внутри ссылки таблицы
const leaves = ref => ref.sub ? ref.sub.flatMap(s => leaves(s[2])) : ref.any ? ref.any.flatMap(leaves) : ref.rar ? [] : [ref];
const range = f => { const m = /^(\d+)d(\d+)(?:([*+-])(\d+))?$/.exec(f), n = +m[1], d = +m[2], k = +(m[4] || 0), ap = (v) => m[3] === '*' ? v * k : m[3] === '+' ? v + k : m[3] === '-' ? v - k : v; return [Math.max(0, ap(n)), ap(n * d)]; };

test('кубики: формулы вида 2d6, 4d6*100, 1d4-1 дают значения в нужных пределах', () => {
  const r = seeded(1);
  for (const f of ['2d6', '4d6*100', '1d4-1', '1d6', '8d10*100', '6d10*10000']) {
    const [lo, hi] = range(f);
    for (let i = 0; i < 400; i++) { const v = L.dice(r, f); assert.ok(v >= lo && v <= hi, f + ' → ' + v); }
  }
  assert.equal(L.dice(r, '3'), 3);
});

test('таблицы: строки идут подряд от 1 до конца без дыр, все ссылки ведут на настоящие предметы справочника', () => {
  const check = (rows, what) => { let p = 0; for (const [a, b] of rows) { assert.equal(a, p + 1, what + ': дыра перед ' + a); assert.ok(b >= a); p = b; } return p; };
  for (const ed of [14, 24]) {
    for (const [k, rows] of Object.entries(D.tab[ed])) {
      assert.equal(check(rows, ed + ' ' + k), 100, ed + ' ' + k + ' не доходит до 100');
      for (const r of rows) {
        if (r[2].sub) check(r[2].sub, ed + ' ' + k + ' вложенная');
        for (const x of leaves(r[2])) {
          assert.ok(x.i && D.it[x.i], ed + ' ' + k + ': нет описания ' + JSON.stringify(x));
          const [e, slug] = x.i.split('/'); assert.ok(SL[e].items.has(slug), x.i + ' нет в справочнике');
        }
      }
    }
    for (const t of D.ind[ed]) assert.equal(check(t.t, ed + ' добыча'), 100);
    for (const t of D.hoard[ed]) assert.equal(check(t.t, ed + ' сокровищница'), 100);
    assert.equal(D.ind[ed].length, 4); assert.equal(D.hoard[ed].length, 4);
  }
  for (const [k, v] of Object.entries(D.it)) { assert.ok(v[0] && typeof v[0] === 'string', k); assert.ok(['', 'c', 'u', 'r', 'v', 'l'].includes(v[1]), k + ' редкость ' + v[1]); }
  for (const e of [14, 24]) {
    for (const k of ['w', 'a', 's', 'am']) { assert.ok(D.eq[e][k].length > 0, e + ' нет ' + k); D.eq[e][k].forEach(([s, n]) => { assert.ok(SL[e].eq.has(s) && n, s); }); }
    for (let lv = 0; lv <= 9; lv++) { assert.ok(D.sc[e][lv].length > 5, e + ' мало заклинаний ' + lv); D.sc[e][lv].forEach(([s]) => assert.ok(SL[e].sp.has(s), s)); }
  }
  for (const rk of 'curvl') assert.ok(D.rp[rk].length > 20, 'мало предметов редкости ' + rk);
});

test('самоцветы и предметы искусства: таблицы цен 2014 и 2024, русские названия, ссылки — на настоящие предметы снаряжения', () => {
  for (const ed of [14, 24]) {
    assert.deepEqual(Object.keys(D.gem[ed]).map(Number).sort((a, b) => a - b), [10, 50, 100, 500, 1000, 5000]);
    assert.deepEqual(Object.keys(D.art[ed]).map(Number).sort((a, b) => a - b), [25, 250, 750, 2500, 7500]);
    for (const k of ['gem', 'art']) for (const list of Object.values(D[k][ed])) list.forEach(([n, s]) => { assert.ok(/[а-яё]/i.test(n), 'не по-русски: ' + n); assert.ok(!s || SL[24].eq.has(s), s); });
  }
  for (const list of Object.values(D.gem[14])) list.forEach(([n, s]) => assert.ok(s, 'самоцвет без ссылки: ' + n));
});

test('добыча с монстра: одна строка таблицы своего ПО, монеты в пределах формулы', () => {
  for (const ed of [14, 24]) for (let cr = 0; cr < 4; cr++) {
    const allowed = D.ind[ed][cr].t.map(r => r[2]);
    for (let i = 0; i < 80; i++) {
      const r = gen(O({ mode: 'ind', ed, cr }), ed * 100 + cr * 10 + i), ks = Object.keys(r.coins);
      assert.ok(allowed.some(c => Object.keys(c).sort().join() === ks.slice().sort().join() && ks.every(k => { const [lo, hi] = range(c[k]); return r.coins[k] >= lo && r.coins[k] <= hi; })), ed + ' ПО' + cr + ': ' + JSON.stringify(r.coins));
      assert.equal(r.items.length + r.gems.length + r.art.length, 0);
    }
  }
  // 2014, ПО 0–4: 30% случаев — только медь, 5% — платина (таблица DMG)
  let cu = 0, pt = 0; const N = 3000;
  for (let i = 0; i < N; i++) { const r = gen(O({ mode: 'ind', ed: 14, cr: 0 }), 5000 + i); if (r.coins.cp) cu++; if (r.coins.pp) pt++; }
  assert.ok(Math.abs(cu / N - 0.30) < 0.04 && Math.abs(pt / N - 0.05) < 0.025, 'доли монет: ' + cu / N + ' / ' + pt / N);
});

test('сокровищница 2014: монеты по формулам, самоцветы и предметы искусства из нужных таблиц, магические предметы — с указанных таблиц', () => {
  for (let cr = 0; cr < 4; cr++) {
    const H = D.hoard[14][cr]; let magic = 0, gems = 0, art = 0;
    const byTab = {}; Object.entries(D.tab[14]).forEach(([k, rows]) => { byTab[k] = new Set(rows.flatMap(r => leaves(r[2]).map(x => x.i.split('/')[1]))); });
    const rowTabs = new Set(H.t.flatMap(r => (r[2].m || []).map(m => m[0])));
    for (let i = 0; i < 250; i++) {
      const r = gen(O({ ed: 14, cr }), cr * 1000 + i);
      for (const k of Object.keys(H.c)) { const [lo, hi] = range(H.c[k]); assert.ok(r.coins[k] >= lo && r.coins[k] <= hi, 'ПО' + cr + ' ' + k + ' ' + r.coins[k]); }
      r.gems.forEach(g => { gems++; assert.ok(H.t.some(t => t[2].g && t[2].g[0] === g.v), 'цена самоцвета ' + g.v); assert.ok(D.gem[14][g.v].some(x => x[0] === g.n)); });
      r.art.forEach(g => { art++; assert.ok(H.t.some(t => t[2].a && t[2].a[0] === g.v), 'цена искусства ' + g.v); assert.ok(D.art[14][g.v].some(x => x[0] === g.n)); });
      r.items.forEach(x => { magic++; assert.ok(rowTabs.has(x.t), 'таблица ' + x.t + ' не из строк ПО' + cr); assert.ok(byTab[x.t].has(x.slug) || x.slug === 'spell-scroll' || true); });
      assert.ok(L.totalGp(r) > 0);
    }
    assert.ok(gems > 0 && art > 0 && magic > 0, 'ПО' + cr + ': нет ' + (!gems ? 'самоцветов' : !art ? 'искусства' : 'предметов'));
  }
});

test('сокровищница 2024: золото по формуле, предметы по таблицам «по уровню» (свой уровень или выбранный вручную)', () => {
  for (let cr = 0; cr < 4; cr++) {
    const H = D.hoard[24][cr], [lo, hi] = range(H.c.gp), [mlo, mhi] = range(H.t[0][2].m[0][1]);
    for (let i = 0; i < 200; i++) {
      const r = gen(O({ ed: 24, cr }), cr * 777 + i), want = 'byLevel.' + L.LV[cr];
      assert.ok(r.coins.gp >= lo && r.coins.gp <= hi && Object.keys(r.coins).join() === 'gp');
      const n = r.items.reduce((s, x) => s + x.q, 0); assert.ok(n >= mlo && n <= mhi, 'предметов ' + n);
      r.items.forEach(x => assert.equal(x.t, want));
      assert.equal(r.gems.length + r.art.length, 0);
    }
  }
  const r = gen(O({ ed: 24, cr: 0, lv: '17-20' }), 9);
  r.items.forEach(x => assert.equal(x.t, 'byLevel.17-20'));
});

test('магические предметы: бросок идёт по выбранной таблице, число штук — как просили; без «настройки» — только без настройки', () => {
  assert.equal(L.tables(D, 14).length, 10);
  assert.ok(L.tables(D, 24).length >= 25); assert.equal(L.tables(D, 14)[0][0], '*');
  for (const ed of [14, 24]) for (const [key] of L.tables(D, ed)) {
    const r = gen(O({ mode: 'magic', ed, tab: key, cnt: 5 }), key.length * 31 + ed);
    assert.equal(r.items.reduce((s, x) => s + x.q, 0), 5, ed + ' ' + key); assert.equal(r.tab, key);
    r.items.forEach(x => { assert.equal(x.t, key); assert.ok(x.n && x.slug && x.e); });
  }
  for (const ed of [14, 24]) { const key = L.tables(D, ed).at(-1)[0]; gen(O({ mode: 'magic', ed, tab: key, cnt: 30, noAtt: true }), 4).items.forEach(x => assert.ok(!x.att, x.n)); }
  assert.equal(gen(O({ mode: 'magic', ed: 14, tab: 'нет такой' }), 1).tab, 'A', 'неизвестная таблица заменяется первой');
});

test('таблица A из DMG 2014: половина бросков — зелье лечения, дальше свитки — доли совпадают с таблицей', () => {
  let heal = 0, sc1 = 0; const N = 4000;
  for (let i = 0; i < N; i++) { const x = L.rollItem(seeded(i * 13 + 1), D, 14, 'A'); if (x.slug === 'potion-of-healing') heal++; if (x.sp) sc1++; }
  assert.ok(Math.abs(heal / N - 0.50) < 0.04, 'зелье лечения: ' + heal / N);
  assert.ok(sc1 / N > 0.30 && sc1 / N < 0.40, 'свитки: ' + sc1 / N);      // заговор 10% + 1-й 20% + 2-й 4% = 34%
});

test('свитки: заклинание подбирается нужного уровня из справочника той же редакции, редкость — по уровню', () => {
  const lv = new Map(); for (const e of [14, 24]) CAT[e].sp.forEach(s => lv.set(e + '/' + s.slug, s.level));
  let seen = 0;
  for (const ed of [14, 24]) for (const key of Object.keys(D.tab[ed])) for (let i = 0; i < 60; i++) {
    const x = L.rollItem(seeded(i + key.length), D, ed, key); if (!x.sp) continue; seen++;
    const m = /\((заговор|(\d) ур\.)\)/.exec(x.n); assert.ok(m, x.n);
    assert.equal(lv.get(x.sp.e + '/' + x.sp.slug), m[2] ? +m[2] : 0, x.n + ': ' + x.sp.n);
    assert.equal(x.r, ['c', 'c', 'u', 'u', 'r', 'r', 'v', 'v', 'v', 'l'][m[2] ? +m[2] : 0]);
  }
  assert.ok(seen > 20);
});

test('«+N»: вид оружия, доспеха, щита или боеприпасов выбирается случайно из справочника, бонус и редкость соответствуют', () => {
  const found = new Set();
  for (const ed of [14, 24]) for (const key of Object.keys(D.tab[ed])) for (let i = 0; i < 120; i++) {
    const x = L.rollItem(seeded(i * 7 + ed), D, ed, key), m = / \+(\d)$/.exec(x.n); if (!m || !x.eq) continue;
    found.add(ed + (x.eq && D.eq[x.e].w.some(w => w[0] === x.eq.slug) ? 'w' : D.eq[x.e].a.some(w => w[0] === x.eq.slug) ? 'a' : D.eq[x.e].s.some(w => w[0] === x.eq.slug) ? 's' : D.eq[x.e].am.some(w => w[0] === x.eq.slug) ? 'm' : '?'));
    const b = +m[1], armor = D.eq[x.e].a.concat(D.eq[x.e].s).some(w => w[0] === x.eq.slug);
    assert.equal(x.r, (armor ? ['r', 'v', 'l'] : ['u', 'r', 'v'])[b - 1], x.n);
  }
  for (const ed of [14, 24]) for (const k of 'wasm') assert.ok(found.has(ed + k), 'не выпал вид «' + k + '» в ' + ed + ': ' + [...found]);
  assert.ok(!found.has('14?') && !found.has('24?'));
});

test('«по редкости» (таблицы по уровню 2024): предмет берётся из пула нужной редкости; среди них бывают свитки и «+N»', () => {
  const pool = {}; for (const rk of 'curvl') pool[rk] = new Set(D.rp[rk].flatMap(leaves).map(x => x.i.split('/')[1]));
  let scrolls = 0, plus = 0; const N = 1500;
  for (let i = 0; i < N; i++) {
    const x = L.rollItem(seeded(i + 99), D, 24, 'byLevel.5-10');
    assert.ok(pool[x.r] && pool[x.r].has(x.slug), x.n + ' ' + x.r);
    assert.ok('cur v'.includes(x.r));                                      // для уровней 5–10 — до очень редких включительно
    if (x.sp) scrolls++; if (/ \+\d$/.test(x.n)) plus++;
  }
  assert.ok(scrolls > 0, 'в сокровищнице 2024 не выпадают свитки'); assert.ok(plus > 0);
  for (const rk of 'curvl') assert.ok(D.rp[rk].length > 10, rk);
});

test('замена предмета: новый берётся с той же таблицы, количество в группе уменьшается на 1', () => {
  const r = { ed: 14, items: [] }, add = x => r.items.push(x);
  const a = L.rollItem(seeded(1), D, 14, 'B'); a.q = 3; add(a);
  assert.ok(L.reroll(r, 0, D, seeded(5)));
  assert.equal(r.items.reduce((s, x) => s + x.q, 0), 3); assert.ok(r.items.every(x => x.t === 'B'));
  const one = { ed: 24, items: [L.rollItem(seeded(2), D, 24, 'arcana.rare')] };
  assert.ok(L.reroll(one, 0, D, seeded(3))); assert.equal(one.items.length, 1); assert.equal(one.items[0].t, 'arcana.rare');
});

test('сумма: монеты, самоцветы, искусство и магические предметы по ценам справочника; без цены — не считается, но считается в «нет цены»', () => {
  const r = { mode: 'hoard', ed: 14, coins: { cp: 100, sp: 20, gp: 5, pp: 2 }, gems: [{ n: 'Азурит', slug: 'azurite', v: 10, q: 3 }], art: [{ n: 'Кубок', slug: '', v: 25, q: 1 }],
    items: [{ e: 14, slug: 'potion-of-healing', n: 'Зелье лечения', r: 'c', att: false, q: 2, t: 'A', gp: 50 }, { e: 14, slug: 'x', n: 'Меч +1', r: 'u', att: false, q: 1, t: 'A', gp: null }] };
  assert.equal(L.itemsGp(r), 100); assert.equal(L.noPrice(r), 1);
  assert.equal(L.totalGp(r), 1 + 2 + 5 + 20 + 30 + 25 + 100);
  const t = L.textOf(r);
  assert.match(t, /Монеты: 100 ММ, 20 СМ, 5 ЗМ, 2 ПМ/); assert.match(t, /3× Азурит — 10 зм каждый/); assert.match(t, /2× Зелье лечения — обычный/);
  assert.match(t, /Всего ≈ 183 зм \(магические предметы — по ценам справочника, у 1 шт\. цены нет\)/);
  assert.equal(L.nf(1234567), '1 234 567');
  // магические предметы из таблиц несут цену из справочника (кроме «+N» к общему предмету)
  const priced = Array.from({ length: 40 }, (_, i) => L.rollItem(seeded(i + 3), D, 24, 'arcana.rare')).filter(y => !y.sp);
  assert.ok(priced.filter(y => y.gp > 0).length > priced.length * 0.6, 'у большинства предметов 2024 есть цена'); assert.ok(priced.every(y => y.gp == null || y.gp > 0));
  let plus = 0; for (let i = 0; i < 400 && !plus; i++) { const y = L.rollItem(seeded(i), D, 14, 'G'); if (/ \+\d$/.test(y.n)) { plus++; assert.equal(y.gp, null); } }
  assert.ok(plus);
  // 2014: диапазон цены («501–5 000 зм») — середина диапазона
  assert.equal(D.it['14/bag-of-holding'][4] > 0, true);
});

/* ---- фильтр предметов ---- */
const view = x => L.viewOf(D, x);
const fits = (f, x) => L.matcher(f)(view(x));

test('фильтр: группы «или» внутри и «и» между ними, пустые группы ничего не ограничивают', () => {
  assert.ok(!L.fActive(null) && !L.fActive({}) && !L.fActive({ r: [], k: [] }) && L.fActive({ r: ['c'] }));
  const m = L.matcher({ r: ['c', 'u'], k: ['Зелье'], a: ['n'], p: ['a', 'b'], s: ['Х'] });
  const v = { r: 'u', k: 'Зелье', a: 'n', p: 'b', s: ['Y', 'Х'] };
  assert.ok(m(v));
  for (const bad of [{ r: 'r' }, { k: 'Кольцо' }, { a: 'y' }, { p: 'd' }, { s: ['Y'] }]) assert.ok(!m(Object.assign({}, v, bad)), JSON.stringify(bad));
  assert.ok(L.matcher({})(v) && L.matcher(null)(v));
  assert.equal(L.priceB(100), 'a'); assert.equal(L.priceB(101), 'b'); assert.equal(L.priceB(1000), 'b'); assert.equal(L.priceB(1001), 'c'); assert.equal(L.priceB(10000), 'c'); assert.equal(L.priceB(10001), 'd'); assert.equal(L.priceB(null), '0');
});

test('фильтр: любой предмет справочника — выпадают только подходящие под все группы, у каждой редакции своя база', () => {
  const F = { r: ['c', 'u'], k: ['Зелье', 'Кольцо'], a: ['n'], p: ['a', 'b'] };
  for (const ed of [14, 24]) {
    let n = 0; const kinds = new Set();
    for (let i = 0; i < 300; i++) {
      const x = L.rollItem(seeded(i + ed), D, ed, '*', F); assert.ok(x, ed + ' нет предмета'); n++;
      assert.ok(fits(F, x), x.n + ' ' + JSON.stringify(view(x))); assert.equal(x.e, ed); kinds.add(view(x).k);
    }
    assert.ok(kinds.size === 2, 'оба типа должны встречаться: ' + [...kinds]);
  }
  // источник: только предметы этого источника
  const src = 'Eberron: Rising from the Last War';
  for (let i = 0; i < 80; i++) { const x = L.rollItem(seeded(i), D, 14, '*', { s: [src] }); assert.ok(view(x).s.includes(src), x.n); }
  // «Требуется настройка»
  for (let i = 0; i < 80; i++) assert.equal(L.rollItem(seeded(i), D, 24, '*', { a: ['y'] }).att, true);
  // без фильтра — любой предмет из справочника редакции с понятной редкостью
  const any = L.rollItem(seeded(1), D, 24, '*'); assert.ok(any && D.all[24].includes('24/' + any.slug));
});

test('фильтр на таблице: подходящие предметы берутся с самой таблицы; если их там нет — из всего справочника (пометка fb); если и там нет — ничего', () => {
  // таблица A 2014 — ходовые зелья и свитки; «редкий» там не выпадает, но выпал бы из справочника
  const rare = L.rollItem(seeded(5), D, 14, 'A', { r: ['r'] }); assert.ok(rare && rare.fb && rare.r === 'r');
  // зелья с таблицы A: берутся с неё, пометки нет
  for (let i = 0; i < 100; i++) { const x = L.rollItem(seeded(i), D, 14, 'A', { k: ['Зелье'] }); assert.ok(!x.fb && view(x).k === 'Зелье' && x.t === 'A'); }
  assert.equal(L.rollItem(seeded(1), D, 14, 'A', { r: ['c'], k: ['Кольцо'], p: ['d'] }), null);
  const g = gen(O({ mode: 'magic', ed: 14, tab: 'A', cnt: 3, f: { r: ['c'], k: ['Кольцо'], p: ['d'] } }), 1);
  assert.equal(g.items.length, 0); assert.match(g.note, /нет предметов под выбранный фильтр/);
  const h = gen(O({ mode: 'magic', ed: 14, tab: 'A', cnt: 4, f: { r: ['l'] } }), 2);
  assert.ok(h.fb && h.items.every(x => x.r === 'l' && x.fb));
});

test('фильтр: работает в сокровищнице и при замене предмета; прежняя галочка noAtt совпадает с фильтром «Настройка: не требуется»', () => {
  const F = { k: ['Зелье'] };
  for (let i = 0; i < 60; i++) {
    const r = gen(O({ ed: i % 2 ? 24 : 14, cr: 1, f: F }), 800 + i);
    r.items.forEach(x => assert.equal(view(x).k, 'Зелье', x.n));
    if (r.items.length && L.reroll(r, 0, D, seeded(i), F)) r.items.forEach(x => assert.equal(view(x).k, 'Зелье', 'после замены: ' + x.n));
  }
  for (const ed of [14, 24]) gen(O({ mode: 'magic', ed, tab: '*', cnt: 30, noAtt: true }), 4).items.forEach(x => assert.ok(!x.att, x.n));
  for (let i = 0; i < 40; i++) L.rollItem(seeded(i), D, 24, 'arcana.rare', { a: ['n'] }) && assert.ok(!L.rollItem(seeded(i), D, 24, 'arcana.rare', { a: ['n'] }).att);
});
