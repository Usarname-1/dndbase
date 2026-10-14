/* ===== Печатный лист персонажа =====
   Две раскладки под редакции правил:
   · D&D 2024 — рамки на клетчатой бумаге, характеристики с навыками внутри блока;
   · D&D 2014 — серые панели, отдельные блоки спасбросков и навыков.
   Расчёты берутся из charrules.js (CSR); сюда приходят готовые данные derive().
   Страницы: 1) основной лист, 2) тексты умений, 3) заклинания, 4) карточки заклинаний,
   5) описание и портрет, 6) снаряжение. Все размеры — в мм, лист A4 с полями 8 мм. */
(function (root) {
  'use strict';
  const h = root.DM.h, R = root.CSR, DB = () => root.DB;
  const el = (tag, cls, ...k) => h(tag, { class: cls }, ...k);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sp = v => (v === '' || v == null) ? ' ' : v;
  const sgn = R.sgn;
  const dot = lev => h('i', { class: 'dt' + (lev ? ' on' : '') + (lev === 2 ? ' ex' : '') });
  const dia = on => h('i', { class: 'dm' + (on ? ' on' : '') });
  const circles = n => el('span', 'cs3', Array.from({ length: n }, () => h('i', { class: 'dt big' })));
  const svg = (s, cls) => { const e = h('span', { class: cls || '' }); e.innerHTML = s; return e; };
  const SHIELD = '<svg viewBox="0 0 60 70" preserveAspectRatio="none"><path d="M30 2.5 56 9v26c0 17-11 27-26 33C15 62 4 52 4 35V9z"/></svg>';
  const AB_SHORT = { str: 'Сил', dex: 'Лов', con: 'Тел', int: 'Инт', wis: 'Муд', cha: 'Хар' };
  const COIN_ORDER = [['mm', 'ММ'], ['sm', 'СМ'], ['em', 'ЭМ'], ['zm', 'ЗМ'], ['pm', 'ПМ']];
  const fld = (v, label, cls) => el('div', 'fld ' + (cls || ''), el('b', '', sp(v)), el('small', '', label));
  const box = (cls, title, ...k) => el('div', 'bx ' + cls, title ? el('div', 'bh', title) : null, ...k);
  const skRow = (lev, bonus, name, cls, extra) => el('div', 'sk' + (lev ? ' prf' : '') + (cls ? ' ' + cls : ''), dot(lev), el('b', 'bn', sgn(bonus)), el('span', 'snm', name, extra || null));
  const srcShort = f => f.src.replace(/^[^:]+: /, '') + (f.level ? ', ' + f.level + ' ур.' : '');
  const isFeat = f => f.src === 'Черты' || /^Предыстория/.test(f.src);

  function shell(title, c, cls) {
    return el('section', 'pg ' + (cls || ''), el('div', 'ph', el('b', 'pt', title), el('span', 'pn', c.name || '')));
  }
  const passive = (d, id) => 10 + d.skills.find(x => x.id === id).bonus;
  const hasShield = c => (c.inv || []).some(i => i.eq && i.slug === 'shield');
  function profFlags(d) {
    const A = R.lc(d.ci ? d.ci.armor : ''), W = R.lc(d.ci ? d.ci.weapons : '');
    const rest = W.replace(/прост\S*|воинск\S*|оружи\S*|[и,;.\s]/g, '');
    return { armor: ['легк', 'средн', 'тяжел', 'щит'].map(k => A.includes(k)), simple: /прост/.test(W), martial: /воинск/.test(W), other: rest.length > 2 };
  }
  const profText = (c, D, d, langStr) => {
    const tools = [d.ci && d.ci.tools, D.bg && D.bg.tools, c.story.tools].filter(x => x && !/^(нет|—)$/i.test(String(x).trim())).join('; ');
    return [d.ci && d.ci.weapons && !/^нет$/i.test(d.ci.weapons.trim()) && ['Оружие', d.ci.weapons], tools && ['Инструменты', tools], langStr(c) && ['Языки', langStr(c)]].filter(Boolean);
  };
  const featLists = (X, c, D, d) => { const all = X.featureList(c, D, d); return { feats: all.filter(f => !isFeat(f)), traits: all.filter(isFeat), all }; };
  const featItems = list => list.map(f => el('div', 'fi', el('b', '', f.name), el('small', '', ' ' + srcShort(f))));
  const coinBox = (c, cls) => el('div', 'coins ' + (cls || ''), COIN_ORDER.map(([k, t]) => el('div', 'coin', el('small', '', t), el('b', '', sp(c.coins[k] || '')))));
  const lined = (v, cls) => el('div', 'tx ln ' + (cls || ''), v ? el('span', '', v) : null);

  /* ============ страница 1 · D&D 2024 ============ */
  function page24(X, c, D, d) {
    const P = el('section', 'pg e24 p1'), L = featLists(X, c, D, d), pf = profFlags(d);
    const hd = el('div', 'hd',
      box('hn', null, fld(c.name, 'Имя персонажа', 'snm'),
        el('div', 'g2', fld(D.bg && D.bg.name_ru, 'Предыстория'), fld(D.cls && D.cls.name_ru, 'Класс'), fld(D.sp && D.sp.name_ru, 'Вид'), fld(D.sub && D.sub.name, 'Подкласс'))),
      el('div', 'bx lv', el('b', '', c.lvl), el('small', '', 'Уровень'), el('i', 'xpl'), el('small', '', 'Опыт')),
      el('div', 'shield', svg(SHIELD, 'sv'), el('div', 'si', el('small', '', 'Класс защиты'), el('b', '', d.ac), el('small', '', 'Щит'), dia(hasShield(c)))),
      box('hpb', null,
        el('div', 'hpc', el('div', 'hph', 'Хиты'), el('div', 'hpr', el('div', 'hpcur', el('small', '', 'Текущие')), el('div', 'hpmt', el('div', 'hmx', el('b', '', d.hp), el('small', '', 'Максимум')), el('div', 'htmp', el('small', '', 'Временные'))))),
        el('div', 'hdc', el('div', 'hph', 'Кости хитов'), el('div', 'hdv', el('b', '', 'к' + d.die), el('small', '', 'Всего ' + c.lvl)), el('div', 'hdu', el('small', '', 'Потрачено'))),
        el('div', 'dsc', el('div', 'hph', 'Спасброски от смерти'), el('div', 'dsr', el('small', '', 'Успехи'), circles(3)), el('div', 'dsr', el('small', '', 'Провалы'), circles(3)))));
    const rule = el('div', 'hrule', el('span', '', 'Лист персонажа · D&D 2024'));
    const ab = a => box('ab', a.ru,
      el('div', 'am', el('div', 'mc', el('span', 'circ', sgn(d.mod[a.k])), el('small', '', 'Модификатор')), el('div', 'vc', el('span', 'val', d.score[a.k]), el('small', '', 'Значение'))),
      el('div', 'sks', skRow(d.saveProf.has(a.k) ? 1 : 0, d.saves[a.k], 'Спасбросок', 'sv'), ...d.skills.filter(s => s.ab === a.k).map(s => skRow(s.lev, s.bonus, s.n))));
    const A = k => R.AB.find(a => a.k === k);
    const colA = el('div', 'acol', box('pb', 'Бонус владения', el('div', 'pbv', sgn(d.pb))), ab(A('str')), ab(A('dex')), ab(A('con')),
      box('exh', 'Истощение', el('div', 'sq6', Array.from({ length: 6 }, () => h('i', { class: 'sqr' })))),
      box('hi', 'Героическое вдохновение', el('div', 'hic', h('i', { class: 'dt huge' }))));
    const colB = el('div', 'acol', ab(A('int')), ab(A('wis')), ab(A('cha')));
    const pt = profText(c, D, d, X.langStr);
    const profs = box('prof', 'Владение снаряжением и умения',
      el('div', 'pry', el('span', 'pl', 'Доспехи'), ['Лёгкие', 'Средние', 'Тяжёлые', 'Щиты'].map((x, i) => el('span', 'pi', dia(pf.armor[i]), x))),
      el('div', 'pry', el('span', 'pl', 'Оружие'), el('span', 'pi', dia(pf.simple), 'Простое'), el('span', 'pi', dia(pf.martial), 'Воинское'), el('span', 'pi', dia(pf.other), 'Другое')),
      el('div', 'tx gr', pt.map(([l, v]) => el('p', '', el('b', '', l + ': '), v))));
    const pas2 = 'Проницательность ' + passive(d, 'insight') + ' · ' + d.skills.find(x => x.id === 'investigation').n + ' ' + passive(d, 'investigation');
    const stats = el('div', 'st4', box('sb', 'Инициатива', el('b', '', sgn(d.init))), box('sb', 'Скорость', el('b', '', d.speed + ' фт.')),
      box('sb', 'Пассивное восприятие', el('b', '', passive(d, 'perception')), el('small', 'pas2', pas2)), box('sb', 'Состояния', el('i', 'cnd')));
    const rows = X.attackList(c, D, d), wr = [];
    for (let i = 0; i < 6; i++) { const r = rows[i] || {}; wr.push(h('tr', {}, h('td', {}, sp(r.n)), h('td', { class: 'c' }, sp(r.bonus)), h('td', {}, sp(r.dmg)), h('td', {}, sp(r.note)))); }
    const wp = box('wp', 'Оружие и боевые заклинания', h('table', { class: 'wtab' },
      h('tr', {}, h('th', {}, 'Название'), h('th', { class: 'c' }, 'Бонус / Сл'), h('th', {}, 'Урон / вид'), h('th', {}, 'Заметки')), ...wr));
    const fbox = box('fb', 'Умения и способности', el('div', 'fl gr', featItems(L.all)));
    const mini = (t, v) => box('mn', t, el('b', '', v));
    const bot = el('div', 'bot', el('div', 'mini4', mini('Размер', d.size), mini('Грузоподъёмность', d.carry + ' / ' + d.carry * 2 + ' фунт.'), mini('Прыжок В.', d.jumpHigh + ' фут.'), mini('Прыжок Д.', d.jumpLong + ' фут.')),
      box('mon', 'Монеты', coinBox(c)));
    P.append(hd, rule, el('div', 'bd', el('div', 'left', el('div', 'abcols', colA, colB), profs), el('div', 'right', stats, wp, fbox, bot)));
    return P;
  }

  /* ============ страница 1 · D&D 2014 ============ */
  function page14(X, c, D, d) {
    const P = el('section', 'pg e14 p1'), L = featLists(X, c, D, d), pf = profFlags(d);
    const clsText = D.cls ? D.cls.name_ru + (D.sub ? ' (' + D.sub.name + ')' : '') : '';
    const hd = el('div', 'hd', el('div', 'hname', el('b', '', sp(c.name)), el('small', '', 'Имя персонажа')),
      box('hinfo', null, el('div', 'g4',
        fld(clsText + (clsText ? ' ' : '') + c.lvl, 'Класс и уровень'), fld(D.bg && D.bg.name_ru, 'Предыстория'), fld('', 'Опыт'),
        fld(D.sp && D.sp.name_ru, 'Раса'), fld(c.align, 'Мировоззрение'), el('div', 'fld'))));
    const strip = el('div', 'abstrip', R.AB.map(a => el('div', 'ab14', el('div', 'an' + (a.ru.length > 9 ? ' long' : ''), a.ru), el('div', 'amod', sgn(d.mod[a.k])), el('div', 'asc', d.score[a.k]))));
    const savesBox = box('sv14', 'Спасброски', ...R.AB.map(a => el('div', 'sk' + (d.saveProf.has(a.k) ? ' prf' : ''), dot(d.saveProf.has(a.k) ? 1 : 0), el('b', 'bn', sgn(d.saves[a.k])), el('span', 'snm big', a.ru))));
    const sk = d.skills.slice().sort((x, y) => x.n.localeCompare(y.n, 'ru'));
    const skillsBox = box('sk14', 'Навыки', ...sk.map(s => skRow(s.lev, s.bonus, s.n, '', el('i', 'at', ' (' + AB_SHORT[s.ab] + ')'))));
    const pt = profText(c, D, d, X.langStr);
    const c1 = el('div', 'c1', el('div', 'c1top', strip, el('div', 'c1b',
      el('div', 'insp', el('i', 'sqb'), el('b', '', 'Вдохновение')), el('div', 'pbc', el('span', 'pcirc', sgn(d.pb)), el('b', '', 'Бонус владения')), savesBox, skillsBox)),
      el('div', 'pasw', el('span', 'poval', passive(d, 'perception')), el('b', '', 'Пассивная Мудрость (Восприятие)')),
      box('lang', 'Прочие владения и языки', el('div', 'tx ln', pf.armor.some(Boolean) ? el('p', '', el('b', '', 'Доспехи: '), ['Лёгкие', 'Средние', 'Тяжёлые', 'Щиты'].filter((x, i) => pf.armor[i]).join(', ')) : null, pt.map(([l, v]) => el('p', '', el('b', '', l + ': '), v)))));
    const rows = X.attackList(c, D, d), wr = [];
    for (let i = 0; i < 5; i++) { const r = rows[i] || {}; wr.push(h('tr', {}, h('td', {}, sp(r.n)), h('td', { class: 'c' }, sp(r.bonus)), h('td', {}, sp(r.dmg)))); }
    const inv = (c.inv || []).map(i => el('div', 'iti', el('i', 'eqm', i.eq ? '●' : ''), el('span', '', i.n), i.q > 1 ? el('b', '', '×' + i.q) : null));
    const c2 = el('div', 'c2',
      el('div', 'panel',
        el('div', 'p3', el('div', 'shield s14', svg(SHIELD, 'sv'), el('div', 'si', el('small', '', 'КЗ'), el('b', '', d.ac), dia(hasShield(c)))), box('sb', 'Инициатива', el('b', '', sgn(d.init))), box('sb', 'Скорость', el('b', '', d.speed + ' фт.'))),
        box('mx', 'Максимум хитов', el('b', '', d.hp)), box('curhp', 'Текущие хиты'), box('tmp', 'Временные хиты'),
        el('div', 'p2', box('hdb', 'Кость хитов', el('small', '', 'Всего ' + c.lvl), el('b', '', 'к' + d.die), el('small', 'sp', 'Потрачено')),
          box('dsb', 'Спасброски от смерти', el('div', 'dsr', el('small', '', 'Успехи'), circles(3)), el('div', 'dsr', el('small', '', 'Провалы'), circles(3))))),
      box('wp', 'Атаки и заклинания', h('table', { class: 'wtab' }, h('tr', {}, h('th', {}, 'Название'), h('th', { class: 'c' }, 'Бонус атаки'), h('th', {}, 'Урон / вид')), ...wr), el('div', 'tx ln')),
      box('eq', 'Снаряжение', coinBox(c, 'small'), el('div', 'tx ln', inv)));
    const ps = (k, label) => box('pers', label, lined(c.story[k]));
    const c3 = el('div', 'c3', el('div', 'panel', ps('traits', 'Черты характера'), ps('ideals', 'Идеалы'), ps('bonds', 'Привязанности'), ps('flaws', 'Слабости')),
      box('fb', 'Умения и способности', el('div', 'tx ln', featItems(L.feats), L.traits.length ? el('div', 'fsub', 'Черты') : null, featItems(L.traits))));
    P.append(hd, el('div', 'bd', c1, c2, c3));
    return P;
  }

  /* ============ страница: тексты умений ============ */
  function featPages(X, c, D, d) {
    const P = shell('Умения и особенности', c, 'flow ftxt'), DBx = DB();
    const cols = el('div', 'pfeat'), list = X.featureList(c, D, d);
    if (!list.length) return null;
    list.forEach(f => {
      const body = el('div', 'ft'); body.innerHTML = (f.blocks ? DBx.B(f.blocks) : esc(f.text || '')).replace(/<\/(p|li|div|h\d)>/g, '$& ');
      if (c.featTxt !== 'full') { const tx = body.textContent.replace(/\s+/g, ' ').trim(); body.textContent = tx.length > 260 ? tx.slice(0, 260).replace(/\s\S*$/, '') + '…' : tx; }
      cols.append(el('div', 'pfi', el('b', '', f.name), el('small', '', ' ' + f.src + (f.level ? ', ' + f.level + ' ур.' : '')), body));
    });
    P.append(cols);
    return [P];
  }

  /* ============ страницы заклинаний ============ */
  const spellSorted = (c, D) => c.spells.slice().sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name, 'ru')).map(s => ({ s, m: D.spells.find(x => x.slug === s.slug) }));
  const casterName = d => R.ABN(d.sp.ab).ru;
  const slotDia = n => Array.from({ length: n }, () => dia(false));

  function spells24(X, c, D, d) {
    const list = spellSorted(c, D), pages = [], FIRST = 34, NEXT = 44;
    const chunks = []; let i = 0;
    chunks.push(list.slice(0, FIRST)); i = FIRST;
    while (i < list.length) { chunks.push(list.slice(i, i + NEXT)); i += NEXT; }
    chunks.forEach((chunk, pi) => {
      const P = shell('Заклинания', c, 'e24 spg' + (pi ? ' cont' : ''));
      if (!pi) {
        const sl = d.sp.rows.map((r, k) => el('div', 'slc' + (r.n ? '' : ' off'), el('small', '', (k + 1) + '-й'), el('b', '', r.n || '—'), r.n ? el('div', 'sld', slotDia(r.n)) : null, el('i', 'slt', r.tag)));
        P.append(el('div', 'sptop',
          box('spst', null, el('div', 'ss', el('b', '', casterName(d)), el('small', '', 'Заклинательная характеристика')), el('div', 'ss', el('b', '', sgn(R.mod(d.score[d.sp.ab]))), el('small', '', 'Заклинательный модификатор')),
            el('div', 'ss', el('b', '', d.sp.dc), el('small', '', 'Сложность спасброска')), el('div', 'ss', el('b', '', sgn(d.sp.atk)), el('small', '', 'Бонус атаки заклинанием'))),
          box('spsl', 'Ячейки заклинаний', el('div', 'slg', sl), el('div', 'spn', 'Отмечайте потраченные ячейки'
            + (d.sp.cantrips != null ? ' · Заговоров: ' + d.sp.cantrips : '') + (d.sp.prepared != null ? ' · Подготовлено: ' + d.sp.prepared : d.sp.known != null ? ' · Известно: ' + d.sp.known : '')))));
      }
      const cap = pi ? NEXT : FIRST, rows = [];
      chunk.forEach(({ s, m }) => rows.push(h('tr', {}, h('td', { class: 'c' }, dia(s.prep || s.lvl === 0)), h('td', { class: 'c' }, s.lvl), h('td', { class: 'snm' }, s.name, s.free ? el('small', '', ' бонус') : null),
        h('td', {}, m ? m.cast_time : ''), h('td', {}, m ? m.range : ''), h('td', { class: 'c fl' }, m && m.concentration ? 'К' : ''), h('td', { class: 'c fl' }, m && m.ritual ? 'Р' : ''), h('td', { class: 'comp' }, m ? m.components : ''), h('td', {}, ''))));
      const blank = pi === chunks.length - 1 ? cap - chunk.length : 0;
      for (let k = 0; k < blank; k++) rows.push(h('tr', {}, ...Array.from({ length: 9 }, (_, j) => h('td', { class: j === 0 ? 'c' : '' }, j === 0 ? dia(false) : ''))));
      P.append(box('spt', 'Заговоры и подготовленные заклинания', h('table', { class: 'sptab' },
        h('tr', {}, h('th', { class: 'c' }, ''), h('th', { class: 'c' }, 'Ур.'), h('th', {}, 'Название'), h('th', {}, 'Время сотворения'), h('th', {}, 'Дистанция'), h('th', { class: 'c', title: 'Концентрация' }, 'К'), h('th', { class: 'c', title: 'Ритуал' }, 'Р'), h('th', {}, 'Компоненты'), h('th', {}, 'Заметки')), ...rows)));
      P.append(el('div', 'pnote', '◆ — заговор или подготовленное заклинание. К — концентрация, Р — ритуал.'));
      pages.push(P);
    });
    return pages;
  }

  function spells14(X, c, D, d) {
    const P = shell('Заклинания', c, 'e14 spg');
    const by = {}; c.spells.forEach(s => (by[s.lvl] = by[s.lvl] || []).push(s));
    Object.values(by).forEach(a => a.sort((x, y) => x.name.localeCompare(y.name, 'ru')));
    const min = [8, 12, 12, 12, 9, 9, 8, 8, 6, 6];
    const lvlBox = l => {
      const items = by[l] || [], n = Math.max(min[l], items.length), sr = l ? d.sp.rows[l - 1] : null, slots = sr ? sr.n : 0;
      const lines = []; for (let i = 0; i < n; i++) { const s = items[i], m = s && D.spells.find(x => x.slug === s.slug);
        lines.push(el('div', 'sl', dot(s && (s.prep || l === 0) ? 1 : 0), el('span', '', s ? s.name : ''), m && (m.concentration || m.ritual) ? el('small', '', [m.concentration ? 'К' : '', m.ritual ? 'Р' : ''].filter(Boolean).join(' ')) : null)); }
      return el('div', 'lv14', el('div', 'lh', el('span', 'ln0', l), l ? el('span', 'lt', el('small', '', 'Всего ячеек'), el('b', '', slots || '—'), sr.tag ? el('small', 'tg', sr.tag) : null) : el('b', 'lz', 'Заговоры'), l && slots ? el('span', 'ls', el('small', '', 'Потрачено'), circles(Math.min(slots, 4))) : null), ...lines);
    };
    const top = el('div', 'sphd', fld(D.cls ? D.cls.name_ru : '', 'Класс заклинателя', 'c1'), el('div', 'bx sbx', el('b', '', casterName(d)), el('small', '', 'Базовая характеристика заклинаний')),
      el('div', 'bx sbx', el('b', '', d.sp.dc), el('small', '', 'Сложность спасброска')), el('div', 'bx sbx', el('b', '', sgn(d.sp.atk)), el('small', '', 'Бонус атаки')));
    P.append(top, el('div', 'lvcols', el('div', 'lvc', lvlBox(0), lvlBox(1), lvlBox(2)), el('div', 'lvc', lvlBox(3), lvlBox(4), lvlBox(5)), el('div', 'lvc', lvlBox(6), lvlBox(7), lvlBox(8), lvlBox(9))));
    P.append(el('div', 'pnote', '● — заговор или подготовленное заклинание. К — концентрация, Р — ритуал.'));
    return [P];
  }

  /* ============ карточки заклинаний (63,5 × 88,9 мм; по 9 на странице) ============ */
  function buildCards(c, D, host) {
    const DBx = DB(), cards = [];
    spellSorted(c, D).forEach(({ s, m }) => {
      if (!m) return;
      const chips = [m.cast_time, m.range, m.duration].filter(Boolean).map(t => el('span', 'schip', t));
      const flags = [m.concentration ? 'К' : '', m.ritual ? 'Р' : ''].filter(Boolean).map(t => el('span', 'schip flag', t));
      const mk = () => {
        const body = el('div', 'cbody');
        return { node: el('div', 'scard', el('div', 'ch', el('span', 'cl', m.level), el('b', 'scn', m.name_ru)), el('div', 'chips', flags, chips), body,
          el('div', 'cf', el('span', 'cc', m.components || ''), el('span', 'cpg', '')), el('div', 'sch', (m.school || '') + ' | ' + (m.name_en || ''))), body };
      };
      const full = html(DBx.B(m.blocks || []) + (m.higher ? '<p>' + DBx.esc(m.higher).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>' : ''));
      let cur = mk(); host.append(cur.node); const group = [cur];
      [...full.children].forEach(ch => {
        cur.body.append(ch);
        if (cur.body.scrollHeight > cur.body.clientHeight + 1) {
          if (cur.body.children.length > 1) { cur.body.removeChild(ch); cur = mk(); host.append(cur.node); cur.body.append(ch); group.push(cur); }
          let fs = 6.9; while (cur.body.scrollHeight > cur.body.clientHeight + 1 && fs > 5.4) { fs -= 0.2; cur.body.style.fontSize = fs + 'pt'; }
        }
      });
      if (group.length > 1) group.forEach((g, i) => { g.node.querySelector('.cpg').textContent = (i + 1) + '/' + group.length; });
      group.forEach(g => cards.push(g.node));
    });
    return cards;
  }
  function html(s) { const d = h('div', {}); d.innerHTML = s; return d; }
  function cardPages(c, D, sh) {
    const host = el('div', 'cardhost csheet-measure'); sh.append(host);   // измерение: карточки должны быть в документе
    const cards = buildCards(c, D, host), pages = [];
    host.remove();
    for (let i = 0; i < cards.length; i += 9) { const P = shell('Заклинания: карточки', c, 'cards'); P.append(el('div', 'cgrid', ...cards.slice(i, i + 9))); pages.push(P); }
    return pages;
  }

  /* ============ страница: описание ============ */
  function descPage(X, c, D, d) {
    const ed = c.ed === 24 ? 'e24' : 'e14', P = shell('Описание персонажа', c, 'flow desc ' + ed);
    const story = (k, t, cls) => box('st ' + (cls || ''), t, lined(c.story[k], 'm'));
    const portrait = box('port', 'Портрет', el('div', 'pimg', c.portrait ? h('img', { src: c.portrait, alt: '' }) : null));
    const left = el('div', 'dcol', portrait, box('st grow', 'Союзники и организации', el('div', 'tx ln m')), box('st grow', 'Цели и задачи', el('div', 'tx ln m')));
    const right = el('div', 'dcol', box('st look grow', 'Внешность и история', lined(c.story.look, 'm tall')),
      ed === 'e24' ? el('div', 'p4', story('traits', 'Черты характера'), story('ideals', 'Идеалы'), story('bonds', 'Привязанности'), story('flaws', 'Слабости')) : null,
      box('st grow', 'Заметки', lined(c.story.notes, 'm tall')));
    P.append(el('div', 'dgrid', left, right));
    return [P];
  }

  /* ============ страница: снаряжение ============ */
  function gearPage(X, c, D, d) {
    const ed = c.ed === 24 ? 'e24' : 'e14', P = shell('Снаряжение', c, 'flow gear desc ' + ed);
    let w = 0;
    const rows = (c.inv || []).map(i => { const g = X.invG(D, i), ww = g && g.weight_lb ? g.weight_lb * i.q : 0; w += ww; return h('tr', {}, h('td', { class: 'c' }, i.eq ? '●' : ''), h('td', {}, i.n), h('td', { class: 'c' }, i.q), h('td', { class: 'c' }, ww ? Math.round(ww * 10) / 10 : '')); });
    while (rows.length < 40) rows.push(h('tr', {}, h('td', { class: 'c' }), h('td', {}), h('td', {}), h('td', {})));
    const cap = d.score.str * 15, att = (c.inv || []).filter(i => i.eq && i.sec === 'items' && (X.invG(D, i) || {}).attunement).length;
    const inv = box('dinv', 'Инвентарь', h('table', { class: 'itab' }, h('tr', {}, h('th', { class: 'c' }, ''), h('th', {}, 'Предмет'), h('th', { class: 'c' }, 'Кол.'), h('th', { class: 'c' }, 'Вес, фнт.')), ...rows),
      el('div', 'cap', el('span', '', 'Вес: ', el('b', '', Math.round(w * 10) / 10 + ' фнт.')), el('span', '', 'Грузоподъёмность: ', el('b', '', cap + ' фнт.'))));
    const side = el('div', 'dcol', box('att', 'Настройка на магические предметы', el('div', 'attn', [0, 1, 2].map(i => dia(i < att)))),
      box('st grow', 'Сокровища', el('div', 'tx ln m')), box('st grow', 'Заметки о снаряжении', el('div', 'tx ln m')));
    P.append(box('dcoin', 'Монеты', coinBox(c)), el('div', 'dgrid gearg', inv, side));
    return [P];
  }

  /* ============ сборка ============ */
  const on = (c, k) => !(c.pOff && c.pOff[k]);
  function build(sh, ctx) {
    const { c, D, d, X } = ctx, e24 = c.ed === 24, pages = [];
    if (on(c, 'main')) pages.push(e24 ? page24(X, c, D, d) : page14(X, c, D, d));
    if (c.featTxt !== 'none') { const fp = featPages(X, c, D, d); if (fp) pages.push(...fp); }
    if (d.sp.has) {
      if (on(c, 'spells')) pages.push(...(e24 ? spells24(X, c, D, d) : spells14(X, c, D, d)));
      if (c.printSpells && c.spells.length) pages.push(...cardPages(c, D, sh));
    }
    if (on(c, 'desc')) pages.push(...descPage(X, c, D, d));
    if (on(c, 'gear')) pages.push(...gearPage(X, c, D, d));
    pages.forEach(p => { if (!p.classList.contains('e24') && !p.classList.contains('e14')) p.classList.add(e24 ? 'e24' : 'e14'); });
    sh.append(...pages);
    const p1 = pages.find(p => p.classList.contains('p1'));
    if (p1) { const trim = () => trimLists(p1); trim(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(trim); }
    return pages;
  }
  // списки умений на первой странице не помещаются — обрезаем по высоте блока, остальное есть на страницах с текстами
  function trimLists(P) {
    P.querySelectorAll('.fl, .tx.ln').forEach(box => {
      box.querySelectorAll('.fmore').forEach(n => n.remove());
      const items = [...box.querySelectorAll('.fi')];
      if (!items.length) return;
      items.forEach(i => { i.style.display = ''; });
      const over = () => box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;
      if (!over()) return;
      const more = el('div', 'fmore', '');
      let hidden = 0;
      const upd = () => { more.textContent = '… ещё ' + hidden; };
      box.append(more); upd();
      for (let k = items.length - 1; k >= 0 && over(); k--) { items[k].style.display = 'none'; hidden++; upd(); }
    });
  }
  // масштаб предпросмотра: лист (210 мм) помещается в ширину окна; на печать не влияет
  function fit(sh) {
    const set = () => { const w = (sh.parentElement || sh).clientWidth, z = Math.min(1, Math.max(0.3, (w - 24) / 793.7)); sh.style.setProperty('--z', z.toFixed(3)); };
    set();
    if (window.ResizeObserver) { const ro = new ResizeObserver(set); ro.observe(sh.parentElement || sh); sh._ro = ro; }
  }

  root.CSP = { build, shell, fit };
})(window);
