/* ===== Правила листа персонажа (без DOM — можно проверять в node) =====
   Берёт данные из базы (класс, подкласс, вид, предыстория…) и считает всё производное:
   характеристики, бонус владения, спасброски, навыки, хиты, КД, ячейки заклинаний, облики друида. */
(function (root) {
  'use strict';

  const AB = [
    { k: 'str', ru: 'Сила', s: 'СИЛ' }, { k: 'dex', ru: 'Ловкость', s: 'ЛОВ' }, { k: 'con', ru: 'Телосложение', s: 'ТЕЛ' },
    { k: 'int', ru: 'Интеллект', s: 'ИНТ' }, { k: 'wis', ru: 'Мудрость', s: 'МДР' }, { k: 'cha', ru: 'Харизма', s: 'ХАР' }
  ];
  const ABK = Object.fromEntries(AB.map(a => [a.ru, a.k]));
  const ABN = k => AB.find(a => a.k === k);
  // al — как навык называется в тексте классов и предысторий (в 2024 и 2014 названия местами разные)
  const SKILLS = [
    { id: 'acrobatics', n: 'Акробатика', ab: 'dex', al: ['Акробатика'] }, { id: 'athletics', n: 'Атлетика', ab: 'str', al: ['Атлетика'] },
    { id: 'survival', n: 'Выживание', ab: 'wis', al: ['Выживание', 'Выжива'] }, { id: 'performance', n: 'Выступление', ab: 'cha', al: ['Выступление'] },
    { id: 'intimidation', n: 'Запугивание', ab: 'cha', al: ['Запугивание'] }, { id: 'history', n: 'История', ab: 'int', al: ['История'] },
    { id: 'sleight', n: 'Ловкость рук', ab: 'dex', al: ['Ловкость рук'] }, { id: 'arcana', n: 'Тайная магия', n14: 'Магия', ab: 'int', al: ['Тайная магия', 'Магия'] },
    { id: 'medicine', n: 'Медицина', ab: 'wis', al: ['Медицина'] }, { id: 'deception', n: 'Обман', ab: 'cha', al: ['Обман'] },
    { id: 'animal', n: 'Обращение с животными', n14: 'Уход за животными', ab: 'wis', al: ['Обращение с животными', 'Уход за животными'] },
    { id: 'nature', n: 'Природа', ab: 'int', al: ['Природа'] }, { id: 'insight', n: 'Проницательность', ab: 'wis', al: ['Проницательность'] },
    { id: 'investigation', n: 'Расследование', ab: 'int', al: ['Расследование', 'Анализ'] }, { id: 'religion', n: 'Религия', ab: 'int', al: ['Религия'] },
    { id: 'stealth', n: 'Скрытность', ab: 'dex', al: ['Скрытность'] }, { id: 'persuasion', n: 'Убеждение', ab: 'cha', al: ['Убеждение'] },
    { id: 'perception', n: 'Восприятие', ab: 'wis', al: ['Восприятие'] }
  ];
  const skillName = (s, ed) => (ed === 14 && s.n14) || s.n;
  const SPELL_AB = { wizard: 'int', artificer: 'int', cleric: 'wis', druid: 'wis', ranger: 'wis', bard: 'cha', paladin: 'cha', sorcerer: 'cha', warlock: 'cha' };
  const STD_ARRAY = [15, 14, 13, 12, 10, 8];
  const BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  const NUMW = { один: 1, одно: 1, одного: 1, два: 2, двух: 2, три: 3, трёх: 3, четыре: 4, четырёх: 4, пять: 5, пяти: 5, шесть: 6 };
  const mod = s => Math.floor((s - 10) / 2);
  const sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const intOf = v => { const n = parseInt(String(v == null ? '' : v).replace('−', '-').replace('+', ''), 10); return isNaN(n) ? 0 : n; };
  const lc = s => String(s || '').toLowerCase().replace(/ё/g, 'е');

  /* ---------- разбор данных класса ---------- */
  function trait(cls, re) { const t = ((cls && cls.core_traits) || []).find(x => re.test(x.label)); return t ? String(t.value) : ''; }
  function abilitiesIn(text) { return AB.filter(a => new RegExp(a.ru.slice(0, 5), 'i').test(text)).map(a => a.k); }
  function skillsIn(text) { return SKILLS.filter(s => s.al.some(a => lc(text).includes(lc(a)))).map(s => s.id); }
  function classInfo(cls) {
    if (!cls) return null;
    const die = (() => { const m = trait(cls, /кост[а-яё]*\s*хит/i).match(/[кКkK](\d+)/); return m ? +m[1] : 8; })();
    const pickTxt = trait(cls, /навык/i);
    const any = /любы/i.test(pickTxt) && !/:/.test(pickTxt);
    let n = 2; const m = pickTxt.toLowerCase().match(/выберите\s+(?:любые\s+)?([а-яё]+)/); if (m && NUMW[m[1]]) n = NUMW[m[1]];
    const skillList = any ? SKILLS.map(s => s.id) : skillsIn(pickTxt);
    return {
      die, saves: abilitiesIn(trait(cls, /спасброс/i)), pickN: n, pickFrom: skillList, pickAny: any,
      armor: trait(cls, /доспех|тренирован/i), weapons: trait(cls, /оружи/i), tools: trait(cls, /инструмент/i), kit: trait(cls, /снаряжен/i),
      spellAb: SPELL_AB[cls.slug] || null
    };
  }
  // таблица уровней: учитываем, что в 2014 первая строка — «шапка», а ячейки идут «хвостом» после колонки с названием
  function levelRow(cls, lvl) {
    const tb = cls && cls.table; if (!tb) return null;
    const rows = tb.rows.filter(r => String(r[0]).trim() === String(lvl) && /^\+?\d+$/.test(String(r[1]).trim()));
    const r = rows[rows.length - 1]; if (!r) return null;
    const cols = tb.columns, find = re => cols.findIndex(c => re.test(c));
    const num = i => (i < 0 ? null : (/^[\d]+$/.test(String(r[i]).trim()) ? +r[i] : 0));
    const out = { prof: intOf(r[find(/бонус/i)]) || Math.ceil(lvl / 4) + 1, extra: {} };
    const iFeat = find(/умения/i); out.features = iFeat >= 0 ? r[iFeat] : '';
    out.cantrips = num(find(/заговор/i));
    out.prepared = num(find(/подготовлен/i));
    out.known = num(find(/известные заклинания/i));
    const per = cols.map((c, i) => [c, i]).filter(([c]) => /^Ячейки заклинаний на уровень заклинаний\s*:\s*\d/.test(c));
    const flat = find(/^Ячейки заклинаний на уровень заклинаний$/);
    let slots = [];
    if (per.length) slots = per.map(([c, i]) => intOf(r[i]));
    else if (flat >= 0) slots = r.slice(flat).map(intOf);
    while (slots.length < 9) slots.push(0);
    out.slots = slots.slice(0, 9);
    const iPact = find(/^Ячейки заклинаний$/), iPl = find(/^Уровень ячеек$/);
    if (iPact >= 0 && iPl >= 0) out.pact = { n: intOf(r[iPact]), lvl: intOf(r[iPl]) };
    cols.forEach((c, i) => { if (!/уровень|бонус|умения|заговор|заклинани/i.test(c)) out.extra[c] = r[i]; });
    return out;
  }
  const asiLevels = cls => {
    const l = ((cls && cls.features) || []).filter(f => /увеличение характеристик|увеличение значени/i.test(f.name)).map(f => f.level);
    if (cls && l.length <= 1 && cls.creation !== undefined) {         // 2014: умение описано одно на весь класс
      const x = [4, 8, 12, 16, 19]; if (cls.slug === 'fighter') x.push(6, 14); if (cls.slug === 'rogue') x.push(10);
      return x.sort((a, b) => a - b);
    }
    return [...new Set(l)].sort((a, b) => a - b);
  };
  const maxSlotLevel = (lr) => {
    if (!lr) return 0;
    let m = 0; lr.slots.forEach((n, i) => { if (n > 0) m = i + 1; });
    if (lr.pact) m = Math.max(m, lr.pact.lvl);
    return m;
  };

  /* ---------- черты вида ---------- */
  function paragraphsOf(blocks) { return (blocks || []).filter(b => b.type === 'paragraph').map(b => b.text); }
  function speciesTraits(sp) {                       // «**Название.** текст»
    const out = [];
    paragraphsOf(sp && sp.blocks).forEach(t => { const m = t.match(/^\*\*(.+?)\.?\*\*\.?\s*(.*)$/s); if (m) out.push({ name: m[1].replace(/\.$/, ''), text: m[2] }); });
    return out;
  }
  function speciesSpeed(sp, ed) {
    if (!sp) return 30;
    if (sp.props) { const p = sp.props.find(x => /скорост/i.test(x.label)); if (p) { const n = intOf(String(p.value).match(/\d+/)); if (n) return n; } }
    if (sp.speeds && sp.speeds.length) return sp.speeds[sp.speeds.length - 1];
    return 30;
  }

  /* ---------- производные значения ---------- */
  // c — персонаж (хранится в браузере); D — загруженные данные {cls, sub, sp, bg, feats, gear}
  function derive(c, D) {
    const lvl = Math.max(1, Math.min(20, c.lvl || 1)), ci = classInfo(D.cls), lr = levelRow(D.cls, lvl);
    const score = {}, src = {};
    AB.forEach(a => { score[a.k] = (c.ab && c.ab[a.k]) || 10; src[a.k] = []; });
    const add = (k, v, why) => { if (!k || !v) return; score[k] += v; src[k].push(sgn(v) + ' ' + why); };
    // 2024 — бонусы дают предыстории; 2014 — вид (вводятся вручную)
    if (c.ed === 24 && D.bg && c.bg2) {
      const bgA = (D.bg.abilities || []).map(x => ABK[x]).filter(Boolean);
      if (c.bg2.m === '111') bgA.forEach(k => add(k, 1, 'предыстория'));
      else { add(c.bg2.a, 2, 'предыстория'); add(c.bg2.b, 1, 'предыстория'); }
    }
    if (c.ed === 14) AB.forEach(a => add(a.k, intOf(c.bonus && c.bonus[a.k]), 'вид'));
    const feats = [];
    asiLevels(D.cls).filter(l => l <= lvl).forEach(l => {
      const x = (c.asi || {})[l]; if (!x) return;
      if (x.m === 'feat') { if (x.feat) feats.push({ slug: x.feat, lvl: l }); }
      else if (x.m === '11') { add(x.a, 1, 'ур. ' + l); add(x.b, 1, 'ур. ' + l); }
      else if (x.m === '2') add(x.a, 2, 'ур. ' + l);
    });
    AB.forEach(a => { score[a.k] = Math.min(score[a.k], (c.cap20 === false ? 30 : 20)); });
    const m = {}; AB.forEach(a => { m[a.k] = mod(score[a.k]); });
    const pb = lr ? lr.prof : Math.ceil(lvl / 4) + 1;

    const saveProf = new Set(ci ? ci.saves : []), saves = {};
    AB.forEach(a => { saves[a.k] = m[a.k] + (saveProf.has(a.k) ? pb : 0); });

    const bgSk = D.bg ? skillsIn((D.bg.skills || []).join(', ') + ' ' + (D.bg.skills_text || '')) : [];
    const pick = new Set(c.skills || []), extra = new Set(c.skillsExtra || []), exp = new Set(c.exp || []);
    const skills = SKILLS.map(s => {
      const from = [];
      if (pick.has(s.id)) from.push('класс'); if (bgSk.includes(s.id)) from.push('предыстория'); if (extra.has(s.id)) from.push('другое');
      const lev = exp.has(s.id) && from.length ? 2 : from.length ? 1 : 0;
      return { id: s.id, n: skillName(s, c.ed), ab: s.ab, lev, from, bonus: m[s.ab] + (lev === 2 ? pb * 2 : lev === 1 ? pb : 0) };
    });

    // хиты
    const die = ci ? ci.die : 8;
    const hpLvl = (L) => Math.max(1, Math.floor(die / 2) + 1 + m.con);
    let hp = die + m.con + (lvl - 1) * hpLvl();
    if (c.hpMode === 'manual' && c.hpManual) hp = c.hpManual;
    hp = Math.max(lvl, hp + (c.hpBonus || 0));

    // КД
    let ac = 10 + m.dex, acWhy = 'без доспеха';
    if (D.cls && D.cls.slug === 'barbarian') { ac = 10 + m.dex + m.con; acWhy = 'без доспеха (варвар)'; }
    if (D.cls && D.cls.slug === 'monk') { ac = 10 + m.dex + m.wis; acWhy = 'без доспеха (монах)'; }
    let shield = false;
    (c.inv || []).filter(i => i.eq).forEach(i => {
      const g = D.gearBySlug && D.gearBySlug[i.slug]; if (!g) return;
      if (/щит/i.test(g.line || '') && g.slug === 'shield') { shield = true; return; }
      const p = (g.props || []).find(x => /класс защиты/i.test(x.label)); if (!p || !/доспех/i.test(g.line || '')) return;
      const base = intOf(String(p.value).match(/\d+/)), dexOk = /ловкост/i.test(p.value), cap = (String(p.value).match(/не более\s*(\d)/) || [])[1];
      ac = base + (dexOk ? (cap ? Math.min(m.dex, +cap) : m.dex) : 0); acWhy = g.name_ru;
    });
    if (shield) { ac += 2; acWhy += ' + щит'; }
    if (c.acBonus) ac += c.acBonus;
    if (c.acMode === 'manual' && c.acManual) { ac = c.acManual; acWhy = 'вручную'; }

    // заклинания
    const spAb = ci && ci.spellAb, sp = { has: !!(lr && (lr.slots.some(x => x > 0) || lr.pact)) || !!(c.spellAbManual) };
    if (sp.has) {
      const ab = spAb || c.spellAbManual || 'int';
      sp.ab = ab; sp.dc = 8 + pb + m[ab]; sp.atk = pb + m[ab];
      sp.slots = (c.slotsManual && !lr) ? c.slotsManual : (lr ? lr.slots : new Array(9).fill(0));
      sp.pact = lr && lr.pact; sp.maxLevel = maxSlotLevel(lr) || (sp.slots.reduce((q, n, i) => n > 0 ? i + 1 : q, 0));
      sp.cantrips = lr ? lr.cantrips : null;
      // подготовлено: столбец таблицы (2024) или модификатор + уровень (2014, подготавливающие классы)
      let prep = lr ? lr.prepared : null, known = lr ? lr.known : null;
      if (prep == null && known == null && c.ed === 14 && D.cls && ['cleric', 'druid', 'wizard', 'artificer'].includes(D.cls.slug)) prep = Math.max(1, m[ab] + (D.cls.slug === 'artificer' ? Math.floor(lvl / 2) : lvl));
      if (prep == null && known == null && c.ed === 14 && D.cls && D.cls.slug === 'paladin') prep = Math.max(1, m[ab] + Math.floor(lvl / 2));
      sp.prepared = prep; sp.known = known;
    }
    // дикий облик (друид)
    const ws = wildShape(D, c, lvl);
    return { lvl, ci, lr, score, src, mod: m, pb, saves, saveProf, skills, bgSk, hp, die, ac, acWhy, init: m.dex, speed: c.speed != null && c.speed !== '' ? intOf(c.speed) : speciesSpeed(D.sp, c.ed), sp, feats, ws };
  }

  /* ---------- дикий облик ---------- */
  const crNum = v => { const s = String(v == null ? '0' : v).trim(); if (/^\d+\/\d+$/.test(s)) { const [a, b] = s.split('/'); return a / b; } return parseFloat(s) || 0; };
  const crStr = n => (n === 0.125 ? '1/8' : n === 0.25 ? '1/4' : n === 0.5 ? '1/2' : String(n));
  function wildShape(D, c, lvl) {
    if (!D.cls || D.cls.slug !== 'druid' || lvl < 2) return null;
    const moon = D.sub && /луны/i.test(D.sub.name);
    let known = 4, cr = 0.25, fly = false, swim = true, rows = null;
    const f = (D.cls.features || []).find(x => /дикий облик/i.test(x.name));
    const tb = f && (f.blocks || []).find(b => b.type === 'table');
    if (tb && c.ed === 24) {                              // таблица в самом умении (2024)
      rows = tb.rows.slice(1).filter(r => intOf(r[0]) <= lvl);
      const r = rows[rows.length - 1];
      if (r) { known = intOf(r[1]); cr = crNum(r[2]); fly = /да/i.test(r[3]); }
    } else {                                              // 2014: в правилах умения
      cr = lvl >= 8 ? 1 : lvl >= 4 ? 0.5 : 0.25; fly = lvl >= 8; swim = lvl >= 4; known = 99;
    }
    let note = '';
    if (moon) {
      const mc = c.ed === 24 ? Math.max(1, Math.floor(lvl / 3)) : (lvl >= 6 ? Math.max(1, Math.floor(lvl / 3)) : 1);
      if (mc > cr) cr = mc; note = 'Круг Луны: опасность до ' + crStr(cr) + ' (уровень ÷ 3, минимум 1).';
      if (c.ed === 14) fly = lvl >= 8 ? true : false;
    }
    return { known, cr, fly, swim: c.ed === 14 ? swim && true : true, moon, note };
  }
  const beastOk = (m, ws, ed) => {
    if (!ws) return false;
    if (!/зверь/i.test(String(m.type || ''))) return false;
    if (crNum(m.cr) > ws.cr) return false;
    const sp = m.speed || {};
    if (sp.fly && !ws.fly) return false;
    if (ed === 14 && sp.swim && !ws.swim) return false;
    return true;
  };

  /* ---------- вспомогательное ---------- */
  function newChar(ed) {
    return {
      id: Math.random().toString(36).slice(2, 9), ed: ed || 24, name: '', player: '', cls: '', sub: '', lvl: 1, sp: '', bg: '', align: '',
      abm: 'std', ab: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, bg2: { m: '21', a: '', b: '' }, bonus: {}, asi: {},
      skills: [], skillsExtra: [], exp: [], hpMode: 'avg', hpManual: 0, hpBonus: 0, hpCur: null, hpTemp: 0, acMode: 'auto', acManual: 0, acBonus: 0,
      speed: '', spells: [], spellsAll: false, inv: [], coins: { pm: 0, zm: 0, em: 0, sm: 0, mm: 0 }, forms: [],
      story: { traits: '', ideals: '', bonds: '', flaws: '', look: '', notes: '', langs: '', tools: '' }, printSpells: false
    };
  }
  const API = { AB, ABK, ABN, SKILLS, skillName, STD_ARRAY, BUY_COST, mod, sgn, intOf, lc, trait, classInfo, levelRow, asiLevels, maxSlotLevel, speciesTraits, speciesSpeed, derive, wildShape, beastOk, crNum, crStr, newChar, skillsIn, abilitiesIn, SPELL_AB };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CSR = API;
})(typeof window !== 'undefined' ? window : globalThis);
