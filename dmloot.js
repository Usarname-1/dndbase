/* ===== Генератор лута для экрана мастера =====
   Подгружается при первом открытии панели «Генератор лута» (см. dmpanels.js), чтобы не утяжелять все страницы.
   Правила — те же, что у генератора лута 5etools: «Руководство мастера» 2014 (добыча с монстра и сокровищницы по ПО,
   таблицы магических предметов A–I, самоцветы и предметы искусства) и 2024 (то же, а также таблицы «по уровню отряда»
   и «Арканум / Вооружение / Орудия / Реликвии» по редкостям). Таблицы лежат в data/loot.json (собирает tools/build_loot.js);
   названия там уже русские и привязаны к справочнику предметов, поэтому справочники для генерации не загружаются.
   Часть «правила» не трогает DOM и проверяется в node (tests/dmloot.test.js); часть «панель» рисует интерфейс. */
(function (root) {
  'use strict';

  /* ---------- правила ---------- */
  const COIN = ['cp', 'sp', 'ep', 'gp', 'pp'];
  const COIN_N = { cp: 'ММ', sp: 'СМ', ep: 'ЭМ', gp: 'ЗМ', pp: 'ПМ' };
  const GP = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };           // стоимость монеты в золотых
  const RAR_N = { c: 'обычный', u: 'необычный', r: 'редкий', v: 'очень редкий', l: 'легендарный', a: 'артефакт' };
  const CRS = [[0, 4], [5, 10], [11, 16], [17, 30]];                   // уровни опасности (ПО) — они же строки таблиц сокровищ
  const CR_N = ['ПО 0–4', 'ПО 5–10', 'ПО 11–16', 'ПО 17 и выше'];
  const LV = ['1-4', '5-10', '11-16', '17-20'];                         // уровни отряда: ключи таблиц «по уровню» (2024)
  const LV_N = ['Уровни 1–4', 'Уровни 5–10', 'Уровни 11–16', 'Уровни 17–20'];
  const CAT_N = { arcana: 'Арканум', armaments: 'Вооружение', implements: 'Орудия', relics: 'Реликвии' };
  const RARK = ['c', 'u', 'r', 'v', 'l'];

  /* Фильтр предметов — те же группы, что в фильтре справочника: внутри группы «или», между группами «и», пустая группа не ограничивает.
     f = { r: [редкости 'c'…'l'], k: [типы], a: ['n' — без настройки, 'y' — с настройкой], p: [цена: '0' без цены, 'a' до 100, 'b' до 1000, 'c' до 10 000, 'd' дороже], s: [источники] } */
  const KINDS = ['Волшебная палочка', 'Доспех', 'Жезл', 'Зелье', 'Кольцо', 'Оружие', 'Посох', 'Свиток', 'Чудесный предмет'];
  const ATT_N = [['n', 'Не требуется'], ['y', 'Требуется']];
  const PRICE_N = [['a', 'до 100 зм'], ['b', '100–1 000 зм'], ['c', '1 000–10 000 зм'], ['d', 'более 10 000 зм'], ['0', 'Без цены']];
  const priceB = gp => gp == null ? '0' : gp <= 100 ? 'a' : gp <= 1000 ? 'b' : gp <= 10000 ? 'c' : 'd';
  const GROUPS = ['r', 'k', 'a', 'p', 's'];
  const fActive = f => !!f && GROUPS.some(g => f[g] && f[g].length);
  // свойства предмета для фильтра: из «описания» D.it[e/slug] (тип и источники) и из выпавшего предмета (редкость, цена — у вариантов они свои)
  const viewOf = (D, x) => { const b = D.it[x.e + '/' + x.slug]; return { r: x.r, a: x.att ? 'y' : 'n', p: priceB(x.gp), k: b[5], s: (b[6] || []).map(i => D.src[i]) }; };
  const matcher = f => { const has = g => f && f[g] && f[g].length; return v => (!has('r') || f.r.includes(v.r)) && (!has('k') || f.k.includes(v.k)) && (!has('a') || f.a.includes(v.a)) && (!has('p') || f.p.includes(v.p)) && (!has('s') || v.s.some(x => f.s.includes(x))); };

  const rint = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
  function dice(rnd, f) {                                                 // «2d6», «4d6*100», «1d4-1», «3»
    const m = /^(\d+)d(\d+)(?:([*+-])(\d+))?$/.exec(String(f));
    if (!m) return +f || 0;
    let s = 0; for (let i = 0; i < +m[1]; i++) s += rint(rnd, 1, +m[2]);
    if (m[3] === '*') s *= +m[4]; else if (m[3] === '+') s += +m[4]; else if (m[3] === '-') s -= +m[4];
    return Math.max(0, s);
  }
  // строка таблицы [от, до, значение], в которую попал бросок кубика на всю таблицу (d100 или кубик поменьше у вложенной)
  function row(rnd, rows) {
    const top = rows[rows.length - 1][1], d = rint(rnd, 1, top);
    return rows.find(r => d >= r[0] && d <= r[1]) || rows[rows.length - 1];
  }
  const tabOf = (D, ed, key) => (D.tab[ed] || {})[key];

  // «ссылка» из таблицы → предмет. e — редакция правил (в каталоге другой редакции предмет может оказаться, если в своей его нет)
  function finish(rnd, D, ref, key) {
    const [ie, slug] = ref.i.split('/'), e = +ie, base = D.it[ref.i];
    const it = { e, slug, n: ref.n || base[0], r: ref.r || base[1] || '', att: !!base[2], price: base[3] || '', gp: base[4] != null && !ref.w && !ref.b ? base[4] : null, q: 1, t: key };   // у «+N» цена общего предмета не годится — её не считаем
    if (ref.w) {                                                         // «+N к оружию / доспеху / щиту / боеприпасам»: конкретный вид выбираем сами
      const list = (D.eq[e] || D.eq[24])[ref.w], x = pick(rnd, list);
      it.n = x[1] + ' +' + ref.b; it.eq = { e, slug: x[0] };
    }
    if (ref.a && !ref.w) it.eq = { e, slug: ref.a };
    if (ref.sc != null) {                                                // свиток: случайное заклинание нужного уровня
      const sp = ((D.sc[e] || {})[ref.sc] && D.sc[e] || D.sc[24])[ref.sc], x = pick(rnd, sp);
      it.sp = { e: D.sc[e] && D.sc[e][ref.sc] ? e : 24, slug: x[0], n: x[1] };
    }
    if (ref.d) it.n = it.n.replace('{d}', ref.d === '*' ? pick(rnd, Object.values(D.dmg)) : D.dmg[ref.d]);
    if (ref.v) it.n = it.n.replace('{v}', pick(rnd, ref.v));
    return it;
  }
  function pickRef(rnd, D, ed, ref, key) {
    if (ref.sub) return pickRef(rnd, D, ed, row(rnd, ref.sub)[2], key);
    if (ref.any) return pickRef(rnd, D, ed, pick(rnd, ref.any), key);
    if (ref.rar) return pickRef(rnd, D, ed, pick(rnd, D.rp[ref.rar]), key);
    return finish(rnd, D, ref, key);
  }
  // предмет из всего справочника редакции ed (D.all) под фильтр; null, если подходящих нет
  function pickPool(rnd, D, ed, f, key) {
    const ok = matcher(f), hit = D.all[ed].filter(k => { const b = D.it[k]; return ok({ r: b[1], a: b[2] ? 'y' : 'n', p: priceB(b[4]), k: b[5], s: (b[6] || []).map(i => D.src[i]) }); });
    return hit.length ? finish(rnd, D, { i: pick(rnd, hit) }, key) : null;
  }
  // один предмет с таблицы key; key '*' — любой предмет справочника. С фильтром бросок на таблице повторяется (до 300 раз);
  // если в таблице подходящих нет — предмет берётся из всего справочника (в результате пометка fb), если и там нет — null
  function rollItem(rnd, D, ed, key, f) {
    if (typeof f === 'boolean') f = f ? { a: ['n'] } : null;               // прежний вызов с noAtt
    if (key === '*') return pickPool(rnd, D, ed, f, key);
    const tab = tabOf(D, ed, key); if (!tab) return null;
    if (!fActive(f)) return pickRef(rnd, D, ed, row(rnd, tab)[2], key);
    const ok = matcher(f);
    for (let i = 0; i < 300; i++) { const it = pickRef(rnd, D, ed, row(rnd, tab)[2], key); if (ok(viewOf(D, it))) return it; }
    const it = pickPool(rnd, D, ed, f, key); if (it) it.fb = 1; return it;
  }
  const addItem = (list, x) => {
    const same = list.find(y => y.e === x.e && y.slug === x.slug && y.n === x.n && (y.sp && y.sp.slug) === (x.sp && x.sp.slug) && (y.eq && y.eq.slug) === (x.eq && x.eq.slug));
    if (same) same.q++; else list.push(x);
  };
  function treasure(rnd, D, ed, kind, type, count) {                     // «самоцветы» / «предметы искусства»: count штук из таблицы цены type
    const names = D[kind][ed][type], map = new Map();
    for (let i = 0; i < count; i++) { const x = pick(rnd, names), k = x[0]; if (!map.has(k)) map.set(k, { n: x[0], slug: x[1], v: +type, q: 0 }); map.get(k).q++; }
    return [...map.values()].sort((a, b) => a.n.localeCompare(b.n, 'ru'));
  }
  const lvKey = (o, cr) => LV[LV.includes(o.lv) ? LV.indexOf(o.lv) : cr];

  // o: { mode: 'hoard' | 'ind' | 'magic', ed: 14 | 24, cr: 0–3, lv: 'auto' | ключ уровня, tab: ключ таблицы, cnt: число предметов (только для режима «magic»), f: фильтр предметов, noAtt }
  function generate(o, D, rnd) {
    rnd = rnd || Math.random;
    const ed = +o.ed === 14 ? 14 : 24, cr = Math.min(3, Math.max(0, +o.cr || 0));
    const r = { mode: o.mode, ed, cr, coins: {}, gems: [], art: [], items: [], note: '' }, f = o.noAtt ? Object.assign({}, o.f, { a: ['n'] }) : o.f;
    const magic = (key, n) => {
      for (let i = 0; i < n; i++) {
        const it = rollItem(rnd, D, ed, key, f);
        if (it) { addItem(r.items, it); if (it.fb) r.fb = 1; } else { r.note = 'В справочнике нет предметов под выбранный фильтр — смягчите его.'; break; }
      }
    };
    if (o.mode === 'ind') {
      const t = D.ind[ed][cr]; r.coins = {};
      const c = row(rnd, t.t)[2]; for (const k of Object.keys(c)) r.coins[k] = dice(rnd, c[k]);
    } else if (o.mode === 'hoard') {
      const h = D.hoard[ed][cr];
      for (const k of Object.keys(h.c)) r.coins[k] = dice(rnd, h.c[k]);
      const x = row(rnd, h.t)[2];
      if (x.g) r.gems = treasure(rnd, D, ed, 'gem', x.g[0], dice(rnd, x.g[1]));
      if (x.a) r.art = treasure(rnd, D, ed, 'art', x.a[0], dice(rnd, x.a[1]));
      (x.m || []).forEach(([key, amount]) => magic(key === 'randomByLevel' ? 'byLevel.' + lvKey(o, cr) : key, dice(rnd, amount)));
    } else {
      const key = o.tab === '*' || (o.tab && tabOf(D, ed, o.tab)) ? o.tab : Object.keys(D.tab[ed])[0];
      r.tab = key; magic(key, +o.cnt > 0 ? +o.cnt : 1);
    }
    return r;
  }
  // другой предмет вместо r.items[i] с той же таблицы (одна штука из группы одинаковых); f — фильтр
  function reroll(r, i, D, rnd, f) {
    const old = r.items[i]; if (!old) return false;
    const it = rollItem(rnd || Math.random, D, r.ed, old.t, f); if (!it) return false;
    if (old.q > 1) old.q--; else r.items.splice(i, 1);
    addItem(r.items, it); return true;
  }
  const coinGp = c => COIN.reduce((s, k) => s + (c[k] || 0) * GP[k], 0);
  const itemsGp = r => r.items.reduce((s, x) => s + (x.gp || 0) * x.q, 0);               // магические предметы — по ценам справочника
  const noPrice = r => r.items.reduce((s, x) => s + (x.gp == null ? x.q : 0), 0);          // сколько предметов без цены (в итог не вошли)
  const totalGp = r => Math.round(coinGp(r.coins) + [...r.gems, ...r.art].reduce((s, x) => s + x.v * x.q, 0) + itemsGp(r));
  const nf = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const coinStr = c => COIN.filter(k => c[k]).map(k => nf(c[k]) + ' ' + COIN_N[k]).join(', ');
  const itemText = x => (x.q > 1 ? x.q + '× ' : '') + x.n + (x.sp ? ': ' + x.sp.n : '') + ' — ' + (RAR_N[x.r] || 'редкость не указана') + (x.att ? ', настройка' : '');
  function textOf(r) {
    const L = [], cs = coinStr(r.coins), val = x => (x.q > 1 ? x.q + '× ' : '') + x.n + ' — ' + nf(x.v) + ' зм' + (x.q > 1 ? ' каждый' : '');
    if (cs) L.push('Монеты: ' + cs);
    r.gems.length && L.push('Самоцветы: ' + r.gems.map(val).join('; '));
    r.art.length && L.push('Предметы искусства: ' + r.art.map(val).join('; '));
    r.items.length && L.push('Магические предметы: ' + r.items.map(itemText).join('; '));
    L.push('Всего ≈ ' + nf(totalGp(r)) + ' зм' + (r.items.length ? ' (магические предметы — по ценам справочника' + (noPrice(r) ? ', у ' + noPrice(r) + ' шт. цены нет' : '') + ')' : ''));
    return L.join('\n');
  }
  // подписи таблиц магических предметов для выбора
  function tables(D, ed) {
    const keys = Object.keys(D.tab[ed]), any = ['*', 'Любой предмет справочника (по фильтру)'];
    if (ed === 14) return [any].concat(keys.map(k => [k, 'Таблица ' + k]));
    const out = [any].concat(LV.map((l, i) => ['byLevel.' + l, 'По уровню отряда: ' + LV_N[i].toLowerCase()]));
    for (const c of Object.keys(CAT_N)) for (const k of RARK) if (D.tab[24][c + '.' + { c: 'common', u: 'uncommon', r: 'rare', v: 'very rare', l: 'legendary' }[k]])
      out.push([c + '.' + { c: 'common', u: 'uncommon', r: 'rare', v: 'very rare', l: 'legendary' }[k], CAT_N[c] + ' — ' + RAR_N[k]]);
    return out;
  }

  const API = { KINDS, ATT_N, PRICE_N, priceB, fActive, matcher, viewOf, pickPool, COIN, COIN_N, RAR_N, CRS, CR_N, LV, LV_N, dice, row, generate, reroll, rollItem, totalGp, itemsGp, noPrice, coinGp, coinStr, textOf, nf, tables };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }

  /* ---------- панель ---------- */
  const DM = root.DM, h = DM.h, DB = () => root.DB;
  let DATA = null;                                                       // таблицы (общие для всех панелей)
  const getData = () => DATA ? Promise.resolve(DATA) : fetch('data/loot.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => (DATA = d));
  const sel = (opts, val, on) => h('select', { onchange: e => on(e.target.value) },
    opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(val) }, t)));
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const fld = (t, ...k) => h('label', { class: 'ltf' }, h('span', {}, t), ...k);

  function copy(text) {
    const ok = () => DM.toast('Скопировано');
    const old = () => { const t = h('textarea', { style: 'position:fixed;opacity:0' }); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { DM.toast('Не удалось скопировать'); } t.remove(); };
    navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text).then(ok, old) : old();
  }

  function render(ctx) {
    const s = ctx.p.s, top = h('div', { class: 'lt-top' }), out = h('div', { class: 'lt-out' });
    // состояние панели, сохранённое прежней версией: тогда был «уровень отряда» tier и редакция 'all'
    if (s.ed !== 14 && s.ed !== 24) s.ed = 24;
    if (s.cr == null) s.cr = Math.max(0, (+s.tier || 1) - 1);
    if (!s.lv) s.lv = 'auto';
    if (!(+s.cnt > 0)) s.cnt = 1;
    if (!s.tab || s.tab.length > 20) s.tab = '';
    if (s.res && !s.res.items.every(x => x.t != null)) s.res = null;
    if (!s.f) s.f = {};
    if (s.noAtt) { s.f.a = ['n']; delete s.noAtt; }                          // прежняя галочка «Без настройки» — теперь часть фильтра
    const fail = () => DM.toast('Не удалось загрузить таблицы лута. Проверьте соединение.');
    const opts = () => ({ mode: s.mode, ed: s.ed, cr: s.cr, lv: s.lv, tab: s.tab, cnt: s.cnt, f: s.f });
    async function go() {
      let D; try { D = await getData(); } catch (e) { return fail(); }
      s.res = generate(opts(), D); ctx.save(); drawRes();
    }
    // фильтр предметов: группы галочек (как в фильтре справочника), в скобках — сколько предметов справочника редакции подходит
    function filterBox(D) {
      const all = D.all[s.ed].map(k => D.it[k]);
      const cnt = { r: {}, k: {}, a: {}, p: {}, s: {} };
      all.forEach(b => { const add = (g, v) => { cnt[g][v] = (cnt[g][v] || 0) + 1; }; add('r', b[1]); add('k', b[5]); add('a', b[2] ? 'y' : 'n'); add('p', priceB(b[4])); (b[6] || []).forEach(i => add('s', D.src[i])); });
      const groups = [['r', 'Редкость', ['c', 'u', 'r', 'v', 'l'].map(k => [k, cap(RAR_N[k])])], ['k', 'Тип', KINDS.map(k => [k, k])], ['a', 'Настройка', ATT_N], ['p', 'Цена', PRICE_N],
        ['s', 'Источник', Object.keys(cnt.s).sort((x, y) => cnt.s[y] - cnt.s[x] || x.localeCompare(y)).map(k => [k, k])]];
      const n = GROUPS.reduce((t, g) => t + (s.f[g] || []).length, 0);
      const box = h('details', { class: 'ltflt', open: !!s.fOpen, ontoggle: e => { s.fOpen = e.target.open; ctx.save(); } },
        h('summary', {}, 'Фильтр предметов', n ? h('b', {}, ' · выбрано ' + n) : null),
        h('p', { class: 'ltfh' }, 'Внутри группы — «или», между группами — «и». Если в таблице нет подходящих предметов, берётся любой подходящий из справочника.'),
        groups.map(([g, title, opts]) => h('div', { class: 'ltfg' + (g === 's' ? ' ltfs' : '') }, h('h6', {}, title),
          opts.map(([v, t]) => h('label', { class: 'ltfo' }, h('input', { type: 'checkbox', checked: (s.f[g] || []).includes(v), onchange: e => {
            const a = new Set(s.f[g] || []); e.target.checked ? a.add(v) : a.delete(v); s.f[g] = [...a]; ctx.save(); drawTop(); } }), ' ' + t, h('small', {}, String(cnt[g][v] || 0)))))),
        n ? h('button', { type: 'button', class: 'ltfx', onclick: () => { s.f = {}; ctx.save(); drawTop(); } }, 'Сбросить фильтр') : null);
      return box;
    }
    function drawTop() {
      const D = DATA; top.textContent = '';
      const modes = [['hoard', 'Сокровищница'], ['ind', 'С монстра'], ['magic', 'Магия']], hoard = s.mode === 'hoard', magic = s.mode === 'magic';
      const tabs = D ? tables(D, s.ed) : [];
      if (magic && D && !tabs.some(t => t[0] === s.tab)) s.tab = tabs[1][0];     // первая строка — «любой предмет», по умолчанию — первая настоящая таблица
      top.append(...[
        h('div', { class: 'seg' }, modes.map(([k, t]) => h('button', { type: 'button', class: s.mode === k ? 'act' : '', title: k === 'hoard' ? 'Клад: монеты, самоцветы, ценности и магические предметы' : k === 'ind' ? 'Монеты, которые несёт с собой один монстр или NPC' : 'Только магические предметы с выбранной таблицы',
          onclick: () => { s.mode = k; s.res = null; ctx.save(); drawTop(); } }, t))),
        h('div', { class: 'ltg' },
          fld('Правила', sel([[24, 'Редакция 2024'], [14, 'Редакция 2014']], s.ed, v => { s.ed = +v; s.tab = ''; s.res = null; ctx.save(); drawRes(); })),
          magic ? fld('Таблица', sel(tabs, s.tab, v => { s.tab = v; ctx.save(); })) : fld('Опасность', sel(CR_N.map((t, i) => [i, t]), s.cr, v => { s.cr = +v; ctx.save(); }))),
        (hoard && s.ed === 24) ? h('div', { class: 'ltg' }, fld('Магические предметы — по уровню', sel([['auto', 'Как у опасности']].concat(LV_N.map((t, i) => [LV[i], t])), s.lv, v => { s.lv = v; ctx.save(); }))) : null,
        magic ? h('div', { class: 'ltg' },
          fld('Предметов', sel([1, 2, 3, 4, 5, 6, 8, 10].map(n => [n, String(n)]), s.cnt, v => { s.cnt = +v; ctx.save(); }))) : null,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'pri', onclick: go }, s.res ? 'Перебросить всё' : 'Сгенерировать'),
          s.res ? h('button', { type: 'button', onclick: () => copy(textOf(s.res)), title: 'Скопировать результат текстом' }, 'Копировать') : null),
        (hoard || magic) && D ? filterBox(D) : null].filter(Boolean));
    }
    function block(title, ...kids) { return h('div', { class: 'ltb' }, h('h5', {}, title), ...kids); }
    function drawRes() {
      drawTop(); out.textContent = '';
      const r = s.res;
      if (!r) { out.append(h('p', { class: 'dmempty' }, 'Выберите, что нужно, и нажмите «Сгенерировать». Каждый предмет можно заменить кнопкой ↻.')); return; }
      const cs = COIN.filter(k => r.coins[k]);
      if (r.mode !== 'magic') out.append(block('Монеты', cs.length ? h('div', { class: 'ltcoins' }, cs.map(k => h('span', { class: 'ltcoin c' + k }, h('b', {}, nf(r.coins[k])), ' ' + COIN_N[k]))) : h('p', { class: 'dmempty' }, 'Нет')));
      const val = (title, a) => a.length ? out.append(block(title, a.map(x => h('div', { class: 'ltr' },
        h('span', {}, (x.q > 1 ? x.q + '× ' : ''), x.slug ? h('a', { href: DB().hh(24, 'equipment', x.slug) }, x.n) : x.n),
        h('small', {}, nf(x.v) + ' зм' + (x.q > 1 ? ' каждый' : ''))))))  : 0;
      val('Самоцветы', r.gems); val('Предметы искусства', r.art);
      if (r.mode !== 'ind') {
        const swap = async i => {
          let D; try { D = await getData(); } catch (e) { return fail(); }
          if (reroll(r, i, D, null, s.f)) { ctx.save(); drawRes(); } else DM.toast('Нет другого подходящего предмета');
        };
        out.append(block('Магические предметы', r.items.length ? r.items.map((x, i) => h('div', { class: 'ltr it r-' + (x.r || 'x') },
          h('span', {}, x.q > 1 ? x.q + '× ' : '', h('a', { href: DB().hh(x.e, 'items', x.slug) }, x.n),
            x.sp ? [': ', h('a', { href: DB().hh(x.sp.e, 'spells', x.sp.slug) }, x.sp.n)] : null,
            x.e !== r.ed ? h('small', { class: 'lted' }, ' ' + DB().EDK(x.e)) : null),
          h('button', { type: 'button', class: 'xx', title: 'Заменить на другой предмет с той же таблицы', onclick: () => swap(i) }, '↻'),
          h('button', { type: 'button', class: 'xx', title: 'Убрать', onclick: () => { r.items.splice(i, 1); ctx.save(); drawRes(); } }, '×'),
          h('small', {}, (RAR_N[x.r] || '') + (x.att ? ' · настройка' : '') + (x.price ? ' · ' + x.price : '') + (x.fb ? ' · не из таблицы' : ''))))
          : h('p', { class: 'dmempty' }, r.note || 'Магических предметов нет')));
        if (r.note && r.items.length) out.append(h('p', { class: 'dmempty' }, r.note));
        if (r.fb) out.append(h('p', { class: 'dmempty' }, 'Часть предметов взята не из таблицы — в ней не нашлось подходящих под фильтр.'));
      }
      out.append(h('p', { class: 'lttot' }, r.items.length ? 'Всего с магическими предметами: ' : 'Всего: ', h('b', {}, '≈ ' + nf(totalGp(r)) + ' зм'),
        r.items.length ? h('small', {}, ' (предметы — по ценам справочника' + (noPrice(r) ? ', у ' + noPrice(r) + ' шт. цены нет' : '') + ')') : null));
    }
    ctx.body.append(h('div', { class: 'loot' }, top, out)); drawRes();
    getData().then(() => drawTop(), () => {});
  }

  root.DMLoot = Object.assign({}, API, { render });
})(typeof window !== 'undefined' ? window : globalThis);
