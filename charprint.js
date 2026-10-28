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
  /* ---- живой лист ----
     LIVE != null, пока лист открыт для правки (переключатель над листом): кружки и ромбики нажимаются, числа и записи правятся прямо на листе.
     Отметки (спасброски от смерти, ячейки, истощение…) лежат в c.play.t и печатаются как есть. Сам по себе лист ничего не пересчитывает:
     всё, что влияет на числа (щит, владение навыком, КД, хиты…), идёт через LIVE.* из charsheet.js и заставляет пересчитать персонажа. */
  let LIVE = null;
  const pl = c => { c.play = c.play || {}; c.play.t = c.play.t || {}; return c.play; };
  const tget = (c, k) => (pl(c).t[k] | 0);
  const tset = (c, k, v) => { v = Math.max(0, v | 0); if (v) pl(c).t[k] = v; else delete pl(c).t[k]; };
  // n значков подряд, отмечено первых k (ключ key в c.play.t): повторное нажатие на последний отмеченный снимает отметку
  function trk(c, key, n, mk) {
    const k = Math.min(n, tget(c, key)), items = [];
    const paint = () => { const v = Math.min(n, tget(c, key)); items.forEach((x, i) => x.classList.toggle('on', i < v)); };
    for (let i = 0; i < n; i++) {
      const x = mk(i < k); items.push(x);
      if (LIVE) { x.classList.add('ix'); x.addEventListener('click', ev => { ev.stopPropagation(); const v = tget(c, key); tset(c, key, v === i + 1 ? i : i + 1); paint(); LIVE.save(); }); }
    }
    return items;
  }
  // значок-переключатель с действием (щит, владение…): без правки остаётся обычным значком
  const tog = (node, fn, tip) => { if (LIVE && fn) { node.classList.add('ix'); if (tip) node.title = tip; node.addEventListener('click', ev => { ev.stopPropagation(); fn(); }); } return node; };
  // поле ввода на листе; без правки — просто текст (как было). o: { num, c — по центру, ov — число изменено вручную, tip }
  function ie(value, set, o) {
    o = o || {}; const v = value == null ? '' : value;
    if (!LIVE || !set) return document.createTextNode(String(v));
    const i = h('input', { type: 'text', class: 'ie' + (o.c ? ' c' : '') + (o.ov ? ' ov' : ''), value: v, autocomplete: 'off', spellcheck: 'false', title: o.tip || (o.ov ? 'Изменено вручную: впишите расчётное значение, чтобы вернуть пересчёт' : '') });
    if (o.num) i.setAttribute('inputmode', 'numeric');
    i.addEventListener('focus', () => i.select());
    i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); if (e.key === 'Escape') { i.value = v; i.blur(); } });
    i.addEventListener('change', () => { const t = i.value.trim(); if (o.num) { if (t === '' && o.empty) set(null); else if (/^[+\-−]?\d+$/.test(t)) set(R.intOf(t)); else i.value = v; } else set(i.value); });
    return i;
  }
  // записи в линованных полях: на экране — поле для ввода на тех же линиях
  function area(value, set) {
    if (!LIVE || !set) return value ? el('span', '', value) : null;
    const t = h('textarea', { class: 'ie ta', spellcheck: 'false' }, value || '');
    t.addEventListener('change', () => set(t.value)); return t;
  }
  // текущие и временные хиты: пустое поле — как на бумажном бланке, число вписывается на листе
  const hpIn = (c, key) => { const v = c[key], shown = v == null || (key === 'hpTemp' && !v) ? '' : v;
    return LIVE ? el('div', 'hpin', ie(shown, n => { c[key] = n == null ? (key === 'hpTemp' ? 0 : null) : Math.max(0, n); LIVE.save(); }, { num: true, c: true, empty: true })) : (shown !== '' ? el('div', 'hpin', String(shown)) : null); };
  const hdIn = c => { const u = tget(c, 'hd'); return LIVE ? el('div', 'hdin', ie(u || '', n => { tset(c, 'hd', n || 0); LIVE.save(); }, { num: true, c: true, empty: true })) : (u ? el('div', 'hdin', String(u)) : null); };
  const deathDots = (c, key) => el('span', 'cs3', trk(c, key, 3, on => h('i', { class: 'dt big' + (on ? ' on' : '') })));
  // пустые строки таблицы «Оружие и боевые заклинания» — собственные записи (c.atkMan[номер пустой строки])
  const atkRow = (c, j, keys) => { const m = (c.atkMan || {})[j] || {};
    return h('tr', {}, ...keys.map(k => h('td', { class: k === 'bonus' ? 'c' : '' }, LIVE ? ie(m[k] || '', v => { c.atkMan = c.atkMan || {}; (c.atkMan[j] = c.atkMan[j] || {})[k] = v; LIVE.save(); }, { c: k === 'bonus' }) : sp(m[k])))); };
  const dot = lev => h('i', { class: 'dt' + (lev ? ' on' : '') + (lev === 2 ? ' ex' : '') });
  const dia = on => h('i', { class: 'dm' + (on ? ' on' : '') });
  const circles = n => el('span', 'cs3', Array.from({ length: n }, () => h('i', { class: 'dt big' })));
  const svg = (s, cls) => { const e = h('span', { class: cls || '' }); e.innerHTML = s; return e; };
  const SHIELD = '<svg viewBox="0 0 60 70" preserveAspectRatio="none"><path d="M30 2.5 56 9v26c0 17-11 27-26 33C15 62 4 52 4 35V9z"/></svg>';
  const AB_SHORT = { str: 'Сил', dex: 'Лов', con: 'Тел', int: 'Инт', wis: 'Муд', cha: 'Хар' };
  const COIN_ORDER = [['mm', 'ММ'], ['sm', 'СМ'], ['em', 'ЭМ'], ['zm', 'ЗМ'], ['pm', 'ПМ']];
  // выпадающий список вместо текста (класс, подкласс, вид); без правки — обычный текст
  const pick = (cur, opts, set, ph) => h('select', { class: 'ie sel', onchange: e => set(e.target.value) },
    h('option', { value: '' }, ph || '—'), ...(opts || []).map(o => h('option', { value: o[0], selected: o[0] === cur }, o[1])));
  const fldS = (text, cur, opts, set, label, cls, ph) => el('div', 'fld ' + (cls || ''), el('b', '', LIVE && opts && opts.length ? pick(cur, opts, set, ph) : sp(text)), el('small', '', label));
  // вид (и подвид, если у вида он есть)
  const spFld = (c, D, label) => LIVE
    ? el('div', 'fld', el('b', 'cl14', pick(c.sp, LIVE.opts.sp, v => LIVE.setSp(v), 'выберите'), LIVE.opts.spo ? pick(c.spOpt, LIVE.opts.spo.map(o => [o, o]), v => LIVE.setSpo(v), LIVE.opts.spoL || '—') : null), el('small', '', label))
    : fld(D.sp && D.sp.name_ru, label);
  const fld = (v, label, cls, set) => el('div', 'fld ' + (cls || ''), el('b', '', set && LIVE ? ie(v, set) : sp(v)), el('small', '', label));
  const box = (cls, title, ...k) => el('div', 'bx ' + cls + (title ? '' : ' nh'), title ? el('div', 'bh', title) : null, ...k);
  const skRow = (lev, bonus, name, cls, extra, tag) => el('div', 'sk' + (lev ? ' prf' : '') + (cls ? ' ' + cls : ''), tog(dot(lev), tag && (() => LIVE.prof(tag)), 'Владение: нажмите, чтобы изменить'), el('b', 'bn', sgn(bonus)), el('span', 'snm', name, extra || null));
  const srcShort = f => f.src.replace(/^[^:]+: /, '') + (f.level ? ', ' + f.level + ' ур.' : '');
  const isFeat = f => f.src === 'Черты' || /^Предыстория/.test(f.src);

  function shell(title, c, cls) {
    return el('section', 'pg ' + (cls || ''), el('div', 'ph', el('b', 'pt', title), el('span', 'pn', c.name || '')));
  }
  const passive = (d, id) => (d.passive ? d.passive[id] : 10 + d.skills.find(x => x.id === id).bonus);   // с учётом «Внимательного» и т. п.
  const hasShield = c => (c.inv || []).some(i => i.eq && i.slug === 'shield');
  const shieldDia = c => tog(dia(hasShield(c)), () => LIVE.shield(), 'Щит: нажмите, чтобы надеть или снять (КД пересчитается)');
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
  const coinBox = (c, cls) => el('div', 'coins ' + (cls || ''), COIN_ORDER.map(([k, t]) => el('div', 'coin', el('small', '', t), el('b', '', LIVE ? ie(c.coins[k] || '', v => { c.coins[k] = Math.max(0, v == null ? 0 : v); LIVE.save(); }, { num: true, c: true, empty: true }) : sp(c.coins[k] || '')))));
  // ресурсы класса: название и значение; расходуемые (до 8 штук) — кружками, чтобы отмечать потраченное
  const resBox = (d, c) => {
    if (!d.res || !d.res.length) return null;
    const row = r => { const tick = r.pool && r.num && r.num <= 8;
      return el('div', 'resi', el('span', 'resn', r.n), tick ? el('span', 'cs3 resk', trk(c, 'res:' + r.id, r.num, on => h('i', { class: 'dt' + (on ? ' on' : '') }))) : el('b', 'resv', r.v + (r.unit ? ' ' + r.unit : ''))); };
    return box('resb', 'Ресурсы', el('div', 'resl', d.res.map(row)));
  };
  const lined = (v, cls, set) => el('div', 'tx ln ' + (cls || ''), LIVE && set ? area(v, set) : (v ? el('span', '', v) : null));
  const story = (c, k) => v => { c.story[k] = v; LIVE.save(); };

  /* ============ страница 1 · D&D 2024 ============ */
  function page24(X, c, D, d) {
    const P = el('section', 'pg e24 p1'), L = featLists(X, c, D, d), pf = profFlags(d);
    const hd = el('div', 'hd',
      box('hn', null, fld(c.name, 'Имя персонажа', 'snm', v => { c.name = v; LIVE.upd(); }),
        el('div', 'g2', fldS(D.bg && D.bg.name_ru, c.bg, LIVE && LIVE.opts.bg, v => LIVE.setBg(v), 'Предыстория', '', 'выберите'), fldS(D.cls && D.cls.name_ru, c.cls, LIVE && LIVE.opts.cls, v => LIVE.setCls(v), 'Класс', '', 'выберите'), spFld(c, D, 'Вид'), fldS(D.sub && D.sub.name, c.sub, LIVE && D.cls && LIVE.opts.sub, v => LIVE.setSub(v), 'Подкласс', '', '—'))),
      el('div', 'bx lv', el('b', '', ie(c.lvl, v => LIVE.setLvl(v), { num: true, c: true })), el('small', '', 'Уровень'), el('i', 'xpl', ie(c.xp, v => { c.xp = v; LIVE.save(); }, { c: true })), el('small', '', 'Опыт')),
      el('div', 'shield', svg(SHIELD, 'sv'), el('div', 'si', el('small', '', 'Класс защиты'), el('b', '', ie(d.ac, v => LIVE.setAc(v), { num: true, c: true, ov: d.ac !== d.acAuto })), el('small', '', 'Щит'), shieldDia(c))),
      box('hpb', null,
        el('div', 'hpc', el('div', 'hph', 'Хиты'), el('div', 'hpr', el('div', 'hpcur', hpIn(c, 'hpCur'), el('small', '', 'Текущие')), el('div', 'hpmt', el('div', 'hmx', el('b', '', ie(d.hp, v => LIVE.setHp(v), { num: true, c: true, ov: d.hp !== d.hpCalc })), el('small', '', 'Максимум')), el('div', 'htmp', hpIn(c, 'hpTemp'), el('small', '', 'Временные'))))),
        el('div', 'hdc', el('div', 'hph', 'Кости хитов'), el('div', 'hdv', el('b', '', 'к' + d.die), el('small', '', 'Всего ' + c.lvl)), el('div', 'hdu', hdIn(c), el('small', '', 'Потрачено'))),
        el('div', 'dsc', el('div', 'hph', 'Спасброски от смерти'), el('div', 'dsr', el('small', '', 'Успехи'), deathDots(c, 'dsS')), el('div', 'dsr', el('small', '', 'Провалы'), deathDots(c, 'dsF')))));
    const rule = el('div', 'hrule', el('span', '', 'Лист персонажа · D&D 2024'));
    const ab = a => box('ab', a.ru,
      el('div', 'am', el('div', 'mc', el('span', 'circ', sgn(d.mod[a.k])), el('small', '', 'Модификатор')), el('div', 'vc', el('span', 'val', ie(d.score[a.k], v => LIVE.setScore(a.k, v), { num: true, c: true })), el('small', '', 'Значение'))),
      el('div', 'sks', skRow(d.saveProf.has(a.k) ? 1 : 0, d.saves[a.k], 'Спасбросок', 'sv', null, { kind: 'save', k: a.k }), ...d.skills.filter(s => s.ab === a.k).map(s => skRow(s.lev, s.bonus, s.n, '', null, { kind: 'skill', id: s.id }))));
    const A = k => R.AB.find(a => a.k === k);
    const colA = el('div', 'acol', box('pb', 'Бонус владения', el('div', 'pbv', sgn(d.pb))), ab(A('str')), ab(A('dex')), ab(A('con')),
      box('exh', 'Истощение', el('div', 'sq6', trk(c, 'exh', 6, on => h('i', { class: 'sqr' + (on ? ' on' : '') })))),
      box('hi', 'Героическое вдохновение', el('div', 'hic', trk(c, 'insp', 1, on => h('i', { class: 'dt huge' + (on ? ' on' : '') })))));
    const colB = el('div', 'acol', ab(A('int')), ab(A('wis')), ab(A('cha')));
    const pt = profText(c, D, d, X.langStr).filter(([l]) => l !== 'Оружие' || pf.other);   // «Простое/Воинское» уже отмечено ромбиками выше
    const profs = box('prof', 'Владение снаряжением и умения',
      el('div', 'pry', el('span', 'pl', 'Доспехи'), ['Лёгкие', 'Средние', 'Тяжёлые', 'Щиты'].map((x, i) => el('span', 'pi', dia(pf.armor[i]), x))),
      el('div', 'pry', el('span', 'pl', 'Оружие'), el('span', 'pi', dia(pf.simple), 'Простое'), el('span', 'pi', dia(pf.martial), 'Воинское'), el('span', 'pi', dia(pf.other), 'Другое')),
      el('div', 'tx gr', pt.map(([l, v]) => el('p', '', el('b', '', l + ': '), v))));
    const pas2 = 'Проницательность ' + passive(d, 'insight') + ' · ' + d.skills.find(x => x.id === 'investigation').n + ' ' + passive(d, 'investigation');
    const stats = el('div', 'st4', box('sb', 'Инициатива', el('b', '', ie(sgn(d.init), v => LIVE.setInit(v), { num: true, c: true, ov: d.initOv != null }))), box('sb', 'Скорость', el('b', '', ie(d.speed, v => LIVE.setSpeed(v), { num: true, c: true, ov: d.speedOv != null }), ' фт.')),
      box('sb', 'Пассивное восприятие', el('b', '', passive(d, 'perception')), el('small', 'pas2', pas2)), box('sb', 'Состояния', LIVE ? area(pl(c).cond, v => { pl(c).cond = v; LIVE.save(); }) : el('i', 'cnd', pl(c).cond || '')));
    const rows = X.attackList(c, D, d), wr = [];
    for (let i = 0; i < 6; i++) { const r = rows[i]; wr.push(r ? h('tr', {}, h('td', {}, sp(r.n)), h('td', { class: 'c' }, sp(r.bonus)), h('td', {}, sp(r.dmg)), h('td', {}, sp(r.note))) : atkRow(c, i - rows.length, ['n', 'bonus', 'dmg', 'note'])); }
    const wp = box('wp', 'Оружие и боевые заклинания', h('table', { class: 'wtab' },
      h('tr', {}, h('th', {}, 'Название'), h('th', { class: 'c' }, 'Бонус / Сл'), h('th', {}, 'Урон / вид'), h('th', {}, 'Заметки')), ...wr));
    const fbox = box('fb', 'Умения и способности', el('div', 'fl gr', featItems(L.all)));
    const mini = (t, v) => box('mn', t, el('b', '', v));
    const bot = el('div', 'bot', el('div', 'mini4', mini('Размер', d.size), mini('Грузоподъёмность', d.carry + ' / ' + d.carry * 2 + ' фунт.'), mini('Прыжок В.', d.jumpHigh + ' фут.'), mini('Прыжок Д.', d.jumpLong + ' фут.')),
      box('mon', 'Монеты', coinBox(c)));
    P.append(hd, rule, el('div', 'bd', el('div', 'left', el('div', 'abcols', colA, colB), profs), el('div', 'right', stats, wp, resBox(d, c), fbox, bot)));
    return P;
  }

  /* ============ страница 1 · D&D 2014 ============ */
  function page14(X, c, D, d) {
    const P = el('section', 'pg e14 p1'), L = featLists(X, c, D, d), pf = profFlags(d);
    const clsText = D.cls ? D.cls.name_ru + (D.sub ? ' (' + D.sub.name + ')' : '') : '';
    const hd = el('div', 'hd', el('div', 'hname', el('b', '', LIVE ? ie(c.name, v => { c.name = v; LIVE.upd(); }) : sp(c.name)), el('small', '', 'Имя персонажа')),
      box('hinfo', null, el('div', 'g4',
        LIVE ? el('div', 'fld', el('b', 'cl14', pick(c.cls, LIVE.opts.cls, v => LIVE.setCls(v), 'класс'), ie(c.lvl, v => LIVE.setLvl(v), { num: true, c: true })), el('small', '', 'Класс и уровень')) : fld(clsText + (clsText ? ' ' : '') + c.lvl, 'Класс и уровень'), fldS(D.bg && D.bg.name_ru, c.bg, LIVE && LIVE.opts.bg, v => LIVE.setBg(v), 'Предыстория', '', 'выберите'), fld(c.xp, 'Опыт', '', v => { c.xp = v; LIVE.save(); }),
        spFld(c, D, 'Раса'), fld(c.align, 'Мировоззрение', '', v => { c.align = v; LIVE.save(); }), LIVE && D.cls && LIVE.opts.sub.length ? fldS('', c.sub, LIVE.opts.sub, v => LIVE.setSub(v), 'Подкласс', '', '—') : el('div', 'fld'))));
    const strip = el('div', 'abstrip', R.AB.map(a => el('div', 'ab14', el('div', 'an' + (a.ru.length > 9 ? ' long' : ''), a.ru), el('div', 'amod', sgn(d.mod[a.k])), el('div', 'asc', ie(d.score[a.k], v => LIVE.setScore(a.k, v), { num: true, c: true })))));
    const savesBox = box('sv14', 'Спасброски', ...R.AB.map(a => el('div', 'sk' + (d.saveProf.has(a.k) ? ' prf' : ''), tog(dot(d.saveProf.has(a.k) ? 1 : 0), () => LIVE.prof({ kind: 'save', k: a.k }), 'Владение: нажмите, чтобы изменить'), el('b', 'bn', sgn(d.saves[a.k])), el('span', 'snm big', a.ru))));
    const sk = d.skills.slice().sort((x, y) => x.n.localeCompare(y.n, 'ru'));
    const skillsBox = box('sk14', 'Навыки', ...sk.map(s => skRow(s.lev, s.bonus, s.n, '', el('i', 'at', ' (' + AB_SHORT[s.ab] + ')'), { kind: 'skill', id: s.id })));
    const pt = profText(c, D, d, X.langStr);
    const c1 = el('div', 'c1', el('div', 'c1top', strip, el('div', 'c1b',
      el('div', 'insp', ...trk(c, 'insp', 1, on => h('i', { class: 'sqb' + (on ? ' on' : '') })), el('b', '', 'Вдохновение')), el('div', 'pbc', el('span', 'pcirc', sgn(d.pb)), el('b', '', 'Бонус владения')), savesBox, skillsBox)),
      el('div', 'pasw', el('span', 'poval', passive(d, 'perception')), el('b', '', 'Пассивная Мудрость (Восприятие)')),
      box('lang', 'Прочие владения и языки', el('div', 'tx ln', pf.armor.some(Boolean) ? el('p', '', el('b', '', 'Доспехи: '), ['Лёгкие', 'Средние', 'Тяжёлые', 'Щиты'].filter((x, i) => pf.armor[i]).join(', ')) : null, pt.map(([l, v]) => el('p', '', el('b', '', l + ': '), v)))));
    const rows = X.attackList(c, D, d), wr = [];
    for (let i = 0; i < 5; i++) { const r = rows[i]; wr.push(r ? h('tr', {}, h('td', {}, sp(r.n)), h('td', { class: 'c' }, sp(r.bonus)), h('td', {}, sp(r.dmg))) : atkRow(c, i - rows.length, ['n', 'bonus', 'dmg'])); }
    const inv = (c.inv || []).map(i => el('div', 'iti', tog(el('i', 'eqm', i.eq ? '●' : ''), () => LIVE.wear(i), 'Надето / не надето (КД пересчитается)'), el('span', '', i.n), i.q > 1 ? el('b', '', '×' + i.q) : null));
    const c2 = el('div', 'c2',
      el('div', 'panel',
        el('div', 'p3', el('div', 'shield s14', svg(SHIELD, 'sv'), el('div', 'si', el('small', '', 'КЗ'), el('b', '', ie(d.ac, v => LIVE.setAc(v), { num: true, c: true, ov: d.ac !== d.acAuto })), shieldDia(c))), box('sb', 'Инициатива', el('b', '', ie(sgn(d.init), v => LIVE.setInit(v), { num: true, c: true, ov: d.initOv != null }))), box('sb', 'Скорость', el('b', '', ie(d.speed, v => LIVE.setSpeed(v), { num: true, c: true, ov: d.speedOv != null }), ' фт.'))),
        box('mx', 'Максимум хитов', el('b', '', ie(d.hp, v => LIVE.setHp(v), { num: true, c: true, ov: d.hp !== d.hpCalc }))), box('curhp', 'Текущие хиты', hpIn(c, 'hpCur')), box('tmp', 'Временные хиты', hpIn(c, 'hpTemp')),
        el('div', 'p2', box('hdb', 'Кость хитов', el('small', '', 'Всего ' + c.lvl), el('b', '', 'к' + d.die), el('small', 'sp', 'Потрачено'), hdIn(c)),
          box('dsb', 'Спасброски от смерти', el('div', 'dsr', el('small', '', 'Успехи'), deathDots(c, 'dsS')), el('div', 'dsr', el('small', '', 'Провалы'), deathDots(c, 'dsF'))))),
      box('wp', 'Атаки и заклинания', h('table', { class: 'wtab' }, h('tr', {}, h('th', {}, 'Название'), h('th', { class: 'c' }, 'Бонус атаки'), h('th', {}, 'Урон / вид')), ...wr), el('div', 'tx ln')),
      box('eq', 'Снаряжение', coinBox(c, 'small'), el('div', 'tx ln', inv)));
    const ps = (k, label) => box('pers', label, lined(c.story[k], '', story(c, k)));
    const c3 = el('div', 'c3', el('div', 'panel', ps('traits', 'Черты характера'), ps('ideals', 'Идеалы'), ps('bonds', 'Привязанности'), ps('flaws', 'Слабости')), resBox(d, c),
      box('fb', 'Умения и способности', el('div', 'tx ln', featItems(L.feats), L.traits.length ? el('div', 'fsub', 'Черты') : null, featItems(L.traits))));
    P.append(hd, el('div', 'bd', c1, c2, c3));
    return P;
  }

  /* ============ страница: тексты умений ============ */
  function featPages(X, c, D, d) {
    const P = shell('Умения и особенности', c, 'flow ftxt'), DBx = DB();
    const cols = el('div', 'pfeat'), list = X.featureList(c, D, d);
    if (!list.length) return null;
    // разделы по источнику: класс, подкласс, вид, подвид, предыстория, черты, выборы класса (порядок как в списке умений)
    const groups = []; list.forEach(f => { let g = groups.find(x => x.src === f.src); if (!g) groups.push(g = { src: f.src, items: [] }); g.items.push(f); });
    groups.forEach(g => {
      const i = g.src.indexOf(':'), kind = i < 0 ? g.src : g.src.slice(0, i), what = i < 0 ? '' : g.src.slice(i + 1).trim();
      const grp = el('div', 'pfg g-' + ({ 'Класс': 'cls', 'Подкласс': 'sub', 'Вид': 'sp', 'Раса': 'sp', 'Подвид': 'ssp', 'Предыстория': 'bg', 'Черты': 'ft' }[kind] || 'pk'),
        el('div', 'pfh', el('b', '', kind), what ? el('span', '', what) : null, el('small', '', g.items.length)));
      g.items.forEach((f, k) => {
        const body = el('div', 'ft'); body.innerHTML = (f.blocks ? DBx.B(f.blocks) : esc(f.text || '')).replace(/<\/(p|li|div|h\d)>/g, '$& ');
        if (c.featTxt !== 'full') { const tx = body.textContent.replace(/\s+/g, ' ').trim(); body.textContent = tx.length > 260 ? tx.slice(0, 260).replace(/\s\S*$/, '') + '…' : tx; }
        const it = el('div', 'pfi', el('b', '', f.name), f.level ? el('small', '', ' ' + f.level + ' ур.') : null, body);
        if (k === 0) { const hd = grp.firstChild; grp.removeChild(hd); grp.append(el('div', 'pfk', hd, it)); } else grp.append(it);   // заголовок раздела всегда вместе с первым умением
      });
      cols.append(grp);
    });
    P.append(cols);
    return [P];
  }

  /* ============ страницы заклинаний ============ */
  // выбранные заклинания и те, что выдаёт подкласс (без повторов)
  const spellsOf = (c, d) => c.spells.concat(((d && d.autoSpells) || []).filter(a => !c.spells.some(x => x.slug === a.slug)));
  const spellSorted = (c, D, d) => spellsOf(c, d).slice().sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name, 'ru')).map(s => ({ s, m: D.spells.find(x => x.slug === s.slug) }));
  // в таблице — коротко: «Реакция, совершаемая вами, когда…» → «Реакция», «В, С, М (рубин…)» → «В, С, М»; полный текст — на карточке заклинания
  const shortCast = t => { t = String(t || ''); if (t.length <= 26) return t; const k = t.split(/[,;]| когда | в ответ | совершаемая | совершаемое /)[0].trim(); return k.length <= 26 ? k : k.slice(0, 25).replace(/\s+\S*$/, '') + '…'; };
  const shortComp = t => String(t || '').replace(/\s*\(.*$/, '');
  const casterName = d => R.ABN(d.sp.ab).ru;
  const slotDia = n => Array.from({ length: n }, () => dia(false));

  function spells24(X, c, D, d) {
    const list = spellSorted(c, D, d), pages = [], NEXT = 44;
    // панель ячеек растёт вместе с числом ромбиков (3 в ряд); список на первой странице короче на столько же строк
    const maxN = Math.max(0, ...d.sp.rows.map(r => r.n)), topH = Math.max(34, 25 + Math.ceil(maxN / 3) * 4), FIRST = 34 - Math.ceil((topH - 34) / 5.1);
    const chunks = []; let i = 0;
    chunks.push(list.slice(0, FIRST)); i = FIRST;
    while (i < list.length) { chunks.push(list.slice(i, i + NEXT)); i += NEXT; }
    chunks.forEach((chunk, pi) => {
      const P = shell('Заклинания', c, 'e24 spg' + (pi ? ' cont' : ''));
      if (!pi) {
        const sl = d.sp.rows.map((r, k) => el('div', 'slc' + (r.n ? '' : ' off'), el('small', '', (k + 1) + '-й'), el('b', '', r.n || '—'), r.n ? el('div', 'sld', ...trk(c, 'sl' + (k + 1), r.n, on => dia(on))) : null, el('i', 'slt', r.tag)));
        P.append(h('div', { class: 'sptop', style: 'height:' + topH.toFixed(1) + 'mm' },
          box('spst', null, el('div', 'ss', el('b', '', casterName(d)), el('small', '', 'Заклинательная характеристика')), el('div', 'ss', el('b', '', sgn(R.mod(d.score[d.sp.ab]))), el('small', '', 'Заклинательный модификатор')),
            el('div', 'ss', el('b', '', d.sp.dc), el('small', '', 'Сложность спасброска')), el('div', 'ss', el('b', '', sgn(d.sp.atk)), el('small', '', 'Бонус атаки заклинанием'))),
          box('spsl', 'Ячейки заклинаний', el('div', 'slg', sl), el('div', 'spn', 'Отмечайте потраченные ячейки'
            + (d.sp.cantrips != null ? ' · Заговоров: ' + d.sp.cantrips : '') + (d.sp.prepared != null ? ' · Подготовлено: ' + d.sp.prepared : d.sp.known != null ? ' · Известно: ' + d.sp.known : '')))));
      }
      const cap = pi ? NEXT : FIRST, rows = [];
      chunk.forEach(({ s, m }) => rows.push(h('tr', {}, h('td', { class: 'c' }, dia(s.prep || s.lvl === 0)), h('td', { class: 'c' }, s.lvl), h('td', { class: 'snm' }, s.name, s.free ? el('small', '', ' бонус') : null),
        h('td', {}, m ? shortCast(m.cast_time) : ''), h('td', {}, m ? m.range : ''), h('td', { class: 'c fl' }, m && m.concentration ? 'К' : ''), h('td', { class: 'c fl' }, m && m.ritual ? 'Р' : ''), h('td', { class: 'comp' }, m ? shortComp(m.components) : ''), h('td', {}, ''))));
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
    const by = {}; spellsOf(c, d).forEach(s => (by[s.lvl] = by[s.lvl] || []).push(s));
    Object.values(by).forEach(a => a.sort((x, y) => x.name.localeCompare(y.name, 'ru')));
    const min = [8, 12, 12, 12, 9, 9, 8, 8, 6, 6];
    const lvlBox = l => {
      const items = by[l] || [], n = Math.max(min[l], items.length), sr = l ? d.sp.rows[l - 1] : null, slots = sr ? sr.n : 0;
      const lines = []; for (let i = 0; i < n; i++) { const s = items[i], m = s && D.spells.find(x => x.slug === s.slug);
        lines.push(el('div', 'sl', dot(s && (s.prep || l === 0) ? 1 : 0), el('span', '', s ? s.name : ''), m && (m.concentration || m.ritual) ? el('small', '', [m.concentration ? 'К' : '', m.ritual ? 'Р' : ''].filter(Boolean).join(' ')) : null)); }
      return el('div', 'lv14', el('div', 'lh', el('span', 'ln0', l), l ? el('span', 'lt', el('small', '', 'Всего ячеек'), el('b', '', slots || '—'), sr.tag ? el('small', 'tg', sr.tag) : null) : el('b', 'lz', 'Заговоры'), l && slots ? el('span', 'ls', el('small', '', 'Потрачено'), el('span', 'cs3', ...trk(c, 'sl' + l, Math.min(slots, 4), on => h('i', { class: 'dt big' + (on ? ' on' : '') })))) : null), ...lines);
    };
    const top = el('div', 'sphd', fld(D.cls ? D.cls.name_ru : '', 'Класс заклинателя', 'c1'), el('div', 'bx sbx', el('b', '', casterName(d)), el('small', '', 'Базовая характеристика заклинаний')),
      el('div', 'bx sbx', el('b', '', d.sp.dc), el('small', '', 'Сложность спасброска')), el('div', 'bx sbx', el('b', '', sgn(d.sp.atk)), el('small', '', 'Бонус атаки')));
    P.append(top, el('div', 'lvcols', el('div', 'lvc', lvlBox(0), lvlBox(1), lvlBox(2)), el('div', 'lvc', lvlBox(3), lvlBox(4), lvlBox(5)), el('div', 'lvc', lvlBox(6), lvlBox(7), lvlBox(8), lvlBox(9))));
    P.append(el('div', 'pnote', '● — заговор или подготовленное заклинание. К — концентрация, Р — ритуал.'));
    return [P];
  }

  /* ============ карточки заклинаний (63,5 × 88,9 мм; по 9 на странице) ============ */
  function buildCards(c, D, host, d) {
    const DBx = DB(), cards = [];
    spellSorted(c, D, d).forEach(({ s, m }) => {
      if (!m) return;
      const chips = [m.cast_time, m.range, m.duration].filter(Boolean).map(t => el('span', 'schip', t));
      const flags = [m.concentration ? 'К' : '', m.ritual ? 'Р' : ''].filter(Boolean).map(t => el('span', 'schip flag', t));
      const mk = () => {
        const body = el('div', 'cbody');
        return { node: el('div', 'scard', el('div', 'ch', el('span', 'cl', m.level), el('b', 'scn', m.name_ru)), el('div', 'chips', flags, chips), body,
          el('div', 'cf', el('span', 'cc', m.components || ''), el('span', 'cpg', '')), el('div', 'sch', el('b', '', m.school || ''), ' · ' + (m.name_en || ''))), body };
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
  function cardPages(c, D, sh, d) {
    const host = el('div', 'cardhost csheet-measure'); sh.append(host);   // измерение: карточки должны быть в документе
    const cards = buildCards(c, D, host, d), pages = [];
    host.remove();
    for (let i = 0; i < cards.length; i += 9) { const P = shell('Заклинания: карточки', c, 'cards'); P.append(el('div', 'cgrid', ...cards.slice(i, i + 9))); pages.push(P); }
    return pages;
  }

  /* ============ страница: описание ============ */
  function descPage(X, c, D, d) {
    const ed = c.ed === 24 ? 'e24' : 'e14', P = shell('Описание персонажа', c, 'flow desc ' + ed);
    const portrait = box('port', 'Портрет', el('div', 'pimg', c.portrait ? h('img', { src: c.portrait, alt: '' }) : null));
    const left = el('div', 'dcol', portrait, box('st grow', 'Союзники и организации', lined(c.story.allies, 'm', story(c, 'allies'))), box('st grow', 'Цели и задачи', lined(c.story.goals, 'm', story(c, 'goals'))));
    const right = el('div', 'dcol', box('st look grow', 'Внешность и история', lined(c.story.look, 'm tall', story(c, 'look'))),
      box('st grow', 'Заметки', lined(c.story.notes, 'm tall', story(c, 'notes'))));   // черты характера, идеалы, привязанности и слабости — только на листе 2014 (в 2024 их нет)
    P.append(el('div', 'dgrid', left, right));
    return [P];
  }

  /* ============ страница: снаряжение ============ */
  function gearPage(X, c, D, d) {
    const ed = c.ed === 24 ? 'e24' : 'e14', P = shell('Снаряжение', c, 'flow gear desc ' + ed);
    let w = 0;
    const rows = (c.inv || []).map(i => { const g = X.invG(D, i), ww = g && g.weight_lb ? R.unitWeight(g) * i.q : 0; w += ww; return h('tr', {}, h('td', { class: 'c' }, i.eq ? '●' : ''), h('td', {}, i.n), h('td', { class: 'c' }, i.q), h('td', { class: 'c' }, ww ? Math.round(ww * 10) / 10 : '')); });
    while (rows.length < 40) rows.push(h('tr', {}, h('td', { class: 'c' }), h('td', {}), h('td', {}), h('td', {})));
    const cap = d.carry, att = (c.inv || []).filter(i => i.eq && i.sec === 'items' && (X.invG(D, i) || {}).attunement).length;
    const inv = box('dinv', 'Инвентарь', h('table', { class: 'itab' }, h('tr', {}, h('th', { class: 'c' }, ''), h('th', {}, 'Предмет'), h('th', { class: 'c' }, 'Кол.'), h('th', { class: 'c' }, 'Вес, фнт.')), ...rows),
      el('div', 'cap', el('span', '', 'Вес: ', el('b', '', Math.round(w * 10) / 10 + ' фнт.')), el('span', '', 'Грузоподъёмность: ', el('b', '', cap + ' фнт.'))));
    const side = el('div', 'dcol', box('att', 'Настройка на магические предметы', el('div', 'attn', [0, 1, 2].map(i => dia(i < att)))),
      box('st grow', 'Сокровища', lined(c.story.loot, 'm', story(c, 'loot'))), box('st grow', 'Заметки о снаряжении', lined(c.story.gnotes, 'm', story(c, 'gnotes'))));
    P.append(el('div', 'dgrid gearg', inv, side));
    return [P];
  }

  /* ============ сборка ============ */
  const on = (c, k) => !(c.pOff && c.pOff[k]);
  function build(sh, ctx) {
    const { c, D, d, X } = ctx, e24 = c.ed === 24, pages = [];
    LIVE = X.ops ? Object.assign({ c, d }, X.ops) : null;
    if (LIVE) { const ch = D.sp && R.speciesChoice(D.sp); LIVE.opts = Object.assign({}, LIVE.opts, { spo: ch ? ch.options : null, spoL: ch ? ch.label : '' }); }       // правка прямо на листе
    if (on(c, 'main')) pages.push(e24 ? page24(X, c, D, d) : page14(X, c, D, d));
    if (c.featTxt !== 'none') { const fp = featPages(X, c, D, d); if (fp) pages.push(...fp); }
    if (d.sp.has) {
      if (on(c, 'spells')) pages.push(...(e24 ? spells24(X, c, D, d) : spells14(X, c, D, d)));
      if (c.printSpells && spellsOf(c, d).length) pages.push(...cardPages(c, D, sh, d));
    }
    else if (c.printSpells && d.autoSpells && d.autoSpells.length) pages.push(...cardPages(c, D, sh, d));   // заклинания вида у персонажа без ячеек: только карточки
    if (on(c, 'desc')) pages.push(...descPage(X, c, D, d));
    if (on(c, 'gear')) pages.push(...gearPage(X, c, D, d));
    pages.forEach(p => { if (!p.classList.contains('e24') && !p.classList.contains('e14')) p.classList.add(e24 ? 'e24' : 'e14'); });
    sh.append(...pages);
    const p1 = pages.find(p => p.classList.contains('p1'));
    pages.forEach(rulings);
    if (p1) { const trim = () => { fitNames(p1); trimLists(p1); }; trim(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(trim); }
    return pages;
  }
  // разлиновка строк (.ln) и клетки (.gr) — настоящие линии (SVG), а не фон-градиент: плитка с дробным размером при печати и масштабировании
  // местами теряет и двоит линии. Линий берём с запасом, лишнее обрезается рамкой блока.
  const NS = 'http://www.w3.org/2000/svg';
  function rulings(P) {
    const mk = (cls, lines) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'rul ' + cls); s.setAttribute('aria-hidden', 'true'); s.setAttribute('preserveAspectRatio', 'none'); lines.forEach(l => { const e = document.createElementNS(NS, 'line'); Object.entries(l).forEach(([k, v]) => e.setAttribute(k, v)); s.append(e); }); return s; };
    P.querySelectorAll('.ln').forEach(n => { n.classList.add('dv'); n.prepend(mk('rul-ln', Array.from({ length: 70 }, (_, i) => ({ x1: '0', x2: '100%', y1: ((i + 1) * 4.7 - 0.08).toFixed(2) + 'mm', y2: ((i + 1) * 4.7 - 0.08).toFixed(2) + 'mm' })))); });
    P.querySelectorAll('.gr').forEach(n => { n.classList.add('dv'); n.prepend(mk('rul-gr', [].concat(
      Array.from({ length: 70 }, (_, i) => ({ x1: '0', x2: '100%', y1: (i * 3.5 + 0.07).toFixed(2) + 'mm', y2: (i * 3.5 + 0.07).toFixed(2) + 'mm' })),
      Array.from({ length: 60 }, (_, i) => ({ y1: '0', y2: '100%', x1: (i * 3.5 + 0.07).toFixed(2) + 'mm', x2: (i * 3.5 + 0.07).toFixed(2) + 'mm' }))))); });
  }
  // длинное имя персонажа и длинные значения в полях шапки уменьшаем, пока не влезут в строку (не меньше 8 пт для имени, 6,5 пт для остальных)
  function fitNames(P) {
    P.querySelectorAll('.fld b, .hname b').forEach(b => {
      b.style.fontSize = '';
      if (b.scrollWidth <= b.clientWidth + 1) return;
      const min = b.closest('.snm, .hname') ? 8 : 6.5;
      let fs = parseFloat(getComputedStyle(b).fontSize) * 0.75;   // px → pt
      while (b.scrollWidth > b.clientWidth + 1 && fs > min) { fs -= 0.5; b.style.fontSize = fs + 'pt'; }
    });
  }
  // списки умений и снаряжения на первой странице не помещаются — обрезаем по высоте блока, остальное есть на отдельных страницах
  function trimLists(P) {
    P.querySelectorAll('.fl, .tx.ln').forEach(box => {
      box.querySelectorAll('.fmore').forEach(n => n.remove());
      const items = [...box.querySelectorAll('.fi, .iti')];   // умения и предметы снаряжения (на первой странице 2014 их место ограничено)
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
