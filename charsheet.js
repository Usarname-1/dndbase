/* ===== Листы персонажей: конструктор и печать =====
   Расчёты — в charrules.js (CSR). Здесь: хранение, вкладки-шаги, лист для печати.
   Данные берутся через window.DB (index.html). */
(function (root) {
  'use strict';
  const R = root.CSR, h = root.DM.h, DB = () => root.DB;
  const KEY = 'dm.chars.v1';
  const UI = { spQ: '', spL: 'all', gearQ: '', ftQ: '' };
  let S = null, host = null, tabId = 'base', dataCache = {}, scrollKeep = 0;
  const TABS = [['base', 'Основа', 1], ['abil', 'Характеристики и навыки', 2], ['skills', 'Умения', 3], ['spells', 'Заклинания', 4], ['gear', 'Снаряжение', 5], ['forms', 'Облики зверей'], ['story', 'Описание'], ['sheet', 'Лист / печать']];
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
      const [classes, species, bgs, feats, spells, items] = await Promise.all([g('class'), g(ed === 14 ? 'race' : 'species'), g('backgrounds'), g('feats'), g('spells'), g('items')]);
      const gear = await g('equipment', ed), gear24 = ed === 24 ? gear : await g('equipment', 24);
      dataCache[key] = { classes: classes.filter(x => !/sidekick/.test(x.slug)), species, bgs: bgs.filter(b => !/^adaptaciia-predystorii/.test(b.slug)), feats, spells, gear, items, itemsBySlug: Object.fromEntries(items.map(x => [x.slug, x])), gearBySlug: Object.assign(Object.fromEntries(gear24.map(x => [x.slug, x])), Object.fromEntries(gear.map(x => [x.slug, x]))) };
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
  // список с поиском; items — массив, render(item) → узел; opt.max — сколько строк за раз; opt.key — чтобы раскрытый список
  // не сворачивался после «+ Добавить» (экран перерисовывается целиком)
  function searchBox(items, render, opt) {
    opt = opt || {};
    const step = opt.max || 80, more = UI.more = UI.more || {};
    let extra = opt.key ? more[opt.key] || 0 : 0;
    const q = h('input', { type: 'text', placeholder: opt.ph || 'Поиск…', autocomplete: 'off', value: opt.q || '' }), list = h('div', { class: 'cslist' });
    const draw = () => {
      const v = DB().norm(q.value.trim()); list.textContent = '';
      const all = items.filter(i => !v || DB().norm(i.name_ru + ' ' + (i.name_en || '')).includes(v)), hit = all.slice(0, step + extra);
      if (!hit.length) list.append(h('div', { class: 'none' }, 'Ничего не найдено'));
      hit.forEach(i => list.append(render(i)));
      // хвост длинного списка не должен пропадать молча (раньше зверей с большим ОП и последние заклинания было видно только через поиск)
      if (all.length > hit.length) list.append(h('div', { class: 'csmore' }, h('small', {}, 'Показано ' + hit.length + ' из ' + all.length),
        btn('Показать ещё ' + Math.min(step, all.length - hit.length), () => { extra += step; if (opt.key) more[opt.key] = extra; draw(); }, 'dmbtn')));
    };
    q.addEventListener('input', () => { extra = 0; if (opt.key) delete more[opt.key]; if (opt.onq) opt.onq(q.value); draw(); }); draw();
    return h('div', { class: 'cssb' }, q, list);
  }
  const link = (ed, sec, m, txt) => h('a', { href: DB().hh(ed, sec, m.slug), target: '_blank', rel: 'noopener', title: 'Открыть карточку в новой вкладке' }, txt || m.name_ru);

  /* ---------- общий каркас ---------- */
  // значение в плитке сводки не должно вылезать за рамку: длинное слово («Маленький», «Громадный») уменьшаем, пока не поместится
  function fitTiles(root) {
    root.querySelectorAll('.cstat b').forEach(b => {
      b.style.fontSize = '';
      let fs = parseFloat(getComputedStyle(b).fontSize) || 16;
      while (b.scrollWidth > b.clientWidth && fs > 9) { fs -= 0.5; b.style.fontSize = fs + 'px'; }
    });
  }
  function build() {
    host = document.getElementById('cs'); load();
    host.textContent = '';
    host.append(h('div', { class: 'csbar' }), h('div', { class: 'csbody' }));
    // ширина плиток зависит от окна и от шрифта (он может подгрузиться уже после первой отрисовки)
    let tm = 0; const refit = () => { clearTimeout(tm); tm = setTimeout(() => fitTiles(host), 80); };
    window.addEventListener('resize', refit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  }
  async function show() {
    if (!host) build();
    await render();
  }
  let renderSeq = 0;
  async function render(keepScroll) {
    const seq = ++renderSeq, main = document.querySelector('main'), top = keepScroll ? main.scrollTop : 0;
    const bar = host.querySelector('.csbar'), body = host.querySelector('.csbody');
    renderBar(bar);
    const c = cur();
    body.textContent = '';
    if (!c) { body.append(welcome()); return; }
    if (c.psv !== 2) { c.printSpells = true; c.psv = 2; }   // описания заклинаний на печатном листе — по умолчанию
    c.feats = c.feats || []; c.picks = c.picks || {}; ['mastery', 'metamagic', 'invocations'].forEach(k => { if (!Array.isArray(c.picks[k])) c.picks[k] = []; }); c.picks.style = c.picks.style || ''; c.kit = c.kit || {}; c.kitSel = c.kitSel || {}; c.kitCoins = c.kitCoins || {}; c.featTxt = c.featTxt || 'short'; c.bonus = c.bonus || {}; c.fxOff = c.fxOff || {};
    const D = await loadData(c), d = R.derive(c, D), t = todo(c, D, d);
    // максимум хитов изменился (уровень, Телосложение, вручную…): текущие хиты растут на столько же, а выше нового максимума не остаются
    if (D.cls && c.hpCur != null) {
      const was = c.hpPrev, now = d.hp, cur = was != null && was !== now && now > was ? c.hpCur + now - was : c.hpCur;
      const fixed = Math.max(0, Math.min(cur, now)); if (fixed !== c.hpCur) { c.hpCur = fixed; save(); }
    }
    if (D.cls && c.hpPrev !== d.hp) { c.hpPrev = d.hp; save(); }
    if (seq !== renderSeq) return;   // пока грузились данные, началась более свежая отрисовка: иначе на экране окажется две сводки подряд
    renderBar(bar);   // повторно: теперь данные загружены, и в списке персонажей будет название класса, а не его код
    body.append(h('div', { class: 'csside' }, summary(c, D, d, t), tabsBar(c, D, d, t), todoCard(t)));   // слева (на узком экране — сверху): сводка, шаги, что осталось
    fitTiles(body);
    const pane = h('div', { class: 'cspane t-' + tabId }); body.append(pane);
    const tb = body.querySelector('.cstabs'), on = tb && tb.querySelector('.act');   // активная вкладка — в центр полосы (на узких экранах)
    if (on) tb.scrollLeft = on.offsetLeft - (tb.clientWidth - on.offsetWidth) / 2;
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
    const has = s.list.length > 0;
    bar.append(...[has ? picker : h('b', {}, 'Листы персонажей'), h('span', { class: 'dmsp' }),
      btn('+ Новый', () => newDialog(), 'dmbtn pri', 'Создать персонажа'),
      has && btn('Копия', dup, 'dmbtn', 'Дублировать выбранного'),
      has && btn('Удалить', del, 'dmbtn danger', 'Удалить выбранного персонажа'),
      has && btn('Экспорт', exportJson, 'dmbtn', 'Сохранить всех персонажей в файл'),
      btn('Импорт', () => file.click(), 'dmbtn', 'Загрузить из файла'), file].filter(Boolean));
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
    const opt = (ed, title, sub) => h('button', { type: 'button', class: 'csopt', onclick: () => mk(ed) }, h('strong', {}, title), h('span', {}, sub));
    const ov = h('div', { class: 'dmmodal csmodal', onclick: e => { if (e.target === ov) ov.remove(); } },
      h('div', { class: 'dmdlg' }, h('h3', {}, 'Новый персонаж'), h('p', { class: 'mhint' }, 'Какими правилами пользуетесь? Это нельзя изменить позже — но можно создать второго персонажа.'),
        h('div', { class: 'csopts' },
          opt(24, 'D&D 2024', 'Новая редакция: классы, виды и предыстории из PHB 2024'),
          opt(14, 'D&D 2014', 'Классическая 5e: расы и подрасы, предыстории из PHB 2014')),
        h('div', { class: 'mbtn' }, btn('Отмена', () => ov.remove()))));
    const mk = ed => { const c = R.newChar(ed); S.list.push(c); S.cur = c.id; tabId = 'base'; save(); ov.remove(); render(); };
    document.body.append(ov);
  }
  function welcome() {
    const step = (t, s) => h('div', {}, h('b', {}, t), s);
    return h('div', { class: 'cswel' }, h('h2', {}, 'Листы персонажей'), h('div', { class: 'rule' }),
      h('p', {}, 'Выберите класс, уровень, вид и предысторию — бонус мастерства, хиты, спасброски, навыки, ячейки заклинаний и умения подставятся сами.'),
      h('div', { class: 'cssteps' }, step('1. Соберите', 'класс, вид, предыстория, характеристики'), step('2. Дополните', 'заклинания, снаряжение, описание'), step('3. Распечатайте', 'лист A4 или сохраните в PDF')),
      btn('Создать персонажа', newDialog, 'dmbtn pri'));
  }

  /* ---------- сводка и чек-лист ---------- */
  function todo(c, D, d) {
    const t = [], ci = d.ci;
    { const sch = D.sp && R.speciesChoice(D.sp); if (sch && !sch.optional && !c.spOpt) t.push(['base', 'Выберите: ' + sch.label.toLowerCase() + ' (вид)']); }
    if (!c.cls) t.push(['base', 'Выберите класс']);
    else {
      if (D.cls && c.lvl >= subLevel(D.cls) && !c.sub && (D.cls.subclasses || []).length) t.push(['base', 'Выберите подкласс']);
      const bgIds = d.bgChoice ? d.bgChoice.from : [], n = new Set([...(c.skills || []), ...(c.skillsExtra || []).filter(id => !bgIds.includes(id))]).size, allow = ci ? ci.pickN + d.extraN : 0;
      if (ci && n < ci.pickN) t.push(['abil', 'Навыки класса: выбрано ' + n + ' из ' + ci.pickN]);
      if (ci && n > allow) t.push(['abil', 'Навыков больше, чем положено (' + n + ' из ' + allow + (d.extraN ? ': класс ' + ci.pickN + ' + черты и вид ' + d.extraN : '') + ')']);
    }
    if (d.bgChoice && d.bgChoice.got < d.bgChoice.n) t.push(['abil', 'Навыки предыстории: выберите ' + d.bgChoice.n + ' из ' + bgChoiceNames(d) + ' (кнопка «+» у навыка)']);
    (d.picks || []).forEach(pk => { if (pk.kind === 'text') return; if (pk.chosen.length < pk.n) t.push(['skills', pk.label + ': выбрано ' + pk.chosen.length + ' из ' + pk.n]); });
    if (!c.sp) t.push(['base', 'Выберите вид']);
    if (!c.bg) t.push(['base', 'Выберите предысторию']);
    if (d.bgFeat && d.bgFeat.required && !d.bgFeat.feat) t.push(['base', 'Выберите черту Тёмного дара (предыстория)']);
    if (c.ed === 24 && D.bg && c.bg2.m === '21' && (!c.bg2.a || !c.bg2.b || c.bg2.a === c.bg2.b)) t.push(['abil', 'Распределите бонусы предыстории (+2 и +1)']);
    R.asiLevels(D.cls).filter(l => l <= c.lvl).forEach(l => {
      const ep = c.ed === 24 && l === R.epicLevel(D.cls), x = c.asi[l];
      if (!x || ((x.m === 'feat' || ep) && !x.feat) || (!ep && x.m === '2' && !x.a) || (!ep && x.m === '11' && (!x.a || !x.b || x.a === x.b))) { t.push(['abil', (ep ? 'Дар эпического героя на ' : 'Увеличение характеристик на ') + l + ' уровне']); return; }
      if (x.m === 'feat' || ep) { const f = D.feats.find(y => y.slug === x.feat), fa = R.featAbility(f); if (fa && !fa.opts.includes(x.fa)) t.push(['abil', 'Черта «' + f.name_ru + '» (' + l + ' ур.): выберите, какую характеристику увеличить на 1']); }
    });
    if (d.expN > d.expUsed) t.push(['abil', 'Экспертность: отмечено ' + d.expUsed + ' из ' + d.expN + ' (★ у навыка, которым вы владеете)']);
    if (d.sp.has && d.sp.cantrips != null) {
      const cn = c.spells.filter(s => s.lvl === 0 && !s.free).length;
      if (cn < d.sp.cantrips) t.push(['spells', 'Заговоры: ' + cn + ' из ' + d.sp.cantrips]);
      else if (cn > d.sp.cantrips) t.push(['spells', 'Заговоров больше нормы: ' + cn + '/' + d.sp.cantrips]);
    }
    if (d.sp.has && d.sp.prepared != null) {
      const pn = c.spells.filter(s => s.lvl > 0 && s.prep && !s.free && !(d.sp.arcanum && d.sp.arcanum.length && s.lvl >= 6)).length;
      if (pn < d.sp.prepared) t.push(['spells', 'Подготовлено заклинаний: ' + pn + ' из ' + d.sp.prepared]);
      else if (pn > d.sp.prepared) t.push(['spells', 'Подготовлено больше нормы: ' + pn + '/' + d.sp.prepared]);
    }
    { const auto = d.hpAuto ? d.hpFx.reduce((q, e) => q + e.v, 0) : 0;   // та же прибавка, вписанная вручную, посчитается дважды
      if (auto > 0 && c.hpBonus === auto) t.push(['story', 'Прибавка к хитам +' + auto + ' уже считается сама (' + d.hpFx.map(e => e.why).join(', ') + ') — уберите её из поля «Прибавка»']); }
    if (d.ws && c.forms.length < Math.min(d.ws.known, 99)) t.push(['forms', 'Облики зверей: ' + c.forms.length + ' из ' + d.ws.known]);
    return t;
  }
  const bgChoiceNames = d => d.bgChoice.from.map(id => d.skills.find(s => s.id === id).n).join(', ');
  const subLevel = cls => { const f = (cls.features || []).find(x => /подкласс/i.test(x.name) && x.level); return f ? f.level : 3; };
  const TAB_SHORT = { base: 'Основа', abil: 'Характеристики', skills: 'Умения', spells: 'Заклинания', gear: 'Снаряжение', forms: 'Облики', story: 'Описание', sheet: 'Лист' };
  // сводка — «статблок игрока»: имя, строка-описание, главные числа и шесть характеристик; всегда на виду, пока правите любую вкладку
  function summary(c, D, d, t) {
    const stat = (l, v, tip, key, more) => h('div', { class: 'cstat' + (key ? ' key' : '') + (String(v).length > 6 ? ' sm' : '') + (more ? ' ' + more : ''), title: tip || '' }, h('small', {}, l), h('b', {}, v));
    const sub = [(D.cls ? D.cls.name_ru + (D.sub ? ' (' + D.sub.name + ')' : '') + ' ' : '') + c.lvl + ' ур.', D.sp && D.sp.name_ru, D.bg && D.bg.name_ru, c.align].filter(Boolean);
    const abil = h('div', { class: 'csab' }, R.AB.map(a => h('div', { class: 'cab', title: a.ru + ': ' + d.score[a.k] + ' (' + R.sgn(d.mod[a.k]) + ')' }, h('small', {}, a.s), h('b', {}, R.sgn(d.mod[a.k])), h('i', {}, d.score[a.k]))));
    const hpTip = 'Максимум хитов' + (d.hpAuto && d.hpFx.length ? ' (умения уже добавили: ' + d.hpFx.map(e => e.why + ' ' + R.sgn(e.v)).join(', ') + ')' : ''),
      spdTip = d.speedOv != null ? 'Введена вручную' + (d.speedOv !== d.speedAuto ? '; по правилам было бы ' + d.speedAuto + ' фт. (' + d.speedWhy + ')' : '') : d.speedWhy;
    const res = d.res.length ? h('div', { class: 'csres' }, d.res.map(r => h('span', { class: 'csr' + (r.pool ? ' pool' : ''), title: r.n + ': ' + (r.next ? 'с ' + r.next.lvl + ' уровня будет ' + r.next.v : 'дальше не меняется') },
      h('small', {}, r.n), h('b', {}, r.v + (r.unit ? ' ' + r.unit : ''))))) : null;
    const box = h('div', { class: 'cssum' },
      h('div', { class: 'cssn' }, h('h2', {}, c.name || 'Без имени'), h('p', { class: 'cssub' }, sub.join(' · '))),
      h('div', { class: 'rule' }),
      h('div', { class: 'csstats' },
        stat('Хиты', d.hp, hpTip, true), stat('КД', d.ac, d.acWhy, true), stat('Бонус мастерства', R.sgn(d.pb)), stat('Инициатива', R.sgn(d.init), d.initWhy), stat('Скорость', d.speed + ' фт.', spdTip), D.sp ? stat('Размер', d.size, d.sizeOpts.length > 1 ? 'Можно сменить на вкладке «Основа»' : 'Определяется видом') : null,
        d.sp.has ? stat('Сл спасброска', d.sp.dc, 'Заклинательная характеристика: ' + R.ABN(d.sp.ab).ru, false, 'wide') : null),
      res, h('div', { class: 'rule' }), abil);
    return h('div', { class: 'cshead' }, box);
  }
  // чек-лист «что осталось»: отдельная карточка под списком шагов
  function todoCard(t) {
    if (!t.length) return h('div', { class: 'cstodo done' }, h('span', {}, '✓ Всё заполнено — лист готов к печати'), btn('Открыть лист', () => { tabId = 'sheet'; render(); }, 'dmbtn pri'));
    // на узком экране список свёрнут, чтобы не занимать полэкрана; на вкладках остаются счётчики
    const wide = !window.matchMedia || window.matchMedia('(min-width:761px)').matches, lst = h('div', { class: 'tdl' });
    t.slice(0, 6).forEach(([tab, txt]) => lst.append(h('a', { href: '#', onclick: ev => { ev.preventDefault(); tabId = tab; render(); } }, h('em', {}, TAB_SHORT[tab]), txt)));
    if (t.length > 6) lst.append(h('span', { class: 'tdm' }, '…и ещё ' + (t.length - 6)));
    return h('details', { class: 'cstodo', open: wide ? '' : null }, h('summary', { class: 'tdh' }, 'Осталось заполнить: ' + t.length), lst);
  }
  function tabsBar(c, D, d, t) {
    const cnt = {}; t.forEach(([tab]) => { cnt[tab] = (cnt[tab] || 0) + 1; });
    // галочка у шага — только там, где программа умеет проверить заполненность, и только когда класс, вид и предыстория уже выбраны
    const ready = !!(c.cls && c.sp && c.bg), checkable = { base: true, abil: true, spells: !!d.sp.has, forms: true };
    const out = []; let sep = false;
    TABS.filter(([id]) => id !== 'forms' || d.ws).forEach(([id, label, n]) => {
      if (!n && !sep) { out.push(h('span', { class: 'tsep' })); sep = true; }
      out.push(h('button', { type: 'button', 'data-tab': id, class: 'cstab' + (n ? '' : ' sec') + (id === 'sheet' ? ' printtab' : '') + (id === tabId ? ' act' : ''), onclick: () => { tabId = id; render(); } },
        n ? h('i', { class: 'no' }, n) : null, h('span', { class: 'tl' }, label),
        cnt[id] ? h('i', { class: 'bd', title: 'Нужно заполнить: ' + cnt[id] }, cnt[id]) : (ready && checkable[id] ? h('i', { class: 'ok', title: 'Здесь всё заполнено' }, '✓') : null)));
    });
    return h('div', { class: 'cstabs' }, out);
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
    const clsSel = sel(D.classes.map(x => [x.slug, x.name_ru + (R.officialSrc(x.sources) ? '' : ' (неофиц.)')]), c.cls, v => {
      c.cls = v; c.sub = ''; c.skills = []; c.exp = []; c.asi = {}; c.spells = []; c.forms = []; upd();
    }, '— выберите класс —');
    const lvlSel = sel(Array.from({ length: 20 }, (_, i) => [i + 1, i + 1]), c.lvl, v => { c.lvl = +v; upd(); });
    const sl = D.cls ? subLevel(D.cls) : 3, subs = D.cls ? D.cls.subclasses || [] : [];
    p.append(h('h3', { class: 'csh' }, 'Класс и уровень'), h('div', { class: 'csgrid cls' }, field('Класс', clsSel), field('Уровень', lvlSel),
      D.cls ? field('Подкласс' + (c.lvl < sl ? ' (с ' + sl + ' уровня)' : ''),
        sel(subs.map(s => [s.name, s.name + (s.official === false ? ' (неофиц.)' : '')]), c.sub, v => { c.sub = v; upd(); }, c.lvl < sl ? '— пока не нужен —' : '— выберите подкласс —')) : null));
    if (D.cls) {
      const ci = d.ci;
      if (D.sub) { const dsc = h('details', {}, h('summary', {}, 'О подклассе «' + D.sub.name + '»'), blocks(D.sub.description || [])); p.append(dsc); }
      p.append(h('div', { class: 'csfacts' },
        fact('Кость хитов', 'к' + ci.die), fact('Спасброски', ci.saves.map(k => R.ABN(k).ru).join(', ')), fact('Доспехи', ci.armor || '—'),
        fact('Оружие', ci.weapons || '—'), fact('Инструменты', ci.tools || '—'), fact('Заклинательная характеристика', ci.spellAb ? R.ABN(ci.spellAb).ru : d.sp.has && d.sp.via ? R.ABN(d.sp.ab).ru + ' (подкласс «' + d.sp.via + '»)' : '—')));
    }
    // вид
    p.append(h('h3', { class: 'csh' }, 'Вид'), h('div', { class: 'csgrid' }, field('Вид', sel(D.species.map(x => [x.slug, x.name_ru]), c.sp, v => { c.sp = v; c.spOpt = ''; upd(); }, '— выберите вид —')),
      field('Скорость (фт.)', numIn(d.speed, v => { c.speed = v === d.speedAuto ? '' : v; upd(); })),
      D.sp && d.sizeOpts.length > 1 ? field('Размер (на выбор)', sel(d.sizeOpts.map(x => [x, x]), d.size, v => { c.size = v; upd(); })) : null));
    p.append(h('p', { class: 'mhint' }, d.speedOv != null
      ? ['Скорость введена вручную' + (d.speedOv !== d.speedAuto ? ': по правилам было бы ' + d.speedAuto + ' фт. (' + d.speedWhy + '). ' : '. '), btn('Вернуть расчёт', () => { c.speed = ''; upd(); }, 'dmbtn')]
      : 'Считается сама: ' + d.speedWhy + '. Бонусы от класса, подкласса и черт подставляются по уровню; свою скорость можно вписать в поле.'));
    if (D.sp) {
      const ch = R.speciesChoice(D.sp);
      if (ch) p.append(h('div', { class: 'csgrid' }, field(ch.label + ' (выбор вида)', sel(ch.options.map(o => [o, o]), c.spOpt, v => { c.spOpt = v; upd(); }, '— выберите —'))));
      const tr = R.speciesTraits(D.sp, { opt: c.spOpt, lvl: c.lvl });
      p.append(h('details', { open: '' }, h('summary', {}, 'Особенности вида (' + tr.length + ')'), h('ul', { class: 'cstr' }, tr.map(t => h('li', {}, h('b', {}, t.name + '. '), t.text.replace(/\*+/g, ''))))));
      if (ed === 14) {
        const ra = d.raceAsi, ABN = R.ABN, ks = ra ? Object.keys(ra.fixed) : [];
        if (ra && (ks.length || ra.picks.length)) {
          const fixTxt = ks.map(k => ABN(k).ru + ' +' + ra.fixed[k]).join(', '), pickTxt = ra.picks.map(x => 'ещё ' + x.n + ' на выбор (+' + x.v + ')').join(', ');
          const same = ks.every(k => ((c.bonus || {})[k] || 0) === ra.fixed[k]) && R.AB.every(a => ra.fixed[a.k] != null || !((c.bonus || {})[a.k]));
          p.append(h('p', { class: 'mhint' }, 'Бонусы вида' + (c.spOpt ? ' («' + c.spOpt + '»)' : '') + ': ' + [fixTxt, pickTxt].filter(Boolean).join(', ') + '. ',
            same ? '✓ внесены на вкладке «Характеристики».' : btn('Внести бонусы вида', () => { const b = {}; R.AB.forEach(a => { if (ra.fixed[a.k]) b[a.k] = ra.fixed[a.k]; }); if (R.AB.some(a => ((c.bonus || {})[a.k] || 0) !== (b[a.k] || 0) && ((c.bonus || {})[a.k] || 0)) && !confirm('В колонке «Бонусы» уже есть другие значения (подраса, черты). Заменить их бонусами вида?')) return; c.bonus = b; upd(); }, 'dmbtn'),
            !same && ra.picks.length ? ' Бонусы «на выбор» впишите сами.' : ''));
        } else if (D.sp.asi && D.sp.asi.length) p.append(h('p', { class: 'mhint' }, 'Бонусы вида (с учётом всех подрас): ' + D.sp.asi.map(x => x.ability + ' +' + x.value).join(', ') + '. Впишите нужные на вкладке «Характеристики».'));
      }
    }
    // предыстория
    p.append(h('h3', { class: 'csh' }, 'Предыстория'), h('div', { class: 'csgrid' }, field('Предыстория', sel(D.bgs.map(x => [x.slug, x.name_ru]), c.bg, v => { c.bg = v; c.bg2 = { m: '21', a: '', b: '' }; c.bgFeat = ''; upd(); }, '— выберите предысторию —'))));
    if (D.bg) {
      const b = D.bg;
      p.append(h('div', { class: 'csfacts' },
        b.abilities ? fact('Характеристики', b.abilities.join(', ')) : null, b.feat ? fact('Черта', d.bgFeat && d.bgFeat.feat ? d.bgFeat.feat.name : b.feat.name) : null,
        fact('Навыки', (b.skills || []).join(', ') || b.skills_text || '—'), fact('Инструменты', b.tools || (b.tool_tags || []).join(', ') || '—'),
        b.equipment ? fact('Снаряжение', typeof b.equipment === 'string' ? b.equipment : '') : null));
      if (d.bgFeat && d.bgFeat.options.length) p.append(h('div', { class: 'csgrid' }, field(d.bgFeat.required ? 'Черта Тёмного дара (предыстория)' : 'Или черта Тёмного дара вместо «' + d.bgFeat.name + '»', sel(d.bgFeat.options.map(f => [f.slug, f.name_ru]), c.bgFeat, v => { c.bgFeat = v; upd(); }, d.bgFeat.required ? '— выберите —' : '— ' + d.bgFeat.name + ' —'))));
      if (b.blocks && b.blocks.length) p.append(h('details', {}, h('summary', {}, 'Описание предыстории'), blocks(b.blocks)));
    }
    languagesBlock(p, c);
    featsBlock(p, c, D, d);
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
    const grid = h('div', { class: 'csabs' });
    const bgA = D.bg ? (D.bg.abilities || []).map(x => R.ABK[x]) : [];
    R.AB.forEach(a => {
      const base = c.ab[a.k];
      let cellBase;
      if (c.abm === 'std') cellBase = sel(std.map(v => [v, v]), base, v => { c.ab[a.k] = +v; upd(); });
      else if (c.abm === 'buy') cellBase = h('span', { class: 'buy' }, btn('−', () => { if (base > 8) { c.ab[a.k]--; upd(); } }, 'cb2'), h('b', {}, base), btn('+', () => { if (base < 15) { c.ab[a.k]++; upd(); } }, 'cb2'));
      else cellBase = numIn(base, v => { c.ab[a.k] = Math.max(1, Math.min(30, v)); upd(); }, { min: 1, max: 30, class: 'num' });
      const bonus = d.score[a.k] - base, why = d.src[a.k].join('; ');
      let bcell;
      if (c.ed === 24) { const ex = (c.bonus || {})[a.k] || 0; bcell = h('span', { class: 'abbon' }, h('span', { class: 'abchip', title: why || 'Бонусы предыстории и черт' }, bonus - ex ? R.sgn(bonus - ex) : '—'), '+', numIn(ex, v => { c.bonus = c.bonus || {}; c.bonus[a.k] = v; upd(); }, { class: 'num', title: 'Прочее: бонусы от черт и т. п.' })); }
      else bcell = h('span', { class: 'abbon' }, numIn((c.bonus || {})[a.k] || 0, v => { c.bonus = c.bonus || {}; c.bonus[a.k] = v; upd(); }, { class: 'num', title: 'Бонусы вида и прочее' }));
      grid.append(h('div', { class: 'abc' + (bgA.includes(a.k) && c.ed === 24 ? ' hl' : ''), title: bgA.includes(a.k) && c.ed === 24 ? 'Эту характеристику можно усилить бонусом предыстории' : '' },
        h('div', { class: 'abt' }, h('b', {}, a.ru), h('span', { class: 'abtot', title: 'Итоговое значение' }, d.score[a.k])),
        h('div', { class: 'abbody' }, h('div', { class: 'abmod', title: 'Модификатор' }, R.sgn(d.mod[a.k])),
          h('div', { class: 'abctl' }, h('div', { class: 'abrow' }, h('small', {}, 'База'), cellBase), h('div', { class: 'abrow' }, h('small', {}, 'Бонусы'), bcell))),
        h('div', { class: 'abskl' }, skillRows(c, D, d, a))));
    });
    p.append(grid); skillsHints(p, c, D, d);
    p.append(h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: c.cap20 === false, onchange: e => { c.cap20 = e.target.checked ? false : true; upd(); } }), ' максимум характеристики 30 вместо 20 (особые случаи: дары, предметы)'));
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
          if (fa) box.append(faPick(fa, x, d));
        }
        p.append(box);
      });
    }
  }
  // «+1 к [характеристика]» у черты; если черта ещё и даёт владение спасброском («Устойчивый»), он включается сам.
  // Когда выбирать можно только характеристику без владения спасброском, эти характеристики класса из списка убираем.
  const faPick = (fa, x, d) => {
    const skip = fa.notProf && d.ci ? d.ci.saves : [], opts = fa.opts.filter(k => !skip.includes(k) || k === x.fa);
    return h('label', { class: 'csfa' }, '+1 к ', sel(opts.map(k => [k, R.ABN(k).ru]), x.fa, v => { x.fa = v; upd(); }, '—'),
      fa.cap > 20 ? ' (до ' + fa.cap + ')' : '', fa.save ? ' и владение её спасброском' : '');
  };
  const AB_RESET = c => { const arr = R.STD_ARRAY; R.AB.forEach((a, i) => { c.ab[a.k] = arr[i]; }); };
  const lvReq = f => { const m = String(f.prerequisite || f.line || '').match(/(\d+)[-\s]*(?:й|го|ого)?\s*уровн/i); return m ? +m[1] : 0; };
  function featDialog(c, D, pick, skip, onlyCat) {
    skip = skip || new Set();
    const ov = h('div', { class: 'dmmodal csmodal', onclick: e => { if (e.target === ov) ov.remove(); } });
    const cats = onlyCat ? [onlyCat] : [...new Set(D.feats.map(f => f.category).filter(Boolean))];
    let cat = onlyCat || ''; const body = h('div');
    const chips = h('div', { class: 'seg csmeth wrapseg' }, ['', ...cats].map(k => btn(k ? k.replace(/^Черта\s+/, '') : 'Все', () => { cat = k; draw(); }, '')));
    function draw() {
      chips.querySelectorAll('button').forEach((b, i) => b.classList.toggle('act', (i ? cats[i - 1] : '') === cat));
      body.textContent = '';
      const items = D.feats.filter(f => (!cat || f.category === cat) && !skip.has(f.slug));
      body.append(searchBox(items, f => { const need = lvReq(f), bad = need > c.lvl;
        return h('div', { class: 'csrow', title: f.prerequisite ? 'Требование: ' + f.prerequisite : '', onclick: () => { ov.remove(); pick(f); } }, h('b', {}, f.name_ru), h('small', {}, (f.category ? f.category.replace(/^Черта\s+/, '') : '') + (f.prerequisite && f.prerequisite !== 'None' ? ' · треб.: ' + f.prerequisite : '')), bad ? h('small', { class: 'warn' }, 'нужен ' + need + ' ур.') : null); },
        { q: UI.ftQ, key: 'feats:' + cat, onq: v => { UI.ftQ = v; }, ph: 'Поиск черты…', max: 100 }));
    }
    ov.append(h('div', { class: 'dmdlg wide' }, h('h3', {}, 'Выбор черты'), chips, body, h('div', { class: 'mbtn' }, btn('Закрыть', () => ov.remove()))));
    document.body.append(ov); draw();
  }
  const LANG_STD = ['Общий', 'Общий жестовый', 'Драконий', 'Дварфийский', 'Эльфийский', 'Великаний', 'Гномий', 'Гоблинский', 'Полуросличий', 'Орочий'];
  const LANG_RARE = ['Бездны', 'Небесный', 'Глубинная речь', 'Друидический', 'Инфернальный', 'Первичный', 'Сильван', 'Воровской жаргон', 'Подземный'];
  const langStr = c => [...(c.langs || []), ...(c.story.langs ? [c.story.langs] : [])].join(', ');
  function languagesBlock(p, c) {
    c.langs = c.langs || ['Общий'];
    const chip = l => h('label', { class: 'lchip' + (c.langs.includes(l) ? ' on' : '') }, h('input', { type: 'checkbox', checked: c.langs.includes(l), onchange: e => { c.langs = e.target.checked ? [...c.langs, l] : c.langs.filter(x => x !== l); upd(); } }), l);
    p.append(h('h3', { class: 'csh' }, 'Языки и инструменты'),
      h('p', { class: 'mhint' }, (c.ed === 24 ? 'По правилам 2024: Общий и ещё два языка на выбор (стандартные или редкие). ' : '') + 'Выбрано: ' + c.langs.length + '.'),
      h('div', { class: 'lchips' }, LANG_STD.map(chip)), h('div', { class: 'lchips rare' }, LANG_RARE.map(chip)),
      h('div', { class: 'csgrid' }, field('Другие языки (если нет в списке)', textIn(c.story.langs, v => { c.story.langs = v; upd(false); })), field('Другие владения (инструменты и т. п.)', textIn(c.story.tools, v => { c.story.tools = v; upd(false); }))));
  }
  function featsBlock(p, c, D, d) {
    p.append(h('p', { class: 'mhint' }, c.ed === 24 ? 'Черта Происхождения даётся предысторией. Остальные берутся вместо увеличения характеристик (вкладка «Характеристики») либо добавляются здесь — по виду (Человек) или с позволения Мастера. Если у добавленной здесь черты есть выбор характеристики (+1), выберите её под чертой: прибавка и, например, владение спасброском у «Устойчивого» посчитаются сами. Иначе впишите +1 в столбец «Бонусы».' : 'Черты берутся вместо увеличения характеристик (вкладка «Характеристики») или добавляются здесь (например, Человек-вариант). Если у добавленной здесь черты есть выбор характеристики (+1), выберите её под чертой: прибавка и, например, владение спасброском у «Устойчивого» посчитаются сами. Иначе впишите бонус на вкладке «Характеристики».'));
    const card = (f, tag, extra) => { const dt = h('details', {}, h('summary', {}, f.name_ru || f.name, h('small', {}, ' · ' + tag), extra || null)); let done = false;
      dt.addEventListener('toggle', () => { if (done || !dt.open) return; done = true; const b = blocks(f.blocks || []); dt.append(b); DB().decorate(b, c.ed, null); }); return dt; };
    const list = [];
    if (c.ed === 24 && D.bg && D.bg.feat) { const f = d.bgFeat && d.bgFeat.feat; list.push(card(f || { name: D.bg.feat.name, blocks: [] }, 'предыстория «' + D.bg.name_ru + '»')); }
    d.feats.filter(x => !x.extra).forEach(x => { const f = D.feats.find(y => y.slug === x.slug); if (f) list.push(card(f, x.lvl + ' ур., вместо увеличения характеристик')); });
    c.feats.forEach((x, i) => {
      const f = D.feats.find(y => y.slug === x.slug); if (!f) return;
      const fa = R.featAbility(f), dt = card(f, 'добавлена вручную', btn('×', ev => { ev.preventDefault(); c.feats.splice(i, 1); upd(); }, 'xx', 'Убрать черту'));
      // с выбором характеристики +1 и владение спасброском («Устойчивый») считаются сами; не выбирайте её и не вписывайте то же в «Бонусы»
      list.push(fa ? h('div', { class: 'csfeatpick' }, dt, faPick(fa, x, d)) : dt);
    });
    p.append(h('h3', { class: 'csh' }, 'Ваши черты (' + list.length + ')'));
    if (!list.length) p.append(h('div', { class: 'none' }, 'Пока нет черт.'));
    list.forEach(x => p.append(x));
    const skip = new Set([...c.feats.map(x => x.slug), ...d.feats.map(x => x.slug)]);
    p.append(h('div', { class: 'row' }, btn('+ Добавить черту', () => featDialog(c, D, f => { c.feats.push({ slug: f.slug }); upd(); }, skip), 'dmbtn pri')));
  }

  /* ---------- 3. Навыки и умения ---------- */
  // спасбросок и навыки одной характеристики — внутри её карточки
  function skillRows(c, D, d, a) {
    const ci = d.ci, rows = [];
    const sv = d.saveProf.has(a.k);
    rows.push(h('div', { class: 'skr sv' + (sv ? ' prof' : '') }, h('i', { class: 'skd' + (sv ? ' on' : '') }), h('span', { class: 'skn' }, 'Спасбросок', sv ? h('small', {}, (d.saveFrom[a.k] || ['класс']).join(', ')) : null), h('b', { class: 'skb' }, R.sgn(d.saves[a.k])), h('span', {}), h('span', {})));
    d.skills.filter(s => s.ab === a.k).forEach(s => {
      const can = ci && ci.pickFrom.includes(s.id), on = (c.skills || []).includes(s.id), bg = d.bgSk.includes(s.id);
      const left = can
        ? h('input', { type: 'checkbox', class: 'skc', title: 'Навык можно выбрать от класса', checked: on, disabled: bg && !on, onchange: e => { c.skills = c.skills.filter(x => x !== s.id); if (e.target.checked) c.skills.push(s.id); upd(); } })
        : h('i', { class: 'skd' + (s.lev ? ' on' : '') + (s.lev === 2 ? ' ex' : '') });
      const extra = btn(c.skillsExtra.includes(s.id) ? '✓' : '+', () => { c.skillsExtra = c.skillsExtra.includes(s.id) ? c.skillsExtra.filter(x => x !== s.id) : [...c.skillsExtra, s.id]; upd(); }, 'cb2 sm', 'Владение из другого источника (вид, черта, предыстория)');
      const ex = btn(s.lev === 2 ? '★' : '☆', () => { c.exp = c.exp.includes(s.id) ? c.exp.filter(x => x !== s.id) : [...c.exp, s.id]; upd(); }, 'cb2 sm', 'Экспертность: удвоенный бонус мастерства');
      rows.push(h('div', { class: 'skr' + (s.lev ? ' prof' : '') }, left, h('span', { class: 'skn' }, s.n, can ? h('em', { title: 'Можно выбрать от класса' }, ' ◆') : null, s.from.length ? h('small', {}, s.from.join(', ')) : null), h('b', { class: 'skb' }, R.sgn(s.bonus)), ex, extra));
    });
    return rows;
  }
  function skillsHints(p, c, D, d) {
    const ci = d.ci, tx = [];
    if (ci) tx.push('Класс «' + D.cls.name_ru + '»: выберите ' + ci.pickN + (ci.pickAny ? ' любых навыка' : ' из отмеченных ◆') + ' галочкой. Навыки предыстории подставляются сами.' + (d.extraN ? ' Черты и вид дают ещё ' + d.extraN + ' (' + d.grants.map(g => g.why + ' — ' + g.n).join('; ') + '): отмечайте их кнопкой «+», инструменты из «Одарённого» впишите в «Другие владения».' : '') + (d.expN ? ' Экспертность — звёздочка ☆ (положено ' + d.expN + ', отмечено ' + d.expUsed + ').' : ''));
    if (d.bgChoice) tx.push('Предыстория «' + D.bg.name_ru + '»: навыки на выбор — выберите ' + d.bgChoice.n + ' из ' + bgChoiceNames(d) + ' (выбрано ' + d.bgChoice.got + '). Отметьте их кнопкой «+».');
    p.append(h('div', { class: 'cslegend' }, h('span', {}, '◆ — навык можно выбрать от класса'), h('span', {}, '☆ / ★ — экспертность (удвоенный бонус)'), h('span', {}, '+ — владение из другого источника'), h('span', {}, '● — есть владение')));
    tx.forEach(t => p.append(h('p', { class: 'mhint' }, t)));
  }
  // ресурсы класса: из таблицы класса (растут с уровнем) и по формулам правил
  function resourcesBlock(p, c, D, d) {
    if (!d.res.length) return;
    const t = h('table', { class: 'cstbl res' }, h('tr', {}, ['Ресурс', 'Сейчас', 'Дальше'].map(x => h('th', {}, x))));
    d.res.forEach(r => t.append(h('tr', {}, h('td', {}, r.n, r.pool ? h('small', {}, ' · расходуется') : null), h('td', {}, h('b', {}, r.v + (r.unit ? ' ' + r.unit : ''))), h('td', { class: 'nx' }, r.next ? 'с ' + r.next.lvl + ' ур.: ' + r.next.v : 'не меняется'))));
    p.append(h('h3', { class: 'csh' }, 'Ресурсы класса'), h('p', { class: 'mhint' }, 'Значения берутся из таблицы класса и растут с уровнем сами. На печатном листе они выводятся в блоке «Ресурсы».'), t);
  }
  // умения, которые меняют числа листа (скорость, хиты, КД, инициатива, спасброски, навыки, характеристики): включены сами, любое можно отключить
  const FX_KIND = { speed: 'скорость', init: 'инициатива', hp: 'хиты', acAlt: 'КД', acCap: 'КД', save: 'спасброски', saveProf: 'владение спасбросками', skill: 'навыки', ability: 'характеристики', passive: 'пассивные проверки', acPlus: 'КД', atkPlus: 'атака', dmgPlus: 'урон' };
  function effectsBlock(p, c, D, d) {
    if (!d.fx.length) return;
    const n = d.fx.filter(e => !e.off).length;
    p.append(h('h3', { class: 'csh' }, 'Автоматические эффекты (' + n + ' из ' + d.fx.length + ')'),
      h('p', { class: 'mhint' }, 'Что умения класса, подкласса, вида и черт меняют в числах листа: уже учтено в хитах, КД, скорости, инициативе, спасбросках и навыках. Если вы вписали такую прибавку вручную или в вашей игре эффекта нет — снимите галочку.'));
    const box = h('div', { class: 'csfxl' }); p.append(box);
    d.fx.forEach(e => box.append(h('label', { class: 'csfx' + (e.off ? ' off' : '') + (!e.on && !e.off ? ' idle' : ''), title: e.src },
      h('input', { type: 'checkbox', checked: !e.off, onchange: ev => { if (ev.target.checked) delete c.fxOff[e.id]; else c.fxOff[e.id] = 1; upd(); } }),
      h('span', { class: 'fxn' }, h('b', {}, e.why), h('small', {}, e.src)),
      h('span', { class: 'fxk' }, FX_KIND[e.k] || e.k),
      h('span', { class: 'fxt' }, e.text, e.cond ? h('small', { class: 'fxc' }, e.on ? e.cond : 'сейчас не действует: ' + e.cond) : null))));
  }
  async function tabSkills(p, c, D, d) {
    picksBlock(p, c, D, d);
    resourcesBlock(p, c, D, d);
    effectsBlock(p, c, D, d);
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
  // выбранные боевой стиль, мастерство оружия, метамагия и воззвания — записи для списка умений и листа
  function pickEntries(c, D, d) {
    const out = [], src = 'Выбор класса';
    (d.picks || []).forEach(pk => {
      if (pk.kind === 'style' && pk.chosen[0]) { const o = pk.options.find(x => x.slug === pk.chosen[0]); if (o) out.push({ name: 'Боевой стиль: ' + o.name, text: o.text, src }); }
      else if (pk.kind === 'weapons') pk.chosen.forEach(sl => { const g = pk.options.find(x => x.slug === sl), m = g && R.masteryOf(g); if (g) out.push({ name: 'Мастерство: ' + g.name_ru + (m ? ' — ' + m.name : ''), text: m ? m.text.replace(/\*+/g, '') : '', src }); });
      else if (pk.kind === 'text') pk.chosen.filter(Boolean).forEach(t => out.push({ name: pk.label + ': ' + t, text: '', src }));
    });
    return out;
  }
  function picksBlock(p, c, D, d) {
    const pks = d.picks || []; if (!pks.length) return;
    p.append(h('h3', { class: 'csh' }, 'Выборы класса'));
    pks.forEach(pk => {
      const box = h('div', { class: 'cspick' }), cnt = pk.chosen.filter(Boolean).length;
      box.append(h('h4', { class: 'csh2' }, pk.label, h('small', {}, ' · выбрано ' + cnt + ' из ' + pk.n)));
      if (pk.kind === 'style') {
        box.append(field('Вариант', sel(pk.options.map(o => [o.slug, o.name]), c.picks.style, v => { c.picks.style = v; upd(); }, '— выберите —')));
        const o = pk.options.find(x => x.slug === pk.chosen[0]); if (o) box.append(h('p', { class: 'mhint' }, o.text, d.styleF ? ' Эффекты (КД, атака, урон) учтены автоматически.' : ''));
      } else if (pk.kind === 'weapons') {
        const row = h('div', { class: 'csgrid' });
        for (let i = 0; i < pk.n; i++) {
          const cur = pk.chosen[i] || '', taken = new Set(pk.chosen.filter((x, k) => k !== i));
          row.append(field('Оружие ' + (i + 1), sel(pk.options.filter(g => !taken.has(g.slug)).map(g => { const m = R.masteryOf(g); return [g.slug, g.name_ru + (m ? ' — ' + m.name : '')]; }), cur, v => { const a = pk.chosen.slice(); a[i] = v; c.picks.mastery = a.filter(Boolean); upd(); }, '— выберите —')));
        }
        box.append(row, h('p', { class: 'mhint' }, 'Выбранное оружие можно менять после каждого Долгого отдыха. Свойство мастерства применяется при атаке этим оружием.'));
      } else {
        const list = c.picks[pk.key] = c.picks[pk.key] || [], row = h('div', { class: 'csgrid' });
        for (let i = 0; i < pk.n; i++) row.append(field(pk.label + ' ' + (i + 1), h('input', { type: 'text', value: list[i] || '', placeholder: 'название', onchange: e => { list[i] = e.target.value.trim(); c.picks[pk.key] = list.slice(0, pk.n); upd(); } })));
        box.append(row, h('p', { class: 'mhint' }, 'Перечня вариантов в справочнике нет — впишите названия сами. Требования и замену при получении уровня проверяйте по книге класса.'));
      }
      p.append(box);
    });
  }
  function featureList(c, D, d) {
    const out = [];
    if (D.cls) (D.cls.features || []).filter(f => f.level <= c.lvl).forEach(f => out.push({ name: f.name, level: f.level, blocks: f.blocks, src: 'Класс: ' + D.cls.name_ru }));
    if (D.sub) (D.sub.features || []).filter(f => f.level <= c.lvl).forEach(f => out.push({ name: f.name, level: f.level, blocks: f.blocks, src: 'Подкласс: ' + D.sub.name }));
    if (D.sp) R.speciesTraits(D.sp, { opt: c.spOpt, lvl: c.lvl }).forEach(t => out.push({ name: t.name, text: t.text.replace(/\*+/g, ''), src: t.sub && c.spOpt ? 'Подвид: ' + c.spOpt : (c.ed === 14 ? 'Раса: ' : 'Вид: ') + D.sp.name_ru }));
    if (D.bg && D.bg.feat) { const f = d.bgFeat && d.bgFeat.feat; out.push({ name: f ? f.name_ru : D.bg.feat.name, blocks: f ? f.blocks : null, text: f ? '' : 'Черта предыстории: выберите на вкладке «Основа»', src: 'Предыстория: ' + D.bg.name_ru }); }
    d.feats.forEach(x => { const f = D.feats.find(y => y.slug === x.slug); if (f) out.push({ name: f.name_ru, level: x.lvl, blocks: f.blocks, src: 'Черты' }); });
    pickEntries(c, D, d).forEach(e => out.push(e));
    return out;
  }

  /* ---------- 4. Заклинания ---------- */
  async function tabSpells(p, c, D, d) {
    const sp = d.sp;
    if (!sp.has) {
      p.append(h('p', { class: 'mhint' }, 'Класс «' + (D.cls ? D.cls.name_ru : '—') + '» на этом уровне не получает ячеек заклинаний. Если заклинания даёт подкласс, вид или черта, включите вручную:'),
        field('Заклинательная характеристика', sel(R.AB.map(a => [a.k, a.ru]), c.spellAbManual, v => { c.spellAbManual = v; if (!c.slotsManual) c.slotsManual = [0, 0, 0, 0, 0, 0, 0, 0, 0]; upd(); }, '— нет —')));
      autoSpellsBlock(p, c, D, d);   // заклинания вида есть и у тех, у кого нет ячеек
      return;
    }
    p.append(h('div', { class: 'csfacts' }, fact('Характеристика', R.ABN(sp.ab).ru), fact('Сл спасброска', sp.dc), fact('Бонус атаки', R.sgn(sp.atk)),
      sp.cantrips != null ? fact('Заговоры', sp.cantrips) : null, sp.prepared != null ? fact('Подготовлено', sp.prepared) : null, sp.known != null ? fact('Известно заклинаний', sp.known) : null));
    if (sp.via) {
      const lname = { wizard: 'Волшебника', cleric: 'Жреца', sorcerer: 'Чародея', warlock: 'Колдуна', druid: 'Друида', bard: 'Барда', paladin: 'Паладина', ranger: 'Следопыта', artificer: 'Изобретателя' }[sp.list] || sp.list;
      p.append(h('p', { class: 'mhint' }, 'Заклинания даёт подкласс «' + sp.via + '»: таблица ячеек и число заклинаний взяты из него, список — заклинаний ' + lname + '.' +
        (sp.schools ? ' Заклинания должны быть из школ: ' + sp.schools.map(x => x.name).join(', ') + (sp.freeLvls.length ? ' (кроме выученных на ' + sp.freeLvls.join(', ') + ' уровнях — любой школы)' : '') + '. Остальные помечаются, но не запрещены.' : '')));
    }
    if (sp.pact) p.append(h('p', { class: 'mhint' }, 'Магия договора: ' + sp.pact.n + ' ячейки(а) ' + sp.pact.lvl + '-го уровня (восстанавливаются после короткого отдыха).'));
    const row = h('div', { class: 'slots edit' }, sp.rows.map((r, i) => h('label', { class: 'slot' + (r.ov ? ' ov' : ''), title: r.ov ? 'Число изменено вручную (по таблице класса: ' + r.base + ')' : 'Можно вписать своё число ячеек' },
      h('small', {}, (i + 1) + ' ур.'), numIn(r.n, v => { const base = r.ov ? r.base : r.n; c.slotsOv = c.slotsOv || []; if (v === base) delete c.slotsOv[i]; else c.slotsOv[i] = Math.max(0, Math.min(20, v)); upd(); }, { min: 0, max: 20, class: 'num' }), r.tag ? h('small', {}, r.tag) : null)));
    p.append(h('h4', { class: 'csh2' }, 'Ячейки заклинаний'), row,
      h('p', { class: 'mhint' }, 'Число ячеек считается по таблице класса. Если оно отличается (предмет, черта, особое правило), впишите своё число в нужный уровень.',
        (c.slotsOv || []).some(x => x != null) ? btn('Сбросить к таблице класса', () => { c.slotsOv = []; upd(); }, 'dmbtn') : null));
    if (!D.cls) return;
    autoSpellsBlock(p, c, D, d);
    const isBook = D.cls.slug === 'wizard', listSlug = sp.list || D.cls.slug, lab = n => n === 0 ? 'Заговоры' : n + (c.ed === 14 ? ' круг' : ' уровень');
    const noLim = !!c.spellsFree, mine = c.spells, bySlug = new Set([...mine.map(s => s.slug), ...d.autoSpells.map(s => s.slug)]);
    const arc = sp.arcanum || [], isArc = s => arc.length > 0 && s.lvl >= 6;                       // арканум колдуна считается отдельно от известных заклинаний
    const cnt = { can: mine.filter(s => s.lvl === 0 && !s.free).length, rest: mine.filter(s => s.lvl > 0 && !s.free && !isArc(s)).length, prep: mine.filter(s => s.lvl > 0 && s.prep && !s.free && !isArc(s)).length, arc: mine.filter(s => !s.free && isArc(s)).length };
    const lim = { arc: arc.length || null, can: sp.cantrips, rest: isBook ? 6 + 2 * (c.lvl - 1) : (sp.known != null ? sp.known : sp.prepared), prep: isBook ? sp.prepared : null };
    const full = k => !noLim && lim[k] != null && cnt[k] >= lim[k];
    const chip = (t, k) => h('span', { class: lim[k] == null ? '' : cnt[k] > lim[k] ? 'over' : cnt[k] === lim[k] ? 'ok' : '', style: lim[k] ? '--p:' + Math.min(100, Math.round(cnt[k] / lim[k] * 100)) + '%' : null }, t + ': ' + cnt[k] + (lim[k] != null ? ' из ' + lim[k] : ''));
    p.append(h('div', { class: 'spcnt' }, lim.can != null ? chip('Заговоры', 'can') : null, lim.rest != null ? chip(isBook ? 'В книге заклинаний' : sp.known != null ? 'Известно заклинаний' : 'Подготовлено заклинаний', 'rest') : null, isBook && lim.prep != null ? chip('Подготовлено', 'prep') : null, lim.arc != null ? chip('Таинственный арканум (по одному, ' + arc[0] + '–' + arc[arc.length - 1] + ' ур.)', 'arc') : null),
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
        box.append(h('div', { class: 'csrow' + (s.prep ? ' prepd' : '') }, h('b', {}, m ? link(c.ed, 'spells', m, s.name) : s.name), h('small', {}, m ? [m.school, m.concentration ? 'К' : '', m.ritual ? 'Р' : ''].filter(Boolean).join(' · ') : ''), d.autoSpells.some(a => a.slug === s.slug) ? h('small', { title: 'Это заклинание и так выдаёт подкласс: эту запись можно убрать' }, 'уже выдаёт подкласс') : null, m && l > 0 && !s.free && R.outOfSchools(sp, m.school) ? h('small', { class: 'warn', title: 'Не из школ подкласса: допустимо только для заклинания, выученного на ' + sp.freeLvls.join(', ') + ' уровне' }, 'вне школ') : null, prepCb, fr, btn('×', () => { c.spells = c.spells.filter(x => x.slug !== s.slug); upd(); }, 'xx', 'Убрать')));
      });
      p.append(box);
    }
    // каталог
    const maxL = Math.max(sp.maxLevel, 0), all = c.spellsAll;
    p.append(h('h3', { class: 'csh' }, 'Добавить заклинание'),
      h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: all, onchange: e => { c.spellsAll = e.target.checked; upd(); } }), ' показать заклинания всех классов (такие добавляются как «бонус»)'));
    let lvlF = UI.spL; if (lvlF !== 'all' && !(lvlF <= maxL)) lvlF = UI.spL = 'all';   // выбранный раньше круг мог остаться от другого персонажа или уровня
    const cat = D.spells.filter(s => (all || s.classes.some(x => x.slug === listSlug) || d.extraList.includes(s.slug)) && s.level <= maxL && !bySlug.has(s.slug)).sort((x, y) => x.level - y.level || x.name_ru.localeCompare(y.name_ru, 'ru'));
    const fl = h('div', { class: 'seg csmeth wrapseg' }, ['all', ...Array.from({ length: maxL + 1 }, (_, i) => i)].map(v => btn(v === 'all' ? 'Все' : v === 0 ? 'Заговоры' : v + (c.ed === 14 ? ' круг' : ' ур.'), () => { lvlF = UI.spL = v; redraw(); }, '')));
    const box = h('div'); p.append(fl, box);
    function redraw() {
      fl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('act', (i === 0 ? 'all' : i - 1) === lvlF));
      box.textContent = '';
      const items = cat.filter(s => lvlF === 'all' || s.level === lvlF);
      box.append(searchBox(items, s => {
        const foreign = !s.classes.some(x => x.slug === listSlug) && !d.extraList.includes(s.slug), k = s.level === 0 ? 'can' : arc.length && s.level >= 6 ? 'arc' : 'rest', blocked = !foreign && (k === 'arc' ? !arc.includes(s.level) || mine.some(x => x.slug !== s.slug && x.lvl === s.level && !x.free) || full(k) : full(k));
        return h('div', { class: 'csrow' }, h('b', {}, link(c.ed, 'spells', s)), h('small', {}, (s.level ? s.level + ' ур. ' : 'заговор ') + (s.school || '') + (s.concentration ? ' · К' : '') + (s.ritual ? ' · Р' : '')), s.level > 0 && R.outOfSchools(sp, s.school) ? h('small', { class: 'warn', title: 'Не из школ подкласса: допустимо только для заклинаний, выученных на ' + (sp.freeLvls.join(', ') || 'особых') + ' уровнях' }, 'вне школ') : null,
          h('button', { type: 'button', class: 'dmbtn', disabled: blocked, title: blocked ? 'Лимит исчерпан — уберите другое заклинание' : '', onclick: () => c.spells.push({ slug: s.slug, name: s.name_ru, lvl: s.level, prep: !isBook && s.level > 0, free: foreign }) && upd() }, blocked ? 'лимит' : '+ Добавить'));
      }, { ph: 'Поиск заклинания по названию…', max: 60, key: 'spells:' + lvlF, q: UI.spQ, onq: v => { UI.spQ = v; } }));
    }
    redraw();
    p.append(h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: c.printSpells, onchange: e => { c.printSpells = e.target.checked; upd(false); } }), ' печатать полные описания выбранных заклинаний'));
  }

  // заклинания, которые подкласс выдаёт сам (домен, клятва, круг, покровитель): всегда подготовлены, в лимит не входят, не хранятся в персонаже
  function autoSpellsBlock(p, c, D, d) {
    if (!d.autoSpells.length && !d.autoMissing.length && !d.extraList.length) return;
    const lab = n => n === 0 ? 'заговор' : n + (c.ed === 14 ? ' круг' : ' ур.');
    const row = a => { const m = D.spells.find(x => x.slug === a.slug);
      return h('div', { class: 'csrow prepd' }, h('b', {}, m ? link(c.ed, 'spells', m, a.name) : a.name), h('small', {}, lab(a.lvl) + (m && m.school ? ' · ' + m.school : '') + (m && m.concentration ? ' · К' : '') + (m && m.ritual ? ' · Р' : '') + (a.trait ? ' · ' + a.trait : '') + ' · с ' + a.at + ' ур.')); };
    const sort = l => l.slice().sort((x, y) => x.lvl - y.lvl || x.name.localeCompare(y.name, 'ru'));
    const subA = d.autoSpells.filter(a => a.kind !== 'sp'), spA = d.autoSpells.filter(a => a.kind === 'sp');
    if (subA.length) p.append(h('h4', { class: 'csh2' }, 'Всегда подготовлены · подкласс «' + D.sub.name + '» (' + subA.length + ')'),
      h('p', { class: 'mhint' }, 'Их выдаёт подкласс по уровню: выбирать не нужно, в лимит заклинаний они не входят и попадают на печатный лист. Следующие откроются на уровнях подкласса.'),
      h('div', { class: 'cslist' }, sort(subA).map(row)));
    if (spA.length) p.append(h('h4', { class: 'csh2' }, 'Заклинания вида «' + D.sp.name_ru + '» (' + spA.length + ')'),
      h('p', { class: 'mhint' }, 'Их даёт вид: выбирать не нужно, в лимит заклинаний они не входят и попадают на печатный лист. Сколько раз их можно сотворить без ячейки и какая характеристика заклинательная — смотрите в особенности вида. Заговоры и заклинания «на выбор из списка» впишите сами.'),
      h('div', { class: 'cslist' }, sort(spA).map(row)));
    if (d.autoMissing.length) p.append(h('p', { class: 'mhint' }, 'Нет в справочнике заклинаний (впишите вручную, если нужны): ' + d.autoMissing.join(', ') + '.'));
    if (d.extraList.length) p.append(h('p', { class: 'mhint' }, 'Подкласс «' + D.sub.name + '» расширяет список заклинаний класса: ' + d.extraList.length + ' заклинаний можно выбирать ниже как обычные.'));
  }

  /* ---------- 5. Снаряжение ---------- */
  const COINS = [['pm', 'ПМ'], ['zm', 'ЗМ'], ['em', 'ЭМ'], ['sm', 'СМ'], ['mm', 'ММ']];
  function weaponInfo(g) {
    const p = (g.props || []).find(x => /урон/i.test(x.label)); if (!p || !/оружие/i.test(g.line || '')) return null;
    const m = String(p.value).match(/^([\dкКdD+\s]+)[,\s]*(.*)$/); if (!m) return null;
    return { dice: m[1].replace(/\s+/g, ''), type: (m[2] || '').trim(), ranged: /дальнобой/i.test(g.line), simple: /простое/i.test(g.line), martial: /воинское/i.test(g.line), fin: ['dagger', 'rapier', 'scimitar', 'shortsword', 'whip', 'dart'].includes(g.slug) || (g.props || []).some(x => /свойств/i.test(x.label) && /фехтовальн/i.test(x.value)) };
  }
  // бонус атаки и модификатор урона: один расчёт для вкладки «Снаряжение» и печатного листа
  function attackOf(i, g, wi, d) {
    const auto = wi.ranged ? 'dex' : (wi.fin ? (d.mod.dex > d.mod.str ? 'dex' : 'str') : 'str'), ab = i.ab || auto;
    const prof = i.prof != null ? !!i.prof : R.weaponProf(d.ci ? d.ci.weapons : '', g);
    const fx = (d.fx || []).filter(e => e.on && !e.off), two = R.weaponProps(g).includes('двуручное');
    const aPlus = fx.filter(e => e.k === 'atkPlus' && (!e.ranged || wi.ranged)).reduce((q, e) => q + e.v, 0), dPlus = fx.filter(e => e.k === 'dmgPlus' && !wi.ranged && !two).reduce((q, e) => q + e.v, 0);   // Стрельба, Дуэлянт
    return { ab, prof, atk: d.mod[ab] + (prof ? d.pb : 0) + aPlus, dm: d.mod[ab] + dPlus };
  }
  async function tabGear(p, c, D, d) {
    p.append(h('h3', { class: 'csh' }, 'Монеты'), h('div', { class: 'coins' }, COINS.map(([k, t]) => field(t, numIn(c.coins[k], v => { c.coins[k] = Math.max(0, v); upd(false); }, { min: 0, class: 'num' })))));
    // стартовое снаряжение
    const kits = d.ci ? d.ci.kit : '';
    const opts = parseKit(kits);
    const bgKit = D.bg && typeof D.bg.equipment === 'string' && c.ed === 24 ? parseKit(D.bg.equipment) : null;
    const k14 = c.ed === 14 && kits ? R.kitLines14(kits) : null, bg14 = c.ed === 14 && D.bg && typeof D.bg.equipment === 'string' ? R.kitBg14(D.bg.equipment) : null;
    if (opts || bgKit || kits || bg14) {
      p.append(h('h3', { class: 'csh' }, 'Стартовое снаряжение'), h('p', { class: 'mhint' }, c.ed === 14
        ? 'Выберите вариант в каждой строке и нажмите «Добавить» — предметы и монеты добавятся один раз, повторное нажатие заменит прежний набор. Деньги стартовое снаряжение не списывает.'
        : 'Выберите вариант — предметы и монеты добавятся один раз; другой вариант заменит прежний. Стартовое снаряжение деньги не списывает.'));
      const kitRow = (lbl, os, src) => h('div', { class: 'kit' }, h('b', {}, lbl), os.map(o => btn((c.kit[src] === o.k ? '✓ ' : '') + 'Вариант ' + o.k, () => { if (c.kit[src] === o.k) { root.DM.toast('Этот вариант уже применён'); return; } addKit(c, D, o, src); }, 'dmbtn' + (c.kit[src] === o.k ? ' act' : ''), o.txt)), c.kit[src] ? btn('Убрать комплект', () => { removeKit(c, src); upd(); }, 'dmbtn', 'Удалит предметы и монеты этого комплекта') : null);
      if (opts) p.append(kitRow('Класс: ', opts, 'cls'));
      else if (k14 && k14.lines.length) p.append(kitBuilder14(c, D, k14));
      else if (kits) p.append(html('<p class="mhint">' + esc(kits).replace(/\n/g, '<br>') + '</p>'));
      if (bgKit) p.append(kitRow('Предыстория: ', bgKit, 'bg'));
      if (bg14 && (bg14.items.length || Object.keys(bg14.coins).length)) {
        const on = c.kit.bg === 'all', txt = bg14.items.map(i => (i.n > 1 ? i.n + ' × ' : '') + kitName(i)).concat(Object.keys(bg14.coins).map(k => bg14.coins[k] + ' ' + k.toUpperCase().replace('Z', 'З').replace('S', 'С').replace('M', 'М'))).join(', ');
        p.append(h('div', { class: 'kit' }, h('b', {}, 'Предыстория: '), btn(on ? '✓ Добавлено' : 'Добавить снаряжение предыстории', () => { if (on) { root.DM.toast('Уже добавлено'); return; } addKitItems(c, D, bg14.items, bg14.coins, 'bg', 'all', 'Снаряжение предыстории добавлено'); }, 'dmbtn' + (on ? ' act' : ''), txt), on ? btn('Убрать комплект', () => { removeKit(c, 'bg'); upd(); }, 'dmbtn') : null), h('p', { class: 'mhint' }, txt + '.'));
      }
    }
    // инвентарь
    let weight = 0;
    p.append(h('h3', { class: 'csh' }, 'Инвентарь'));
    const t = h('table', { class: 'cstbl inv' }, h('tr', {}, ['Надето', 'Предмет', 'Кол-во', 'Вес', 'Урон / КД', ''].map(x => h('th', {}, x))));
    c.inv.forEach((i, idx) => {
      const g = invG(D, i), w = g ? R.unitWeight(g) * i.q : 0; weight += w;
      const wi = g && weaponInfo(g);
      let info = '';
      if (wi) {
        const a = attackOf(i, g, wi, d), dm = a.dm;
        info = 'атака ' + R.sgn(a.atk) + ', урон ' + wi.dice + (dm ? (dm > 0 ? '+' : '−') + Math.abs(dm) : '') + ' ' + wi.type;
      } else if (g && i.sec !== 'items' && /доспех|щит/i.test(g.line || '')) { const q = (g.props || []).find(x => /класс защиты/i.test(x.label)); info = q ? 'КД ' + String(q.value).replace(/^КД\s*/i, '') : (g.slug === 'shield' ? '+2 к КД' : ''); }
      t.append(h('tr', {}, h('td', {}, h('input', { type: 'checkbox', checked: !!i.eq, title: 'Надето / в руках', onchange: e => { i.eq = e.target.checked; upd(); } })),
        h('td', {}, g ? link(c.ed, i.sec === 'items' ? 'items' : 'equipment', g, i.n) : i.n, i.sec === 'items' && g ? h('small', {}, ' ' + [g.rarity, g.attunement ? 'настройка' : ''].filter(Boolean).join(', ')) : null), h('td', {}, numIn(i.q, v => { i.q = Math.max(1, v); upd(); }, { min: 1, class: 'num' })), h('td', {}, w ? w + ' фнт.' : '—'), h('td', {}, info),
        h('td', {}, btn('×', () => { const back = i.spent || 0; if (back) giveCu(c, back); c.inv.splice(idx, 1); upd(); if (back) root.DM.toast('Возвращено: ' + fmtCu(back)); }, 'xx', i.spent ? 'Убрать предмет: потраченные деньги вернутся' : 'Убрать предмет'))));
    });
    if (!c.inv.length) t.append(h('tr', {}, h('td', { colspan: 6, class: 'none' }, 'Пусто. Добавьте предметы ниже.')));
    p.append(t);
    const cap = d.carry;   // с учётом размера, как в сводке
    const att = c.inv.filter(i => i.eq && i.sec === 'items' && (invG(D, i) || {}).attunement).length;
    p.append(h('p', { class: 'mhint' }, 'Вес снаряжения: ' + (Math.round(weight * 10) / 10) + ' фнт. Грузоподъёмность: ' + cap + ' фнт. ' + (weight > cap ? '— перегруз!' : '') + (att ? ' Настроено на магические предметы: ' + att + ' из 3' + (att > 3 ? ' — многовато!' : '') + ' (отметка «Надето» у предмета с настройкой).' : '')),
      h('div', { class: 'csgrid' }, field('Бонус к КД (магия и т. п.)', numIn(c.acBonus, v => { c.acBonus = v; upd(); })), field('КД', h('span', {}, h('b', {}, d.ac), ' (' + d.acWhy + ')'))));
    const freeIn = textIn('', v => { }, { placeholder: 'Свободная запись: «Верёвка пеньковая»…' });
    p.append(h('div', { class: 'row' }, freeIn, btn('Добавить запись', () => { const v = freeIn.value.trim(); if (v) { c.inv.push({ n: v, slug: '', q: 1, eq: false }); upd(); } }, 'dmbtn')));
    const RAR = [['', 'Любая редкость'], ['обычн', 'Обычные'], ['необычн', 'Необычные'], ['редк', 'Редкие'], ['очень', 'Очень редкие'], ['легенд', 'Легендарные'], ['артеф', 'Артефакты']];
    const rarOf = g => { const r = String(g.rarity || '').toLowerCase(); return r.startsWith('очень') ? 'очень' : r.startsWith('необыч') ? 'необычн' : r.startsWith('обыч') ? 'обычн' : r.startsWith('редк') ? 'редк' : r.startsWith('легенд') ? 'легенд' : r.startsWith('артеф') ? 'артеф' : ''; };
    const cat = UI.gearCat || '';
    const catalog = (cat === '' ? [...D.gear, ...D.items] : cat === 'magic' ? D.items.filter(g => !UI.gearRar || rarOf(g) === UI.gearRar) : D.gear.filter(g => gearCatOf(g) === cat)).slice().sort((a, b) => (a.section === 'items') - (b.section === 'items') || a.name_ru.localeCompare(b.name_ru, 'ru'));
    const rarChips = cat === 'magic' ? h('div', { class: 'seg csmeth wrapseg' }, RAR.map(([k, t]) => btn(t, () => { UI.gearRar = k; upd(); }, (UI.gearRar || '') === k ? 'act' : ''))) : null;
    const chips = h('div', { class: 'seg csmeth wrapseg' }, GCAT.map(([k, t]) => btn(t, () => { UI.gearCat = k; upd(); }, (UI.gearCat || '') === k ? 'act' : '')));
    p.append(h('h4', { class: 'csh2' }, 'Каталог снаряжения · у вас ' + fmtCu(wallet(c))), h('p', { class: 'mhint' }, 'Собирайте снаряжение сами: «Купить» списывает деньги, «Взять» — бесплатно. Магические предметы (посохи, кольца, зелья…) — в категории «Магические предметы» или через поиск. Если убрать купленный предмет, деньги вернутся.'), chips, ...(rarChips ? [rarChips] : []), searchBox(catalog, g => { const mg = g.section === 'items', wi = !mg && weaponInfo(g), cu = costCu(g); return h('div', { class: 'csrow' }, h('b', {}, mg ? link(c.ed, 'items', g) : link(c.ed, 'equipment', g)), h('small', {}, (g.line || '') + (wi ? ' · ' + wi.dice + ' ' + wi.type : '') + ' · ' + (mg ? (g.price || '') : (g.cost || ''))),
      h('button', { type: 'button', class: 'dmbtn', disabled: cu > wallet(c), title: cu > wallet(c) ? 'Не хватает денег' : 'Купить: деньги спишутся', onclick: () => buy(c, g) }, cu ? 'Купить' : '+'),
      cu ? h('button', { type: 'button', class: 'dmbtn', title: 'Взять бесплатно, без списания денег', onclick: () => buy(c, g, true) }, 'Взять') : null); }, { ph: 'Поиск предмета: меч, верёвка, алмазный посох…', max: 120, key: 'gear:' + cat + (UI.gearRar || ''), q: UI.gearQ, onq: v => { UI.gearQ = v; } }));
  }
  const invG = (D, i) => i.sec === 'items' ? (D.itemsBySlug || {})[i.slug] : D.gearBySlug[i.slug];   // запись справочника: снаряжение или магический предмет
  const GCAT = [['', 'Всё'], ['weapon', 'Оружие'], ['armor', 'Доспехи и щиты'], ['tool', 'Инструменты'], ['pack', 'Наборы'], ['gear', 'Прочее снаряжение'], ['magic', 'Магические предметы']];
  const gearCatOf = g => { if (g.section === 'items') return 'magic'; const l = g.line || ''; return /оружие|боеприпас/i.test(l) ? 'weapon' : /доспех|щит/i.test(l) ? 'armor' : /нструмент/i.test(l) ? 'tool' : /набор/i.test(l) ? 'pack' : 'gear'; };
  function parseKit(txt) {
    if (!txt) return null;
    const m = [...String(txt).matchAll(/\(([А-ЯA-Z])\)\s*([^;]*?)(?=;?\s*(?:или\s*)?\([А-ЯA-Z]\)|$)/gs)];
    return m.length ? m.map(x => ({ k: x[1], txt: x[2].replace(/^[\s;]+|[\s;.]+$/g, '').replace(/^или\s*/i, '') })) : null;
  }
  const DEN = [['mm', 1], ['sm', 10], ['em', 50], ['zm', 100], ['pm', 1000]];
  const wallet = c => DEN.reduce((q, [k, v]) => q + (c.coins[k] || 0) * v, 0);
  const costCu = g => { const n = g && g.cost_gp != null ? parseFloat(String(g.cost_gp).replace(',', '.')) : (g && g.price_gp ? +g.price_gp : 0); return isNaN(n) ? 0 : Math.round(n * 100); };
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
    const sec = g.section === 'items' ? 'items' : '', ex = c.inv.find(x => x.slug === g.slug && !x.kit && (x.sec || '') === sec);
    const pk = sec ? 1 : R.packOf(g);   // боеприпасы: цена за пачку, в инвентарь — штуки
    if (ex) { ex.q += pk; ex.spent = (ex.spent || 0) + cu; } else c.inv.push({ n: g.name_ru, slug: g.slug, sec, q: pk, eq: false, spent: cu });
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

  // конструктор стартового набора класса 2014: в каждой строке — выбор «а / б / в», а «любое оружие» — список на выбор
  const kitName = i => i.slot ? (i.slot.kind === 'instrument' ? 'музыкальный инструмент' : (i.slot.cat === 'simple' ? 'простое' : 'воинское') + (i.slot.mode === 'melee' ? ' рукопашное' : i.slot.mode === 'ranged' ? ' дальнобойное' : '') + ' оружие') : i.name;
  const slotChoices = (D, sl) => D.gear.filter(g => { const l = R.lc(g.line || ''); if (/эпох|современн|футурист|особое/.test(l)) return false;
    if (sl.kind === 'instrument') return l === 'музыкальный инструмент';
    return /оружие/.test(l) && l.includes(sl.cat === 'simple' ? 'простое' : 'воинское') && (sl.mode === 'any' || l.includes(sl.mode === 'melee' ? 'рукопашное' : 'дальнобойное')); });
  const gearByKitName = (D, name) => R.kitGear(D.gear, D.gearBySlug, name);
  // положить предметы и монеты набора в инвентарь (src: 'cls' | 'bg'); items: [{name, n} | {slot, n, slug}]
  function addKitItems(c, D, items, coins, src, tag, msg) {
    removeKit(c, src); const miss = [], got = {};
    Object.keys(coins || {}).forEach(k => { c.coins[k] += coins[k]; got[k] = (got[k] || 0) + coins[k]; });
    items.forEach(it => {
      const g = it.slug ? D.gearBySlug[it.slug] : it.name ? gearByKitName(D, fixLat(it.name)) : null, qty = it.n || 1;
      if (g) { const ex = c.inv.find(x => x.slug === g.slug && x.kit === src); if (ex) ex.q += qty; else c.inv.push({ n: g.name_ru, slug: g.slug, q: qty, eq: false, kit: src }); }
      else { miss.push(it); c.inv.push({ n: it.slot ? 'Любое ' + kitName(it) + ' (выберите в каталоге)' : it.name, slug: '', q: qty, eq: false, kit: src }); }
    });
    c.kit[src] = tag; c.kitCoins[src] = got;
    upd(); root.DM.toast((msg || 'Комплект применён') + (miss.length ? ' (без записи в справочнике: ' + miss.length + ')' : ''));
  }
  function kitBuilder14(c, D, k) {
    const sel = c.kitSel.cls = c.kitSel.cls || { pick: [], w: {} }, box = h('div', { class: 'kitb' });
    const chosen = k.lines.map((ln, li) => ln.opts.length === 1 ? ln.opts[0] : ln.opts[sel.pick[li]] || null), slotKeys = [];
    k.lines.forEach((ln, li) => {
      const o = chosen[li], row = h('div', { class: 'kit' });
      if (ln.opts.length > 1) { row.append(...ln.opts.map((x, oi) => btn((o === x ? '✓ ' : '') + x.k + ') ' + x.txt, () => { sel.pick[li] = oi; upd(false); renderKit(); }, 'dmbtn' + (o === x ? ' act' : ''), x.cond ? 'Если владеете соответствующим доспехом или оружием' : ''))); }
      else row.append(h('span', { class: 'mhint' }, '• ' + o.txt));
      if (o) o.items.forEach((it, ii) => { if (!it.slot) return; for (let q = 0; q < (it.n || 1); q++) { const key = li + ':' + ii + ':' + q; slotKeys.push([key, it]);
        row.append(sel0(slotChoices(D, it.slot), sel.w[key] || '', v => { sel.w[key] = v; upd(false); renderKit(); }, '— ' + kitName(it) + ' —')); } });
      box.append(row);
    });
    function renderKit() { const nb = kitBuilder14(c, D, k); box.replaceWith(nb); }
    const ready = chosen.every(Boolean), on = c.kit.cls === 'sel';
    box.append(h('div', { class: 'kit' }, btn(on ? '↻ Заменить набор класса' : 'Добавить набор класса', () => {
      if (!ready) { root.DM.toast('Выберите вариант в каждой строке'); return; }
      const items = []; chosen.forEach((o, li) => o.items.forEach((it, ii) => { if (!it.slot) { items.push(it); return; } for (let q = 0; q < (it.n || 1); q++) { const g = sel.w[li + ':' + ii + ':' + q]; items.push(g ? { slug: g, n: 1 } : { slot: it.slot, n: 1 }); } }));
      addKitItems(c, D, items, {}, 'cls', 'sel', 'Набор класса применён');
    }, 'dmbtn pri', 'Добавит выбранные предметы в инвентарь'), on ? btn('Убрать комплект', () => { removeKit(c, 'cls'); upd(); }, 'dmbtn') : null,
      k.gold ? h('span', { class: 'mhint' }, ' Вместо набора и предметов предыстории можно взять ' + k.gold + ' на покупку снаряжения — впишите в «Монеты».') : null));
    return box;
  }
  const sel0 = (opts, val, on, ph) => sel(opts.map(g => [g.slug, g.name_ru]), val, on, ph);

  /* ---------- Облики зверей (друид) ---------- */
  async function tabForms(p, c, D, d) {
    const ws = d.ws; if (!ws) { p.append(h('p', { class: 'mhint' }, 'Дикий облик доступен друиду со 2 уровня.')); return; }
    p.append(h('div', { class: 'csfacts' }, fact('Известно обликов', ws.known >= 99 ? 'любые подходящие' : ws.known), fact('Макс. опасность', R.crStr(ws.cr)), fact('Полёт', ws.fly ? 'да' : 'нет'),
      c.ed === 14 ? fact('Плавание', ws.swim ? 'да' : 'нет') : null));
    if (ws.note) p.append(h('p', { class: 'mhint' }, ws.note));
    const beasts = await DB().load('bestiary', c.ed);
    const crKey = m => (m.cr == null || m.cr === '' ? '—' : String(m.cr));   // у призванных духов в данных 2014 опасности нет
    const chosen = c.forms;
    p.append(h('h3', { class: 'csh' }, 'Ваши облики (' + chosen.length + (ws.known < 99 ? ' из ' + ws.known : '') + ')'));
    const lst = h('div', { class: 'cslist' });
    if (!chosen.length) lst.append(h('div', { class: 'none' }, 'Выберите зверей из списка ниже.'));
    chosen.forEach(slug => { const m = beasts.find(x => x.slug === slug); if (!m) return;
      const sp = m.speed || {}, sps = Object.entries(sp).map(([k, v]) => ({ walk: '', fly: 'полёт ', swim: 'плавание ', climb: 'лазание ', burrow: 'копание ' }[k] || k + ' ') + v).join(', ');
      lst.append(h('div', { class: 'csrow' }, h('b', {}, link(c.ed, 'bestiary', m)), h('small', {}, 'ОП ' + crKey(m) + ' · КД ' + m.ac + ' · ХП ' + (m.hp && m.hp.avg) + ' · ' + sps), btn('×', () => { c.forms = c.forms.filter(x => x !== slug); upd(); }, 'xx', 'Убрать'))); });
    p.append(lst);
    const all = h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: !!c.formsAll, onchange: e => { c.formsAll = e.target.checked; upd(); } }), ' показать всех зверей (по правилам — только подходящих; с позволения Мастера можно и других)');
    const cands = beasts.filter(m => !chosen.includes(m.slug) && (c.formsAll ? /зверь/i.test(String(m.type)) : R.beastOk(m, ws, c.ed))).sort((a, b) => R.crNum(a.cr) - R.crNum(b.cr) || a.name_ru.localeCompare(b.name_ru, 'ru'));
    p.append(h('h3', { class: 'csh' }, (c.formsAll ? 'Все звери' : 'Подходящие звери') + ' (' + cands.length + ')'), all);
    // фильтр по опасности: список отсортирован по ОП, и самые сильные звери (ОП 1 с 8 уровня и выше) идут в конце
    const crs = [...new Set(cands.map(m => crKey(m)))].sort((a, b) => R.crNum(a) - R.crNum(b));
    let crF = UI.crF && crs.includes(UI.crF) ? UI.crF : '';
    const chips = crs.length > 1 ? h('div', { class: 'seg csmeth wrapseg' }) : null, box = h('div');
    const redraw = () => {
      if (chips) { chips.textContent = ''; [['', 'Все'], ...crs.map(k => [k, 'ОП ' + k])].forEach(([k, t]) => chips.append(btn(t + ' · ' + (k ? cands.filter(m => crKey(m) === k).length : cands.length), () => { crF = UI.crF = k; redraw(); }, k === crF ? 'act' : ''))); }
      box.textContent = '';
      box.append(searchBox(crF ? cands.filter(m => crKey(m) === crF) : cands, m => { const sp = m.speed || {}; return h('div', { class: 'csrow' }, h('b', {}, link(c.ed, 'bestiary', m)), h('small', {}, 'ОП ' + crKey(m) + ' · КД ' + m.ac + ' · ХП ' + (m.hp && m.hp.avg) + (sp.fly ? ' · полёт' : '') + (sp.swim ? ' · плавание' : '')), btn('+ Добавить', () => { c.forms.push(m.slug); upd(); }, 'dmbtn')); },
        { ph: 'Поиск зверя: волк, медведь, паук…', max: 60, key: 'beasts:' + crF }));
    };
    redraw();
    p.append(...[chips, box].filter(Boolean));
    p.append(h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: c.printForms !== false, onchange: e => { c.printForms = e.target.checked; upd(false); } }), ' печатать карточки обликов отдельными страницами'));
  }

  /* ---------- Описание ---------- */
  async function tabStory(p, c, D, d) {
    const ta = (k, label, rows) => field(label, h('textarea', { rows: rows || 3, onchange: e => { c.story[k] = e.target.value; upd(false); } }, c.story[k] || ''));
    // в правилах 2024 у предысторий нет черт характера, идеалов, привязанностей и слабостей — эти поля только для 2014
    const personal = c.ed === 14 ? [ta('traits', 'Черты характера'), ta('ideals', 'Идеалы'), ta('bonds', 'Привязанности'), ta('flaws', 'Слабости')] : [];
    p.append(h('div', { class: 'csgrid two' }, ...personal, ta('look', 'Внешность и история', 6), ta('notes', 'Заметки', 6)),
      h('h3', { class: 'csh' }, 'Портрет'), portraitCtl(c),
      h('h3', { class: 'csh' }, 'Хиты'),
      h('div', { class: 'csgrid' }, field('Способ', sel([['avg', 'Среднее (по умолчанию)'], ['manual', 'Ввести итог вручную']], c.hpMode, v => { c.hpMode = v; upd(); })),
        c.hpMode === 'manual' ? field('Максимум хитов', numIn(c.hpManual, v => { c.hpManual = v; upd(); })) : null,
        field('Прибавка к хитам (магия, особые правила)', numIn(c.hpBonus, v => { c.hpBonus = v; upd(); }))));
    // подсказка — только когда умения что-то добавили к хитам (родной append() превращает null в текст «null»)
    if (d.hpAuto && d.hpFx.length) p.append(h('p', { class: 'mhint' }, 'Умения уже добавили к хитам ' + R.sgn(d.hpFx.reduce((q, e) => q + e.v, 0)) + ' (' + d.hpFx.map(e => e.why).join(', ') + ') — их вписывать не нужно. Отключить можно на вкладке «Умения».'));
  }

  /* ---------- Лист для печати ---------- */
  // строки таблицы «Оружие и боевые заклинания»: надетое оружие + атака заклинанием
  function attackList(c, D, d) {
    const rows = [];
    c.inv.filter(i => i.eq).forEach(i => {
      const g = invG(D, i), wi = g && i.sec !== 'items' && weaponInfo(g); if (!wi) return;
      const a = attackOf(i, g, wi, d), dm = a.dm, pr = R.weaponProps(g).map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(', ');
      rows.push({ n: g.name_ru, bonus: R.sgn(a.atk), dmg: wi.dice + (dm ? (dm > 0 ? '+' : '−') + Math.abs(dm) : '') + ' ' + wi.type, note: pr });
    });
    if (d.sp.has) rows.push({ n: 'Заклинания', bonus: R.sgn(d.sp.atk), dmg: 'Сл ' + d.sp.dc, note: R.ABN(d.sp.ab).ru });
    return rows;
  }
  /* портрет: сжимаем до 900 px по длинной стороне, храним строкой в персонаже */
  function readPortrait(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader(); fr.onerror = rej;
      fr.onload = () => {
        const im = new Image(); im.onerror = rej;
        im.onload = () => {
          const k = Math.min(1, 900 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
          const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
          res(cv.toDataURL('image/jpeg', 0.85));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function portraitCtl(c) {
    const inp = h('input', { type: 'file', accept: 'image/*', hidden: '', onchange: e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      readPortrait(f).then(u => { c.portrait = u; upd(); }).catch(() => root.DM.toast('Не удалось прочитать изображение'));
    } });
    return h('div', { class: 'csport' },
      c.portrait ? h('img', { src: c.portrait, alt: 'Портрет персонажа' }) : h('div', { class: 'csport0' }, 'Портрет не загружен'),
      h('div', { class: 'csportb' }, btn(c.portrait ? 'Заменить…' : 'Загрузить портрет…', () => inp.click(), 'dmbtn'),
        c.portrait ? btn('Убрать', () => { delete c.portrait; upd(); }, 'dmbtn') : null, inp));
  }

  /* что печатать: страницы и отдельные умения (c.pOff, c.featOff) */
  const fkey = f => f.src + '|' + f.name;
  const uiOpen = {};
  function printOptions(c, D, d) {
    const all = featureList(c, D, d), off = c.featOff || (c.featOff = {}), pOff = c.pOff || (c.pOff = {});
    const chosen = all.filter(f => !off[fkey(f)]).length;
    const pg = (label, on, set) => h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: on, onchange: e => { set(e.target.checked); upd(); } }), ' ' + label);
    const pOn = k => !pOff[k], pSet = k => v => { if (v) delete pOff[k]; else pOff[k] = 1; };
    const pages = h('div', { class: 'cspages' },
      pg('Основной лист', pOn('main'), pSet('main')),
      pg('Тексты умений', c.featTxt !== 'none', v => { c.featTxt = v ? 'short' : 'none'; }),
      c.featTxt !== 'none' ? sel([['short', 'кратко'], ['full', 'полностью']], c.featTxt, v => { c.featTxt = v; upd(); }) : null,
      d.sp.has ? pg('Заклинания (список)', pOn('spells'), pSet('spells')) : null,
      d.sp.has ? pg('Карточки заклинаний', !!c.printSpells, v => { c.printSpells = v; }) : null,
      pg('Описание и портрет', pOn('desc'), pSet('desc')),
      pg('Снаряжение', pOn('gear'), pSet('gear')),
      d.ws && c.forms.length ? pg('Дикий облик', c.printForms !== false, v => { c.printForms = v; }) : null);
    const groups = [];
    all.forEach(f => { let g = groups.find(x => x.src === f.src); if (!g) groups.push(g = { src: f.src, items: [] }); g.items.push(f); });
    const setAll = (items, v) => { items.forEach(f => { if (v) delete off[fkey(f)]; else off[fkey(f)] = 1; }); upd(); };
    const glist = groups.map(g => h('div', { class: 'csfg' },
      h('label', { class: 'csfgh' }, h('input', { type: 'checkbox', checked: g.items.every(f => !off[fkey(f)]), onchange: e => setAll(g.items, e.target.checked) }), h('b', {}, ' ' + g.src)),
      h('div', { class: 'csfgl' }, g.items.map(f => h('label', { class: 'csall' }, h('input', { type: 'checkbox', checked: !off[fkey(f)], onchange: e => { if (e.target.checked) delete off[fkey(f)]; else off[fkey(f)] = 1; upd(); } }), ' ' + f.name + (f.level ? ' (' + f.level + ' ур.)' : ''))))));
    const feats = h('details', { class: 'cspr', open: uiOpen.f ? '' : null, ontoggle: e => { uiOpen.f = e.target.open; } },
      h('summary', {}, 'Какие умения и способности печатать: ' + chosen + ' из ' + all.length),
      h('div', { class: 'csfbar' }, btn('Все', () => setAll(all, true), 'dmbtn'), btn('Ничего', () => setAll(all, false), 'dmbtn'),
        btn('Только класс и подкласс', () => { all.forEach(f => { if (/^(Класс|Подкласс):/.test(f.src)) delete off[fkey(f)]; else off[fkey(f)] = 1; }); upd(); }, 'dmbtn'),
        h('small', {}, 'Выбор действует и на список в листе, и на страницу с текстами.')), ...glist);
    return h('div', { class: 'csprint' }, h('div', { class: 'cslbl' }, 'Страницы для печати'), pages, feats);
  }
  // печать и PDF: браузер сохраняет PDF через то же окно печати; название вкладки становится именем файла
  function printSheet(c, pdf) {
    const was = document.title; document.title = (c.name || 'Персонаж') + ' — D&D ' + (c.ed === 24 ? '2024' : '2014');
    root.addEventListener('afterprint', () => { document.title = was; }, { once: true });
    if (pdf) root.DM.toast('В окне печати выберите принтер «Сохранить как PDF» — файл получит имя персонажа');
    setTimeout(() => root.print(), pdf ? 600 : 50);
  }
  async function tabSheet(p, c, D, d) {
    const CSP = root.CSP, live = c.sheetEdit !== false;
    // действия прямо на листе: всё, что меняет числа, идёт через upd() (пересчёт), отметки и записи — только сохранение
    const ops = {
      upd: () => upd(), save: () => upd(false),
      opts: { bg: D.bgs.map(x => [x.slug, x.name_ru]), cls: D.classes.map(x => [x.slug, x.name_ru + (R.officialSrc(x.sources) ? '' : ' (неофиц.)')]), sp: D.species.map(x => [x.slug, x.name_ru]),
        sub: (D.cls && D.cls.subclasses || []).map(x => [x.name, x.name]) },
      setLvl: v => { c.lvl = Math.max(1, Math.min(20, v)); upd(); },
      setCls: v => {
        if (v !== c.cls && ((c.skills || []).length || (c.spells || []).length || Object.keys(c.asi || {}).length) && !confirm('Смена класса сбросит выбранные навыки класса, заклинания и повышения характеристик. Продолжить?')) { upd(); return; }
        if (v !== c.cls) { c.cls = v; c.sub = ''; c.skills = []; c.exp = []; c.asi = {}; c.spells = []; c.forms = []; } upd();
      },
      setSub: v => { c.sub = v; upd(); },
      setBg: v => {
        const b2 = c.bg2 || {}; if (v !== c.bg && (c.bgFeat || b2.a || b2.b) && !confirm('Смена предыстории сбросит выбранные для неё бонусы характеристик и черту. Продолжить?')) { upd(); return; }
        if (v !== c.bg) { c.bg = v; c.bg2 = { m: '21', a: '', b: '' }; c.bgFeat = ''; } upd();
      },
      setSp: v => { if (v !== c.sp) { c.sp = v; c.spOpt = ''; } upd(); },
      setSpo: v => { c.spOpt = v; upd(); },
      setScore: (k, v) => { v = Math.max(1, Math.min(30, v)); c.ab = c.ab || {}; c.ab[k] = Math.max(1, (R.intOf(c.ab[k]) || 10) + v - d.score[k]); upd(); },
      setAc: v => { if (v === d.acAuto) { c.acMode = 'auto'; c.acManual = 0; } else { c.acMode = 'manual'; c.acManual = v; } upd(); },
      setHp: v => { v = Math.max(1, v); if (v === d.hpCalc) { c.hpMode = 'avg'; c.hpManual = 0; } else { c.hpMode = 'manual'; c.hpManual = Math.max(1, v - (c.hpBonus || 0)); } upd(); },
      setInit: v => { c.initOv = v === d.initAuto ? '' : v; upd(); },
      setSpeed: v => { c.speed = v === d.speedAuto ? '' : Math.max(0, v); upd(); },
      shield: () => { const sh = c.inv.find(i => i.slug === 'shield'); if (sh) sh.eq = !sh.eq; else c.inv.push({ n: 'Щит', slug: 'shield', sec: '', q: 1, eq: true }); upd(); },
      wear: it => { it.eq = !it.eq; upd(); },
      // навык: нет → владение → экспертность → снова нет (владение от класса и предыстории снимается тоже)
      prof: t => {
        if (t.kind === 'save') { c.saveExtra = c.saveExtra || {}; const x = c.saveExtra[t.k], on = d.saveProf.has(t.k); if (on) { if (x === 1) delete c.saveExtra[t.k]; else c.saveExtra[t.k] = -1; } else if (x === -1) delete c.saveExtra[t.k]; else c.saveExtra[t.k] = 1; upd(); return; }
        const lev = (d.skills.find(x => x.id === t.id) || {}).lev | 0, id = t.id;
        c.skillsExtra = c.skillsExtra || []; c.exp = c.exp || []; c.skills = c.skills || [];
        if (lev === 0) c.skillsExtra.push(id);
        else if (lev === 1) c.exp.push(id);
        else { c.exp = c.exp.filter(x => x !== id); c.skillsExtra = c.skillsExtra.filter(x => x !== id); c.skills = c.skills.filter(x => x !== id); }
        upd();
      },
      rest: () => {
        if (!confirm('Долгий отдых: хиты до максимума, ячейки заклинаний, ресурсы и спасброски от смерти сбрасываются, истощение −1, половина костей хитов возвращается. Продолжить?')) return;
        const t = (c.play = c.play || {}).t = c.play.t || {};
        Object.keys(t).forEach(k => { if (/^(sl\d|res:|ds[SF]$)/.test(k)) delete t[k]; });
        if (t.exh) { t.exh--; if (!t.exh) delete t.exh; }
        if (t.hd) { t.hd = Math.max(0, t.hd - Math.max(1, Math.floor(d.lvl / 2))); if (!t.hd) delete t.hd; }
        c.hpCur = null; c.hpTemp = 0; upd(); root.DM.toast('Долгий отдых: всё восстановлено');
      },
    };
    const X = { ops: live ? ops : null, featureList: (cc, DD, dd) => featureList(cc, DD, dd).filter(f => !(cc.featOff || {})[fkey(f)]), attackList, invG, langStr };
    // цвет печати: палитра справочника (красная для 2024, бирюзовая для 2014) или чёрно-белый вариант (c.pMono)
    const colorCtl = h('div', { class: 'csprint' }, h('div', { class: 'cslbl' }, 'Цвет печати'),
      h('div', { class: 'seg csmeth' }, btn('Цветная', () => { delete c.pMono; upd(); }, c.pMono ? '' : 'act'), btn('Чёрно-белая', () => { c.pMono = true; upd(); }, c.pMono ? 'act' : '')),
      h('p', { class: 'mhint' }, c.pMono ? 'Только чёрный и серый: для принтера без цвета или чтобы сэкономить картридж.'
        : 'Заголовки и линии цвета справочника (' + (c.ed === 24 ? 'кирпично-красные' : 'бирюзовые') + '), светлые плашки. Бумага остаётся белой.'));
    p.append(h('div', { class: 'noprint sheetbar' }, btn('Печать', () => printSheet(c, false), 'dmbtn pri', 'Открыть окно печати'),
      btn('Сохранить в PDF', () => printSheet(c, true), 'dmbtn pri', 'Откроется окно печати: выберите «Сохранить как PDF» (имя файла уже подставлено)'),
      h('label', { class: 'sheetedit', title: 'Нажимайте на кружки и ромбики, вписывайте числа и текст прямо в лист. Правка не попадает в печать.' }, h('input', { type: 'checkbox', checked: live, onchange: e => { c.sheetEdit = e.target.checked; upd(); } }), ' Править на листе'),
      live ? btn('Долгий отдых', ops.rest, 'dmbtn', 'Сбросить ячейки, ресурсы, хиты и спасброски от смерти') : null,
      h('span', { class: 'mhint' }, 'Лист A4 в оформлении правил ' + (c.ed === 24 ? '2024' : '2014') + '. Если цвета не печатаются, в окне печати включите «Фоновая графика» (в Chrome это включается само).')),
      h('div', { class: 'noprint sheetopt' }, printOptions(c, D, d), h('div', { class: 'cscol' }, colorCtl,
        h('div', { class: 'csprint' }, h('div', { class: 'cslbl' }, 'Портрет'), portraitCtl(c), h('p', { class: 'mhint' }, 'Печатается на странице «Описание».')))));
    const sh = h('div', { class: 'csheet' + (c.pMono ? ' mono' : '') + (live ? ' live' : '') }); p.append(sh);
    CSP.build(sh, { c, D, d, X });
    // облики зверей
    if (d.ws && c.forms.length && c.printForms !== false) {
      const beasts = await DB().load('bestiary', c.ed);
      const p5 = CSP.shell('Дикий облик', c, 'flow pforms ' + (c.ed === 24 ? 'e24' : 'e14'));
      c.forms.forEach(slug => { const m = beasts.find(x => x.slug === slug); if (!m) return; const w = h('div', { class: 'pform' }); w.innerHTML = DB().SXS[c.ed].bestiary.card(m); p5.append(w); });
      sh.append(p5);
    }
    CSP.fit(sh);
  }

  root.CS = { show, render, load, cur };
})(window);
