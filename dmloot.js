/* ===== Генератор лута для экрана мастера =====
   Подгружается при первом открытии панели «Генератор лута» (см. dmpanels.js), чтобы не утяжелять все страницы.
   Часть «правила» не трогает DOM и проверяется в node (tests/dmloot.test.js); часть «панель» рисует интерфейс.
   Монеты, самоцветы и ценности считаются по уровню отряда, магические предметы берутся из справочника (items.json) —
   по редкости, которая зависит от уровня, с отбором по типу и без предметов, требующих настройки. */
(function (root) {
  'use strict';

  /* ---------- правила ---------- */
  const COIN = ['pm', 'zm', 'em', 'sm', 'mm'];
  const COIN_N = { pm: 'ПМ', zm: 'ЗМ', em: 'ЭМ', sm: 'СМ', mm: 'ММ' };
  const GP = { pm: 10, zm: 1, em: 0.5, sm: 0.1, mm: 0.01 };           // стоимость монеты в золотых
  const RAR = [['обычн', 'Обычный'], ['необычн', 'Необычный'], ['редк', 'Редкий'], ['очень', 'Очень редкий'], ['легенд', 'Легендарный'], ['артеф', 'Артефакт']];
  const RAR_N = Object.fromEntries(RAR);
  const KINDS = [['', 'Любые'], ['Оружие', 'Оружие'], ['Доспех', 'Доспехи и щиты'], ['Зелье', 'Зелья'], ['Свиток', 'Свитки'], ['Кольцо', 'Кольца'], ['Жезл', 'Жезлы'],
    ['Посох', 'Посохи'], ['Волшебная палочка', 'Палочки'], ['Чудесный предмет', 'Чудесные предметы']];

  // Для каждого уровня отряда:
  //  ind    — монеты с одного монстра: [монета, кубы, грани, множитель, вес]
  //  hoard  — сокровищница: стоимость монет в золотых (кубы, грани, множитель) и доли номиналов
  //  gems / art — шанс, сколько штук (кубы, грани) и из каких цен выбирается одна
  //  mag    — сколько магических предметов в сокровищнице: [число, вес];  rar — редкость предметов: [редкость, вес]
  const TIERS = {
    1: { name: 'Уровни 1–4', note: 'ПО до 4',
      ind: [['mm', 5, 6, 1, 30], ['sm', 4, 6, 1, 30], ['em', 3, 6, 1, 10], ['zm', 3, 6, 1, 25], ['pm', 1, 6, 1, 5]],
      hoard: { gp: [3, 6, 30], split: { pm: 0, zm: 0.5, em: 0, sm: 0.3, mm: 0.2 } },
      gems: { p: 0.55, n: [2, 4], v: [10, 50] }, art: { p: 0.3, n: [1, 4], v: [25] },
      mag: [[0, 45], [1, 40], [2, 15]], rar: [['обычн', 50], ['необычн', 40], ['редк', 10]] },
    2: { name: 'Уровни 5–10', note: 'ПО 5–10',
      ind: [['sm', 4, 6, 10, 30], ['em', 1, 6, 10, 10], ['zm', 2, 6, 10, 35], ['pm', 1, 6, 1, 25]],
      hoard: { gp: [4, 6, 150], split: { pm: 0.05, zm: 0.6, em: 0.05, sm: 0.25, mm: 0.05 } },
      gems: { p: 0.6, n: [2, 4], v: [50, 100] }, art: { p: 0.4, n: [1, 4], v: [25, 250] },
      mag: [[0, 20], [1, 40], [2, 30], [3, 10]], rar: [['обычн', 15], ['необычн', 50], ['редк', 30], ['очень', 5]] },
    3: { name: 'Уровни 11–16', note: 'ПО 11–16',
      ind: [['zm', 2, 6, 100, 40], ['em', 1, 6, 100, 10], ['pm', 1, 6, 10, 50]],
      hoard: { gp: [4, 6, 1000], split: { pm: 0.2, zm: 0.7, em: 0.02, sm: 0.07, mm: 0.01 } },
      gems: { p: 0.65, n: [2, 4], v: [100, 500] }, art: { p: 0.5, n: [1, 4], v: [250, 750] },
      mag: [[0, 10], [1, 30], [2, 35], [3, 20], [4, 5]], rar: [['необычн', 20], ['редк', 50], ['очень', 25], ['легенд', 5]] },
    4: { name: 'Уровни 17–20', note: 'ПО 17+',
      ind: [['zm', 2, 6, 1000, 35], ['pm', 2, 6, 100, 65]],
      hoard: { gp: [6, 6, 2500], split: { pm: 0.4, zm: 0.58, em: 0, sm: 0.02, mm: 0 } },
      gems: { p: 0.65, n: [1, 6], v: [1000, 5000] }, art: { p: 0.5, n: [1, 4], v: [2500, 7500] },
      mag: [[1, 25], [2, 40], [3, 25], [4, 10]], rar: [['редк', 20], ['очень', 50], ['легенд', 30]] }
  };
  const GEMS = {
    10: ['Азурит', 'Тигровый глаз', 'Гематит', 'Малахит', 'Лазурит', 'Кружевной агат', 'Кварц с рутилом', 'Обсидиан'],
    50: ['Кровавая яшма', 'Сердолик', 'Лунный камень', 'Оникс', 'Горный хрусталь', 'Сардоникс', 'Цитрин', 'Розовый кварц'],
    100: ['Аметист', 'Гранат', 'Жемчужина', 'Турмалин', 'Хризоберилл', 'Шпинель', 'Нефрит', 'Янтарь'],
    500: ['Аквамарин', 'Чёрная жемчужина', 'Топаз', 'Перидот', 'Альмандин', 'Лунный опал', 'Дымчатый топаз', 'Бирюза'],
    1000: ['Чёрный опал', 'Огненный опал', 'Изумруд', 'Синий сапфир', 'Звёздчатый сапфир', 'Александрит', 'Красная шпинель', 'Демантоид'],
    5000: ['Чёрный сапфир', 'Алмаз', 'Императорский жадеит', 'Рубин', 'Бриллиант чистой воды', 'Крупный изумруд', 'Красный алмаз']
  };
  const ART = {
    25: ['Серебряный кубок', 'Резная костяная статуэтка', 'Золотое кольцо без камней', 'Платок с шёлковой вышивкой', 'Медный браслет с чеканкой', 'Костяной гребень', 'Серебряная брошь', 'Позолоченное зеркальце'],
    250: ['Золотая статуэтка', 'Гобелен с золотой нитью', 'Серебряная диадема', 'Шкатулка с эмалью', 'Ожерелье из серебра и жемчуга', 'Лютня с инкрустацией', 'Кубок с гербом знатного рода'],
    750: ['Золотая корона без камней', 'Парадная сабля в золочёных ножнах', 'Картина мастера в раме', 'Серебряный подсвечник с самоцветами', 'Резной ларец из чёрного дерева', 'Золотой кубок с рубинами'],
    2500: ['Золотая тиара с самоцветами', 'Скрипка мастера', 'Золотая маска с эмалью', 'Нефритовая скульптура в золотой оправе', 'Ожерелье с изумрудами'],
    7500: ['Королевская корона', 'Золотая чаша с самоцветами', 'Реликварий в алмазах', 'Трон-кресло из слоновой кости и золота', 'Скипетр с крупным рубином']
  };

  const rint = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
  const dice = (rnd, n, d) => { let s = 0; for (let i = 0; i < n; i++) s += rint(rnd, 1, d); return s; };
  const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
  function pickW(rnd, arr) {                                   // arr: [[значение, вес], …]
    let r = rnd() * arr.reduce((s, x) => s + x[1], 0);
    for (const [v, w] of arr) if ((r -= w) < 0) return v;
    return arr[arr.length - 1][0];
  }
  const lcs = s => String(s || '').toLowerCase().replace(/ё/g, 'е');

  // редкость предмета → ключ из RAR; «редкость варьируется» и пустое значение не считаются (такие предметы не выпадают)
  function rarOf(it) {
    const r = lcs(it && it.rarity);
    if (!r || r.startsWith('редкость')) return '';
    return r.startsWith('очень') ? 'очень' : r.startsWith('необыч') ? 'необычн' : r.startsWith('обыч') ? 'обычн' : r.startsWith('редк') ? 'редк' : r.startsWith('легенд') ? 'легенд' : r.startsWith('артеф') ? 'артеф' : '';
  }

  // lists — { 24: [предметы], 14: [предметы] } (нужные редакции); o: { ed: 24 | 14 | 'all', kind, noAtt, rar }
  // В «обеих» редакциях один и тот же предмет (тот же slug) берётся один раз — версией 2024.
  function buildPool(lists, o) {
    const eds = o.ed === 'all' ? [24, 14] : [+o.ed], seen = new Set(), pool = [], kind = lcs(o.kind);
    for (const e of eds) for (const it of lists[e] || []) {
      const r = rarOf(it); if (!r) continue;
      if (r === 'артеф' && o.rar !== 'артеф') continue;          // артефакты выпадают только по прямой просьбе
      if (kind && !lcs(it.type).startsWith(kind)) continue;
      if (o.noAtt && it.attunement) continue;
      if (seen.has(it.slug)) continue; seen.add(it.slug);
      pool.push({ e, it, r });
    }
    return pool;
  }

  // предмет нужной редкости; если таких нет (редкий тип, узкий фильтр) — ближайшей по редкости
  function pickItem(rnd, pool, rar) {
    if (!pool.length) return null;
    const keys = RAR.map(x => x[0]), at = keys.indexOf(rar);
    const order = keys.map((k, i) => [k, Math.abs(i - at), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    for (const [k] of order) {
      const hit = pool.filter(x => x.r === k);
      if (hit.length) { const x = pick(rnd, hit); return { e: x.e, slug: x.it.slug, n: x.it.name_ru, r: k, want: rar, price: x.it.price || '', att: !!x.it.attunement, q: 1 }; }
    }
    return null;
  }
  const addItem = (list, x) => { const same = list.find(y => y.e === x.e && y.slug === x.slug); if (same) same.q++; else list.push(x); };

  function group(rnd, count, values, names) {                   // «3× Азурит», штуки одного названия склеиваются
    const v = pick(rnd, values), map = new Map();
    for (let i = 0; i < count; i++) { const n = pick(rnd, names[v]); map.set(n, (map.get(n) || 0) + 1); }
    return [...map].map(([n, q]) => ({ n, v, q })).sort((a, b) => a.n.localeCompare(b.n, 'ru'));
  }

  // o: { mode: 'hoard' | 'ind' | 'magic', tier: 1–4, cnt: 'auto' | число, rar: '' | ключ редкости }; pool — из buildPool
  function generate(o, pool, rnd) {
    rnd = rnd || Math.random;
    const T = TIERS[o.tier] || TIERS[1], r = { mode: o.mode, tier: +o.tier || 1, coins: {}, gems: [], art: [], items: [], note: '' };
    if (o.mode === 'ind') {
      const [c, n, d, m] = pickW(rnd, T.ind.map(x => [x, x[4]]));
      r.coins[c] = dice(rnd, n, d) * m;
    } else if (o.mode === 'hoard') {
      const [n, d, m] = T.hoard.gp, gp = dice(rnd, n, d) * m, sh = {}; let tot = 0;
      COIN.forEach(k => { const w = T.hoard.split[k] || 0; sh[k] = w ? w * (0.6 + 0.8 * rnd()) : 0; tot += sh[k]; });
      COIN.forEach(k => { const part = sh[k] / tot * gp / GP[k]; const v = k === 'pm' ? Math.floor(part) : Math.round(part); if (v > 0) r.coins[k] = v; });
      if (rnd() < T.gems.p) r.gems = group(rnd, dice(rnd, ...T.gems.n), T.gems.v, GEMS);
      if (rnd() < T.art.p) r.art = group(rnd, dice(rnd, ...T.art.n), T.art.v, ART);
    }
    let cnt = 0;
    if (o.mode === 'magic') cnt = o.cnt === 'auto' || !(+o.cnt >= 0) ? 1 : +o.cnt;
    else if (o.mode === 'hoard') cnt = o.cnt === 'auto' || o.cnt == null ? pickW(rnd, T.mag) : +o.cnt;
    for (let i = 0; i < cnt; i++) {
      const it = pickItem(rnd, pool, o.rar || pickW(rnd, T.rar));
      if (it) addItem(r.items, it); else { r.note = 'Под выбранные условия нет подходящих предметов — измените тип или редакцию.'; break; }
    }
    return r;
  }
  // другой предмет вместо r.items[i] (той же редкости, что выпала; одна штука из группы)
  function reroll(r, i, pool, rnd) {
    const old = r.items[i]; if (!old) return false;
    const it = pickItem(rnd || Math.random, pool, old.want || old.r); if (!it) return false;
    if (old.q > 1) { old.q--; addItem(r.items, it); } else { r.items.splice(i, 1); addItem(r.items, it); }
    return true;
  }
  const coinGp = c => COIN.reduce((s, k) => s + (c[k] || 0) * GP[k], 0);
  const totalGp = r => Math.round(coinGp(r.coins) + [...r.gems, ...r.art].reduce((s, x) => s + x.v * x.q, 0));
  const nf = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const coinStr = c => COIN.filter(k => c[k]).map(k => nf(c[k]) + ' ' + COIN_N[k]).join(', ');
  function textOf(r, both) {
    const L = [], tag = x => both ? ' (' + x.e + ')' : '';
    const cs = coinStr(r.coins); if (cs) L.push('Монеты: ' + cs);
    r.gems.length && L.push('Самоцветы: ' + r.gems.map(x => (x.q > 1 ? x.q + '× ' : '') + x.n + ' — ' + nf(x.v) + ' зм' + (x.q > 1 ? ' каждый' : '')).join('; '));
    r.art.length && L.push('Предметы искусства: ' + r.art.map(x => (x.q > 1 ? x.q + '× ' : '') + x.n + ' — ' + nf(x.v) + ' зм' + (x.q > 1 ? ' каждый' : '')).join('; '));
    r.items.length && L.push('Магические предметы: ' + r.items.map(x => (x.q > 1 ? x.q + '× ' : '') + x.n + tag(x) + ' — ' + (RAR_N[x.r] || x.r).toLowerCase() + (x.att ? ', настройка' : '')).join('; '));
    if (r.mode !== 'magic') L.push('Монеты и ценности вместе: ≈ ' + nf(totalGp(r)) + ' зм');
    return L.join('\n');
  }

  const API = { TIERS, RAR, KINDS, COIN, COIN_N, GEMS, ART, rarOf, buildPool, pickItem, generate, reroll, totalGp, coinGp, coinStr, textOf, nf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }

  /* ---------- панель ---------- */
  const DM = root.DM, h = DM.h, DB = () => root.DB;
  const CACHE = {};                                              // редакция → промис с предметами (общий для всех панелей)
  const items = e => CACHE[e] || (CACHE[e] = DB().load('items', e).catch(x => { delete CACHE[e]; throw x; }));
  const sel = (opts, val, on) => h('select', { onchange: e => on(e.target.value) },
    opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(val) }, t)));
  const fld = (t, ...k) => h('label', { class: 'ltf' }, h('span', {}, t), ...k);

  function copy(text) {
    const ok = () => DM.toast('Скопировано');
    const old = () => { const t = h('textarea', { style: 'position:fixed;opacity:0' }); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { DM.toast('Не удалось скопировать'); } t.remove(); };
    navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text).then(ok, old) : old();
  }

  function render(ctx) {
    const s = ctx.p.s, top = h('div', { class: 'lt-top' }), out = h('div', { class: 'lt-out' });
    const need = () => s.ed === 'all' ? [24, 14] : [+s.ed];
    const opts = () => ({ mode: s.mode, tier: +s.tier, ed: s.ed, kind: s.kind, rar: s.rar, cnt: s.cnt, noAtt: !!s.noAtt });
    const poolNow = async () => {
      const lists = {}; await Promise.all(need().map(async e => { lists[e] = await items(e); }));
      return buildPool(lists, opts());
    };
    const fail = () => DM.toast('Не удалось загрузить предметы. Проверьте соединение.');
    async function go() {
      let pool; try { pool = await poolNow(); } catch (e) { return fail(); }
      s.res = generate(opts(), pool); s.resEd = s.ed; ctx.save(); drawRes();
    }
    function drawTop() {
      top.textContent = '';
      const modes = [['hoard', 'Сокровищница'], ['ind', 'С монстра'], ['magic', 'Магия']];
      const magic = s.mode !== 'ind';
      top.append(
        h('div', { class: 'seg' }, modes.map(([k, t]) => h('button', { type: 'button', class: s.mode === k ? 'act' : '', title: k === 'hoard' ? 'Клад: монеты, самоцветы, ценности и магические предметы' : k === 'ind' ? 'Монеты, которые несёт с собой один монстр или NPC' : 'Только магические предметы',
          onclick: () => { s.mode = k; if (k === 'magic' && s.cnt === 'auto') s.cnt = 1; else if (k === 'hoard') s.cnt = 'auto'; ctx.save(); drawTop(); } }, t))),
        h('div', { class: 'ltg' },
          fld('Уровень отряда', sel(Object.keys(TIERS).map(k => [k, TIERS[k].name]), s.tier, v => { s.tier = +v; ctx.save(); })),
          fld('Справочник', sel([[24, 'Редакция 2024'], [14, 'Редакция 2014'], ['all', 'Обе редакции']], s.ed, v => { s.ed = v === 'all' ? v : +v; ctx.save(); }))),
        magic ? h('div', { class: 'ltg' },
          fld('Тип предмета', sel(KINDS, s.kind, v => { s.kind = v; ctx.save(); })),
          fld('Редкость', sel([['', 'По уровню отряда']].concat(RAR.map(([k, t]) => [k, t])), s.rar, v => { s.rar = v; ctx.save(); })),
          fld('Предметов', sel([['auto', s.mode === 'magic' ? '1' : 'Как выпадет']].concat([0, 1, 2, 3, 4, 5, 6].filter(n => s.mode === 'hoard' || n > 0).map(n => [n, String(n)])), s.cnt, v => { s.cnt = v === 'auto' ? v : +v; ctx.save(); })),
          h('label', { class: 'ltc' }, h('input', { type: 'checkbox', checked: !!s.noAtt, onchange: e => { s.noAtt = e.target.checked; ctx.save(); } }), ' Без настройки')) : null,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'pri', onclick: go }, s.res ? 'Перебросить всё' : 'Сгенерировать'),
          s.res ? h('button', { type: 'button', onclick: () => copy(textOf(s.res, s.resEd === 'all')), title: 'Скопировать результат текстом' }, 'Копировать') : null));
    }
    function block(title, ...kids) { return h('div', { class: 'ltb' }, h('h5', {}, title), ...kids); }
    function drawRes() {
      drawTop(); out.textContent = '';
      const r = s.res;
      if (!r) { out.append(h('p', { class: 'dmempty' }, 'Выберите, что нужно, и нажмите «Сгенерировать». Каждый предмет можно заменить кнопкой ↻.')); return; }
      const both = s.resEd === 'all';
      const cs = COIN.filter(k => r.coins[k]);
      if (r.mode !== 'magic') out.append(block('Монеты', cs.length ? h('div', { class: 'ltcoins' }, cs.map(k => h('span', { class: 'ltcoin c' + k }, h('b', {}, nf(r.coins[k])), ' ' + COIN_N[k]))) : h('p', { class: 'dmempty' }, 'Нет')));
      const val = (title, a) => a.length ? out.append(block(title, a.map(x => h('div', { class: 'ltr' }, h('span', {}, (x.q > 1 ? x.q + '× ' : '') + x.n), h('small', {}, nf(x.v) + ' зм' + (x.q > 1 ? ' каждый' : ''))))))  : 0;
      val('Самоцветы', r.gems); val('Предметы искусства', r.art);
      if (r.mode !== 'ind') {
        out.append(block('Магические предметы', r.items.length ? r.items.map((x, i) => h('div', { class: 'ltr it r-' + x.r },
          h('span', {}, x.q > 1 ? x.q + '× ' : '', h('a', { href: DB().hh(x.e, 'items', x.slug) }, x.n), both ? h('small', { class: 'lted' }, ' ' + DB().EDK(x.e)) : null),
          h('button', { type: 'button', class: 'xx', title: 'Заменить на другой предмет', onclick: async () => { let pool; try { pool = await poolNow(); } catch (e) { return fail(); } if (reroll(r, i, pool)) { ctx.save(); drawRes(); } else DM.toast('Нет другого подходящего предмета'); } }, '↻'),
          h('button', { type: 'button', class: 'xx', title: 'Убрать', onclick: () => { r.items.splice(i, 1); ctx.save(); drawRes(); } }, '×'),
          h('small', {}, (RAR_N[x.r] || '').toLowerCase() + (x.att ? ' · настройка' : '') + (x.price ? ' · ' + x.price : ''))))
          : h('p', { class: 'dmempty' }, r.note || 'Магических предметов нет')));
        if (r.note && r.items.length) out.append(h('p', { class: 'dmempty' }, r.note));
      }
      if (r.mode !== 'magic') out.append(h('p', { class: 'lttot' }, 'Монеты и ценности вместе: ', h('b', {}, '≈ ' + nf(totalGp(r)) + ' зм')));
    }
    ctx.body.append(h('div', { class: 'loot' }, top, out)); drawRes();
  }

  root.DMLoot = Object.assign({}, API, { render });
})(typeof window !== 'undefined' ? window : globalThis);
