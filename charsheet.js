/* ===== Листы персонажей: конструктор и печать =====
   Расчёты — в charrules.js (CSR). Здесь: хранение, вкладки-шаги, лист для печати.
   Данные берутся через window.DB (index.html). */
(function (root) {
  'use strict';
  const R = root.CSR, h = root.DM.h, DB = () => root.DB;
  const KEY = 'dm.chars.v1';
  const UI = { spQ: '', spL: 'all', gearQ: '', ftQ: '' };
  let S = null, host = null, tabId = 'base', dataCache = {}, scrollKeep = 0;
  const TABS = [['base', '1. Основа'], ['abil', '2. Характеристики'], ['skills', '3. Навыки и умения'], ['feats', '4. Черты'], ['spells', '5. Заклинания'], ['gear', '6. Снаряжение'], ['forms', 'Облики зверей'], ['story', 'Описание'], ['sheet', 'Лист / печать']];
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
    const q = h('input', { type: 'text', placeholder: opt.ph || 'Поиск…', autocomplete: 'off', value: opt.q || '' }), list = h('div', { class: 'cslist' });
    const draw = () => {
      const v = DB().norm(q.value.trim()); list.textContent = '';
      const hit = items.filter(i => !v || DB().norm(i.name_ru + ' ' + (i.name_en || '')).includes(v)).slice(0, opt.max || 80);
      if (!hit.length) list.append(h('div', { class: 'none' }, 'Ничего не найдено'));
      hit.forEach(i => list.append(render(i)));
    };
    q.addEventListener('input', () => { if (opt.onq) opt.onq(q.value); draw(); }); draw();
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
    c.feats = c.feats || []; c.kit = c.kit || {}; c.kitCoins = c.kitCoins || {}; c.featTxt = c.featTxt || 'short'; c.bonus = c.bonus || {};
    const D = await loadData(c), d = R.derive(c, D);
    body.append(summary(c, D, d), tabsBar(c, D, d));
    const pane = h('div', { class: 'cspane t-' + tabId }); body.append(pane);
    const fn = { base: tabBase, abil: tabAbil, skills: tabSkills, feats: tabFeats, spells: tabSpells, gear: tabGear, forms: tabForms, story: tabStory, sheet: tabSheet }[tabId] || tabBase;
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
      const bgIds = d.bgChoice ? d.bgChoice.from : [], n = new Set([...(c.skills || []), ...(c.skillsExtra || []).filter(id => !bgIds.includes(id))]).size, allow = ci ? ci.pickN + d.extraN : 0;
      if (ci && n < ci.pickN) t.push(['skills', 'Навыки класса: выбрано ' + n + ' из ' + ci.pickN]);
      if (ci && n > allow) t.push(['skills', 'Навыков больше, чем положено (' + n + ' из ' + allow + (d.extraN ? ': класс ' + ci.pickN + ' + черты и вид ' + d.extraN : '') + ')']);
    }
    if (d.bgChoice && d.bgChoice.got < d.bgChoice.n) t.push(['skills', 'Навыки предыстории: выберите ' + d.bgChoice.n + ' из ' + bgChoiceNames(d) + ' (кнопка «+» у навыка)']);
    if (!c.sp) t.push(['base', 'Выберите вид']);
    if (!c.bg) t.push(['base', 'Выберите предысторию']);
    if (c.ed === 24 && D.bg && c.bg2.m === '21' && (!c.bg2.a || !c.bg2.b || c.bg2.a === c.bg2.b)) t.push(['abil', 'Распределите бонусы предыстории (+2 и +1)']);
    R.asiLevels(D.cls).filter(l => l <= c.lvl).forEach(l => {
      const ep = c.ed === 24 && l === R.epicLevel(D.cls), x = c.asi[l];
      if (!x || ((x.m === 'feat' || ep) && !x.feat) || (!ep && x.m === '2' && !x.a) || (!ep && x.m === '11' && (!x.a || !x.b || x.a === x.b))) { t.push(['abil', (ep ? 'Дар эпического героя на ' : 'Увеличение характеристик на ') + l + ' уровне']); return; }
      if (x.m === 'feat' || ep) { const f = D.feats.find(y => y.slug === x.feat), fa = R.featAbility(f); if (fa && !fa.opts.includes(x.fa)) t.push(['abil', 'Черта «' + f.name_ru + '» (' + l + ' ур.): выберите, какую характеристику увеличить на 1']); }
    });
    if (d.expN > d.expUsed) t.push(['skills', 'Экспертность: отмечено ' + d.expUsed + ' из ' + d.expN + ' (★ у навыка, которым вы владеете)']);
    if (d.sp.has && d.sp.cantrips != null) {
      const cn = c.spells.filter(s => s.lvl === 0 && !s.free).length;
      if (cn < d.sp.cantrips) t.push(['spells', 'Заговоры: ' + cn + ' из ' + d.sp.cantrips]);
      else if (cn > d.sp.cantrips) t.push(['spells', 'Заговоров больше нормы: ' + cn + '/' + d.sp.cantrips]);
    }
    if (d.sp.has && d.sp.prepared != null) {
      const pn = c.spells.filter(s => s.lvl > 0 && s.prep && !s.free).length;
      if (pn < d.sp.prepared) t.push(['spells', 'Подготовлено заклинаний: ' + pn + ' из ' + d.sp.prepared]);
      else if (pn > d.sp.prepared) t.push(['spells', 'Подготовлено больше нормы: ' + pn + '/' + d.sp.prepared]);
    }
    if (d.ws && c.forms.length < Math.min(d.ws.known, 99)) t.push(['forms', 'Облики зверей: ' + c.forms.length + ' из ' + d.ws.known]);
    return t;
  }
  const bgChoiceNames = d => d.bgChoice.from.map(id => d.skills.find(s => s.id === id).n).join(', ');
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

  const ALIGNS = ['Законопослушный добрый', 'Нейтральный добрый', 'Хаотичный добрый', 'Законопослушный нейтральный', 'Нейтральный', 'Хаотичный нейтральный', 'Законопослушный злой', 'Нейтральный злой', 'Хаотичный злой', 'Без мировоззрения'];
  /* ---------- 1. Основа ---------- */
  async function tabBase(p, c, D, d) {
    const ed = c.ed;
    p.append(h('div', { class: 'csgrid' },
      field('Имя персонажа', textIn(c.name, v => { c.name = v; upd(); })),
      field('Мировоззрение', sel(ALIGNS.concat(c.align && !ALIGNS.includes(c.align) ? [c.align] : []), c.align, v => { c.align = v; upd(false); }, '— не выбрано —')),
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
      if (c.ed === 24) { const ex = (c.bonus || {})[a.k] || 0; bcell = h('span', { title: d.src[a.k].join('; ') }, (bonus - ex ? R.sgn(bonus - ex) : '—') + ' + ', numIn(ex, v => { c.bonus = c.bonus || {}; c.bonus[a.k] = v; upd(); }, { class: 'num', title: 'Прочее: бонусы от черт и т. п.' })); }
      if (c.ed === 14) bcell = numIn((c.bonus || {})[a.k] || 0, v => { c.bonus = c.bonus || {}; c.bonus[a.k] = v; upd(); }, { class: 'num', title: 'Бонусы вида и прочее' });
      t.append(h('tr', { class: bgA.includes(a.k) && c.ed === 24 ? 'hl' : '' }, h('td', {}, h('b', {}, a.ru)), h('td', {}, cellBase), h('td', {}, bcell), h('td', {}, h('b', { class: 'big' }, d.score[a.k])), h('td', {}, R.sgn(d.mod[a.k])),
        h('td', {}, R.sgn(d.saves[a.k]) + (d.saveProf.has(a.k) ? ' ●' : ''))));
    });
    p.append(t, h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: c.cap20 === false, onchange: e => { c.cap20 = e.target.checked ? false : true; upd(); } }), ' максимум характеристики 30 вместо 20 (особые случаи: дары, предметы)'));
    // бонусы предыстории 2024
    if (c.ed === 24) {
      p.append(h('h3', { class: 'csh' }, 'Бонусы предыстории'));
      if (!D.bg) p.append(h('p', { class: 'mhint' }, 'Сначала выберите предысторию на вкладке «Основа».'));
      else {
        const opts = D.bg.abilities.map(x => [R.ABK[x], x]);
        p.append(h('div', { class: 'seg csmeth' }, btn('+2 и +1', () => { c.bg2.m = '21'; upd(); }, c.bg2.m === '21' ? 'act' : ''), btn('+1, +1, +1', () => { c.bg2.m = '111'; upd(); }, c.bg2.m === '111' ? 'act' : '')));
        if (c.bg2.m === '21') p.append(h('div', { class: 'csgrid' }, field('+2 к', sel(opts.filter(o => o[0] !== c.bg2.b), c.bg2.a, v => { c.bg2.a = v; upd(); }, '—')), field('+1 к', sel(opts.filter(o => o[0] !== c.bg2.a), c.bg2.b, v => { c.bg2.b = v; upd(); }, '—'))));
        else p.append(h('p', { class: 'mhint' }, '+1 к каждой: ' + D.bg.abilities.join(', ')));
      }
    } else p.append(h('p', { class: 'mhint' }, 'В колонке «Бонусы» впишите прибавки от вида (расовые бонусы).'));
    // увеличения характеристик по уровням
    const lv = R.asiLevels(D.cls).filter(l => l <= c.lvl);
    if (lv.length) {
      p.append(h('h3', { class: 'csh' }, 'Увеличение характеристик и черты'));
      lv.forEach(l => {
        const ep = c.ed === 24 && l === R.epicLevel(D.cls);
        const x = c.asi[l] || (c.asi[l] = { m: ep ? 'feat' : '2', a: '', b: '', feat: '' });
        if (ep) x.m = 'feat';
        const abOpts = R.AB.map(a => [a.k, a.ru]);
        const box = h('div', { class: 'csasi' }, h('b', {}, l + ' уровень' + (ep ? ' · Дар эпического героя' : '')),
          ep ? null : sel([['2', '+2 к одной'], ['11', '+1 к двум'], ['feat', 'Черта']], x.m, v => { x.m = v; upd(); }),
          x.m === '2' ? sel(abOpts, x.a, v => { x.a = v; upd(); }, '—') : null,
          x.m === '11' ? [sel(abOpts, x.a, v => { x.a = v; upd(); }, '—'), sel(abOpts, x.b, v => { x.b = v; upd(); }, '—')] : null);
        if (x.m === 'feat') {
          const cur = D.feats.find(f => f.slug === x.feat), fa = R.featAbility(cur);
          box.append(h('span', { class: 'csfeat' }, cur ? link(c.ed, 'feats', cur) : 'не выбрана'),
            btn(cur ? 'Сменить' : 'Выбрать черту', () => featDialog(c, D, f => { x.feat = f.slug; x.fa = ''; upd(); }, null, ep ? 'Черта Эпического дара' : ''), 'dmbtn'));
          if (fa) box.append(h('label', { class: 'csfa' }, '+1 к ', sel(fa.opts.map(k => [k, R.ABN(k).ru]), x.fa, v => { x.fa = v; upd(); }, '—'), fa.cap > 20 ? ' (до ' + fa.cap + ')' : ''));
        }
        p.append(box);
      });
    }
  }
  const AB_RESET = c => { const arr = R.STD_ARRAY; R.AB.forEach((a, i) => { c.ab[a.k] = arr[i]; }); };
  const lvReq = f => { const m = String(f.prerequisite || f.line || '').match(/(\d+)[-\s]*(?:й|го|ого)?\s*уровн/i); return m ? +m[1] : 0; };
  function featDialog(c, D, pick, skip, onlyCat) {
    skip = skip || new Set();
    const ov = h('div', { class: 'dmmodal', onclick: e => { if (e.target === ov) ov.remove(); } });
    const cats = onlyCat ? [onlyCat] : [...new Set(D.feats.map(f => f.category).filter(Boolean))];
    let cat = onlyCat || ''; const body = h('div');
    const chips = h('div', { class: 'seg csmeth wrapseg' }, ['', ...cats].map(k => btn(k ? k.replace(/^Черта\s+/, '') : 'Все', () => { cat = k; draw(); }, '')));
    function draw() {
      chips.querySelectorAll('button').forEach((b, i) => b.classList.toggle('act', (i ? cats[i - 1] : '') === cat));
      body.textContent = '';
      const items = D.feats.filter(f => (!cat || f.category === cat) && !skip.has(f.slug));
      body.append(searchBox(items, f => { const need = lvReq(f), bad = need > c.lvl;
        return h('div', { class: 'csrow', title: f.prerequisite ? 'Требование: ' + f.prerequisite : '', onclick: () => { ov.remove(); pick(f); } }, h('b', {}, f.name_ru), h('small', {}, (f.category ? f.category.replace(/^Черта\s+/, '') : '') + (f.prerequisite && f.prerequisite !== 'None' ? ' · треб.: ' + f.prerequisite : '')), bad ? h('small', { class: 'warn' }, 'нужен ' + need + ' ур.') : null); },
        { q: UI.ftQ, onq: v => { UI.ftQ = v; }, ph: 'Поиск черты…', max: 100 }));
    }
    ov.append(h('div', { class: 'dmdlg wide' }, h('h3', {}, 'Выбор черты'), chips, body, h('div', { class: 'mbtn' }, btn('Закрыть', () => ov.remove()))));
    document.body.append(ov); draw();
  }
  async function tabFeats(p, c, D, d) {
    p.append(h('p', { class: 'mhint' }, c.ed === 24 ? 'Черта Происхождения даётся предысторией. Остальные берутся вместо увеличения характеристик (вкладка «Характеристики») либо добавляются здесь — по виду (Человек) или с позволения Мастера. Если черта даёт +1 к характеристике, впишите его в столбец «Бонусы» на вкладке «Характеристики».' : 'Черты берутся вместо увеличения характеристик (вкладка «Характеристики») или добавляются здесь (например, Человек-вариант). Бонусы к характеристикам впишите на вкладке «Характеристики».'));
    const card = (f, tag, extra) => { const dt = h('details', {}, h('summary', {}, f.name_ru || f.name, h('small', {}, ' · ' + tag), extra || null)); let done = false;
      dt.addEventListener('toggle', () => { if (done || !dt.open) return; done = true; const b = blocks(f.blocks || []); dt.append(b); DB().decorate(b, c.ed, null); }); return dt; };
    const list = [];
    if (c.ed === 24 && D.bg && D.bg.feat) { const f = D.feats.find(x => x.name_ru === D.bg.feat.name); list.push(card(f || { name: D.bg.feat.name, blocks: [] }, 'предыстория «' + D.bg.name_ru + '»')); }
    d.feats.filter(x => !x.extra).forEach(x => { const f = D.feats.find(y => y.slug === x.slug); if (f) list.push(card(f, x.lvl + ' ур., вместо увеличения характеристик')); });
    c.feats.forEach((x, i) => { const f = D.feats.find(y => y.slug === x.slug); if (f) list.push(card(f, 'добавлена вручную', btn('×', ev => { ev.preventDefault(); c.feats.splice(i, 1); upd(); }, 'xx', 'Убрать черту'))); });
    p.append(h('h3', { class: 'csh' }, 'Ваши черты (' + list.length + ')'));
    if (!list.length) p.append(h('div', { class: 'none' }, 'Пока нет черт.'));
    list.forEach(x => p.append(x));
    const skip = new Set([...c.feats.map(x => x.slug), ...d.feats.map(x => x.slug)]);
    p.append(h('div', { class: 'row' }, btn('+ Добавить черту', () => featDialog(c, D, f => { c.feats.push({ slug: f.slug }); upd(); }, skip), 'dmbtn pri')));
  }

  /* ---------- 3. Навыки и умения ---------- */
  async function tabSkills(p, c, D, d) {
    const ci = d.ci;
    p.append(h('h3', { class: 'csh' }, 'Навыки'));
    if (ci) p.append(h('p', { class: 'mhint' }, 'Класс «' + D.cls.name_ru + '»: выберите ' + ci.pickN + (ci.pickAny ? ' любых навыка' : ' из отмеченных ◆') + '. Навыки предыстории подставляются сами.' + (d.extraN ? ' Черты и вид дают ещё ' + d.extraN + ' (' + d.grants.map(g => g.why + ' — ' + g.n).join('; ') + '): отмечайте их галочкой или кнопкой «+», инструменты из «Одарённого» впишите в «Другие владения».' : '') + ' Экспертность — звёздочка ☆ рядом с бонусом' + (d.expN ? ' (положено ' + d.expN + ', отмечено ' + d.expUsed + ')' : '') + '.'));
    if (d.bgChoice) p.append(h('p', { class: 'mhint' }, 'Предыстория «' + D.bg.name_ru + '»: навыки на выбор — выберите ' + d.bgChoice.n + ' из ' + bgChoiceNames(d) + ' (выбрано ' + d.bgChoice.got + '). Отметьте их кнопкой «+» в колонке «Откуда».'));
    const t = h('table', { class: 'cstbl sk' }, h('tr', {}, ['Выбор', 'Навык', 'Бонус', 'Откуда'].map(x => h('th', {}, x))));
    R.AB.forEach(a => {
      t.append(h('tr', { class: 'abh' }, h('td', { colspan: 4 }, h('b', {}, a.ru), h('small', {}, '  модификатор ' + R.sgn(d.mod[a.k])))));
      t.append(h('tr', { class: 'sv' + (d.saveProf.has(a.k) ? ' prof' : '') }, h('td', {}, d.saveProf.has(a.k) ? '●' : '○'), h('td', {}, 'Спасбросок'), h('td', {}, h('b', {}, R.sgn(d.saves[a.k]))), h('td', {}, d.saveProf.has(a.k) ? 'класс' : '')));
      d.skills.filter(s => s.ab === a.k).forEach(s => {
        const can = ci && ci.pickFrom.includes(s.id), on = (c.skills || []).includes(s.id), bg = d.bgSk.includes(s.id);
        const cb = h('input', { type: 'checkbox', checked: on, disabled: !can || bg && !on, onchange: e => { c.skills = c.skills.filter(x => x !== s.id); if (e.target.checked) c.skills.push(s.id); upd(); } });
        const extra = btn(c.skillsExtra.includes(s.id) ? '✓' : '+', () => { c.skillsExtra = c.skillsExtra.includes(s.id) ? c.skillsExtra.filter(x => x !== s.id) : [...c.skillsExtra, s.id]; upd(); }, 'cb2', 'Владение из другого источника (вид, черта)');
        const ex = btn(s.lev === 2 ? '★' : '☆', () => { c.exp = c.exp.includes(s.id) ? c.exp.filter(x => x !== s.id) : [...c.exp, s.id]; upd(); }, 'cb2', 'Экспертиза: удвоенный бонус мастерства');
        t.append(h('tr', { class: s.lev ? 'prof' : '' }, h('td', {}, can ? h('span', {}, cb, ' ◆') : ''), h('td', {}, s.n), h('td', {}, h('b', {}, R.sgn(s.bonus)), ' ', ex), h('td', {}, s.from.join(', ') || '', ' ', extra)));
      });
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
    const isBook = D.cls.slug === 'wizard', lab = n => n === 0 ? 'Заговоры' : n + (c.ed === 14 ? ' круг' : ' уровень');
    const noLim = !!c.spellsFree, mine = c.spells, bySlug = new Set(mine.map(s => s.slug));
    const cnt = { can: mine.filter(s => s.lvl === 0 && !s.free).length, rest: mine.filter(s => s.lvl > 0 && !s.free).length, prep: mine.filter(s => s.lvl > 0 && s.prep && !s.free).length };
    const lim = { can: sp.cantrips, rest: isBook ? 6 + 2 * (c.lvl - 1) : (sp.known != null ? sp.known : sp.prepared), prep: isBook ? sp.prepared : null };
    const full = k => !noLim && lim[k] != null && cnt[k] >= lim[k];
    const chip = (t, k) => h('span', { class: lim[k] == null ? '' : cnt[k] > lim[k] ? 'over' : cnt[k] === lim[k] ? 'ok' : '' }, t + ': ' + cnt[k] + (lim[k] != null ? ' из ' + lim[k] : ''));
    p.append(h('div', { class: 'spcnt' }, lim.can != null ? chip('Заговоры', 'can') : null, lim.rest != null ? chip(isBook ? 'В книге заклинаний' : sp.known != null ? 'Известно заклинаний' : 'Подготовлено заклинаний', 'rest') : null, isBook && lim.prep != null ? chip('Подготовлено', 'prep') : null),
      h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: noLim, onchange: e => { c.spellsFree = e.target.checked; upd(); } }), ' не ограничивать количество'));
    // выбранные — по кругам
    p.append(h('h3', { class: 'csh' }, 'Ваши заклинания (' + mine.length + ')'));
    if (!mine.length) p.append(h('div', { class: 'none' }, 'Пока ничего не выбрано — найдите заклинания ниже.'));
    for (let l = 0; l <= 9; l++) {
      const g = mine.filter(s => s.lvl === l).sort((x, y) => x.name.localeCompare(y.name, 'ru')); if (!g.length) continue;
      const nf = g.filter(s => !s.free).length;
      p.append(h('h4', { class: 'csh2' }, lab(l) + ' · ' + g.length + (l === 0 && lim.can != null ? ' (по норме ' + nf + '/' + lim.can + ')' : '')));
      const box = h('div', { class: 'cslist' });
      g.forEach(s => {
        const m = D.spells.find(x => x.slug === s.slug);
        const prepCb = isBook && l > 0 ? h('label', { class: 'prep' }, h('input', { type: 'checkbox', checked: !!s.prep, disabled: !s.prep && !s.free && full('prep'), onchange: e => { s.prep = e.target.checked; upd(); } }), ' подготовлено') : null;
        const fr = h('label', { class: 'prep', title: 'Бонусное заклинание (от подкласса, вида, черты): не считается в лимит' }, h('input', { type: 'checkbox', checked: !!s.free, onchange: e => { s.free = e.target.checked; upd(); } }), ' бонус');
        box.append(h('div', { class: 'csrow' + (s.prep ? ' prepd' : '') }, h('b', {}, m ? link(c.ed, 'spells', m, s.name) : s.name), h('small', {}, m ? [m.school, m.concentration ? 'К' : '', m.ritual ? 'Р' : ''].filter(Boolean).join(' · ') : ''), prepCb, fr, btn('×', () => { c.spells = c.spells.filter(x => x.slug !== s.slug); upd(); }, 'xx', 'Убрать')));
      });
      p.append(box);
    }
    // каталог
    const maxL = Math.max(sp.maxLevel, 0), all = c.spellsAll;
    p.append(h('h3', { class: 'csh' }, 'Добавить заклинание'),
      h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: all, onchange: e => { c.spellsAll = e.target.checked; upd(); } }), ' показать заклинания всех классов (такие добавляются как «бонус»)'));
    let lvlF = UI.spL;
    const cat = D.spells.filter(s => (all || s.classes.some(x => x.slug === D.cls.slug)) && s.level <= maxL && !bySlug.has(s.slug)).sort((x, y) => x.level - y.level || x.name_ru.localeCompare(y.name_ru, 'ru'));
    const fl = h('div', { class: 'seg csmeth wrapseg' }, ['all', ...Array.from({ length: maxL + 1 }, (_, i) => i)].map(v => btn(v === 'all' ? 'Все' : v === 0 ? 'Заговоры' : v + (c.ed === 14 ? ' круг' : ' ур.'), () => { lvlF = UI.spL = v; redraw(); }, '')));
    const box = h('div'); p.append(fl, box);
    function redraw() {
      fl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('act', (i === 0 ? 'all' : i - 1) === lvlF));
      box.textContent = '';
      const items = cat.filter(s => lvlF === 'all' || s.level === lvlF);
      box.append(searchBox(items, s => {
        const foreign = !s.classes.some(x => x.slug === D.cls.slug), k = s.level === 0 ? 'can' : 'rest', blocked = !foreign && full(k);
        return h('div', { class: 'csrow' }, h('b', {}, link(c.ed, 'spells', s)), h('small', {}, (s.level ? s.level + ' ур. ' : 'заговор ') + (s.school || '') + (s.concentration ? ' · К' : '') + (s.ritual ? ' · Р' : '')),
          h('button', { type: 'button', class: 'dmbtn', disabled: blocked, title: blocked ? 'Лимит исчерпан — уберите другое заклинание' : '', onclick: () => c.spells.push({ slug: s.slug, name: s.name_ru, lvl: s.level, prep: !isBook && s.level > 0, free: foreign }) && upd() }, blocked ? 'лимит' : '+ Добавить'));
      }, { ph: 'Поиск заклинания по названию…', max: 60, q: UI.spQ, onq: v => { UI.spQ = v; } }));
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
  // бонус атаки и модификатор урона: один расчёт для вкладки «Снаряжение» и печатного листа
  function attackOf(i, g, wi, d) {
    const auto = wi.ranged ? 'dex' : (wi.fin ? (d.mod.dex > d.mod.str ? 'dex' : 'str') : 'str'), ab = i.ab || auto;
    const prof = i.prof != null ? !!i.prof : R.weaponProf(d.ci ? d.ci.weapons : '', g);
    return { ab, prof, atk: d.mod[ab] + (prof ? d.pb : 0), dm: d.mod[ab] };
  }
  async function tabGear(p, c, D, d) {
    p.append(h('h3', { class: 'csh' }, 'Монеты'), h('div', { class: 'coins' }, COINS.map(([k, t]) => field(t, numIn(c.coins[k], v => { c.coins[k] = Math.max(0, v); upd(false); }, { min: 0, class: 'num' })))));
    // стартовое снаряжение
    const kits = d.ci ? d.ci.kit : '';
    const opts = parseKit(kits);
    const bgKit = D.bg && typeof D.bg.equipment === 'string' ? parseKit(D.bg.equipment) : null;
    if (opts || bgKit || kits) {
      p.append(h('h3', { class: 'csh' }, 'Стартовое снаряжение'), h('p', { class: 'mhint' }, 'Выберите вариант — предметы и монеты добавятся один раз; другой вариант заменит прежний. Стартовое снаряжение деньги не списывает.'));
      const kitRow = (lbl, os, src) => h('div', { class: 'kit' }, h('b', {}, lbl), os.map(o => btn((c.kit[src] === o.k ? '✓ ' : '') + 'Вариант ' + o.k, () => { if (c.kit[src] === o.k) { root.DM.toast('Этот вариант уже применён'); return; } addKit(c, D, o, src); }, 'dmbtn' + (c.kit[src] === o.k ? ' act' : ''), o.txt)), c.kit[src] ? btn('Убрать комплект', () => { removeKit(c, src); upd(); }, 'dmbtn', 'Удалит предметы и монеты этого комплекта') : null);
      if (opts) p.append(kitRow('Класс: ', opts, 'cls'));
      else if (kits) p.append(html('<p class="mhint">' + esc(kits).replace(/\n/g, '<br>') + '</p>'));
      if (bgKit) p.append(kitRow('Предыстория: ', bgKit, 'bg'));
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
        const a = attackOf(i, g, wi, d), dm = a.dm;
        info = 'атака ' + R.sgn(a.atk) + ', урон ' + wi.dice + (dm ? (dm > 0 ? '+' : '−') + Math.abs(dm) : '') + ' ' + wi.type;
      } else if (g && /доспех|щит/i.test(g.line || '')) { const q = (g.props || []).find(x => /класс защиты/i.test(x.label)); info = q ? 'КД ' + q.value : (g.slug === 'shield' ? '+2 к КД' : ''); }
      t.append(h('tr', {}, h('td', {}, h('input', { type: 'checkbox', checked: !!i.eq, title: 'Надето / в руках', onchange: e => { i.eq = e.target.checked; upd(); } })),
        h('td', {}, g ? link(24, 'equipment', g, i.n) : i.n), h('td', {}, numIn(i.q, v => { i.q = Math.max(1, v); upd(); }, { min: 1, class: 'num' })), h('td', {}, w ? w + ' фнт.' : '—'), h('td', {}, info),
        h('td', {}, btn('×', () => { const back = i.spent || 0; if (back) giveCu(c, back); c.inv.splice(idx, 1); upd(); if (back) root.DM.toast('Возвращено: ' + fmtCu(back)); }, 'xx', i.spent ? 'Убрать предмет: потраченные деньги вернутся' : 'Убрать предмет'))));
    });
    if (!c.inv.length) t.append(h('tr', {}, h('td', { colspan: 6, class: 'none' }, 'Пусто. Добавьте предметы ниже.')));
    p.append(t);
    const cap = d.score.str * 15;
    p.append(h('p', { class: 'mhint' }, 'Вес снаряжения: ' + (Math.round(weight * 10) / 10) + ' фнт. Грузоподъёмность: ' + cap + ' фнт. ' + (weight > cap ? '— перегруз!' : '')),
      h('div', { class: 'csgrid' }, field('Бонус к КД (магия и т. п.)', numIn(c.acBonus, v => { c.acBonus = v; upd(); })), field('КД', h('span', {}, h('b', {}, d.ac), ' (' + d.acWhy + ')'))));
    const freeIn = textIn('', v => { }, { placeholder: 'Свободная запись: «Верёвка пеньковая»…' });
    p.append(h('div', { class: 'row' }, freeIn, btn('Добавить запись', () => { const v = freeIn.value.trim(); if (v) { c.inv.push({ n: v, slug: '', q: 1, eq: false }); upd(); } }, 'dmbtn')));
    const chips = h('div', { class: 'seg csmeth wrapseg' }, GCAT.map(([k, t]) => btn(t, () => { UI.gearCat = k; upd(); }, (UI.gearCat || '') === k ? 'act' : '')));
    p.append(h('h4', { class: 'csh2' }, 'Каталог снаряжения · у вас ' + fmtCu(wallet(c))), h('p', { class: 'mhint' }, 'Собирайте снаряжение сами: «Купить» списывает деньги, «Взять» — бесплатно. Если убрать купленный предмет, деньги вернутся.'), chips, searchBox(D.gear.filter(g => !UI.gearCat || gearCatOf(g) === UI.gearCat), g => { const wi = weaponInfo(g), cu = costCu(g); return h('div', { class: 'csrow' }, h('b', {}, g.name_ru), h('small', {}, (g.line || '') + (wi ? ' · ' + wi.dice + ' ' + wi.type : '') + ' · ' + (g.cost || '')),
      h('button', { type: 'button', class: 'dmbtn', disabled: cu > wallet(c), title: cu > wallet(c) ? 'Не хватает денег' : 'Купить: деньги спишутся', onclick: () => buy(c, g) }, cu ? 'Купить' : '+'),
      cu ? h('button', { type: 'button', class: 'dmbtn', title: 'Взять бесплатно, без списания денег', onclick: () => buy(c, g, true) }, 'Взять') : null); }, { ph: 'Поиск предмета: меч, верёвка, щит…', max: 120, q: UI.gearQ, onq: v => { UI.gearQ = v; } }));
  }
  const GCAT = [['', 'Всё'], ['weapon', 'Оружие'], ['armor', 'Доспехи и щиты'], ['tool', 'Инструменты'], ['pack', 'Наборы'], ['gear', 'Прочее снаряжение']];
  const gearCatOf = g => { const l = g.line || ''; return /оружие|боеприпас/i.test(l) ? 'weapon' : /доспех|щит/i.test(l) ? 'armor' : /нструмент/i.test(l) ? 'tool' : /набор/i.test(l) ? 'pack' : 'gear'; };
  function parseKit(txt) {
    if (!txt) return null;
    const m = [...String(txt).matchAll(/\(([А-ЯA-Z])\)\s*([^;]*?)(?=;?\s*(?:или\s*)?\([А-ЯA-Z]\)|$)/gs)];
    return m.length ? m.map(x => ({ k: x[1], txt: x[2].replace(/^[\s;]+|[\s;.]+$/g, '').replace(/^или\s*/i, '') })) : null;
  }
  const DEN = [['mm', 1], ['sm', 10], ['em', 50], ['zm', 100], ['pm', 1000]];
  const wallet = c => DEN.reduce((q, [k, v]) => q + (c.coins[k] || 0) * v, 0);
  const costCu = g => { const n = g && g.cost_gp != null ? parseFloat(String(g.cost_gp).replace(',', '.')) : 0; return isNaN(n) ? 0 : Math.round(n * 100); };
  const fmtCu = n => { const z = Math.floor(n / 100), sm = Math.floor(n % 100 / 10), m = n % 10; return [z && z + ' ЗМ', sm && sm + ' СМ', m && m + ' ММ'].filter(Boolean).join(' ') || '0'; };
  function giveCu(c, n) { c.coins.zm += Math.floor(n / 100); c.coins.sm += Math.floor(n % 100 / 10); c.coins.mm += n % 10; }
  function pay(c, cu) {
    if (wallet(c) < cu) return false;
    let need = cu;
    for (const [k, v] of DEN) { if (need <= 0) break; const take = Math.min(c.coins[k] || 0, Math.ceil(need / v)); c.coins[k] -= take; need -= take * v; }
    if (need < 0) giveCu(c, -need);
    return true;
  }
  function buy(c, g, free) {
    const cu = free ? 0 : costCu(g);
    if (cu && !pay(c, cu)) { root.DM.toast('Не хватает денег: нужно ' + fmtCu(cu) + ', у вас ' + fmtCu(wallet(c))); return; }
    const ex = c.inv.find(x => x.slug === g.slug && !x.kit);
    if (ex) { ex.q++; ex.spent = (ex.spent || 0) + cu; } else c.inv.push({ n: g.name_ru, slug: g.slug, q: 1, eq: false, spent: cu });
    upd(); if (cu) root.DM.toast('Куплено: ' + g.name_ru + ' (−' + fmtCu(cu) + ')');
  }
  function removeKit(c, src) {
    c.inv = c.inv.filter(i => i.kit !== src);
    const kc = (c.kitCoins || {})[src] || {}; Object.keys(kc).forEach(k => { c.coins[k] = Math.max(0, (c.coins[k] || 0) - kc[k]); });
    c.kitCoins[src] = {}; delete c.kit[src];
  }
  // в данных встречаются латинские двойники кириллических букв («Cтрел»)
  const LAT = { C: 'С', c: 'с', A: 'А', a: 'а', E: 'Е', e: 'е', O: 'О', o: 'о', P: 'Р', p: 'р', X: 'Х', x: 'х', T: 'Т', K: 'К', M: 'М', H: 'Н', B: 'В' };
  const fixLat = s => String(s).replace(/[A-Za-z]/g, ch => LAT[ch] || ch);
  // основа слова без падежного окончания: «Кинжалов» ≈ «Кинжал», «Одноручных топора» ≈ «Одноручный топор»
  const wstems = R.wstems;
  const GEAR_ALIAS = { 'кольчуга': 'Кольчужный доспех' };              // в справочнике доспех называется иначе
  // предмет из текста набора → запись справочника (точное имя, псевдоним, затем совпадение по основам; неоднозначное — не берём)
  function findGear(gear, name) {
    const n = R.lc(name), exact = gear.find(x => R.lc(x.name_ru) === n);
    if (exact) return exact;
    if (GEAR_ALIAS[n]) return gear.find(x => x.name_ru === GEAR_ALIAS[n]) || null;
    const key = wstems(name), hit = gear.filter(x => wstems(x.name_ru) === key);
    return hit.length === 1 ? hit[0] : null;
  }
  // «Набор учёного и 5 ЗМ» — это предмет и монеты: делим на две части
  const splitCoin = p => { const m = p.match(/^(.+?)\s+и\s+(\d+\s*(?:ЗМ|СМ|ММ|ЭМ|ПМ))$/i); return m ? [m[1], m[2]] : [p]; };
  function addKit(c, D, o, src) {
    removeKit(c, src);
    const parts = fixLat(o.txt).split(/,\s*(?![^()]*\))/).map(s => s.trim().replace(/^и\s+/i, '')).filter(Boolean).flatMap(splitCoin), miss = [], got = {};
    parts.forEach(p => {
      const coin = p.match(/^(\d+)\s*(ЗМ|СМ|ММ|ЭМ|ПМ)$/i);
      if (coin) { const k = { зм: 'zm', см: 'sm', мм: 'mm', эм: 'em', пм: 'pm' }[coin[2].toLowerCase()]; c.coins[k] += +coin[1]; got[k] = (got[k] || 0) + +coin[1]; return; }
      const q = p.match(/^(\d+)\s+(.*)$/), name = (q ? q[2] : p).replace(/\s*\(.*\)\s*$/, ''), qty = q ? +q[1] : 1;
      const g = findGear(D.gear, name);
      if (g) { const ex = c.inv.find(x => x.slug === g.slug && x.kit === src); if (ex) ex.q += qty; else c.inv.push({ n: g.name_ru, slug: g.slug, q: qty, eq: false, kit: src }); } else miss.push(p);
    });
    miss.forEach(m => c.inv.push({ n: m, slug: '', q: 1, eq: false, kit: src }));
    c.kit[src] = o.k; c.kitCoins[src] = got;
    upd(); root.DM.toast('Комплект «' + o.k + '» применён' + (miss.length ? ' (без записи в справочнике: ' + miss.length + ')' : ''));
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
    p.querySelector('.sheetbar').append(field('Описания умений', sel([['none', 'Нет'], ['short', 'Кратко'], ['full', 'Полностью']], c.featTxt, v => { c.featTxt = v; upd(); })));
    const sh = h('div', { class: 'csheet' }); p.append(sh);
    const t = (tag, cls, ...k) => h(tag, { class: cls }, ...k);
    const box = (title, ...k) => h('div', { class: 'pbox' }, h('div', { class: 'ptt' }, title), ...k);
    // страница 1
    const p1 = t('section', 'pg p1');
    p1.append(h('div', { class: 'phead' }, h('div', { class: 'pname' }, c.name || ' ', h('small', {}, 'Имя персонажа')),
      h('div', { class: 'pmeta' }, [[D.cls ? D.cls.name_ru : '', 'Класс'], [D.sub ? D.sub.name : '', 'Подкласс'], [D.sp ? D.sp.name_ru : '', 'Вид'], [D.bg ? D.bg.name_ru : '', 'Предыстория'], [c.align, 'Мировоззрение']].map(([v, l]) => h('div', {}, h('b', {}, v || ' '), h('small', {}, l)))),
      h('div', { class: 'plvl' }, h('b', {}, c.lvl), h('small', {}, 'Уровень')), h('div', { class: 'plvl' }, h('b', {}, ' '), h('small', {}, 'Опыт'))));
    const left = t('div', 'pcol');
    left.append(h('div', { class: 'pbox pinsp' }, h('i', { class: 'dot big' }), h('b', {}, c.ed === 24 ? 'Героическое вдохновение' : 'Вдохновение')));
    R.AB.forEach(a => {
      const blk = h('div', { class: 'pabx' }, h('div', { class: 'pah' }, h('span', { class: 'pan' }, a.ru), h('b', { class: 'pam' }, R.sgn(d.mod[a.k])), h('span', { class: 'pas' }, d.score[a.k])),
        h('div', { class: 'prow sv' }, h('i', { class: d.saveProf.has(a.k) ? 'dot on' : 'dot' }), h('b', {}, R.sgn(d.saves[a.k])), ' Спасбросок'));
      d.skills.filter(x => x.ab === a.k).forEach(x => blk.append(h('div', { class: 'prow' }, h('i', { class: x.lev ? 'dot on' + (x.lev === 2 ? ' ex' : '') : 'dot' }), h('b', {}, R.sgn(x.bonus)), ' ' + x.n)));
      left.append(blk);
    });
    left.append(h('div', { class: 'pnote' }, '● — владение, ◎ — экспертиза'));
    const pas = id => 10 + d.skills.find(x => x.id === id).bonus, lcA = R.lc(d.ci ? d.ci.armor : '');
    const tile = (l, v) => h('div', {}, h('b', {}, v), h('small', {}, l));
    const dots = n => h('span', { class: 'dots' }, Array.from({ length: n }, () => h('i', { class: 'dot' })));
    const tools = [d.ci && d.ci.tools, D.bg && D.bg.tools, c.story.tools].filter(x => x && !/^нет$/i.test(String(x).trim())).join('; ');
    const feat = featureList(c, D, d);
    const mainA = t('div', 'pcol'), mainB = t('div', 'pcol');
    mainA.append(box('Атаки и заклинания', ...attacksRows(c, D, d)),
      box('Владения', h('div', { class: 'parm' }, ['Лёгкие', 'Средние', 'Тяжёлые', 'Щиты'].map((x, i) => h('span', {}, h('i', { class: (i < 3 ? lcA.includes(['легк', 'средн', 'тяжел'][i]) : lcA.includes('щит')) ? 'dot on' : 'dot' }), ' ' + x))),
        h('div', { class: 'ptxt' }, [d.ci && d.ci.weapons && 'Оружие: ' + d.ci.weapons, tools && 'Инструменты: ' + tools, c.story.langs && 'Языки: ' + c.story.langs].filter(Boolean).join('\n'))));
    mainB.append(...[box('Умения и особенности', h('div', { class: 'ptxt feats' }, feat.filter(f => f.src !== 'Черты').map(f => h('div', {}, h('b', {}, f.name), h('small', {}, ' ' + f.src.replace(/^[^:]+: /, '') + (f.level ? ', ' + f.level + ' ур.' : '')))))),
      box('Черты', h('div', { class: 'ptxt feats' }, feat.filter(f => f.src === 'Черты' || /^Предыстория/.test(f.src)).map(f => h('div', {}, h('b', {}, f.name))))),
      c.ed === 14 ? box('Личность', h('div', { class: 'ptxt' }, [c.story.traits && 'Черты: ' + c.story.traits, c.story.ideals && 'Идеалы: ' + c.story.ideals, c.story.bonds && 'Привязанности: ' + c.story.bonds, c.story.flaws && 'Слабости: ' + c.story.flaws].filter(Boolean).join('\n') || ' ')) : null].filter(Boolean));
    const right = t('div', 'pcol',
      h('div', { class: 'pstats' }, [tile('Класс доспеха', d.ac), tile('Инициатива', R.sgn(d.init)), tile('Скорость', d.speed + ' фт.'), tile('Бонус мастерства', R.sgn(d.pb)), tile('Пассивное Восприятие', pas('perception')), tile('Пассивная Проницательность', pas('insight'))]),
      h('div', { class: 'pcols two' }, box('Хиты', h('div', { class: 'phps' }, h('div', {}, h('b', {}, d.hp), h('small', {}, 'Максимум')), h('div', {}, h('b', {}, ' '), h('small', {}, 'Текущие')), h('div', {}, h('b', {}, ' '), h('small', {}, 'Временные')))),
        box('Кость хитов и смерть', h('div', { class: 'phd' }, h('b', {}, c.lvl + 'к' + d.die), h('small', {}, ' всего; потрачено: ____')), h('div', { class: 'pdeath' }, h('span', {}, 'Успехи ', dots(3)), h('span', {}, 'Провалы ', dots(3))))),
      h('div', { class: 'pcols two' }, mainA, mainB));
    p1.append(t('div', 'pcols', left, right)); sh.append(p1);
    // страница: умения и особенности (текст)
    if (c.featTxt !== 'none') {
      const p1b = t('section', 'pg'); p1b.append(h('div', { class: 'phead' }, h('div', { class: 'pname' }, 'Умения и особенности', h('small', {}, c.name || ''))));
      const cols = t('div', 'pfeat');
      feat.forEach(f => {
        const body = h('div', { class: 'ft' }); body.innerHTML = (f.blocks ? DB().B(f.blocks) : esc(f.text || '')).replace(/<\/(p|li|div|h\d)>/g, '$& ');
        if (c.featTxt !== 'full') { const tx = body.textContent.replace(/\s+/g, ' ').trim(); body.textContent = tx.length > 260 ? tx.slice(0, 260).replace(/\s\S*$/, '') + '…' : tx; }
        cols.append(h('div', { class: 'pfi' }, h('b', {}, f.name), h('small', {}, ' ' + f.src + (f.level ? ', ' + f.level + ' ур.' : '')), body));
      });
      p1b.append(cols); sh.append(p1b);
    }
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
      const a = attackOf(i, g, wi, d), dm = a.dm;
      rows.push(h('div', { class: 'prow atk' }, h('b', {}, g.name_ru), h('span', {}, R.sgn(a.atk)), h('span', {}, wi.dice + (dm ? (dm > 0 ? '+' : '−') + Math.abs(dm) : '') + ' ' + wi.type)));
    });
    if (d.sp.has) rows.push(h('div', { class: 'prow atk' }, h('b', {}, 'Заклинание'), h('span', {}, R.sgn(d.sp.atk)), h('span', {}, 'Сл ' + d.sp.dc)));
    while (rows.length < 4) rows.push(h('div', { class: 'prow atk' }, ' '));
    return rows;
  }

  root.CS = { show, render, load, cur };
})(window);
