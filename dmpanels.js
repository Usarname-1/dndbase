/* ===== Панели экрана мастера =====
   Регистрируются через DM.registerType(id, {name, desc, w, h, init(), render(ctx)}).
   ctx: {p (панель; p.s — её сохраняемое состояние), body, save(), db(), title(текст), addBtn(), onDispose(fn), refresh()} */
(function (root) {
  'use strict';
  const DM = root.DM, h = DM.h;
  const DB = () => root.DB;
  const num = (v, d) => { const n = parseInt(String(v).replace('−', '-'), 10); return isNaN(n) ? (d || 0) : n; };
  const sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const btn = (txt, fn, cls, tip) => h('button', { type: 'button', class: cls || '', title: tip || '', onclick: fn }, txt);
  const inp = (attrs, on) => h('input', Object.assign({ type: 'text', autocomplete: 'off' }, attrs, on ? { oninput: on } : {}));

  /* ---------- Кубики ---------- */
  DM.registerType('dice', {
    name: 'Кубики', desc: 'd4–d100, своя формула, избранное', w: 3, h: 6,
    init: () => ({ fav: ['2к6+3', '8к6'], last: '' }),
    render(ctx) {
      const s = ctx.p.s, res = h('div', { class: 'dres' }, 'Бросьте кубик');
      const go = f => {
        const r = root.Dice.roll(f, { kind: 'dice', label: 'Кубики', src: '', mode: root.Dice.state.mode });
        if (!r) { res.textContent = 'Не понял формулу «' + f + '». Пример: 2к8+3'; res.classList.add('bad'); }
        return r;
      };
      const show = r => {
        res.classList.remove('bad');
        res.textContent = '';
        res.append(h('b', {}, String(r.total)), h('small', {}, r.formula + (r.mode === 'a' ? ' · преим.' : r.mode === 'd' ? ' · помеха' : '')));
        res.classList.remove('pop'); void res.offsetWidth; res.classList.add('pop');
      };
      const listener = r => { if (r.label === 'Кубики') show(r); };
      root.Dice.on(listener); ctx.onDispose(() => root.Dice.off(listener));
      const pad = h('div', { class: 'dpad' }, [4, 6, 8, 10, 12, 20, 100].map(n => btn('к' + n, () => go('1к' + n), 'dd d' + n)));
      const f = inp({ placeholder: 'Формула: 2к8+3', value: s.last || '' });
      const run = () => { if (f.value.trim()) { s.last = f.value.trim(); ctx.save(); go(f.value); } };
      f.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
      const favs = h('div', { class: 'favs' });
      const drawFav = () => {
        favs.textContent = '';
        s.fav.forEach((x, i) => favs.append(h('span', { class: 'fav' }, btn(x, () => go(x)), btn('×', () => { s.fav.splice(i, 1); ctx.save(); drawFav(); }, 'xx', 'Убрать из избранного'))));
      };
      drawFav();
      const modes = h('div', { class: 'seg' }, [['n', 'обыч.'], ['a', 'преим.'], ['d', 'помеха']].map(([m, t]) => {
        const b = btn(t, () => { root.Dice.state.mode = m; root.Dice.syncTray(); sync(); });
        b.dataset.m = m; return b;
      }));
      const sync = () => modes.querySelectorAll('button').forEach(b => b.classList.toggle('act', root.Dice.state.mode === b.dataset.m));
      sync();
      ctx.body.append(h('div', { class: 'dice' }, res, pad,
        h('div', { class: 'row' }, f, btn('Бросить', run, 'pri'), btn('★', () => {
          const v = f.value.trim(); if (!v || !root.Dice.parse(v, 'dice')) return DM.toast('Сначала введите верную формулу');
          if (!s.fav.includes(v)) { s.fav.push(v); ctx.save(); drawFav(); }
        }, '', 'Сохранить формулу в избранное')), favs, modes));
    }
  });

  const EQ = { species: 'race', race: 'species', articles: 'glossary', glossary: 'articles' };
  // поиск по названию: eds — [24,14], secs — 'all' или раздел; возвращает [{e, sec, m}]
  async function searchDB(db, eds, sec, text, limit) {
    const v = db.norm(text.trim()); if (!v) return [];
    const out = [];
    for (const e of eds) {
      let keys = sec === 'all' ? db.ORDERS[e] : [db.ORDERS[e].includes(sec) ? sec : EQ[sec]].filter(k => k && db.ORDERS[e].includes(k));
      for (const k of keys) {
        const data = await db.load(k, e);
        for (const m of data) {
          const n = db.norm(m.name_ru + ' ' + (m.name_en || '')), i = n.indexOf(v);
          if (i >= 0) out.push({ e, sec: k, m, r: (db.norm(m.name_ru).startsWith(v) || db.norm(m.name_en || '').startsWith(v) ? 0 : 1) });
        }
      }
    }
    out.sort((a, b) => a.r - b.r || (a.e === b.e ? 0 : b.e - a.e) || a.m.name_ru.localeCompare(b.m.name_ru, 'ru'));
    return out.slice(0, limit || 60);
  }
  const edList = v => v === 'all' ? [24, 14] : [+v];

  /* ---------- Инициатива ---------- */
  const COND = ['Бессознательный', 'Ослеплённый', 'Очарованный', 'Оглохший', 'Испуганный', 'Схваченный', 'Недееспособный', 'Невидимый', 'Парализованный', 'Окаменевший', 'Отравленный', 'Сбитый с ног', 'Опутанный', 'Ошеломлённый', 'Истощение', 'Концентрация'];
  const COND_RE = { 'Бессознательный': /бессознат/, 'Ослеплённый': /ослеп/, 'Очарованный': /очаро/, 'Оглохший': /оглох|глухот/, 'Испуганный': /испуг|страх/, 'Схваченный': /схвач/, 'Недееспособный': /недееспос/, 'Невидимый': /невидим/, 'Парализованный': /парал/, 'Окаменевший': /окамен/, 'Отравленный': /отравл/, 'Сбитый с ног': /сбит|лежач/, 'Опутанный': /опутан|ограничен/, 'Ошеломлённый': /ошеломл|оглушен/, 'Истощение': /истощ/ };
  const DMG = ['Кислота', 'Дробящий', 'Холод', 'Огонь', 'Силовое поле', 'Электричество', 'Некротическая энергия', 'Колющий', 'Яд', 'Психическая энергия', 'Излучение', 'Рубящий', 'Звук'];
  const DMG_RE = { 'Кислота': /кислот/, 'Дробящий': /дробящ/, 'Холод': /холод/, 'Огонь': /огн|огон/, 'Силовое поле': /силов/, 'Электричество': /электр|молни/, 'Некротическая энергия': /некрот/, 'Колющий': /колющ/, 'Яд': /(^|[^а-яё])яд([^а-яё]|$)/, 'Психическая энергия': /психич/, 'Излучение': /излуч/, 'Рубящий': /рубящ/, 'Звук': /звук|гром/ };
  const QUAL = /немагическ|посеребр|серебр|адамант|кроме|не из |не облада/;
  const rid = () => Math.random().toString(36).slice(2, 8);
  const lc = t => String(t || '').toLowerCase().replace(/ё/g, 'е');
  // из текста («Огонь; Яд») → {t: [типы всегда], q: [типы при условии], c: [состояния]}
  function parseSet(text) {
    const t = lc(text), out = { t: [], q: [], c: [] };
    if (!t.trim()) return out;
    const cond = QUAL.test(t);
    DMG.forEach(d => { if (DMG_RE[d].test(t.replace(/ё/g, 'е'))) (cond ? out.q : out.t).push(d); });
    COND.forEach(c => { if (COND_RE[c] && COND_RE[c].test(t)) out.c.push(c); });
    return out;
  }
  const uniq = a => [...new Set(a)];
  function mkRes(res, imm, vul, cimm) {
    const R = parseSet(res), I = parseSet(imm), V = parseSet(vul), C = parseSet(cimm);
    return { r: R.t, i: I.t, v: V.t, q: uniq([...R.q, ...I.q, ...V.q]), ci: uniq([...I.c, ...C.c]) };
  }
  const tabNew = (name) => ({ id: rid(), name: name || 'Бой', list: [], turn: 0, round: 1, started: false });
  function fixInit(s) {                                      // старые сохранения без вкладок
    if (!s.tabs) { s.tabs = [Object.assign(tabNew('Бой 1'), { list: s.list || [], turn: s.turn || 0, round: s.round || 1, started: !!s.started })]; s.at = s.tabs[0].id; delete s.list; delete s.turn; delete s.round; delete s.started; }
    if (!s.tabs.some(t => t.id === s.at)) s.at = s.tabs[0].id;
    s.tabs.forEach(t => t.list.forEach(x => { x.cond = (x.cond || []).map(c => typeof c === 'string' ? { n: c, r: null } : c); }));
    return s;
  }
  const act = s => fixInit(s).tabs.find(t => t.id === s.at);
  function sortList(t) {
    const cur = t.list[t.turn] && t.list[t.turn].id;
    t.list = t.list.map((x, i) => [x, i]).sort((a, b) => (b[0].init - a[0].init) || (a[1] - b[1])).map(x => x[0]);
    const i = t.list.findIndex(x => x.id === cur);
    t.turn = i < 0 ? 0 : i;
  }
  function rollInit(mod) { const r = root.Dice.roll('к20' + (mod < 0 ? '−' : '+') + Math.abs(mod), { kind: 'check', silent: true }); return r ? r.total : 10 + mod; }
  function newRow(o) { return Object.assign({ id: rid(), name: 'Участник', init: 10, hp: 0, max: 0, ac: '', cond: [], mon: null, note: '', res: null }, o); }

  /* библиотека своих монстров (общая для всех экранов) */
  const LIB = 'dm.mons';
  const lib = () => { try { const a = JSON.parse(localStorage.getItem(LIB)); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const saveLib = a => { try { localStorage.setItem(LIB, JSON.stringify(a)); } catch (e) { DM.toast('Не удалось сохранить монстра: память браузера заполнена'); } };

  DM.INIT = {
    addMonster(s, m, e, qty) {
      const t = act(s);
      qty = Math.max(1, Math.min(30, qty || 1));
      const ab = m.abilities || {}, dex = ab.dex || {};
      const mod = m.initiative && typeof m.initiative.mod === 'number' ? m.initiative.mod : (typeof dex.mod === 'number' ? dex.mod : 0);
      const same = t.list.filter(x => x.mon && x.mon.slug === m.slug && x.mon.e === e).length;
      const res = mkRes(m.resistances, m.immunities, m.vulnerabilities, m.condition_immunities);
      for (let i = 0; i < qty; i++) {
        const n = same + i + 1, hp = (m.hp && m.hp.avg) || 0;
        t.list.push(newRow({
          name: m.name_ru + (qty > 1 || same ? ' ' + n : ''), init: rollInit(mod), hp, max: hp,
          ac: m.ac != null ? String(typeof m.ac === 'object' ? (m.ac.value || m.ac.ac || '') : m.ac) : '', mon: { e, sec: 'bestiary', slug: m.slug }, mod, res: JSON.parse(JSON.stringify(res))
        }));
      }
      sortList(t);
    },
    addCustom(s, c, qty) {
      const t = act(s);
      qty = Math.max(1, Math.min(30, qty || 1));
      const same = t.list.filter(x => x.cid === c.id).length;
      for (let i = 0; i < qty; i++) {
        const n = same + i + 1;
        t.list.push(newRow({
          name: c.name + (qty > 1 || same ? ' ' + n : ''), init: rollInit(c.mod || 0), hp: c.hp || 0, max: c.hp || 0, ac: c.ac || '', mod: c.mod || 0,
          cid: c.id, note: c.note || '', res: mkRes(c.res, c.imm, c.vul, c.cimm)
        }));
      }
      sortList(t);
    }
  };

  /* окно «свой монстр» */
  function monForm(c, done) {
    const f = {};
    const field = (k, label, attrs, tag) => {
      f[k] = h(tag || 'input', Object.assign({ type: 'text', autocomplete: 'off' }, attrs || {}));
      if (c && c[k] != null) f[k].value = c[k];
      return h('label', { class: 'mf' }, h('span', {}, label), f[k]);
    };
    const close = () => ov.remove();
    const save = () => {
      const name = f.name.value.trim(); if (!name) { f.name.focus(); return; }
      const o = { id: c ? c.id : rid(), name, ac: f.ac.value.trim(), hp: Math.max(0, num(f.hp.value)), mod: num(f.mod.value), res: f.res.value, imm: f.imm.value, vul: f.vul.value, cimm: f.cimm.value, note: f.note.value };
      const a = lib(), i = a.findIndex(x => x.id === o.id);
      if (i >= 0) a[i] = o; else a.push(o);
      saveLib(a); close(); done && done(o);
    };
    const ov = h('div', { class: 'dmmodal', onclick: e => { if (e.target === ov) close(); } },
      h('div', { class: 'dmdlg' }, h('h3', {}, c ? 'Изменить монстра' : 'Свой монстр'),
        field('name', 'Название *', { placeholder: 'Например: Культист-фанатик' }),
        h('div', { class: 'mrow' }, field('ac', 'КД', { type: 'number' }), field('hp', 'Хиты', { type: 'number' }), field('mod', 'Мод. инициативы', { type: 'number', value: '0' })),
        field('res', 'Сопротивление урону', { placeholder: 'огонь, холод' }), field('imm', 'Иммунитет к урону', { placeholder: 'яд' }), field('vul', 'Уязвимость', { placeholder: 'дробящий' }),
        field('cimm', 'Иммунитет к состояниям', { placeholder: 'отравленный, очарованный' }),
        field('note', 'Атаки, особенности (формулы вроде «+5 к попаданию, 1к8+3» станут кнопками)', { rows: 5 }, 'textarea'),
        h('p', { class: 'mhint' }, 'Типы урона: ' + DMG.join(', ').toLowerCase() + '.'),
        h('div', { class: 'mbtn' }, btn('Сохранить', save, 'pri'), btn('Отмена', close))));
    document.body.append(ov);
    f.name.focus();
  }

  DM.registerType('init', {
    name: 'Инициатива', desc: 'Бой: вкладки-схватки, порядок ходов, урон по типам, состояния с длительностью, свои монстры', w: 6, h: 11,
    init: () => fixInit({}),
    render(ctx) {
      const s = fixInit(ctx.p.s), el = ctx.body;
      const lst = h('div', { class: 'ilist' }), tabsEl = h('div', { class: 'itabs' });
      const toolbar = h('div', { class: 'itools' });
      const name = inp({ placeholder: 'Имя или поиск монстра…', class: 'iname' });
      const qty = inp({ type: 'number', value: '1', min: '1', max: '30', class: 'iqty', title: 'Сколько добавить' });
      const edSel = h('select', { class: 'eed', title: 'Редакция монстров' }, h('option', { value: '24' }, '2024'), h('option', { value: '14' }, '2014'), h('option', { value: 'all' }, 'Все'));
      edSel.value = s.fe || String(DB().ed);
      const res = h('div', { class: 'eres' });
      const nQty = () => Math.max(1, Math.min(30, num(qty.value, 1)));
      const clearSearch = () => { name.value = ''; res.textContent = ''; };
      const addMon = (e, m) => { DM.INIT.addMonster(s, m, e, nQty()); clearSearch(); ctx.save(); draw(); };
      const addCust = c => { DM.INIT.addCustom(s, c, nQty()); clearSearch(); ctx.save(); draw(); };
      const mineRow = c => h('a', { href: '#', onclick: ev => { ev.preventDefault(); ev.stopPropagation(); addCust(c); } },
        h('span', {}, c.name, h('em', { class: 'mine' }, ' свой')),
        h('small', {}, 'КД ' + (c.ac || '—') + ' · ХП ' + (c.hp || '—') + ' ',
          h('button', { type: 'button', class: 'xx', title: 'Изменить', onclick: ev => { ev.preventDefault(); ev.stopPropagation(); monForm(c, () => search(true)); } }, '✎'),
          h('button', { type: 'button', class: 'xx', title: 'Удалить из библиотеки', onclick: ev => { ev.preventDefault(); ev.stopPropagation(); if (confirm('Удалить «' + c.name + '» из своих монстров?')) { saveLib(lib().filter(x => x.id !== c.id)); search(true); } } }, '🗑')));
      let tk = 0;
      const search = async (mine) => {
        const my = ++tk, v = name.value.trim(); res.textContent = '';
        const own = lib().filter(c => mine === true || (v && lc(c.name).includes(lc(v))));
        if (!v && !own.length) return;
        own.forEach(c => res.append(mineRow(c)));
        if (!v) { if (!own.length) res.append(h('div', { class: 'none' }, 'Своих монстров пока нет. Нажмите «＋ Свой».')); return; }
        const hits = await searchDB(DB(), edList(edSel.value), 'bestiary', v, 40);
        if (my !== tk) return;
        if (!hits.length && !own.length) return res.append(h('div', { class: 'none' }, 'В бестиарии не найдено. «Добавить» — внести как обычного участника.'));
        hits.forEach(x => res.append(h('a', { href: DB().hh(x.e, 'bestiary', x.m.slug), onclick: ev => { ev.preventDefault(); ev.stopPropagation(); addMon(x.e, x.m); } },
          h('span', {}, x.m.name_ru), h('small', {}, (edSel.value === 'all' ? DB().EDK(x.e) + ' · ' : '') + 'КД ' + (x.m.ac != null ? x.m.ac : '—') + ' · ХП ' + ((x.m.hp && x.m.hp.avg) || '—') + ' · ' + (x.m.name_en || '')))));
      };
      name.addEventListener('input', () => search());
      edSel.addEventListener('change', () => { s.fe = edSel.value; ctx.save(); search(); });
      const addByName = async () => {
        const v = name.value.trim(); if (!v) return;
        const q = nQty(), nv = lc(v), t = act(s);
        const c = lib().find(x => lc(x.name) === nv); if (c) return addCust(c);
        const hits = await searchDB(DB(), edList(edSel.value), 'bestiary', v, 200);
        const x = hits.find(y => DB().norm(y.m.name_ru) === DB().norm(v) || DB().norm(y.m.name_en) === DB().norm(v));
        if (x) return addMon(x.e, x.m);
        for (let i = 0; i < q; i++) t.list.push(newRow({ name: q > 1 ? v + ' ' + (i + 1) : v })); sortList(t);
        clearSearch(); ctx.save(); draw();
      };
      name.addEventListener('keydown', e => { if (e.key === 'Enter') addByName(); if (e.key === 'Escape') clearSearch(); });
      // ход: условия с длительностью заканчиваются в конце хода их носителя
      const next = () => {
        const t = act(s); if (!t.list.length) return;
        const ended = t.started ? t.list[t.turn] : null, gone = [];
        if (ended) ended.cond = ended.cond.filter(c => { if (c.r == null) return true; c.r--; if (c.r <= 0) { gone.push(c.n); return false; } return true; });
        t.started = true;
        t.turn++; if (t.turn >= t.list.length) { t.turn = 0; t.round++; }
        ctx.save(); draw();
        if (gone.length) DM.toast(ended.name + ': закончилось — ' + gone.join(', '));
      };
      const start = () => {
        const t = act(s); if (!t.list.length) return;
        t.list.forEach(x => { if (x.mon || x.cid) x.init = rollInit(x.mod || 0); });
        sortList(t); t.turn = 0; t.round = 1; t.started = true; ctx.save(); draw();
      };
      toolbar.append(edSel, name, qty, btn('Добавить', addByName, 'pri', 'Точное название монстра или просто имя участника; монстра можно выбрать из списка ниже'),
        btn('＋ Свой', () => monForm(null, c => { DM.toast('Сохранён: ' + c.name); search(true); }), '', 'Создать своего монстра'),
        btn('Мои', () => search(true), '', 'Показать своих монстров'),
        btn('Начать бой', start, 'pri', 'Бросить инициативу всем монстрам, сбросить раунд и дать ход первому'),
        btn('След. ход ▶', next, 'pri', 'Передать ход следующему'),
        btn('Очистить', () => {
          if (!confirm('Убрать всех из этой схватки?')) return;
          const t = act(s); t.list = []; t.turn = 0; t.round = 1; t.started = false; ctx.save(); draw();
        }, '', 'Убрать всех участников этой вкладки'));
      const upd = (x, f) => { f(x); ctx.save(); };
      const damage = (x, v, type) => {
        if (v < 0) { x.hp = x.max ? Math.min(x.max, x.hp - v) : x.hp - v; return 'Лечение ' + (-v); }
        let k = 1, why = '';
        const R = x.res;
        if (type && R) {
          if (R.i.includes(type)) { k = 0; why = 'иммунитет'; }
          else if (R.r.includes(type) && R.v.includes(type)) { k = 1; why = 'сопротивление и уязвимость гасят друг друга'; }
          else if (R.r.includes(type)) { k = .5; why = 'сопротивление'; }
          else if (R.v.includes(type)) { k = 2; why = 'уязвимость'; }
          else if (R.q.includes(type)) why = 'есть условное (напр. немагическое оружие) — проверьте вручную';
        }
        const d = Math.floor(v * k);
        x.hp = Math.max(0, x.hp - d);
        return d + ' урона' + (type ? ' (' + type.toLowerCase() + ')' : '') + (why ? ': ' + why : '') + (k !== 1 ? ' — было ' + v : '');
      };
      function resLine(x) {
        const R = x.res; if (!R) return null;
        const part = (l, a, c) => a.length ? h('span', { class: 'rs ' + c }, l + ' ' + a.map(t => t.toLowerCase()).join(', ')) : null;
        const bits = [part('сопр.', R.r, 'r'), part('иммун.', R.i, 'i'), part('уязв.', R.v, 'v'), part('условно*', R.q, 'q'), part('иммун. к сост.', R.ci || [], 'i')].filter(Boolean);
        return bits.length ? h('div', { class: 'ires', title: '* — сопротивление или иммунитет с условием (немагическое оружие и т. п.): не применяется автоматически' }, bits) : null;
      }
      function row(x, i) {
        const t = act(s), cur = t.started && i === t.turn, dead = x.max > 0 && x.hp <= 0;
        const r = h('div', { class: 'irow' + (cur ? ' cur' : '') + (dead ? ' dead' : '') });
        const ini = inp({ type: 'number', value: x.init, class: 'iini', title: 'Инициатива', onchange: e => { x.init = num(e.target.value); sortList(t); ctx.save(); draw(); } });
        const nm = x.mon
          ? h('a', { href: DB().hh(x.mon.e, x.mon.sec, x.mon.slug), class: 'inm', title: 'Открыть карточку' }, x.name)
          : h('span', { class: 'inm', contenteditable: 'plaintext-only', spellcheck: 'false', onblur: e => upd(x, o => o.name = e.target.textContent.trim() || 'Участник') }, x.name);
        const hp = inp({ type: 'number', value: x.hp, class: 'ihp', title: 'Хиты сейчас', onchange: e => { x.hp = num(e.target.value); ctx.save(); draw(); } });
        const mx = inp({ type: 'number', value: x.max, class: 'ihp', title: 'Максимум хитов', onchange: e => { x.max = num(e.target.value); ctx.save(); draw(); } });
        const ac = inp({ value: x.ac, class: 'iac', title: 'Класс доспеха', placeholder: 'КД', onchange: e => upd(x, o => o.ac = e.target.value) });
        const dm = inp({ type: 'number', placeholder: 'урон', class: 'idm', title: 'Введите число и Enter. Отрицательное число — лечение' });
        const ty = h('select', { class: 'ity', title: 'Тип урона (для сопротивлений и уязвимостей)' }, h('option', { value: '' }, 'тип'), DMG.map(d => h('option', { value: d }, d)));
        dm.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          const v = num(dm.value); if (!v) return;
          const msg = damage(x, v, ty.value); ctx.save(); draw(); DM.toast(x.name + ': ' + msg);
        });
        const cond = h('span', { class: 'icond' }, x.cond.map(c => h('span', { class: 'chip', title: c.r != null ? 'Осталось раундов: ' + c.r + '. Нажмите, чтобы снять' : 'Нажмите, чтобы снять', onclick: () => { x.cond.splice(x.cond.indexOf(c), 1); ctx.save(); draw(); } }, c.n + (c.r != null ? ' · ' + c.r + ' р.' : '') + ' ×')));
        const dur = inp({ type: 'number', class: 'idur', placeholder: 'р.', min: '1', title: 'На сколько раундов (пусто — пока не снимете). Заканчивается в конце хода носителя' });
        const sel = h('select', { class: 'icadd', title: 'Добавить состояние', onchange: e => {
          const n = e.target.value; if (!n) return;
          if ((x.res && x.res.ci || []).includes(n) && !confirm(x.name + ' имеет иммунитет к состоянию «' + n + '». Всё равно наложить?')) { draw(); return; }
          const d = parseInt(dur.value, 10);
          x.cond.push({ n, r: d > 0 ? d : null }); ctx.save(); draw();
        } }, h('option', { value: '' }, '＋'), COND.filter(c => !x.cond.some(k => k.n === c)).map(c => h('option', { value: c }, c)));
        const del = btn('×', () => { t.list.splice(t.list.indexOf(x), 1); if (t.turn >= t.list.length) t.turn = 0; ctx.save(); draw(); }, 'xx', 'Убрать из боя');
        r.append(ini, nm, h('span', { class: 'ihpw', title: 'Хиты' }, hp, '/', mx), ac, h('span', { class: 'idw' }, dm, ty), del, h('div', { class: 'ibot' }, cond, dur, sel));
        const rl = resLine(x); if (rl) r.append(rl);
        if (x.note) { const n = h('div', { class: 'inote' }, x.note); root.Dice.linkify(n); r.append(n); }
        return r;
      }
      function drawTabs() {
        tabsEl.textContent = '';
        s.tabs.forEach(t => {
          const b = h('button', { type: 'button', class: 'itab' + (t.id === s.at ? ' act' : ''), title: 'Двойной клик — переименовать' }, t.name + (t.list.length ? ' (' + t.list.length + ')' : ''));
          b.addEventListener('click', () => { if (s.at !== t.id) { s.at = t.id; ctx.save(); draw(); } });
          b.addEventListener('dblclick', () => { const n = prompt('Название схватки', t.name); if (n && n.trim()) { t.name = n.trim().slice(0, 30); ctx.save(); draw(); } });
          tabsEl.append(b);
        });
        tabsEl.append(btn('+', () => { const t = tabNew('Бой ' + (s.tabs.length + 1)); s.tabs.push(t); s.at = t.id; ctx.save(); draw(); }, 'itab add', 'Новая схватка: можно заранее собрать монстров'));
        if (s.tabs.length > 1) tabsEl.append(btn('×', () => {
          const t = act(s); if (!confirm('Удалить схватку «' + t.name + '»?')) return;
          s.tabs = s.tabs.filter(x => x !== t); s.at = s.tabs[0].id; ctx.save(); draw();
        }, 'itab del', 'Удалить эту схватку'));
      }
      function draw() {
        const t = act(s);
        lst.textContent = '';
        if (!t.list.length) lst.append(h('p', { class: 'dmempty' }, 'Здесь пока никого. Найдите монстра выше (подставятся КД, хиты, сопротивления и бросок инициативы), создайте своего («＋ Свой») или нажмите «В инициативу» на карточке монстра. Вкладки сверху — отдельные схватки: можно заготовить их заранее и нажать «Начать бой», когда понадобится.'));
        t.list.forEach((x, i) => lst.append(row(x, i)));
        drawTabs();
        ctx.title('Инициатива · ' + t.name + (t.started ? ' · раунд ' + t.round : ''));
      }
      const head = h('div', { class: 'irow ihead' }, h('span', { title: 'Результат броска инициативы: кто ходит раньше' }, 'Иниц.'), h('span', {}, 'Имя'),
        h('span', { title: 'Хиты сейчас / максимум' }, 'Хиты тек./макс.'), h('span', { title: 'Класс доспеха' }, 'КД'),
        h('span', { title: 'Число + Enter. Тип урона учитывает сопротивление, уязвимость и иммунитет. Отрицательное число — лечение' }, 'Урон / лечение'), h('span'));
      el.append(tabsEl, toolbar, res, head, lst);
      draw();
      ctx.el._refresh = draw;
    }
  });

  /* ---------- Запись из базы ---------- */
  DM.registerType('entity', {
    name: 'Запись', desc: 'Карточка из базы: монстр, заклинание, правило…', w: 5, h: 12,
    init: () => ({ e: 24, sec: 'bestiary', slug: '', hist: [] }),
    render(ctx) {
      const s = ctx.p.s, db = DB();
      const secSel = h('select', { class: 'esec', title: 'Где искать: раздел' });
      const edSel = h('select', { class: 'eed', title: 'Где искать: редакция' }, h('option', { value: '24' }, '2024'), h('option', { value: '14' }, '2014'), h('option', { value: 'all' }, 'Все'));
      const q = inp({ placeholder: 'Поиск по названию…', class: 'eq' });
      const res = h('div', { class: 'eres' });
      const card = h('div', { class: 'ecard' });
      if (!s.fe) { s.fe = String(s.e); s.fs = s.sec; }
      const back = btn('←', () => { const p = s.hist.pop(); if (p) go(p.e, p.sec, p.slug, true); }, 'eback', 'Назад');
      const fill = () => {
        const ords = s.fe === 'all' ? db.ORDERS[24] : db.ORDERS[+s.fe];
        secSel.textContent = '';
        secSel.append(h('option', { value: 'all' }, 'Все'));
        ords.forEach(k => secSel.append(h('option', { value: k }, db.SXS[s.fe === 'all' ? 24 : +s.fe][k].t)));
        if (s.fs !== 'all' && !ords.includes(s.fs)) s.fs = EQ[s.fs] && ords.includes(EQ[s.fs]) ? EQ[s.fs] : 'all';
        secSel.value = s.fs; edSel.value = s.fe;
      };
      async function go(e, sec, slug, isBack) {
        if (!db.SXS[e] || !db.SXS[e][sec]) { sec = db.ORDERS[e][0]; slug = ''; }
        if (!isBack && s.slug && (s.e !== e || s.sec !== sec || s.slug !== slug)) { s.hist.push({ e: s.e, sec: s.sec, slug: s.slug }); if (s.hist.length > 30) s.hist.shift(); }
        s.e = e; s.sec = sec; s.slug = slug || ''; ctx.save(); DM.noteEntity(ctx.p.id);
        back.disabled = !s.hist.length;
        card.textContent = '';
        if (!s.slug) { card.append(h('p', { class: 'dmempty' }, 'Найдите запись выше или нажмите на ссылку в другой панели.')); ctx.title('Запись'); return; }
        const data = await db.load(sec, e);
        const m = data.find(x => x.slug === s.slug);
        if (s.slug !== slug && slug) return;
        if (!m) { card.append(h('p', { class: 'dmempty' }, 'Запись не найдена: ' + s.slug)); return; }
        const box = h('div'); box.innerHTML = db.SXS[e][sec].card(m);
        card.textContent = ''; card.append(box); card.scrollTop = 0;
        ctx.title(m.name_ru);
        db.decorate(card, e, { k: db.SELFK[sec], slug: m.slug });
        if (db.placePic) db.placePic(card, e, sec, m);
        card.querySelectorAll('.stat').forEach(x => x.classList.add('ins'));
      }
      let tk = 0;
      async function search() {
        const my = ++tk, v = q.value.trim(); res.textContent = '';
        if (!v) return;
        const hits = await searchDB(db, edList(s.fe), s.fs, v, 60);
        if (my !== tk) return;
        if (!hits.length) res.append(h('div', { class: 'none' }, 'Ничего не найдено'));
        const multi = s.fe === 'all', allSec = s.fs === 'all';
        hits.forEach(x => res.append(h('a', { href: db.hh(x.e, x.sec, x.m.slug), onclick: ev => { ev.preventDefault(); ev.stopPropagation(); q.value = ''; res.textContent = ''; go(x.e, x.sec, x.m.slug); } },
          h('span', {}, x.m.name_ru), h('small', {}, [multi ? db.EDK(x.e) : '', allSec ? db.SXS[x.e][x.sec].t : '', x.m.name_en || ''].filter(Boolean).join(' · ')))));
      }
      q.addEventListener('input', search);
      q.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = res.querySelector('a'); if (a) a.click(); } if (e.key === 'Escape') { q.value = ''; res.textContent = ''; } });
      edSel.addEventListener('change', () => { s.fe = edSel.value; ctx.save(); fill(); search(); });
      secSel.addEventListener('change', () => { s.fs = secSel.value; ctx.save(); search(); });
      ctx.addBtn('↗', 'Открыть на странице', () => { if (s.slug) location.hash = db.hh(s.e, s.sec, s.slug); });
      ctx.body.append(h('div', { class: 'etools' }, back, edSel, secSel, q), res, card);
      ctx.el._nav = (e, sec, slug) => go(e, sec, slug);
      fill();
      go(s.e, s.sec, s.slug, true);
    }
  });

  /* ---------- Справка: состояния и правила ---------- */
  DM.registerType('conds', {
    name: 'Состояния', desc: 'Состояния и правила: список со ссылками на статьи', w: 3, h: 11,
    init: () => ({ e: 0, g: '' }),
    render(ctx) {
      const s = ctx.p.s, db = DB();
      const edSel = h('select', { title: 'Редакция' }, h('option', { value: '24' }, '2024'), h('option', { value: '14' }, '2014'));
      const grp = h('select', { title: 'Группа' });
      const q = inp({ placeholder: 'Поиск…' });
      const list = h('div', { class: 'clist' });
      let data = [];
      const gOf = m => m.group || m.category_ru || 'Прочее';
      async function load() {
        const e = s.e || db.ed, sec = e === 14 ? 'articles' : 'glossary';
        edSel.value = String(e);
        data = await db.load(sec, e);
        const gs = [...new Set(data.map(gOf))];
        grp.textContent = ''; grp.append(h('option', { value: '' }, 'Все группы'));
        gs.forEach(g => grp.append(h('option', { value: g }, g)));
        if (!gs.includes(s.g)) s.g = gs.includes('Состояния') ? 'Состояния' : '';
        grp.value = s.g; draw();
      }
      function draw() {
        const e = s.e || db.ed, sec = e === 14 ? 'articles' : 'glossary', v = db.norm(q.value.trim());
        list.textContent = '';
        data.filter(m => (!s.g || gOf(m) === s.g) && (!v || db.norm(m.name_ru + ' ' + (m.name_en || '')).includes(v)))
          .forEach(m => list.append(h('a', { href: db.hh(e, sec, m.slug) }, m.name_ru, h('small', {}, m.name_en || ''))));
        if (!list.children.length) list.append(h('div', { class: 'none' }, 'Ничего не найдено'));
      }
      edSel.addEventListener('change', () => { s.e = +edSel.value; s.g = ''; ctx.save(); load(); });
      grp.addEventListener('change', () => { s.g = grp.value; ctx.save(); draw(); });
      q.addEventListener('input', draw);
      ctx.body.append(h('div', { class: 'etools' }, edSel, grp), h('div', { class: 'etools' }, q), list);
      load();
    }
  });

  /* ---------- Заметки ---------- */
  DM.registerType('notes', {
    name: 'Заметки', desc: 'Свободный текст, сохраняется сам', w: 3, h: 5,
    init: () => ({ text: '' }),
    render(ctx) {
      const t = h('textarea', { class: 'notes', placeholder: 'Заметки по сцене, имена, секреты…', spellcheck: 'false' });
      t.value = ctx.p.s.text || '';
      t.addEventListener('input', () => { ctx.p.s.text = t.value; ctx.save(); });
      ctx.body.append(t);
    }
  });

  /* ---------- Счётчики ---------- */
  DM.registerType('counters', {
    name: 'Счётчики', desc: 'Ячейки заклинаний, ресурсы, отсчёты', w: 3, h: 6,
    init: () => ({ items: [{ n: 'Счётчик', v: 0 }] }),
    render(ctx) {
      const s = ctx.p.s, box = h('div', { class: 'cnts' });
      const draw = () => {
        box.textContent = '';
        s.items.forEach((c, i) => {
          const v = h('b', { class: 'cv' }, String(c.v));
          const set = d => { c.v += d; v.textContent = c.v; ctx.save(); };
          box.append(h('div', { class: 'cnt' },
            h('span', { class: 'cn', contenteditable: 'plaintext-only', spellcheck: 'false', onblur: e => { c.n = e.target.textContent.trim() || 'Счётчик'; ctx.save(); } }, c.n),
            btn('−', () => set(-1), 'cb2'), v, btn('+', () => set(1), 'cb2'),
            btn('×', () => { s.items.splice(i, 1); ctx.save(); draw(); }, 'xx', 'Убрать')));
        });
      };
      draw();
      ctx.body.append(box, btn('+ Счётчик', () => { s.items.push({ n: 'Счётчик', v: 0 }); ctx.save(); draw(); }, 'pri'));
    }
  });

  /* ---------- Переводчик единиц ---------- */
  DM.registerType('conv', {
    name: 'Единицы и монеты', desc: 'Футы↔метры, фунты↔кг, пересчёт монет', w: 3, h: 7,
    init: () => ({ v: '' }),
    render(ctx) {
      const f = (n, d) => (Math.round(n * (d || 10)) / (d || 10)).toString().replace('.', ',');
      const out = h('div', { class: 'cout' });
      const a = inp({ type: 'number', placeholder: 'Число', value: ctx.p.s.v, class: 'cin' });
      const cur = h('select', {}, [['мм', 'Медные (ММ)', 0.01], ['см', 'Серебряные (СМ)', 0.1], ['эм', 'Электрум (ЭМ)', 0.5], ['зм', 'Золотые (ЗМ)', 1], ['пм', 'Платиновые (ПМ)', 10]].map(([v, t]) => h('option', { value: v, selected: v === 'зм' }, t)));
      const W = { мм: 0.01, см: 0.1, эм: 0.5, зм: 1, пм: 10 };
      const draw = () => {
        const n = parseFloat(String(a.value).replace(',', '.')); ctx.p.s.v = a.value; ctx.save();
        out.textContent = '';
        if (isNaN(n)) return out.append(h('p', { class: 'dmempty' }, 'Введите число — увидите всё сразу.'));
        const gp = n * W[cur.value];
        const row = (l, v) => out.append(h('div', { class: 'cr' }, h('span', {}, l), h('b', {}, v)));
        row('Футы → метры', f(n * 0.3) + ' м'); row('Метры → футы', f(n / 0.3) + ' фт');
        row('Мили → км', f(n * 1.5) + ' км'); row('Км → мили', f(n / 1.5) + ' миль');
        row('Фунты → кг', f(n * 0.5) + ' кг'); row('Кг → фунты', f(n * 2) + ' фнт');
        out.append(h('div', { class: 'csep' }, 'Монеты (число = выбранный номинал)'));
        row('в ПМ', f(gp / 10, 100)); row('в ЗМ', f(gp, 100)); row('в ЭМ', f(gp * 2, 100)); row('в СМ', f(gp * 10, 100)); row('в ММ', f(gp * 100, 100));
      };
      a.addEventListener('input', draw); cur.addEventListener('change', draw);
      ctx.body.append(h('div', { class: 'etools' }, a, cur), out); draw();
    }
  });

  /* ---------- Игровое время ---------- */
  DM.registerType('time', {
    name: 'Игровое время', desc: 'День и время суток, отдыхи', w: 3, h: 5,
    init: () => ({ d: 1, m: 480 }),
    render(ctx) {
      const s = ctx.p.s, big = h('div', { class: 'tbig' }), sub = h('div', { class: 'tsub' });
      const part = m => m < 360 ? 'ночь' : m < 720 ? 'утро' : m < 1080 ? 'день' : 'вечер';
      const draw = () => {
        const hh = Math.floor(s.m / 60), mm = s.m % 60;
        big.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
        sub.textContent = 'День ' + s.d + ' · ' + part(s.m);
      };
      const add = m => { s.m += m; while (s.m >= 1440) { s.m -= 1440; s.d++; } while (s.m < 0) { s.m += 1440; s.d = Math.max(1, s.d - 1); } ctx.save(); draw(); };
      draw();
      ctx.body.append(big, sub, h('div', { class: 'tbtn' },
        btn('+10 мин', () => add(10)), btn('+1 ч', () => add(60)), btn('Корот. отдых +1 ч', () => add(60)), btn('Долгий отдых +8 ч', () => add(480)),
        btn('−10 мин', () => add(-10)), btn('Новый день', () => { s.d++; s.m = 480; ctx.save(); draw(); })));
    }
  });

  /* ---------- Картинка: файл с компьютера или ссылка ---------- */
  // файлы хранятся в IndexedDB браузера (в localStorage они не поместились бы); в экспорт экрана попадает только ссылка-ключ
  const IDB = {
    db: null, mem: new Map(),
    open() {
      if (this.db) return this.db;
      return this.db = new Promise((ok, no) => {
        try { const r = indexedDB.open('dm-img', 1); r.onupgradeneeded = () => r.result.createObjectStore('i'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); }
      });
    },
    async put(k, blob) { this.mem.set(k, blob); try { const d = await this.open(); await new Promise((ok, no) => { const t = d.transaction('i', 'readwrite'); t.objectStore('i').put(blob, k); t.oncomplete = ok; t.onerror = () => no(t.error); }); return true; } catch (e) { return false; } },
    async get(k) { if (this.mem.has(k)) return this.mem.get(k); try { const d = await this.open(); return await new Promise((ok, no) => { const r = d.transaction('i').objectStore('i').get(k); r.onsuccess = () => ok(r.result || null); r.onerror = () => no(r.error); }); } catch (e) { return null; } }
  };
  function shrink(file, max) {                           // уменьшаем большие снимки: до 1600 px по длинной стороне
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? ok(b) : no(new Error('toBlob')), 'image/webp', 0.88);
      };
      im.onerror = () => { URL.revokeObjectURL(url); no(new Error('не картинка')); };
      im.src = url;
    });
  }
  DM.registerType('image', {
    name: 'Картинка', desc: 'Карта или иллюстрация: файл с компьютера (можно перетащить или вставить Ctrl+V) или ссылка', w: 4, h: 7,
    init: () => ({ url: '', key: '' }),
    render(ctx) {
      const s = ctx.p.s, box = h('div', { class: 'imgbox', tabindex: '0' });
      let objUrl = '';
      ctx.onDispose(() => { if (objUrl) URL.revokeObjectURL(objUrl); });
      const draw = async () => {
        box.textContent = '';
        if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = ''; }
        let src = s.url;
        if (s.key) { const b = await IDB.get(s.key); if (b) src = objUrl = URL.createObjectURL(b); }
        if (!src) return box.append(h('p', { class: 'dmempty' }, 'Выберите файл, перетащите картинку сюда или вставьте её с помощью Ctrl+V. Можно и ссылку (https://…).'));
        const im = new Image(); im.alt = ''; im.src = src;
        im.onerror = () => { box.textContent = 'Не удалось показать картинку.'; };
        box.append(im);
      };
      const take = async file => {
        if (!file || !/^image\//.test(file.type)) return DM.toast('Это не картинка');
        try {
          const b = await shrink(file, 1600);
          s.key = s.key || ('i' + Math.random().toString(36).slice(2, 10)); s.url = '';
          const saved = await IDB.put(s.key, b);
          if (!saved) DM.toast('Браузер не дал сохранить файл: картинка пропадёт после перезагрузки');
          ctx.save(); draw();
        } catch (e) { DM.toast('Не получилось открыть картинку'); }
      };
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: e => { take(e.target.files[0]); e.target.value = ''; } });
      const u = inp({ placeholder: 'или ссылка https://…', value: s.url });
      u.addEventListener('change', () => { const v = u.value.trim(); if (v && !/^https?:\/\//i.test(v)) { DM.toast('Нужна ссылка, начинающаяся с https://'); u.value = ''; return; } s.url = v; if (v) s.key = ''; ctx.save(); draw(); });
      ctx.el.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); ctx.el.classList.add('drop'); } });
      ctx.el.addEventListener('dragleave', () => ctx.el.classList.remove('drop'));
      ctx.el.addEventListener('drop', e => { ctx.el.classList.remove('drop'); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) { e.preventDefault(); take(f); } });
      ctx.el.addEventListener('paste', e => { const it = [...(e.clipboardData || { items: [] }).items].find(i => i.type.startsWith('image/')); if (it) { e.preventDefault(); take(it.getAsFile()); } });
      ctx.body.append(h('div', { class: 'etools' }, btn('Файл с компьютера…', () => file.click(), 'pri'), u, file), box); draw();
    }
  });
})(window);
