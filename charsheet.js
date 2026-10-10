/* ===== Листы персонажей: конструктор и печать =====
   Расчёты — в charrules.js (CSR). Здесь: хранение, вкладки-шаги, лист для печати.
   Данные берутся через window.DB (index.html). */
(function (root) {
  'use strict';
  const R = root.CSR, h = root.DM.h, DB = () => root.DB;
  const KEY = 'dm.chars.v1';
  let S = null, host = null, tabId = 'base', dataCache = {}, scrollKeep = 0;
  const TABS = [['base', '1. Основа'], ['abil', '2. Характеристики'], ['skills', '3. Навыки и умения'], ['spells', '4. Заклинания'], ['gear', '5. Снаряжение'], ['forms', 'Облики зверей'], ['story', 'Описание'], ['sheet', 'Лист / печать']];
  const rid = () => Math.random().toString(36).slice(2, 9);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------- хранение ---------- */
  function load() {
    if (S) return S;
    try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && Array.isArray(j.list)) S = j; } catch (e) { /* пусто */ }
    if (!S) S = { cur: '', list: [] };
    if (!S.list.some(c => c.id === S.cur)) S.cur = S.list[0] ? S.list[0].id : '';
    return S;
  }
  let st = 0;
  function save() {
    clearTimeout(st);
    st = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { root.DM.toast('Не удалось сохранить: память браузера заполнена. Сделайте экспорт.'); } }, 200);
  }
  const cur = () => load().list.find(c => c.id === S.cur) || null;

  /* ---------- данные для персонажа ---------- */
  async function loadData(c) {
    const ed = c.ed, db = DB(), key = ed;
    const g = async (k, e) => { try { return await db.load(k, e || ed); } catch (x) { return []; } };
    if (!dataCache[key]) {
      const [classes, species, bgs, feats, spells] = await Promise.all([g('class'), g(ed === 14 ? 'race' : 'species'), g('backgrounds'), g('feats'), g('spells')]);
      const gear = await g('equipment', 24);
      dataCache[key] = { classes: classes.filter(x => !/sidekick/.test(x.slug)), species, bgs, feats, spells, gear, gearBySlug: Object.fromEntries(gear.map(x => [x.slug, x])) };
    }
    const D = dataCache[key];
    const cls = D.classes.find(x => x.slug === c.cls) || null;
    return Object.assign({}, D, { cls, sub: cls ? (cls.subclasses || []).find(s => (s.name) === c.sub) || null : null, sp: D.species.find(x => x.slug === c.sp) || null, bg: D.bgs.find(x => x.slug === c.bg) || null });
  }

  /* ---------- мелкие помощники интерфейса ---------- */
  const btn = (t, fn, cls, tip) => h('button', { type: 'button', class: cls || '', title: tip || '', onclick: fn }, t);
  function sel(options, value, onchange, ph, cls) {
    const s = h('select', { class: cls || '', onchange: e => onchange(e.target.value) }, ph != null ? h('option', { value: '' }, ph) : null,
      options.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(value) }, t); }));
    return s;
  }
  const field = (label, ...kids) => h('label', { class: 'csf' }, h('span', {}, label), ...kids);
  function textIn(value, onchange, attrs) { return h('input', Object.assign({ type: 'text', value: value || '', autocomplete: 'off', onchange: e => onchange(e.target.value) }, attrs || {})); }
  function numIn(value, onchange, attrs) { return h('input', Object.assign({ type: 'number', value: value == null ? '' : value, onchange: e => onchange(R.intOf(e.target.value)) }, attrs || {})); }
  function html(htmlStr, cls) { const d = h('div', { class: cls || '' }); d.innerHTML = htmlStr; return d; }
  function blocks(bl) { const d = html(DB().B(bl || []), 'csb'); return d; }
  function searchBox(items, render, opt) {      // список с поиском; items — массив, render(item) → узел
    opt = opt || {};
    const q = h('input', { type: 'text', placeholder: opt.ph || 'Поиск…', autocomplete: 'off' }), list = h('div', { class: 'cslist' });
    const draw = () => {
      const v = DB().norm(q.value.trim()); list.textContent = '';
      const hit = items.filter(i => !v || DB().norm(i.name_ru + ' ' + (i.name_en || '')).includes(v)).slice(0, opt.max || 80);
      if (!hit.length) list.append(h('div', { class: 'none' }, 'Ничего не найдено'));
      hit.forEach(i => list.append(render(i)));
    };
    q.addEventListener('input', draw); draw();
    return h('div', { class: 'cssb' }, q, list);
  }
  const link = (ed, sec, m, txt) => h('a', { href: DB().hh(ed, sec, m.slug), target: '_blank', rel: 'noopener', title: 'Открыть карточку в новой вкладке' }, txt || m.name_ru);

  /* ---------- общий каркас ---------- */
  function build() {
    host = document.getElementById('cs'); load();
    host.textContent = '';
    host.append(h('div', { class: 'csbar' }), h('div', { class: 'csbody' }));
  }
  async function show() {
    if (!host) build();
    await render();
  }
  async function render(keepScroll) {
    const main = document.querySelector('main'), top = keepScroll ? main.scrollTop : 0;
    const bar = host.querySelector('.csbar'), body = host.querySelector('.csbody');
    renderBar(bar);
    const c = cur();
    body.textContent = '';
    if (!c) { body.append(welcome()); return; }
    const D = await loadData(c), d = R.derive(c, D);
    body.append(summary(c, D, d), tabsBar(c, D, d));
    const pane = h('div', { class: 'cspane t-' + tabId }); body.append(pane);
    const fn = { base: tabBase, abil: tabAbil, skills: tabSkills, spells: tabSpells, gear: tabGear, forms: tabForms, story: tabStory, sheet: tabSheet }[tabId] || tabBase;
    await fn(pane, c, D, d);
    if (keepScroll) main.scrollTop = top;
  }
  const upd = (redraw) => { save(); if (redraw !== false) render(true); };

  function renderBar(bar) {
    bar.textContent = '';
    const s = load();
    const picker = h('select', { class: 'cscur', onchange: e => { s.cur = e.target.value; save(); render(); } },
      s.list.map(c => h('option', { value: c.id, selected: c.id === s.cur }, (c.name || 'Без имени') + (c.cls ? ' — ' + clsLabel(c) : ''))));
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; } });
    bar.append(s.list.length ? picker : h('b', {}, 'Листы персонажей'), h('span', { class: 'dmsp' }),
      btn('+ Новый', () => newDialog(), 'dmbtn pri', 'Создать персонажа'),
      s.list.length ? btn('Копия', dup, 'dmbtn', 'Дублировать выбранного') : null,
      s.list.length ? btn('Удалить', del, 'dmbtn') : null,
      s.list.length ? btn('Экспорт', exportJson, 'dmbtn', 'Сохранить всех персонажей в файл') : null,
      btn('Импорт', () => file.click(), 'dmbtn', 'Загрузить из файла'), file);
  }
  const clsLabel = c => { const x = dataCache[c.ed] && dataCache[c.ed].classes.find(k => k.slug === c.cls); return (x ? x.name_ru : c.cls) + ' ' + c.lvl; };
  function dup() { const c = cur(); if (!c) return; const n = JSON.parse(JSON.stringify(c)); n.id = rid(); n.name = (c.name || 'Без имени') + ' (копия)'; S.list.push(n); S.cur = n.id; save(); render(); }
  function del() { const c = cur(); if (!c || !confirm('Удалить персонажа «' + (c.name || 'Без имени') + '» насовсем?')) return; S.list = S.list.filter(x => x !== c); S.cur = S.list[0] ? S.list[0].id : ''; save(); render(); }
  function exportJson() {
    const blob = new Blob([JSON.stringify(load(), null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'персонажи.json' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importJson(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result); const list = Array.isArray(j) ? j : j.list;
        if (!Array.isArray(list) || !list.every(c => c && c.ed && c.lvl)) throw new Error('формат');
        list.forEach(c => { const n = Object.assign(R.newChar(c.ed), c); if (S.list.some(x => x.id === n.id)) n.id = rid(); S.list.push(n); S.cur = n.id; });
        save(); render(); root.DM.toast('Загружено персонажей: ' + list.length);
      } catch (e) { root.DM.toast('Не получилось прочитать файл: это не файл с персонажами'); }
    };
    r.readAsText(file);
  }
  function newDialog() {
    const ov = h('div', { class: 'dmmodal', onclick: e => { if (e.target === ov) ov.remove(); } },
      h('div', { class: 'dmdlg' }, h('h3', {}, 'Новый персонаж'), h('p', { class: 'mhint' }, 'Какими правилами пользуетесь?'),
        h('div', { class: 'mbtn', style: 'justify-content:flex-start' },
          btn('D&D 2024', () => mk(24), 'pri'), btn('D&D 2014', () => mk(14), 'pri'), btn('Отмена', () => ov.remove()))));
    const mk = ed => { const c = R.newChar(ed); S.list.push(c); S.cur = c.id; tabId = 'base'; save(); ov.remove(); render(); };
    document.body.append(ov);
  }
  function welcome() {
    return h('div', { class: 'cswel' }, h('h2', {}, 'Листы персонажей'),
      h('p', {}, 'Выберите класс, уровень, вид и предысторию — бонус мастерства, хиты, спасброски, навыки, ячейки заклинаний и умения подставятся сами. Готовый лист можно распечатать или сохранить в PDF.'),
      btn('Создать персонажа', newDialog, 'dmbtn pri'));
  }

  /* ---------- сводка и чек-лист ---------- */
  function todo(c, D, d) {
    const t = [], ci = d.ci;
    if (!c.cls) t.push(['base', 'Выберите класс']);
    else {
      if (D.cls && c.lvl >= subLevel(D.cls) && !c.sub && (D.cls.subclasses || []).length) t.push(['base', 'Выберите подкласс']);
      const n = (c.skills || []).length;
      if (ci && n < ci.pickN) t.push(['skills', 'Навыки класса: выбрано ' + n + ' из ' + ci.pickN]);
      if (ci && n > ci.pickN) t.push(['skills', 'Навыков класса больше, чем положено (' + n + '/' + ci.pickN + ')']);
    }
    if (!c.sp) t.push(['base', 'Выберите вид']);
    if (!c.bg) t.push(['base', 'Выберите предысторию']);
    if (c.ed === 24 && D.bg && c.bg2.m === '21' && (!c.bg2.a || !c.bg2.b || c.bg2.a === c.bg2.b)) t.push(['abil', 'Распределите бонусы предыстории (+2 и +1)']);
    R.asiLevels(D.cls).filter(l => l <= c.lvl).forEach(l => { const x = c.asi[l]; if (!x || (x.m === 'feat' && !x.feat) || (x.m === '2' && !x.a) || (x.m === '11' && (!x.a || !x.b || x.a === x.b))) t.push(['abil', 'Увеличение характеристик на ' + l + ' уровне']); });
    if (d.sp.has && d.sp.cantrips != null) {
      const cn = c.spells.filter(s => s.lvl === 0).length;
      if (cn < d.sp.cantrips) t.push(['spells', 'Заговоры: ' + cn + ' из ' + d.sp.cantrips]);
      else if (cn > d.sp.cantrips) t.push(['spells', 'Заговоров больше нормы: ' + cn + '/' + d.sp.cantrips]);
    }
    if (d.sp.has && d.sp.prepared != null) {
      const pn = c.spells.filter(s => s.lvl > 0 && s.prep).length;
      if (pn < d.sp.prepared) t.push(['spells', 'Подготовлено заклинаний: ' + pn + ' из ' + d.sp.prepared]);
      else if (pn > d.sp.prepared) t.push(['spells', 'Подготовлено больше нормы: ' + pn + '/' + d.sp.prepared]);
    }
    if (d.ws && c.forms.length < Math.min(d.ws.known, 99)) t.push(['forms', 'Облики зверей: ' + c.forms.length + ' из ' + d.ws.known]);
    return t;
  }
  const subLevel = cls => { const f = (cls.features || []).find(x => /подкласс/i.test(x.name) && x.level); return f ? f.level : 3; };
  function summary(c, D, d) {
    const cell = (l, v, tip) => h('div', { class: 'sc1', title: tip || '' }, h('small', {}, l), h('b', {}, v));
    const box = h('div', { class: 'cssum' },
      h('div', { class: 'cssn' }, c.name || 'Без имени', h('small', {}, [D.cls && D.cls.name_ru, D.sub && D.sub.name, c.lvl + ' ур.', D.sp && D.sp.name_ru].filter(Boolean).join(' · '))),
      cell('Хиты', d.hp), cell('КД', d.ac, d.acWhy), cell('Бонус мастерства', R.sgn(d.pb)), cell('Инициатива', R.sgn(d.init)), cell('Скорость', d.speed + ' фт.'),
      d.sp.has ? cell('Сл спасброска', d.sp.dc, 'Заклинательная характеристика: ' + R.ABN(d.sp.ab).ru) : null);
    const t = todo(c, D, d);
    const chk = h('div', { class: 'cstodo' + (t.length ? '' : ' done') });
    if (!t.length) chk.append(h('span', {}, '✓ Всё заполнено — можно печатать'));
    else t.slice(0, 6).forEach(([tab, txt]) => chk.append(h('a', { href: '#', onclick: ev => { ev.preventDefault(); tabId = tab; render(); } }, txt)));
    if (t.length > 6) chk.append(h('span', {}, '…ещё ' + (t.length - 6)));
    return h('div', { class: 'cshead' }, box, chk);
  }
  function tabsBar(c, D, d) {
    return h('div', { class: 'cstabs' }, TABS.filter(([id]) => (id !== 'forms' || d.ws) && (id !== 'spells' || d.sp.has || true)).map(([id, t]) =>
      h('button', { type: 'button', class: 'cstab' + (id === tabId ? ' act' : ''), onclick: () => { tabId = id; render(); } }, t)));
  }

  /* ---------- 1. Основа ---------- */
  async function tabBase(p, c, D, d) {
    const ed = c.ed;
    p.append(h('div', { class: 'csgrid' },
      field('Имя персонажа', textIn(c.name, v => { c.name = v; upd(); })),
      field('Игрок', textIn(c.player, v => { c.player = v; upd(false); })),
      field('Мировоззрение', textIn(c.align, v => { c.align = v; upd(false); }, { placeholder: 'Например: Нейтральный добрый' })),
      field('Правила', h('div', { class: 'csro' }, 'D&D ' + (ed === 24 ? '2024' : '2014') + ' (задаются при создании)'))));
    // класс
    const clsSel = sel(D.classes.map(x => [x.slug, x.name_ru]), c.cls, v => {
      c.cls = v; c.sub = ''; c.skills = []; c.exp = []; c.asi = {}; c.spells = []; c.forms = []; upd();
    }, '— выберите класс —');
    const lvlSel = sel(Array.from({ length: 20 }, (_, i) => [i + 1, i + 1]), c.lvl, v => { c.lvl = +v; upd(); });
    p.append(h('h3', { class: 'csh' }, 'Класс и уровень'), h('div', { class: 'csgrid' }, field('Класс', clsSel), field('Уровень', lvlSel)));
    if (D.cls) {
      const ci = d.ci, sl = subLevel(D.cls), subs = D.cls.subclasses || [];
      p.append(h('div', { class: 'csgrid' }, field('Подкласс' + (c.lvl < sl ? ' (с ' + sl + ' уровня)' : ''),
        sel(subs.map(s => [s.name, s.name + (s.official === false ? ' (неофиц.)' : '')]), c.sub, v => { c.sub = v; upd(); }, c.lvl < sl ? '— пока не нужен —' : '— выберите подкласс —'))));
      if (D.sub) { const dsc = h('details', {}, h('summary', {}, 'О подклассе «' + D.sub.name + '»'), blocks(D.sub.description || [])); p.append(dsc); }
      p.append(h('div', { class: 'csfacts' },
        fact('Кость хитов', 'к' + ci.die), fact('Спасброски', ci.saves.map(k => R.ABN(k).ru).join(', ')), fact('Доспехи', ci.armor || '—'),
        fact('Оружие', ci.weapons || '—'), fact('Инструменты', ci.tools || '—'), fact('Заклинательная характеристика', ci.spellAb ? R.ABN(ci.spellAb).ru : '—')));
    }
    // вид
    p.append(h('h3', { class: 'csh' }, 'Вид'), h('div', { class: 'csgrid' }, field('Вид', sel(D.species.map(x => [x.slug, x.name_ru]), c.sp, v => { c.sp = v; upd(); }, '— выберите вид —')),
      field('Скорость (фт.)', numIn(c.speed === '' ? d.speed : c.speed, v => { c.speed = v; upd(); }))));
    if (D.sp) {
      const tr = R.speciesTraits(D.sp);
      p.append(h('details', { open: '' }, h('summary', {}, 'Особенности вида (' + tr.length + ')'), h('ul', { class: 'cstr' }, tr.map(t => h('li', {}, h('b', {}, t.name + '. '), t.text.replace(/\*+/g, ''))))));
      if (ed === 14 && D.sp.asi && D.sp.asi.length) p.append(h('p', { class: 'mhint' }, 'Бонусы вида (с учётом всех подрас): ' + D.sp.asi.map(x => x.ability + ' +' + x.value).join(', ') + '. Впишите нужные на вкладке «Характеристики».'));
    }
    // предыстория
    p.append(h('h3', { class: 'csh' }, 'Предыстория'), h('div', { class: 'csgrid' }, field('Предыстория', sel(D.bgs.map(x => [x.slug, x.name_ru]), c.bg, v => { c.bg = v; c.bg2 = { m: '21', a: '', b: '' }; upd(); }, '— выберите предысторию —'))));
    if (D.bg) {
      const b = D.bg;
      p.append(h('div', { class: 'csfacts' },
        b.abilities ? fact('Характеристики', b.abilities.join(', ')) : null, b.feat ? fact('Черта', b.feat.name) : null,
        fact('Навыки', (b.skills || []).join(', ') || b.skills_text || '—'), fact('Инструменты', b.tools || (b.tool_tags || []).join(', ') || '—'),
        b.equipment ? fact('Снаряжение', typeof b.equipment === 'string' ? b.equipment : '') : null));
      if (b.blocks && b.blocks.length) p.append(h('details', {}, h('summary', {}, 'Описание предыстории'), blocks(b.blocks)));
    }
  }
  const fact = (l, v) => h('div', { class: 'fact' }, h('small', {}, l), h('span', {}, v));

  /* ---------- 2. Характеристики ---------- */
  async function tabAbil(p, c, D, d) {
    const std = R.STD_ARRAY;
    const methods = [['std', 'Стандартный набор'], ['buy', 'Покупка очков'], ['manual', 'Вручную / броски']];
    p.append(h('div', { class: 'seg csmeth' }, methods.map(([id, t]) => btn(t, () => { c.abm = id; if (id === 'std') AB_RESET(c); if (id === 'buy') R.AB.forEach(a => c.ab[a.k] = 8); upd(); }, c.abm === id ? 'act' : ''))));
    const used = R.AB.map(a => c.ab[a.k]);
    let info = '';
    if (c.abm === 'buy') { const cost = used.reduce((q, v) => q + (R.BUY_COST[v] != null ? R.BUY_COST[v] : 99), 0); info = 'Потрачено очков: ' + cost + ' из 27' + (cost > 27 ? ' — многовато!' : ''); }
    if (c.abm === 'std') info = 'Раздайте значения 15, 14, 13, 12, 10, 8 — каждое один раз.' + (std.slice().sort().join() === used.slice().sort().join() ? '' : ' Сейчас распределение не по набору.');
    if (c.abm === 'manual') p.append(btn('Бросить 4к6 (отбросить меньший) для всех', () => {
      R.AB.forEach(a => { const r = root.Dice.roll('4к6', { kind: 'dice', silent: true }); const v = r.parts[0].rolls.slice().sort((x, y) => x - y).slice(1).reduce((q, y) => q + y, 0); c.ab[a.k] = v; });
      upd();
    }, 'dmbtn', 'Результат можно переставить, редактируя числа'));
    if (info) p.append(h('p', { class: 'mhint' }, info));
    const t = h('table', { class: 'cstbl' }, h('tr', {}, ['Характеристика', 'База', 'Бонусы', 'Итог', 'Мод.', 'Спасбросок'].map(x => h('th', {}, x))));
    const bgA = D.bg ? (D.bg.abilities || []).map(x => R.ABK[x]) : [];
    R.AB.forEach(a => {
      const base = c.ab[a.k];
      let cellBase;
      if (c.abm === 'std') cellBase = sel(std.map(v => [v, v]), base, v => { c.ab[a.k] = +v; upd(); });
      else if (c.abm === 'buy') cellBase = h('span', { class: 'buy' }, btn('−', () => { if (base > 8) { c.ab[a.k]--; upd(); } }, 'cb2'), h('b', {}, base), btn('+', () => { if (base < 15) { c.ab[a.k]++; upd(); } }, 'cb2'));
      else cellBase = numIn(base, v => { c.ab[a.k] = Math.max(1, Math.min(30, v)); upd(); }, { min: 1, max: 30, class: 'num' });
      const bonus = d.score[a.k] - base;
      let bcell = h('span', { title: d.src[a.k].join('; ') }, bonus ? R.sgn(bonus) : '—');
      if (c.ed === 14) bcell = numIn((c.bonus || {})[a.k] || 0, v => { c.bonus = c.bonus || {}; c.bonus[a.k] = v; upd(); }, { class: 'num', title: 'Бонусы вида и прочее' });
      t.append(h('tr', { class: bgA.includes(a.k) && c.ed === 24 ? 'hl' : '' }, h('td', {}, h('b', {}, a.ru)), h('td', {}, cellBase), h('td', {}, bcell), h('td', {}, h('b', { class: 'big' }, d.score[a.k])), h('td', {}, R.sgn(d.mod[a.k])),
        h('td', {}, R.sgn(d.saves[a.k]) + (d.saveProf.has(a.k) ? ' ●' : ''))));
    });
    p.append(t);
    // бонусы предыстории 2024
    if (c.ed === 24) {
      p.append(h('h3', { class: 'csh' }, 'Бонусы предыстории'));
      if (!D.bg) p.append(h('p', { class: 'mhint' }, 'Сначала выберите предысторию на вкладке «Основа».'));
      else {
        const opts = D.bg.abilities.map(x => [R.ABK[x], x]);
        p.append(h('div', { class: 'seg csmeth' }, btn('+2 и +1', () => { c.bg2.m = '21'; upd(); }, c.bg2.m === '21' ? 'act' : ''), btn('+1, +1, +1', () => { c.bg2.m = '111'; upd(); }, c.bg2.m === '111' ? 'act' : '')));
        if (c.bg2.m === '21') p.append(h('div', { class: 'csgrid' }, field('+2 к', sel(opts, c.bg2.a, v => { c.bg2.a = v; upd(); }, '—')), field('+1 к', sel(opts, c.bg2.b, v => { c.bg2.b = v; upd(); }, '—'))));
        else p.append(h('p', { class: 'mhint' }, '+1 к каждой: ' + D.bg.abilities.join(', ')));
      }
    } else p.append(h('p', { class: 'mhint' }, 'В колонке «Бонусы» впишите прибавки от вида (расовые бонусы).'));
    // увеличения характеристик по уровням
    const lv = R.asiLevels(D.cls).filter(l => l <= c.lvl);
    if (lv.length) {
      p.append(h('h3', { class: 'csh' }, 'Увеличение характеристик и черты'));
      lv.forEach(l => {
        const x = c.asi[l] || (c.asi[l] = { m: '2', a: '', b: '', feat: '' });
        const abOpts = R.AB.map(a => [a.k, a.ru]);
        const box = h('div', { class: 'csasi' }, h('b', {}, l + ' уровень'),
          sel([['2', '+2 к одной'], ['11', '+1 к двум'], ['feat', 'Черта']], x.m, v => { x.m = v; upd(); }),
          x.m === '2' ? sel(abOpts, x.a, v => { x.a = v; upd(); }, '—') : null,
          x.m === '11' ? [sel(abOpts, x.a, v => { x.a = v; upd(); }, '—'), sel(abOpts, x.b, v => { x.b = v; upd(); }, '—')] : null);
        if (x.m === 'feat') {
          const cur = D.feats.find(f => f.slug === x.feat);
          box.append(h('span', { class: 'csfeat' }, cur ? link(c.ed, 'feats', cur) : 'не выбрана'), btn(cur ? 'Сменить' : 'Выбрать черту', () => featDialog(c, D, f => { x.feat = f.slug; upd(); }), 'dmbtn'));
        }
        p.append(box);
      });
    }
  }
  const AB_RESET = c => { const arr = R.STD_ARRAY; R.AB.forEach((a, i) => { c.ab[a.k] = arr[i]; }); };
  function featDialog(c, D, pick) {
    const ov = h('div', { class: 'dmmodal', onclick: e => { if (e.target === ov) ov.remove(); } });
    const feats = D.feats.filter(f => c.ed === 14 || /общая|origin|базов|эпическ|стиль|черта|^$/i.test(f.category || '') || true);
    ov.append(h('div', { class: 'dmdlg wide' }, h('h3', {}, 'Выбор черты'), searchBox(feats, f => h('div', { class: 'csrow', onclick: () => { ov.remove(); pick(f); } }, h('b', {}, f.name_ru), h('small', {}, f.line || f.prerequisite || ''))),
      h('div', { class: 'mbtn' }, btn('Закрыть', () => ov.remove()))));
    document.body.append(ov);
  }

  /* ---------- 3. Навыки и умения ---------- */
  async function tabSkills(p, c, D, d) {
    const ci = d.ci;
    p.append(h('h3', { class: 'csh' }, 'Навыки'));
    if (ci) p.append(h('p', { class: 'mhint' }, 'Класс «' + D.cls.name_ru + '»: выберите ' + ci.pickN + (ci.pickAny ? ' любых навыка' : ' из отмеченных ◆') + '. Навыки предыстории подставляются сами. Двойной щелчок по бонусу — экспертиза.'));
    const t = h('table', { class: 'cstbl sk' }, h('tr', {}, ['Выбор', 'Навык', 'Хар.', 'Бонус', 'Откуда'].map(x => h('th', {}, x))));
    d.skills.forEach(s => {
      const can = ci && ci.pickFrom.includes(s.id), on = (c.skills || []).includes(s.id), bg = d.bgSk.includes(s.id);
      const cb = h('input', { type: 'checkbox', checked: on, disabled: !can || bg && !on, onchange: e => { c.skills = c.skills.filter(x => x !== s.id); if (e.target.checked) c.skills.push(s.id); upd(); } });
      const extra = btn(c.skillsExtra.includes(s.id) ? '✓' : '+', () => { c.skillsExtra = c.skillsExtra.includes(s.id) ? c.skillsExtra.filter(x => x !== s.id) : [...c.skillsExtra, s.id]; upd(); }, 'cb2', 'Владение из другого источника (вид, черта)');
      const ex = btn(s.lev === 2 ? '★' : '☆', () => { c.exp = c.exp.includes(s.id) ? c.exp.filter(x => x !== s.id) : [...c.exp, s.id]; upd(); }, 'cb2', 'Экспертиза: удвоенный бонус мастерства');
      t.append(h('tr', { class: s.lev ? 'prof' : '' }, h('td', {}, can ? h('span', {}, cb, ' ◆') : ''), h('td', {}, s.n), h('td', {}, R.ABN(s.ab).s), h('td', {}, h('b', {}, R.sgn(s.bonus)), ' ', ex), h('td', {}, s.from.join(', ') || '', ' ', extra)));
    });
    p.append(t);
    p.append(h('div', { class: 'csgrid' }, field('Языки', textIn(c.story.langs, v => { c.story.langs = v; upd(false); }, { placeholder: 'Всеобщий, …' })), field('Другие владения (инструменты и т. п.)', textIn(c.story.tools, v => { c.story.tools = v; upd(false); }))));
    // умения
    const feats = featureList(c, D, d);
    p.append(h('h3', { class: 'csh' }, 'Умения и особенности (' + feats.length + ')'), h('p', { class: 'mhint' }, 'Всё, что даёт ваш класс, подкласс, вид, предыстория и выбранные черты на текущем уровне.'));
    const grp = {};
    feats.forEach(f => (grp[f.src] = grp[f.src] || []).push(f));
    Object.keys(grp).forEach(g => {
      p.append(h('h4', { class: 'csh2' }, g));
      grp[g].forEach(f => { const dt = h('details', {}, h('summary', {}, f.name, f.level ? h('small', {}, ' · ' + f.level + ' ур.') : null)); let done = false; dt.addEventListener('toggle', () => { if (done || !dt.open) return; done = true; const b = f.blocks ? blocks(f.blocks) : h('div', { class: 'csb' }, f.text || ''); dt.append(b); DB().decorate(b, c.ed, null); }); p.append(dt); });
    });
  }
  function featureList(c, D, d) {
    const out = [];
    if (D.cls) (D.cls.features || []).filter(f => f.level <= c.lvl).forEach(f => out.push({ name: f.name, level: f.level, blocks: f.blocks, src: 'Класс: ' + D.cls.name_ru }));
    if (D.sub) (D.sub.features || []).filter(f => f.level <= c.lvl).forEach(f => out.push({ name: f.name, level: f.level, blocks: f.blocks, src: 'Подкласс: ' + D.sub.name }));
    if (D.sp) R.speciesTraits(D.sp).forEach(t => out.push({ name: t.name, text: t.text.replace(/\*+/g, ''), src: 'Вид: ' + D.sp.name_ru }));
    if (D.bg && D.bg.feat) { const f = D.feats.find(x => x.name_ru === D.bg.feat.name); out.push({ name: D.bg.feat.name, blocks: f ? f.blocks : null, text: f ? '' : 'Черта предыстории', src: 'Предыстория: ' + D.bg.name_ru }); }
    d.feats.forEach(x => { const f = D.feats.find(y => y.slug === x.slug); if (f) out.push({ name: f.name_ru, level: x.lvl, blocks: f.blocks, src: 'Черты' }); });
    return out;
  }

  /* ---------- 4. Заклинания ---------- */
  async function tabSpells(p, c, D, d) {
    const sp = d.sp;
    if (!sp.has) {
      p.append(h('p', { class: 'mhint' }, 'Класс «' + (D.cls ? D.cls.name_ru : '—') + '» на этом уровне не получает ячеек заклинаний. Если заклинания даёт подкласс, вид или черта, включите вручную:'),
        field('Заклинательная характеристика', sel(R.AB.map(a => [a.k, a.ru]), c.spellAbManual, v => { c.spellAbManual = v; if (!c.slotsManual) c.slotsManual = [0, 0, 0, 0, 0, 0, 0, 0, 0]; upd(); }, '— нет —')));
      return;
    }
    p.append(h('div', { class: 'csfacts' }, fact('Характеристика', R.ABN(sp.ab).ru), fact('Сл спасброска', sp.dc), fact('Бонус атаки', R.sgn(sp.atk)),
      sp.cantrips != null ? fact('Заговоры', sp.cantrips) : null, sp.prepared != null ? fact('Подготовлено', sp.prepared) : null, sp.known != null ? fact('Известно заклинаний', sp.known) : null));
    if (sp.pact) p.append(h('p', { class: 'mhint' }, 'Магия договора: ' + sp.pact.n + ' ячейки(а) ' + sp.pact.lvl + '-го уровня (восстанавливаются после короткого отдыха).'));
    const row = h('div', { class: 'slots' }, sp.slots.map((n, i) => n ? h('div', { class: 'slot' }, h('small', {}, (i + 1) + ' ур.'), h('b', {}, n)) : null));
    if (sp.slots.some(x => x)) p.append(h('h4', { class: 'csh2' }, 'Ячейки заклинаний'), row);
    if (!D.cls) return;
    const mine = c.spells, bySlug = new Set(mine.map(s => s.slug));
    // выбранные
    p.append(h('h3', { class: 'csh' }, 'Ваши заклинания (' + mine.length + ')'));
    const sel1 = h('div', { class: 'cslist' });
    const sorted = mine.slice().sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name, 'ru'));
    if (!sorted.length) sel1.append(h('div', { class: 'none' }, 'Пока ничего не выбрано — найдите заклинания ниже.'));
    sorted.forEach(s => {
      const m = D.spells.find(x => x.slug === s.slug);
      const prepCb = s.lvl > 0 ? h('label', { class: 'prep', title: 'Подготовлено' }, h('input', { type: 'checkbox', checked: !!s.prep, onchange: e => { s.prep = e.target.checked; upd(); } }), ' подгот.') : h('span', { class: 'prep' }, 'заговор');
      sel1.append(h('div', { class: 'csrow' + (s.prep ? ' prepd' : '') }, h('b', {}, m ? link(c.ed, 'spells', m, s.name) : s.name), h('small', {}, s.lvl ? s.lvl + ' ур.' : 'заговор'), prepCb, btn('×', () => { c.spells = c.spells.filter(x => x.slug !== s.slug); upd(); }, 'xx', 'Убрать')));
    });
    p.append(sel1);
    // каталог
    const maxL = Math.max(sp.maxLevel, 0);
    const all = c.spellsAll;
    p.append(h('h3', { class: 'csh' }, 'Добавить заклинание'),
      h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: all, onchange: e => { c.spellsAll = e.target.checked; upd(); } }), ' показать заклинания всех классов (для черт, подклассов, «Магического посвящённого»)'));
    let lvlF = 'all';
    const cat = D.spells.filter(s => (all || s.classes.some(x => x.slug === D.cls.slug)) && s.level <= Math.max(maxL, 0) && !bySlug.has(s.slug));
    const fl = h('div', { class: 'seg csmeth' }, ['all', ...Array.from({ length: maxL + 1 }, (_, i) => i)].map(v => btn(v === 'all' ? 'Все' : v === 0 ? 'Заговоры' : v + ' ур.', () => { lvlF = v; redraw(); }, '')));
    const box = h('div'); p.append(fl, box);
    function redraw() {
      fl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('act', (i === 0 ? 'all' : i - 1) === lvlF));
      box.textContent = '';
      const items = cat.filter(s => lvlF === 'all' || s.level === lvlF);
      box.append(searchBox(items, s => h('div', { class: 'csrow' }, h('b', {}, link(c.ed, 'spells', s)), h('small', {}, (s.level ? s.level + ' ур. ' : 'заговор ') + (s.school || '') + (s.concentration ? ' · К' : '') + (s.ritual ? ' · Р' : '')),
        btn('+ Добавить', () => { c.spells.push({ slug: s.slug, name: s.name_ru, lvl: s.level, prep: s.level > 0 && sp.prepared == null ? false : false }); upd(); }, 'dmbtn')), { ph: 'Поиск заклинания по названию…', max: 60 }));
    }
    redraw();
    p.append(h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: c.printSpells, onchange: e => { c.printSpells = e.target.checked; upd(false); } }), ' печатать полные описания выбранных заклинаний'));
  }

  /* ---------- 5. Снаряжение ---------- */
  const COINS = [['pm', 'ПМ'], ['zm', 'ЗМ'], ['em', 'ЭМ'], ['sm', 'СМ'], ['mm', 'ММ']];
  function weaponInfo(g) {
    const p = (g.props || []).find(x => /урон/i.test(x.label)); if (!p || !/оружие/i.test(g.line || '')) return null;
    const m = String(p.value).match(/^([\dкКdD+\s]+)[,\s]*(.*)$/); if (!m) return null;
    return { dice: m[1].replace(/\s+/g, ''), type: (m[2] || '').trim(), ranged: /дальнобой/i.test(g.line), simple: /простое/i.test(g.line), martial: /воинское/i.test(g.line), fin: ['dagger', 'rapier', 'scimitar', 'shortsword', 'whip', 'dart'].includes(g.slug) };
  }
  async function tabGear(p, c, D, d) {
    p.append(h('h3', { class: 'csh' }, 'Монеты'), h('div', { class: 'coins' }, COINS.map(([k, t]) => field(t, numIn(c.coins[k], v => { c.coins[k] = Math.max(0, v); upd(false); }, { min: 0, class: 'num' })))));
    // стартовое снаряжение
    const kits = d.ci ? d.ci.kit : '';
    const opts = parseKit(kits);
    const bgKit = D.bg && typeof D.bg.equipment === 'string' ? parseKit(D.bg.equipment) : null;
    if (opts || bgKit || kits) {
      p.append(h('h3', { class: 'csh' }, 'Стартовое снаряжение'), h('p', { class: 'mhint' }, 'Выберите вариант — предметы найдутся в справочнике и добавятся в инвентарь. Нераспознанное попадёт отдельной строкой.'));
      if (opts) p.append(h('div', { class: 'kit' }, h('b', {}, 'Класс: '), opts.map(o => btn('Вариант ' + o.k, () => addKit(c, D, o), 'dmbtn', o.txt))));
      else if (kits) p.append(html('<p class="mhint">' + esc(kits).replace(/\n/g, '<br>') + '</p>'));
      if (bgKit) p.append(h('div', { class: 'kit' }, h('b', {}, 'Предыстория: '), bgKit.map(o => btn('Вариант ' + o.k, () => addKit(c, D, o), 'dmbtn', o.txt))));
    }
    // инвентарь
    let weight = 0;
    p.append(h('h3', { class: 'csh' }, 'Инвентарь'));
    const t = h('table', { class: 'cstbl inv' }, h('tr', {}, ['Надето', 'Предмет', 'Кол-во', 'Вес', 'Урон / КД', ''].map(x => h('th', {}, x))));
    c.inv.forEach((i, idx) => {
      const g = D.gearBySlug[i.slug], w = g ? (g.weight_lb || 0) * i.q : 0; weight += w;
      const wi = g && weaponInfo(g);
      let info = '';
      if (wi) {
        const ab = wi.ranged ? 'dex' : (wi.fin ? (d.mod.dex > d.mod.str ? 'dex' : 'str') : 'str'), use = i.ab || ab;
        const lc = R.lc(d.ci ? d.ci.weapons : ''), isProf = i.prof != null ? i.prof : ((wi.simple && /прост/.test(lc)) || (wi.martial && /воинск/.test(lc)) || (g && lc.includes(R.lc(g.name_ru).slice(0, 5))));
        const atk = d.mod[use] + (isProf ? d.pb : 0); const dm = d.mod[use];
        info = 'атака ' + R.sgn(atk) + ', урон ' + wi.dice + (dm ? (dm > 0 ? '+' : '−') + Math.abs(dm) : '') + ' ' + wi.type;
      } else if (g && /доспех|щит/i.test(g.line || '')) { const q = (g.props || []).find(x => /класс защиты/i.test(x.label)); info = q ? 'КД ' + q.value : (g.slug === 'shield' ? '+2 к КД' : ''); }
      t.append(h('tr', {}, h('td', {}, h('input', { type: 'checkbox', checked: !!i.eq, title: 'Надето / в руках', onchange: e => { i.eq = e.target.checked; upd(); } })),
        h('td', {}, g ? link(24, 'equipment', g, i.n) : i.n), h('td', {}, numIn(i.q, v => { i.q = Math.max(1, v); upd(); }, { min: 1, class: 'num' })), h('td', {}, w ? w + ' фнт.' : '—'), h('td', {}, info),
        h('td', {}, btn('×', () => { c.inv.splice(idx, 1); upd(); }, 'xx', 'Убрать'))));
    });
    if (!c.inv.length) t.append(h('tr', {}, h('td', { colspan: 6, class: 'none' }, 'Пусто. Добавьте предметы ниже.')));
    p.append(t);
    const cap = d.score.str * 15;
    p.append(h('p', { class: 'mhint' }, 'Вес снаряжения: ' + (Math.round(weight * 10) / 10) + ' фнт. Грузоподъёмность: ' + cap + ' фнт. ' + (weight > cap ? '— перегруз!' : '')),
      h('div', { class: 'csgrid' }, field('Бонус к КД (магия и т. п.)', numIn(c.acBonus, v => { c.acBonus = v; upd(); })), field('КД', h('span', {}, h('b', {}, d.ac), ' (' + d.acWhy + ')'))));
    const freeIn = textIn('', v => { }, { placeholder: 'Свободная запись: «Верёвка пеньковая»…' });
    p.append(h('div', { class: 'row' }, freeIn, btn('Добавить запись', () => { const v = freeIn.value.trim(); if (v) { c.inv.push({ n: v, slug: '', q: 1, eq: false }); upd(); } }, 'dmbtn')));
    p.append(h('h4', { class: 'csh2' }, 'Каталог снаряжения'), searchBox(D.gear, g => { const wi = weaponInfo(g); return h('div', { class: 'csrow' }, h('b', {}, g.name_ru), h('small', {}, (g.line || '') + (wi ? ' · ' + wi.dice + ' ' + wi.type : '') + ' · ' + (g.cost || '')), btn('+', () => { const ex = c.inv.find(x => x.slug === g.slug); if (ex) ex.q++; else c.inv.push({ n: g.name_ru, slug: g.slug, q: 1, eq: false }); upd(); }, 'dmbtn')); }, { ph: 'Поиск предмета: меч, верёвка, щит…', max: 50 }));
  }
  function parseKit(txt) {
    if (!txt) return null;
    const m = [...String(txt).matchAll(/\(([А-ЯA-Z])\)\s*([^;]*?)(?=;?\s*(?:или\s*)?\([А-ЯA-Z]\)|$)/gs)];
    return m.length ? m.map(x => ({ k: x[1], txt: x[2].replace(/^[\s;]+|[\s;.]+$/g, '').replace(/^или\s*/i, '') })) : null;
  }
  function addKit(c, D, o) {
    const parts = o.txt.split(/,\s*(?![^()]*\))/).map(s => s.trim().replace(/^и\s+/i, '')).filter(Boolean);
    let miss = [];
    parts.forEach(p => {
      const coin = p.match(/^(\d+)\s*(ЗМ|СМ|ММ|ЭМ|ПМ)$/i);
      if (coin) { const k = { зм: 'zm', см: 'sm', мм: 'mm', эм: 'em', пм: 'pm' }[coin[2].toLowerCase()]; c.coins[k] += +coin[1]; return; }
      const q = p.match(/^(\d+)\s+(.*)$/), name = (q ? q[2] : p).replace(/\s*\(.*\)\s*$/, ''), qty = q ? +q[1] : 1;
      const stem = R.lc(name).replace(/(ы|и|а|я|у|ю|ой|ей|ом|ем|ов)$/g, '').slice(0, Math.max(4, R.lc(name).length - 2));
      const g = D.gear.find(x => R.lc(x.name_ru) === R.lc(name)) || D.gear.find(x => R.lc(x.name_ru).startsWith(stem) && Math.abs(x.name_ru.length - name.length) < 5);
      if (g) { const ex = c.inv.find(x => x.slug === g.slug); if (ex) ex.q += qty; else c.inv.push({ n: g.name_ru, slug: g.slug, q: qty, eq: false }); } else miss.push(p);
    });
    miss.forEach(m => c.inv.push({ n: m, slug: '', q: 1, eq: false }));
    upd(); root.DM.toast('Снаряжение добавлено' + (miss.length ? ' (без записи в справочнике: ' + miss.length + ')' : ''));
  }

  /* ---------- Облики зверей (друид) ---------- */
  async function tabForms(p, c, D, d) {
    const ws = d.ws; if (!ws) { p.append(h('p', { class: 'mhint' }, 'Дикий облик доступен друиду со 2 уровня.')); return; }
    p.append(h('div', { class: 'csfacts' }, fact('Известно обликов', ws.known >= 99 ? 'любые подходящие' : ws.known), fact('Макс. опасность', R.crStr(ws.cr)), fact('Полёт', ws.fly ? 'да' : 'нет'),
      c.ed === 14 ? fact('Плавание', ws.swim ? 'да' : 'нет') : null));
    if (ws.note) p.append(h('p', { class: 'mhint' }, ws.note));
    const beasts = await DB().load('bestiary', c.ed);
    const chosen = c.forms;
    p.append(h('h3', { class: 'csh' }, 'Ваши облики (' + chosen.length + (ws.known < 99 ? ' из ' + ws.known : '') + ')'));
    const lst = h('div', { class: 'cslist' });
    if (!chosen.length) lst.append(h('div', { class: 'none' }, 'Выберите зверей из списка ниже.'));
    chosen.forEach(slug => { const m = beasts.find(x => x.slug === slug); if (!m) return;
      const sp = m.speed || {}, sps = Object.entries(sp).map(([k, v]) => ({ walk: '', fly: 'полёт ', swim: 'плавание ', climb: 'лазание ', burrow: 'копание ' }[k] || k + ' ') + v).join(', ');
      lst.append(h('div', { class: 'csrow' }, h('b', {}, link(c.ed, 'bestiary', m)), h('small', {}, 'ОП ' + m.cr + ' · КД ' + m.ac + ' · ХП ' + (m.hp && m.hp.avg) + ' · ' + sps), btn('×', () => { c.forms = c.forms.filter(x => x !== slug); upd(); }, 'xx', 'Убрать'))); });
    p.append(lst);
    const all = h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: !!c.formsAll, onchange: e => { c.formsAll = e.target.checked; upd(); } }), ' показать всех зверей (по правилам — только подходящих; с позволения Мастера можно и других)');
    p.append(h('h3', { class: 'csh' }, 'Подходящие звери'), all);
    const cands = beasts.filter(m => !chosen.includes(m.slug) && (c.formsAll ? /зверь/i.test(String(m.type)) : R.beastOk(m, ws, c.ed))).sort((a, b) => R.crNum(a.cr) - R.crNum(b.cr) || a.name_ru.localeCompare(b.name_ru, 'ru'));
    p.append(searchBox(cands, m => { const sp = m.speed || {}; return h('div', { class: 'csrow' }, h('b', {}, link(c.ed, 'bestiary', m)), h('small', {}, 'ОП ' + m.cr + ' · КД ' + m.ac + ' · ХП ' + (m.hp && m.hp.avg) + (sp.fly ? ' · полёт' : '') + (sp.swim ? ' · плавание' : '')), btn('+ Добавить', () => { c.forms.push(m.slug); upd(); }, 'dmbtn')); }, { ph: 'Поиск зверя: волк, медведь, паук…', max: 60 }));
    p.append(h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: c.printForms !== false, onchange: e => { c.printForms = e.target.checked; upd(false); } }), ' печатать карточки обликов отдельными страницами'));
  }

  /* ---------- Описание ---------- */
  async function tabStory(p, c) {
    const ta = (k, label, rows) => field(label, h('textarea', { rows: rows || 3, onchange: e => { c.story[k] = e.target.value; upd(false); } }, c.story[k] || ''));
    p.append(h('div', { class: 'csgrid two' }, ta('traits', 'Черты характера'), ta('ideals', 'Идеалы'), ta('bonds', 'Привязанности'), ta('flaws', 'Слабости'), ta('look', 'Внешность и история', 6), ta('notes', 'Заметки', 6)),
      h('h3', { class: 'csh' }, 'Хиты'),
      h('div', { class: 'csgrid' }, field('Способ', sel([['avg', 'Среднее (по умолчанию)'], ['manual', 'Ввести итог вручную']], c.hpMode, v => { c.hpMode = v; upd(); })),
        c.hpMode === 'manual' ? field('Максимум хитов', numIn(c.hpManual, v => { c.hpManual = v; upd(); })) : null,
        field('Прибавка к хитам (Крепкий и т. п.)', numIn(c.hpBonus, v => { c.hpBonus = v; upd(); }))));
  }

  /* ---------- Лист для печати ---------- */
  async function tabSheet(p, c, D, d) {
    p.append(h('div', { class: 'noprint sheetbar' }, btn('Печать / сохранить в PDF', () => window.print(), 'dmbtn pri', 'В окне печати выберите «Сохранить как PDF»'), h('span', { class: 'mhint' }, 'Лист формата A4, чёрно-белая печать. Заклинания и описания можно включить на других вкладках.')));
    const sh = h('div', { class: 'csheet' }); p.append(sh);
    const t = (tag, cls, ...k) => h(tag, { class: cls }, ...k);
    const box = (title, ...k) => h('div', { class: 'pbox' }, h('div', { class: 'ptt' }, title), ...k);
    // страница 1
    const p1 = t('section', 'pg');
    p1.append(h('div', { class: 'phead' }, h('div', { class: 'pname' }, c.name || 'Без имени', h('small', {}, 'Имя персонажа')),
      h('div', { class: 'pmeta' }, [[(D.cls ? D.cls.name_ru : '') + (D.sub ? ' (' + D.sub.name + ')' : ''), 'Класс'], [c.lvl, 'Уровень'], [D.sp ? D.sp.name_ru : '', 'Вид'], [D.bg ? D.bg.name_ru : '', 'Предыстория'], [c.align, 'Мировоззрение'], [c.player, 'Игрок']].map(([v, l]) => h('div', {}, h('b', {}, v || ' '), h('small', {}, l))))));
    const left = t('div', 'pcol'), mid = t('div', 'pcol'), right = t('div', 'pcol');
    const abBox = t('div', 'pabs');
    R.AB.forEach(a => abBox.append(h('div', { class: 'pab' }, h('small', {}, a.ru), h('b', { class: 'pm' }, R.sgn(d.mod[a.k])), h('span', { class: 'ps' }, d.score[a.k]))));
    left.append(abBox,
      box('Спасброски', ...R.AB.map(a => h('div', { class: 'prow' }, h('i', { class: d.saveProf.has(a.k) ? 'dot on' : 'dot' }), h('b', {}, R.sgn(d.saves[a.k])), ' ' + a.ru))),
      box('Навыки', ...d.skills.map(s => h('div', { class: 'prow' }, h('i', { class: s.lev ? 'dot on' + (s.lev === 2 ? ' ex' : '') : 'dot' }), h('b', {}, R.sgn(s.bonus)), ' ' + s.n, h('small', {}, ' (' + R.ABN(s.ab).s + ')')))));
    const pp = 10 + d.skills.find(s => s.id === 'perception').bonus;
    mid.append(h('div', { class: 'pstats' }, [['Бонус мастерства', R.sgn(d.pb)], ['Класс доспеха', d.ac], ['Инициатива', R.sgn(d.init)], ['Скорость', d.speed + ' фт.'], ['Пассивное Восприятие', pp], ['Кость хитов', c.lvl + 'к' + d.die]].map(([l, v]) => h('div', {}, h('b', {}, v), h('small', {}, l)))),
      box('Хиты', h('div', { class: 'phps' }, h('div', {}, h('small', {}, 'Максимум'), h('b', {}, d.hp)), h('div', {}, h('small', {}, 'Текущие'), h('b', {}, ' ')), h('div', {}, h('small', {}, 'Временные'), h('b', {}, ' ')))),
      box('Атаки', ...attacksRows(c, D, d)),
      box('Владения и языки', h('div', { class: 'ptxt' }, [d.ci && 'Доспехи: ' + d.ci.armor, d.ci && 'Оружие: ' + d.ci.weapons, [d.ci && d.ci.tools, D.bg && D.bg.tools, c.story.tools].filter(Boolean).join('; ') && 'Инструменты: ' + [d.ci && d.ci.tools, D.bg && D.bg.tools, c.story.tools].filter(x => x && x !== 'Нет' && x !== 'нет').join('; '), c.story.langs && 'Языки: ' + c.story.langs].filter(Boolean).join('\n'))));
    const feat = featureList(c, D, d);
    right.append(box('Умения и особенности', h('div', { class: 'ptxt feats' }, feat.map(f => h('div', {}, h('b', {}, f.name), h('small', {}, ' ' + f.src.replace(/^[^:]+: /, '') + (f.level ? ', ' + f.level + ' ур.' : '')))))),
      box('Черты характера', h('div', { class: 'ptxt' }, [c.story.traits && 'Черты: ' + c.story.traits, c.story.ideals && 'Идеалы: ' + c.story.ideals, c.story.bonds && 'Привязанности: ' + c.story.bonds, c.story.flaws && 'Слабости: ' + c.story.flaws].filter(Boolean).join('\n'))));
    p1.append(t('div', 'pcols', left, mid, right)); sh.append(p1);
    // страница 2: заклинания
    if (d.sp.has) {
      const p2 = t('section', 'pg');
      p2.append(h('div', { class: 'phead' }, h('div', { class: 'pname' }, 'Заклинания', h('small', {}, c.name || ''))),
        h('div', { class: 'pstats' }, [['Характеристика', R.ABN(d.sp.ab).ru], ['Сл спасброска', d.sp.dc], ['Бонус атаки', R.sgn(d.sp.atk)], ['Заговоры', d.sp.cantrips != null ? d.sp.cantrips : ' '], ['Подготовлено', d.sp.prepared != null ? d.sp.prepared : (d.sp.known != null ? d.sp.known : ' ')]].map(([l, v]) => h('div', {}, h('b', {}, v), h('small', {}, l)))));
      const slotRow = h('div', { class: 'pslots' });
      d.sp.slots.forEach((n, i) => { if (n) slotRow.append(h('div', {}, h('small', {}, (i + 1) + ' ур.'), h('span', {}, Array.from({ length: n }, () => h('i', { class: 'dot' })))) ); });
      if (d.sp.pact) slotRow.append(h('div', {}, h('small', {}, 'Договор ' + d.sp.pact.lvl + ' ур.'), h('span', {}, Array.from({ length: d.sp.pact.n }, () => h('i', { class: 'dot' })))));
      p2.append(box('Ячейки заклинаний (отмечайте потраченные)', slotRow));
      const byL = {}; c.spells.forEach(s => (byL[s.lvl] = byL[s.lvl] || []).push(s));
      const cols = t('div', 'pspl');
      Object.keys(byL).sort((a, b) => a - b).forEach(l => cols.append(box(l == 0 ? 'Заговоры' : l + ' уровень', ...byL[l].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(s => { const m = D.spells.find(x => x.slug === s.slug); return h('div', { class: 'prow' }, h('i', { class: s.prep || l == 0 ? 'dot on' : 'dot' }), s.name, m ? h('small', {}, ' ' + [m.concentration ? 'К' : '', m.ritual ? 'Р' : '', m.range].filter(Boolean).join(' · ')) : null); }))));
      if (!c.spells.length) cols.append(box('Заклинания', h('div', { class: 'ptxt' }, ' ')));
      p2.append(cols, h('p', { class: 'pnote' }, '● — заговор или подготовленное заклинание. К — концентрация, Р — ритуал.'));
      sh.append(p2);
      if (c.printSpells && c.spells.length) {
        const p3 = t('section', 'pg ptext'); p3.append(h('div', { class: 'phead' }, h('div', { class: 'pname' }, 'Описания заклинаний', h('small', {}, c.name || ''))));
        c.spells.slice().sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name, 'ru')).forEach(s => { const m = D.spells.find(x => x.slug === s.slug); if (!m) return;
          const hd = h('div', { class: 'pspell' }, h('b', {}, m.name_ru), h('small', {}, ' ' + (m.line || '') + ' · ' + [m.cast_time, m.range, m.components, m.duration].filter(Boolean).join(' · ')), html(DB().B(m.blocks || []) + (m.higher ? '<p>' + DB().esc(m.higher).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>' : '')));
          p3.append(hd); });
        sh.append(p3);
      }
    }
    // страница: снаряжение
    const p4 = t('section', 'pg');
    p4.append(h('div', { class: 'phead' }, h('div', { class: 'pname' }, 'Снаряжение и описание', h('small', {}, c.name || ''))));
    const inv = h('table', { class: 'ptbl' }, h('tr', {}, ['', 'Предмет', 'Кол.', 'Вес'].map(x => h('th', {}, x))));
    c.inv.forEach(i => { const g = D.gearBySlug[i.slug]; inv.append(h('tr', {}, h('td', {}, i.eq ? '●' : ''), h('td', {}, i.n), h('td', {}, i.q), h('td', {}, g && g.weight_lb ? g.weight_lb * i.q : ''))); });
    p4.append(t('div', 'pcols two', t('div', 'pcol', box('Монеты', h('div', { class: 'pcoins' }, COINS.map(([k, tt]) => h('div', {}, h('small', {}, tt), h('b', {}, c.coins[k] || ' '))))), box('Инвентарь', inv)),
      t('div', 'pcol', box('Внешность и история', h('div', { class: 'ptxt' }, c.story.look || ' ')), box('Заметки', h('div', { class: 'ptxt tall' }, c.story.notes || ' ')))));
    sh.append(p4);
    // облики
    if (d.ws && c.forms.length && c.printForms !== false) {
      const beasts = await DB().load('bestiary', c.ed);
      const p5 = t('section', 'pg pforms'); p5.append(h('div', { class: 'phead' }, h('div', { class: 'pname' }, 'Дикий облик', h('small', {}, c.name || ''))));
      c.forms.forEach(slug => { const m = beasts.find(x => x.slug === slug); if (!m) return; const w = h('div', { class: 'pform' }); w.innerHTML = DB().SXS[c.ed].bestiary.card(m); p5.append(w); });
      sh.append(p5);
    }
  }
  function attacksRows(c, D, d) {
    const rows = [];
    c.inv.filter(i => i.eq).forEach(i => {
      const g = D.gearBySlug[i.slug], wi = g && weaponInfo(g); if (!wi) return;
      const ab = wi.ranged ? 'dex' : (wi.fin ? (d.mod.dex > d.mod.str ? 'dex' : 'str') : 'str'), lcw = R.lc(d.ci ? d.ci.weapons : '');
      const isProf = (wi.simple && /прост/.test(lcw)) || (wi.martial && /воинск/.test(lcw)) || lcw.includes(R.lc(g.name_ru).slice(0, 5));
      const dm = d.mod[ab];
      rows.push(h('div', { class: 'prow atk' }, h('b', {}, g.name_ru), h('span', {}, R.sgn(d.mod[ab] + (isProf ? d.pb : 0))), h('span', {}, wi.dice + (dm ? (dm > 0 ? '+' : '−') + Math.abs(dm) : '') + ' ' + wi.type)));
    });
    if (d.sp.has) rows.push(h('div', { class: 'prow atk' }, h('b', {}, 'Атака заклинанием'), h('span', {}, R.sgn(d.sp.atk)), h('span', {}, 'Сл ' + d.sp.dc)));
    while (rows.length < 4) rows.push(h('div', { class: 'prow atk' }, ' '));
    return rows;
  }

  root.CS = { show, render, load, cur };
})(window);
