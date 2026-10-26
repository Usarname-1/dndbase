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
  // в данных местами «й» и «ё» записаны двумя символами (буква + знак): приводим к обычному виду, иначе поиск по тексту их не находит
  const nfc = s => { s = String(s == null ? '' : s); return s.normalize ? s.normalize('NFC') : s; };
  const lc = s => nfc(s).toLowerCase().replace(/ё/g, 'е');

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
  // Дар эпического героя (2024, 19 уровень): вместо увеличения характеристик берётся только черта Эпического дара
  const epicLevel = cls => { const f = ((cls && cls.features) || []).find(x => /^эпический дар/i.test(x.name)); return f ? f.level : 0; };
  const asiLevels = cls => {
    const l = ((cls && cls.features) || []).filter(f => /увеличение характеристик|увеличение значени|^эпический дар/i.test(f.name)).map(f => f.level);
    if (cls && l.length <= 1 && cls.creation !== undefined) {         // 2014: умение описано одно на весь класс
      const x = [4, 8, 12, 16, 19]; if (cls.slug === 'fighter') x.push(6, 14); if (cls.slug === 'rogue') x.push(10);
      return x.sort((a, b) => a - b);
    }
    return [...new Set(l)].sort((a, b) => a - b);
  };
  // ячейки по уровням 1–9: обычные, договора (колдун) и мистический арканум (колдун, 11/13/15/17 ур.)
  const ARCANUM = [0, 0, 0, 0, 0, 11, 13, 15, 17];
  function slotRows(sp, cls, lvl) {
    const rows = (sp.slots || []).slice(0, 9).map(n => ({ n: n || 0, tag: '' }));
    while (rows.length < 9) rows.push({ n: 0, tag: '' });
    if (sp.pact && sp.pact.lvl >= 1 && sp.pact.lvl <= 9) { const r = rows[sp.pact.lvl - 1]; r.n += sp.pact.n; r.tag = 'договор'; }
    if (cls && cls.slug === 'warlock') ARCANUM.forEach((need, i) => { if (need && lvl >= need) { rows[i].n += 1; rows[i].tag = rows[i].tag ? rows[i].tag + ' + арканум' : 'арканум'; } });
    return rows;
  }
  const maxSlotLevel = (lr) => {
    if (!lr) return 0;
    let m = 0; lr.slots.forEach((n, i) => { if (n > 0) m = i + 1; });
    if (lr.pact) m = Math.max(m, lr.pact.lvl);
    return m;
  };

  /* ---------- заклинания, которые даёт подкласс ---------- */
  // Мистический рыцарь и ловкач, а также неофициальные Костяной рыцарь, Божественный вестник, Тёмный проситель, Мистический воин:
  // в подклассе лежит своя таблица (уровень → заговоры, известные/подготовленные заклинания, ячейки), а список заклинаний,
  // заклинательная характеристика и школы названы в тексте умения. Всё разбирается из данных: таблица — по заголовкам столбцов.
  const subCache = new WeakMap();
  const nCell = v => { const x = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10); return isNaN(x) ? 0 : x; };
  const NUM_WORD = { один: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5 };
  const LIST_STEM = { волшеб: 'wizard', жре: 'cleric', чаро: 'sorcerer', колду: 'warlock', друид: 'druid', бард: 'bard', палад: 'paladin', следоп: 'ranger', изобрет: 'artificer' };
  const AB_WORD = { интеллект: 'int', мудрост: 'wis', харизм: 'cha' };
  const SCHOOL_STEM = { воплощ: 'Воплощение', огражд: 'Ограждение', иллюз: 'Иллюзия', очарован: 'Очарование', некроман: 'Некромантия', преобразован: 'Преобразование', прорицан: 'Прорицание', вызов: 'Вызов', призыв: 'Призыв' };
  const stemOf = (map, w) => { const k = Object.keys(map).find(x => lc(w).startsWith(x)); return k ? map[k] : null; };
  // Таблица подкласса → { kind: 'prepared'|'known', cantripCol, rows: { уровень: { slots[9], cantrips, n } } } или null
  function castTable(rows) {
    if (!rows || rows.length < 4 || !/^уровень/i.test(String(rows[0][0]).trim())) return null;
    const hd = rows[0].map(x => String(x).trim()), idx = re => hd.findIndex(x => re.test(x));
    const iKnown = idx(/подготовл|известн\S*\s+заклинан/i), iCan = idx(/заговор/i);
    if (iKnown < 0) return null;                       // без столбца «подготовленные / известные заклинания» это не таблица заклинателя
    let slotIdx = [], from = 1;
    hd.forEach((h, i) => { const m = i > 0 && h.match(/^(?:ячейк\S*\s+)?(\d)(?:-?(?:й|го))?(?:\s+уровн\S*)?$/i); if (m) slotIdx.push([i, +m[1]]); });
    if (!slotIdx.length) {                             // 2014: столбцов в шапке меньше, чем в строках; уровни ячеек — во второй строке («1 | 2 | 3 | 4»)
      const sub = rows[1].map(x => String(x).trim());
      if (!sub.length || !sub.every(x => /^\d(?:-?й)?$/.test(x))) return null;
      const start = Math.max(iKnown, iCan, 0) + 1; slotIdx = sub.map((x, j) => [start + j, parseInt(x, 10)]); from = 2;
    }
    const out = {};
    rows.slice(from).forEach(r => {
      const lvl = parseInt(r[0], 10); if (isNaN(lvl)) return;
      const slots = new Array(9).fill(0); slotIdx.forEach(([i, L]) => { if (L >= 1 && L <= 9) slots[L - 1] = nCell(r[i]); });
      out[lvl] = { slots, cantrips: iCan >= 0 ? nCell(r[iCan]) : null, n: nCell(r[iKnown]) };
    });
    return { kind: /подготовл/i.test(hd[iKnown]) ? 'prepared' : 'known', rows: out };
  }
  function subCasting(sub) {
    if (!sub) return null; if (subCache.has(sub)) return subCache.get(sub);
    const bl = [...(sub.description || []), ...(sub.features || []).flatMap(f => f.blocks || [])];
    const tb = bl.filter(b => b.type === 'table').map(b => castTable(b.rows)).find(t => t && Object.values(t.rows).some(r => r.slots.some(x => x > 0)));
    let out = null;
    if (tb) {
      const tx = bl.filter(b => b.type === 'paragraph').map(b => plain(b.text)), all = tx.join('\n');
      let list = null; for (const t of tx) { const m = lc(t).match(/списк\S*\s+(?:заклинаний\s+)?([а-я]+)/); if (m && (list = stemOf(LIST_STEM, m[1]))) break; }
      list = list || 'wizard';
      const am = lc(all).match(/(?:заклинательн\S*|базов\S*)\s+характеристик\S*[\s\S]{0,80}?(интеллект|мудрост|харизм)|(интеллект|мудрост|харизм)\S*\s+является\s+(?:базов|заклинательн)/);
      const ab = am ? AB_WORD[am[1] || am[2]] : SPELL_AB[list];
      // заговоры: в таблице 2014 есть столбец, в 2024 — только текст («Вы знаете два заговора…», «на 10-м уровне изучите ещё один»)
      let can = null;
      if (!Object.values(tb.rows).some(r => r.cantrips != null)) {
        const m = lc(all).match(/(?:знаете|изучаете)\s+(\d+|[а-я]+)\s+заговор/), base = m ? (NUM_WORD[m[1]] || +m[1] || 0) : 0;
        const ex = all.match(/ещ[её]\s+один\s+заговор|дополнительн\S*\s+заговор/i) ? 1 : 0, at = (all.match(/(\d+)-?(?:го|м)\s+уровн\S*\s+(?:воина|плута|монаха|друида|следопыта|[а-яё]+)?[^.]{0,40}(?:ещ[её]\s+один\s+заговор)/i) || all.match(/достигнете\s+(\d+)-?(?:го|м)/i) || [])[1];
        can = { base, extra: ex, at: at ? +at : 10 };
      }
      // школы (2014): «Все эти заклинания должны принадлежать школам Воплощения или Ограждения»; «…на 8-м, 14-м и 20-м уровнях» — любой школы
      let schools = null, free = [];
      const sm = all.match(/должны\s+принадлежать\s+(?:к\s+)?школ\S*\s+([^.]+)/i);
      if (sm) { const st = Object.keys(SCHOOL_STEM).filter(k => lc(sm[1]).includes(k)); if (st.length) schools = st.map(k => ({ stem: k, name: SCHOOL_STEM[k] })); }
      const fm = all.match(/заклинани\S*,\s+которые\s+вы\s+(?:выучите|узнаёте|изучите)\s+на\s+([^.]*?)\s+уровн/i); if (fm) free = (fm[1].match(/\d+/g) || []).map(Number);
      out = { kind: tb.kind, rows: tb.rows, list, ab, can, schools, free };
    }
    subCache.set(sub, out); return out;
  }
  // строка подкласса для этого уровня: { slots, cantrips, prepared | known } или null (уровень ниже первого в таблице)
  function subCastRow(sc, lvl) {
    const r = sc && sc.rows[lvl]; if (!r) return null;
    const cantrips = r.cantrips != null ? r.cantrips : sc.can ? sc.can.base + (sc.can.extra && lvl >= sc.can.at ? 1 : 0) : null;
    return { slots: r.slots.slice(), cantrips, prepared: sc.kind === 'prepared' ? r.n : null, known: sc.kind === 'known' ? r.n : null };
  }
  // школа заклинания не из школ подкласса (2014: у Мистического рыцаря и ловкача, кроме заклинаний 8, 14 и 20 уровней)
  const outOfSchools = (sp, sc) => !!(sp && sp.schools && sc && !sp.schools.some(x => lc(sc).startsWith(x.stem)));

  /* ---------- заклинания, которые выдаёт подкласс ---------- */
  // В подклассе лежит таблица из двух столбцов «Уровень <класса> | Заклинания» (домены, клятвы, круги, покровители 2024): с указанного уровня
  // класса эти заклинания у персонажа подготовлены всегда. «Уровень заклинания | Заклинания» (покровители колдуна 2014) — не выдача,
  // а расширение списка: заклинания можно выбрать как обычные. Названия в тексте разные: «Лечение ран», «лечение ран [cure wounds]»,
  // две записи у «Возрождения» и «Удержания чудовища» (в справочнике — «Возвращение к жизни», «Удержание монстра»).
  const SPELL_ALIAS = { 'возрождение': 'raise-dead', 'удержание чудовища': 'hold-monster' };
  const subSpellCache = new WeakMap();
  const splitNames = cell => { const out = []; let cur = '', dep = 0; for (const ch of String(cell == null ? '' : cell)) { if (ch === '(' || ch === '[') dep++; if (ch === ')' || ch === ']') dep = Math.max(0, dep - 1); if (ch === ',' && !dep) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
  const cleanSpellName = raw => { const t = nfc(raw).replace(/\*+/g, '').trim(), en = (t.match(/\[([^\]]+)\]/) || [])[1] || ''; return { ru: t.replace(/\s*\[.*$/, '').replace(/[.\s]+$/, '').trim(), en: en.replace(/[\]\s]+$/, '').trim() }; };
  function spellByName(spells, raw) {
    const n = cleanSpellName(raw), key = lc(n.ru); if (!key || !spells) return null;
    const alias = SPELL_ALIAS[key];
    return spells.find(x => lc(x.name_ru) === key) || (alias && spells.find(x => x.slug === alias)) || (n.en && spells.find(x => lc(x.name_en || '') === lc(n.en))) || null;
  }
  // { always: [{ lvl (уровень класса), names }], expanded: [{ lvl (круг заклинания), names }] }
  function subSpellTables(sub) {
    if (!sub) return { always: [], expanded: [] }; if (subSpellCache.has(sub)) return subSpellCache.get(sub);
    const out = { always: [], expanded: [] };
    [...(sub.description || []), ...(sub.features || []).flatMap(f => f.blocks || [])].filter(b => b.type === 'table' && b.rows && b.rows.length > 1 && b.rows[0].length === 2).forEach(b => {
      const h0 = lc(plain(b.rows[0][0])).trim(), h1 = lc(plain(b.rows[0][1])).trim(); if (h1 !== 'заклинания') return;
      const kind = /^уровень\s*заклинани/.test(h0) ? 'expanded' : /^уровень\s*[а-я]/.test(h0) ? 'always' : null; if (!kind) return;
      b.rows.slice(1).forEach(r => { const lvl = parseInt(String(r[0]).replace(/\*/g, ''), 10); if (!isNaN(lvl)) out[kind].push({ lvl, names: splitNames(r[1]) }); });
    });
    subSpellCache.set(sub, out); return out;
  }
  // что подкласс даёт на этом уровне: autoSpells — всегда подготовлены, extra — slug заклинаний, добавленных в список класса, missing — названия, которых нет в справочнике
  function subSpells(sub, spells, lvl) {
    const t = subSpellTables(sub), auto = [], extra = [], missing = [];
    t.always.filter(r => r.lvl <= lvl).forEach(r => r.names.forEach(raw => {
      const m = spellByName(spells, raw);
      if (!m) { const n = cleanSpellName(raw).ru; if (n && !missing.includes(n)) missing.push(n); return; }
      if (!auto.some(a => a.slug === m.slug)) auto.push({ slug: m.slug, name: m.name_ru, lvl: m.level, from: sub.name, at: r.lvl, auto: true, free: true, prep: true });
    }));
    t.expanded.forEach(r => r.names.forEach(raw => { const m = spellByName(spells, raw); if (m && !extra.includes(m.slug)) extra.push(m.slug); }));
    return { auto, extra, missing };
  }

  /* ---------- заклинания, которые даёт вид ---------- */
  // 2014: «Начиная с 3-го уровня вы можете накладывать заклинание опутывание [entangle] с помощью этой особенности» (название с английским в скобках);
  // 2024: «Вы знаете заговор Свет», «У вас всегда подготовлены заклинания Маскировка и Сглаз», таблица наследия тифлинга.
  // Выбор из списка («один заговор из списка волшебника») не разбирается: названия в тексте нет. → [{ slug, name, lvl, from, at, kind, auto, free, prep }]
  function speciesSpells(sp, opt, lvl, spells, ed) {
    if (!sp || !spells || !spells.length) return [];
    const out = [], add = (m, at, trait) => { if (m && at <= lvl && !out.some(a => a.slug === m.slug)) out.push({ slug: m.slug, name: m.name_ru, lvl: m.level, from: sp.name_ru, at, kind: 'sp', trait, auto: true, free: true, prep: true }); };
    const atOf = z => { const m = lc(z).match(/(?:начиная с|при достижении|на)\s+(\d+)-?\S*\s+уровн/); return m ? +m[1] : 1; };
    let traits = speciesTraits(sp, { opt, lvl: 20 });
    const vi = traits.findIndex(t => /^внешний вид$/i.test(String(t.name).trim())); if (vi >= 0) traits = traits.slice(0, vi);   // дальше идут необязательные варианты (SCAG): их заклинания нельзя назначать сразу
    if (!opt && traits.filter(t => /заклинани|заговор/i.test(t.text) && /\[[A-Za-z]/.test(t.text)).length >= 3) return [];       // сборная статья «все наследия сразу»
    traits.forEach(t => {
      sentences(t.text).forEach(z => {
        if (/из\s+списка/i.test(z) || !/заклинани|заговор/i.test(z)) return;
        if (ed === 14) { [...z.matchAll(/([А-Яа-яЁё][А-Яа-яЁё’' \/-]*?)\s*\[([A-Za-z’' \/-]+)\]/g)].forEach(m => add(spellByName(spells, m[1].trim() + ' [' + m[2] + ']'), atOf(z), t.name)); return; }
        const known = z.match(/(?:знаете|изучаете)\s+заговор(?:ы)?\s+([^.]+)/i) || z.match(/всегда\s+подготовлен\S*\s+заклинани\S*\s+([^.]+)/i);
        if (!known) return;
        const raw = known[1].replace(/\s+(?:Ваша|Вы|Кроме|Когда|Каждый)\b.*$/, '').trim(), whole = spellByName(spells, raw);
        (whole ? [raw] : raw.split(/\s+и\s+|,\s*/)).forEach(n => add(spellByName(spells, n), atOf(z), t.name));
      });
    });
    // 2024: наследие тифлинга — таблица «Наследие | 1-й уровень | 3-й уровень | 5-й уровень»
    if (ed === 24 && opt) (sp.blocks || []).filter(b => b.type === 'table' && b.rows && /наследие/i.test(String(b.rows[0][0]))).forEach(b => {
      const row = b.rows.find(r => lc(r[0]) === lc(opt)); if (!row) return;
      const cant = String(row[1]).match(/заговор\s+([^.]+)/i); if (cant) add(spellByName(spells, cant[1]), 1, 'Наследие');
      [[2, 3], [3, 5]].forEach(([i, at]) => add(spellByName(spells, row[i]), at, 'Наследие'));
    });
    return out;
  }

  /* ---------- владение оружием ---------- */
  // основа слова без падежного окончания: «кинжалы» ≈ «Кинжал», «длинные мечи» ≈ «Длинный меч»
  const ENDS = /(ыми|ими|ого|его|ому|ему|ами|ями|ый|ий|ой|ая|яя|ое|ее|ые|ие|ую|юю|ым|им|ом|ем|ых|их|ов|ей|ам|ям|ах|ях|ою|ею|а|я|у|ю|ы|и|е|о|ь|й)$/;
  const wstem = w => { const n = lc(w), c = n.replace(ENDS, '').replace(/[ьи]$/, ''); return c.length >= 3 ? c : n; };
  const wstemList = s => (lc(s).match(/[а-я0-9]+/g) || []).map(wstem);
  const wstems = s => wstemList(s).join(' ');
  // свойства оружия — первые жирные слова абзацев: «**Лёгкое.**», «**Фехтовальное.**»
  function weaponProps(g) {
    return ((g && g.blocks) || []).filter(b => b.type === 'paragraph').map(b => { const m = String(b.text || '').match(/^\*\*([А-Яа-яЁё ]+?)\.?\*\*/); return m ? lc(m[1]) : null; }).filter(Boolean);
  }
  // Владеет ли класс этим оружием. text — строка «Оружие» из класса, g — запись снаряжения.
  // Понимает: «Простое оружие», «Воинское оружие», «Воинское оружие, обладающее свойством Лёгкое или Фехтовальное»
  // (2024) и перечни по названиям: «кинжалы, дротики, лёгкие арбалеты» (2014).
  function weaponProf(text, g) {
    if (!g) return false;
    const line = lc(g.line || ''), simple = /прост/.test(line), martial = /воинск/.test(line), gs = wstemList(g.name_ru);
    for (let clause of lc(text).split(';')) {
      const lim = clause.match(/воинск\S*\s+оружи\S*,?\s*обладающ\S*\s+свойств\S*\s+(.+)$/);
      if (lim) {
        clause = clause.slice(0, lim.index);
        const want = lim[1].split(/,|\sили\s|\sи\s/).map(x => wstem(x.trim())).filter(Boolean), have = weaponProps(g).map(wstem);
        if (martial && want.some(w => have.includes(w))) return true;
      }
      for (const cat of clause.matchAll(/(?:(?:прост|воинск)\S*\s+(?:и\s+)?)+оружи\S*/g)) {   // «Простое оружие», «Простое и Воинское оружие»
        if (/прост/.test(cat[0]) && simple) return true;
        if (/воинск/.test(cat[0]) && martial) return true;
      }
      const rest = clause.replace(/(?:(?:прост|воинск)\S*\s+(?:и\s+)?)+оружи\S*/g, ' ');
      for (const item of rest.split(/,|\sи\s/)) {
        const it = wstemList(item); if (!it.length) continue;
        // название должно совпасть целиком: «копья» — это не «Кавалерийское копьё»; «ручные арбалеты» ≈ «Одноручный арбалет»
        if (it.length === gs.length && it.every((w, k) => gs[k] === w || (w.length >= 4 && gs[k].endsWith(w)))) return true;
      }
    }
    return false;
  }

  /* ---------- черты: прибавка к характеристике ---------- */
  // «**Повышение характеристики.** Увеличьте значение вашей Силы или Ловкости на 1, но не выше 20.»
  // → { opts: ['str','dex'], cap: 20 }; «одной из ваших характеристик» → все шесть; нет такой строки → null
  // Если черта заодно даёт владение спасброском выбранной характеристики («Устойчивый»), save: true;
  // notProf: true — выбирать можно только ту, спасброском которой персонаж ещё не владеет.
  // «Увеличьте значение Силы или Ловкости на 1…» бывает абзацем с жирным заголовком (2024), пунктом списка (почти все черты 2014)
  // и «характеристики по вашему выбору» / «выбранной характеристики» (любая из шести).
  const STEM_AB = { str: 'сил', dex: 'ловк', con: 'телос', int: 'интел', wis: 'мудр', cha: 'хариз' };   // падежи: «Силы», «Ловкости»
  function featAbility(f) {
    const blocks = (f && f.blocks) || [];
    const texts = blocks.flatMap(b => b.type === 'paragraph' ? [String(b.text || '')] : b.type === 'list' ? (b.items || []).map(i => String(typeof i === 'string' ? i : (i && i.text) || '')) : []);
    const flags = { save: texts.some(t => /владени\S*\s+спасброск\S*\s+(?:выбранной|этой)\s+характеристики/i.test(t)), notProf: texts.some(t => /спасброском\s+которой\s+вы\s+не\s+владеете/i.test(t)) };
    const parse = body => {
      const cap = (body.match(/(?:не выше|максимум\S*)\s+(\d+)/i) || [])[1];
      const any = /одн\S*\s+из\s+(?:ваших\s+)?характеристик|выберите\s+одну\s+характеристику|выбранной\s+характеристики|характеристики\s+по\s+(?:вашему|своему)\s+выбору/i.test(body);
      const head = body.replace(/на\s+1.*$/i, '');
      const opts = any ? AB.map(a => a.k) : AB.filter(a => lc(head).includes(STEM_AB[a.k])).map(a => a.k);
      return opts.length ? { opts, cap: cap ? +cap : 20 } : null;
    };
    let res = null;
    const bold = texts.find(t => /^\*\*(?:Повышение|Увеличение)\s+(?:значения\s+)?характеристик/i.test(t));
    if (bold) res = parse(bold.replace(/^\*\*[^*]+\*\*\.?\s*/, ''));
    for (let i = 0; !res && i < texts.length; i++) { const m = texts[i].replace(/\*+/g, '').match(/увеличь(?:те)?\s+значение\s+[^.]*?\s+на\s+1[^.]*/i); if (m && !/на\s+2/.test(m[0])) res = parse(m[0]); }   // «на 2 или двух на 1» — это сама черта «Увеличение характеристик», не +1
    // «Могущественная драконья метка»: +1 к заклинательной характеристике метки — у всех меток это Интеллект, Мудрость или Харизма
    if (!res && texts.some(t => /заклинательн\S*\s+для\s+вашей\s+черты\s+Драконьей\s+метки/i.test(t))) res = { opts: ['int', 'wis', 'cha'], cap: 20 };
    return res ? Object.assign(res, flags.save ? { save: true } : {}, flags.notProf ? { notProf: true } : {}) : null;
  }
  // класс из официальной книги (издание WotC)? «The Pugilist Class» — фанатский материал
  const officialSrc = src => !src || !src.length || src.some(x => /Handbook|Tasha|Eberron|Xanathar|Dungeon Master|Mordenkainen|Fizban|Sword Coast|Ravnica|Strixhaven|Theros|Wayfinder|Spelljammer|Planescape|Van Richten|Bigby/i.test(x));
  // сколько навыков класс позволяет усилить Экспертностью к этому уровню (2024)
  function expertiseSlots(cls, lvl, ed) {
    if (!cls || ed === 14) return 0;
    return (cls.features || []).filter(f => f.level <= lvl).reduce((n, f) => n + (/^экспертность$/i.test(f.name) ? 2 : /^(искусный исследователь|академические знания)$/i.test(f.name) ? 1 : 0), 0);
  }

  /* ---------- что дают черты, вид и подкласс ---------- */
  const CNT = { одним: 1, одному: 1, одного: 1, двумя: 2, двум: 2, тремя: 3, трём: 3 };
  // «владение тремя навыками или инструментами» / «владение одним навыком на ваш выбор» → число навыков на выбор
  const skillGrantN = texts => texts.reduce((n, t) => { const m = lc(t).match(/владе\S*\s+(одним|одному|одного|двумя|двум|тремя|трем)\s+навык/); return n + (m ? (CNT[m[1]] || (m[1] === 'трем' ? 3 : 0)) : 0); }, 0);
  // «Вы получаете владение Воинским оружием и тренированность со Средними доспехами и Щитами»
  function profGrants(texts) {
    const arm = new Set(), wp = new Set();
    texts.forEach(t => {
      const m = String(t).match(/тренированност\S*\s+(?:с|со)\s+([^.]*)/i);
      if (m) { const c = lc(m[1]); if (/легк/.test(c)) arm.add('Лёгкие доспехи'); if (/средн/.test(c)) arm.add('Средние доспехи'); if (/тяжел/.test(c)) arm.add('Тяжёлые доспехи'); if (/щит/.test(c)) arm.add('Щиты'); }
      const w = lc(t).match(/владени\S*\s+(?:всем\s+)?(воинск\S*|прост\S*)\s+оружи/); if (w) wp.add(/воинск/.test(w[1]) ? 'Воинское оружие' : 'Простое оружие');
    });
    return { arm: [...arm], wp: [...wp] };
  }

  /* ---------- черты вида ---------- */
  function paragraphsOf(blocks) { return (blocks || []).filter(b => b.type === 'paragraph').map(b => b.text); }
  const OPT_HEAD = /наследие великанов|гномий род|наследие драконов|наследие исчадий|эльфийский род/i;
  // В данных 2014 рядом с особенностями вида лежат справочные абзацы в том же оформлении: «**Мужские имена:** …», «**Лидер:** …», «**Об эльфах.** …»,
  // «**Источник: …**». Особенностями они не являются, и без этого фильтра попадали бы в список умений и на печатный лист.
  const LORE_NAME = /(:\s*$|^источник|^смотрите статью|^об?\s+\S+(ах|ях)$|(^|\s)(имена|имён)(\s|$)|^(лидеры?|штаб-?квартира)$|^(названия\s+\S+|прозвища|фамилии)(\s|$))/i;
  function traitOf(text) {
    const m = String(text).match(/^\*\*(.+?)\.?\*\*\.?\s*(.*)$/s); if (!m) return null;
    const name = m[1].replace(/\.$/, ''); return LORE_NAME.test(name.trim()) ? null : { name, text: m[2] };
  }
  // Все особенности вида. Повторы раздела «Особенности …» из другой книги (гоблин, орк, кентавр: те же особенности под тем же заголовком) пропускаются.
  function allTraits(sp) {
    const out = [], bl = (sp && sp.blocks) || [], ss = speciesSections(sp); let skip = false;
    bl.forEach((b, i) => {
      if (b.type === 'heading') { skip = !!(ss && ss.dupAt.has(i)); return; }
      if (b.type !== 'paragraph' || skip) return;
      const tr = traitOf(b.text); if (tr) out.push(tr);
    });
    return out;
  }
  /* ---------- подвиды и варианты вида 2014 ---------- */
  // У многих видов 2014 подрасы лежат под своими заголовками («Высший эльф», «Коренастый», «Аасимар-защитник»), но в поле subraces они не указаны.
  // Раздел вида — заголовок «Особенности …» (общие особенности), раздел подрасы — заголовок после него, где есть своё «Увеличение характеристик».
  // Подраса чаще прибавляется (эльф + высший эльф), но бывает и заменой: «следующие особенности заменяют расовые…», «вместо стандартного увеличения»,
  // а у тифлингов подраса пересказывает все бонусы целиком. Тогда общие «Увеличение характеристик» и названные в тексте особенности отбрасываются.
  const secCache = new WeakMap(), ASI_NAME = /^увеличение\s+(?:характеристик|значени)/i;
  const isAsiTrait = t => ASI_NAME.test(String(t.name).trim()) || /заменя\S*\s+особенност\S*\s+[«"]увеличение характеристик/i.test(lc(t.text));
  const KEEP_ALL = /^(возраст|мировоззрение|размер|скорость)/i;
  // «Значение вашей Силы увеличивается на 2, а значение Телосложения — на 1», «…всех ваших характеристик… на 1», «двух разных характеристик на ваш выбор… на 1»
  function parseAsi(text) {
    const fixed = {}, picks = [], t = lc(plain(text));
    t.split(/,\s*а\s+|;\s*|\.\s+/).forEach(cl => {
      const m = cl.match(/(?:увеличива\S*|повыша\S*|—|-)?\s*на\s+(\d)(?!\d)/); if (!m) return;
      const v = +m[1], head = cl.slice(0, m.index);
      if (/на ваш выбор|одн\S*\s+друг\S*\s+характеристик|дву\S*\s+(?:разных\s+|друг\S*\s+)?характеристик/.test(cl)) { picks.push({ n: /одн\S*\s+(?:друг\S*\s+)?характеристик/.test(cl) ? 1 : 2, v }); return; }
      if (/всех\s+(?:ваших\s+)?характеристик/.test(head)) { AB.forEach(a => { fixed[a.k] = (fixed[a.k] || 0) + v; }); return; }
      abIn(head).forEach(k => { fixed[k] = (fixed[k] || 0) + v; });
    });
    return { fixed, picks };
  }
  const asiTotal = tr => { const seen = new Set(); let n = 0; tr.filter(isAsiTrait).forEach(t => { if (seen.has(t.text)) return; seen.add(t.text); const a = parseAsi(t.text); n += Object.values(a.fixed).reduce((q, x) => q + x, 0) + a.picks.reduce((q, x) => q + x.n * x.v, 0); }); return n; };
  function speciesSections(sp) {
    if (!sp) return null; if (secCache.has(sp)) return secCache.get(sp);
    const bl = sp.blocks || [], heads = []; bl.forEach((b, i) => { if (b.type === 'heading') heads.push(i); });
    const secs = heads.map((i, k) => {
      const to = k + 1 < heads.length ? heads[k + 1] : bl.length, tr = [], sent = [];
      for (let j = i + 1; j < to; j++) { const b = bl[j]; if (b.type !== 'paragraph') continue; const t = traitOf(b.text); if (t) tr.push(t); sentences(b.text).forEach(x => sent.push(x)); }
      return { h: String(bl[i].text), i, tr, sent };
    });
    const bi = secs.findIndex(x => /^особенност/i.test(x.h) && x.tr.length);
    let out = null;
    if (bi >= 0) {
      const base = secs[bi], key = wstems(base.h), dupAt = new Set(), subs = [], baseTotal = asiTotal(base.tr);
      secs.slice(bi + 1).forEach(x => {
        if (!x.tr.length) return;
        if (/^особенност/i.test(x.h) && wstems(x.h) === key) { dupAt.add(x.i); return; }       // тот же раздел из другой книги
        if (!x.tr.some(isAsiTrait)) return;                                                     // подраса — только раздел со своим «Увеличением характеристик»
        const names = new Set(); let all = false;
        x.sent.forEach(z => { const lz = lc(z); if (!/заменя|вместо/.test(lz)) return;
          if (/расов\S*\s+особенност/.test(lz)) all = true;
          [...z.matchAll(/«([^»]+)»/g)].forEach(q => names.add(lc(q[1]).trim()));
          if (/увеличени\S*\s+характеристик/.test(lz)) names.add('увеличение характеристик'); });
        const total = asiTotal(x.tr), restates = baseTotal >= 3 && total >= baseTotal;           // тифлинг-подраса пересказывает бонусы целиком
        if (restates) names.add('увеличение характеристик');
        subs.push({ label: x.h, tr: x.tr, names, all, replacesAsi: all || names.has('увеличение характеристик') });
      });
      out = { base, subs, dupAt, optional: subs.length > 0 && subs.every(x => x.replacesAsi) };
    }
    if (!out) out = { base: null, subs: [], dupAt: new Set(), optional: false };
    secCache.set(sp, out); return out;
  }
  // особенности «общая часть + выбранная подраса»: у заменяющей подрасы общие особенности из заменённых отбрасываются
  function sectionTraits(sp, opt) {
    const ss = speciesSections(sp), sub = ss.subs.find(x => x.label === opt), base = ss.base.tr;
    if (!sub) return base.slice();
    // подраса, пересказывающая свои Возраст/Размер/Скорость (гоблины Данквуда), заменяет одноимённые общие особенности
    const ownAll = sub.tr.map(t => lc(t.name).trim()), restated = ownAll.some(n => /^(возраст|размер)/.test(n)), own = new Set(restated ? ownAll.concat('разновидности') : ownAll.filter(n => KEEP_ALL.test(n)));
    // «Наследие Маладомини» (MToF) заменяет общее «Дьявольское наследие»: наследия подрасы вытесняют общее
    const heritage = sub.tr.some(t => /наследие/i.test(String(t.name).trim()));
    const kept = (sub.all ? base.filter(t => KEEP_ALL.test(String(t.name).trim())) : base.filter(t => !sub.names.has(lc(t.name).trim()) && !(sub.names.has('увеличение характеристик') && isAsiTrait(t)))).filter(t => !own.has(lc(t.name).trim()) && !(heritage && /наследие/i.test(String(t.name).trim())));
    return kept.concat(sub.tr);
  }
  // Бонусы вида к характеристикам по выбранной подрасе: { fixed: {ключ: +N}, picks: [{ n, v }] (на выбор), traits: [названия] }
  function speciesAsi(sp, opt) {
    if (!sp) return null;
    const tr = speciesTraits(sp, { opt, lvl: 1 }).filter(isAsiTrait), seen = new Set(), fixed = {}, picks = [], from = [];
    tr.forEach(t => { if (seen.has(t.text)) return; seen.add(t.text); const a = parseAsi(t.text); Object.keys(a.fixed).forEach(k => { fixed[k] = (fixed[k] || 0) + a.fixed[k]; }); picks.push(...a.picks); from.push(t.name); });
    return Object.keys(fixed).length || picks.length ? { fixed, picks, traits: from } : null;
  }
  // Подвид/наследие вида: {kind:'par'|'table'|'groups', label, options:[имена], head, table}
  function speciesChoice(sp) {
    if (!sp) return null;
    const bl = sp.blocks || [], tr = allTraits(sp);
    const subs = (sp.subraces || []).filter(x => typeof x === 'string');
    if (subs.length > 1) { const hs = bl.filter(b => b.type === 'heading').map(b => b.text), opts = subs.filter(n => hs.includes(n)); if (opts.length > 1) return { kind: 'groups', label: 'Подраса', options: opts }; }
    const head = tr.find(t => OPT_HEAD.test(t.name) && /выбер/i.test(t.text));
    if (!head) { const ss = speciesSections(sp); return ss && ss.subs.length ? { kind: 'sections', label: 'Подраса или вариант', options: ss.subs.map(x => x.label), optional: ss.optional } : null; }
    const tb = bl.find(b => b.type === 'table' && b.rows && b.rows.length > 2 && /^(наследие|род|дракон)/i.test(b.rows[0][0]));
    if (tb) return { kind: 'table', label: head.name, head: head.name, table: tb, options: tb.rows.slice(1).map(r => r[0]) };
    const opts = tr.filter(t => /великан\)$|^(Лесной|Скальный) гном$/.test(t.name)).map(t => t.name);
    if (opts.length > 1) return { kind: 'par', label: head.name, head: head.name, options: opts };
    return null;
  }
  // o = {opt, lvl}: без o — все особенности; с o — только выбранный вариант
  function speciesTraits(sp, o) {
    const ch = o && speciesChoice(sp);
    if (!ch) return allTraits(sp);
    const opt = o.opt, lvl = o.lvl || 1;
    if (ch.kind === 'sections') return sectionTraits(sp, opt);
    if (ch.kind === 'groups') {
      const out = []; let cur = null;
      (sp.blocks || []).forEach(b => {
        if (b.type === 'heading') { cur = b.text; return; }
        if (b.type !== 'paragraph' || (ch.options.includes(cur) && cur !== opt)) return;
        const tr = traitOf(b.text); if (tr) out.push(tr);
      });
      return out;
    }
    const tr = allTraits(sp);
    if (ch.kind === 'par') return tr.filter(t => !ch.options.includes(t.name) || t.name === opt);
    const out = [];
    tr.forEach(t => {
      out.push(t);
      if (t.name !== ch.head || !opt) return;
      const hd = ch.table.rows[0], row = ch.table.rows.find((r, i) => i && r[0] === opt); if (!row) return;
      const parts = [];
      hd.forEach((hn, j) => { if (!j) return; const n = (hn.match(/(\d+)-й/) || [])[1]; if (n) { if (+n <= lvl) parts.push(n + '-й ур.: ' + row[j]); } else parts.push(hn + ': ' + row[j]); });
      out.push({ name: t.name + ' — ' + opt, text: parts.join(' ') });
    });
    return out;
  }
  // «Ваша базовая скорость ходьбы составляет 25 футов» → 25 (в тексте бывают и другие скорости: «плавание 30 футов»)
  const walkOf = t => { const s = String(t || '').replace(/\*+/g, ''), m = s.match(/ходьб\S*[^.\d]{0,40}?(\d+)/i) || s.match(/(\d+)\s*фут/i); return m ? +m[1] : 0; };
  const modeOf = a => { const n = {}; a.forEach(x => { n[x] = (n[x] || 0) + 1; }); return a.slice().sort((x, y) => n[y] - n[x] || a.indexOf(x) - a.indexOf(y))[0]; };
  // Базовая скорость вида. 2024 — свойство «Скорость»; 2014 — особенность «Скорость» (поле speeds в данных путает ходьбу с полётом и вариантами,
  // а у подрас особенность лежит в их разделе: берём выбранную подрасу o.opt, а пока она не выбрана — самое частое значение).
  function speciesSpeed(sp, ed, o) {
    if (!sp) return 30;
    if (sp.props) { const p = sp.props.find(x => /скорост/i.test(x.label)); if (p) { const n = intOf(String(p.value).match(/\d+/)); if (n) return n; } }
    const ch = speciesChoice(sp), opt = o && o.opt, groups = ch && ch.kind === 'groups' ? ch.options : [];
    if (ch && ch.kind === 'sections') {      // базовая скорость — из «Скорость» (у подрасы может быть своя), прибавка — «Быстрые ноги»: «скорость ходьбы увеличивается до 35 футов»
      const tr = sectionTraits(sp, opt), own = tr.filter(t => /^скорость$/i.test(String(t.name).trim())), walk = own.length ? walkOf(own[own.length - 1].text) : 0;
      const up = tr.map(t => plain(t.text).match(/скорост\S*(?:\s+ходьбы)?\s+увеличивается\s+до\s+(\d+)\s+фут/i)).filter(Boolean).map(m => +m[1]);
      return Math.max(walk || 30, ...up);
    }
    let cur = null; const general = [], mine = [], other = [];
    (sp.blocks || []).forEach(b => {
      if (b.type === 'heading') { cur = b.text; return; }
      if (b.type !== 'paragraph' || !/^\**\s*Скорость\s*\**\s*[.:]/.test(b.text)) return;   // «**Скорость**. …» и «Скорость. …» (жирный шрифт местами потерян); «Скорость курьера» сюда не попадает
      const n = walkOf(b.text); if (!n) return;
      (!groups.includes(cur) ? general : cur === opt ? mine : other).push(n);
    });
    const pick = mine.length ? mine : general.length ? general : other;
    return pick.length ? modeOf(pick) : 30;
  }

  // размер: у вида 2024 в свойствах («Средний … или Маленький … ; выберите»), у расы 2014 — список sizes
  const SIZES = ['Крошечный', 'Маленький', 'Средний', 'Большой', 'Огромный', 'Громадный'];
  const SIZE_MULT = { 'Крошечный': 0.5, 'Маленький': 1, 'Средний': 1, 'Большой': 2, 'Огромный': 4, 'Громадный': 8 };
  function speciesSizes(sp) {
    if (!sp) return ['Средний'];
    const p = sp.props && sp.props.find(x => /^размер/i.test(x.label));
    let list = [];
    if (p) { const txt = String(p.value); list = SIZES.map(n => ({ n, i: txt.indexOf(n) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i).map(x => x.n); }
    else if (sp.sizes && sp.sizes.length) list = sp.sizes.filter(n => SIZES.includes(n));
    return list.length ? list : ['Средний'];
  }
  const sizeOf = (sp, chosen) => { const o = speciesSizes(sp); return o.includes(chosen) ? chosen : o[0]; };

  /* ---------- навыки предыстории ---------- */
  // У части предысторий 2014 навыки даны на выбор («Выберите два из…», «История, плюс один из…»).
  // Возвращает {fixed — выдаются сразу, choose — сколько выбрать, from — из чего}.
  function bgSkillInfo(bg) {
    let txt = String((bg && bg.skills_text) || ''), listed = skillsIn(((bg && bg.skills) || []).join(', '));
    // у части предысторий 2014 (Резчик рун, Хранитель врат…) навыки записаны только абзацем «**Навыки:** Восприятие, История»
    if (bg && !txt && !listed.length) { const pr = (bg.blocks || []).find(x => x.type === 'paragraph' && /^\*\*Навыки:?\*\*/.test(String(x.text))); if (pr) { txt = plain(pr.text).replace(/^Навыки:?\s*/, '').replace(/[.\s]+$/, ''); listed = skillsIn(txt); } }
    const all = skillsIn(((bg && bg.skills) || []).join(', ') + ' ' + txt), fixedAll = { fixed: all, choose: 0, from: [] };
    if (!bg) return { fixed: [], choose: 0, from: [] };
    const t = lc(txt), pick = t.match(/выберите\s+(один|одно|два|три)(?=\s|$)/);
    if (pick && listed.length > NUMW[pick[1]]) return { fixed: [], choose: NUMW[pick[1]], from: listed };
    if (/или\s+один\s+навык\s+на\s+ваш\s+выбор/.test(t) && listed.length) { const fx = skillsIn(txt.split(/,\s*навык/i)[0]); return { fixed: fx, choose: 1, from: SKILLS.map(x => x.id).filter(id => !fx.includes(id)) }; }   // «Магия, навык вашей фракции или один навык на выбор»
    const plus = t.search(/(?:,\s*плюс|\sи)\s+(?:один|одно)\s/);
    if (plus > 0) {
      const fixed = skillsIn(txt.slice(0, plus)), from = listed.filter(id => !fixed.includes(id));
      if (from.length) return { fixed, choose: 1, from };
    }
    return fixedAll;
  }

  /* ---------- слой эффектов ----------
     Что умения меняют в числах: скорость, инициатива, хиты, КД, спасброски, навыки, характеристики.
     Правила разобраны по текстам умений из базы: эффект появляется, только если умение есть в данных и уже доступно на этом
     уровне — поэтому всё растёт с уровнем само. Выбор игрока (боевой стиль, метамагия…) сам не применяется.
     Каждый эффект можно отключить (c.fxOff[id]): на случай домашних правил и чтобы не считать дважды то, что вписано вручную. */
  const STEMS = { str: 'сил', dex: 'ловк', con: 'телос', int: 'интел', wis: 'мудр', cha: 'хариз' };
  const abIn = s => AB.filter(a => lc(s).includes(STEMS[a.k])).map(a => a.k);
  const abShort = k => ABN(k).ru.slice(0, 3);
  const plain = t => nfc(t).replace(/\*+/g, '');
  const sentences = t => plain(t).replace(/([.!?:])\s+/g, '$1\u0001').split('\u0001').map(s => s.trim()).filter(Boolean);
  // Абзацы умения для разбора. Пропускаем то, что не постоянный эффект: списки после «Пока вы …/В течение …» (временные состояния)
  // и — у умений класса/подкласса — варианты на выбор: абзацы с жирным заголовком, когда им предшествует «Выберите …»
  // или умение целиком состоит из таких вариантов («Проклятие совы», «Варвар», «Воин»…). Перечни преимуществ
  // («Вы получаете следующие преимущества: **Бонус к инициативе.** …») — не варианты, их разбираем.
  const TEMP_LEAD = /(?:^|[^а-яё])(?:пока|в течение|на время|в этом состоянии)(?![а-яё])/i;
  const BOLD_LEAD = /^\*\*[^*]+\*\*/;
  function flatText(bl, options) {
    const raw = []; let prev = '';
    (bl || []).forEach(b => {
      if (b.type === 'paragraph') { prev = nfc(b.text); raw.push(prev); }
      else if (b.type === 'list') { if (!TEMP_LEAD.test(prev)) (b.items || []).forEach(i => raw.push(nfc(typeof i === 'string' ? i : (i && i.text) || ''))); prev = ''; }
    });
    const bold = raw.filter(t => BOLD_LEAD.test(t)).length;
    const choice = options && bold >= 2 && (raw.some(t => !BOLD_LEAD.test(t) && /выбер|на ваш выбор/i.test(t)) || (bold >= 3 && BOLD_LEAD.test(raw[0])));
    return raw.filter(t => !(choice && BOLD_LEAD.test(t))).map(plain).filter(Boolean);
  }

  const lowDie = v => String(v).replace(/^К(?=\d)/, 'к');

  // Что надето. Доспех — только со свойством «Класс защиты» (по нему считается КД); магические доспехи и щиты КД не меняют
  // (бонус вносится вручную), но отменяют «без доспехов».
  function wornGear(c, D) {
    const w = { armor: null, shield: false, anyArmor: false, anyShield: false, heavy: false, medium: false };
    (c.inv || []).forEach(i => {
      if (!i.eq) return;
      const mg = i.sec === 'items', g = mg ? (D.itemsBySlug || {})[i.slug] : (D.gearBySlug || {})[i.slug]; if (!g) return;
      const line = String(g.line || '');
      if (mg) {
        if (/^Доспех\s*\(\s*Щит/i.test(line)) w.anyShield = true;
        else if (/^Доспех/i.test(line)) { w.anyArmor = true; if (!/любой/i.test(line) && /Тяжёл|Латн|Полулатн|Кольчужн|Пластинчат/i.test(line)) w.heavy = true; }
        return;
      }
      if (g.slug === 'shield' && /щит/i.test(line)) { w.shield = w.anyShield = true; return; }
      if (!/доспех/i.test(line)) return;
      w.anyArmor = true; if (/тяжел/.test(lc(line))) w.heavy = true;
      if ((g.props || []).some(x => /класс защиты/i.test(x.label))) { w.armor = g; w.medium = /средн/.test(lc(line)); }
    });
    return w;
  }
  // умения, собранные в списки (с уровнем и текстом для разбора): класс, подкласс, вид, черты
  function sourcesOf(c, D, lvl, featObjs) {
    const pack = (list, from, label) => (list || []).filter(f => (f.level || 0) <= lvl).map(f => { const paras = flatText(f.blocks, true); return { name: f.name, level: f.level || 0, paras, text: paras.join(' '), from, label }; });
    return {
      cf: pack(D.cls && D.cls.features, 'cls', D.cls && D.cls.name_ru),
      sf: pack(D.sub && D.sub.features, 'sub', D.sub && D.sub.name),
      tr: D.sp ? speciesTraits(D.sp, { opt: c.spOpt, lvl }).map(t => ({ name: t.name, level: 0, paras: [plain(t.text)], text: plain(t.text), from: 'sp', label: D.sp.name_ru })) : [],
      ft: featObjs.map(f => { const paras = flatText(f.blocks); return { name: f.name_ru, level: 0, paras, text: paras.join(' '), from: 'ft', label: f.name_ru }; })
    };
  }
  const COND = {
    noArmorShield: { t: 'пока нет доспехов и щита', f: w => !w.anyArmor && !w.anyShield },
    noHeavy: { t: 'пока нет тяжёлого доспеха', f: w => !w.heavy },
    noArmor: { t: 'пока нет доспехов', f: w => !w.anyArmor },
    armor: { t: 'пока надет доспех', f: w => !!w.anyArmor }
  };
  const srcLabel = f => f.from === 'cls' ? f.label + ', ' + f.level + ' ур.' : f.from === 'sub' ? 'подкласс «' + f.label + '», ' + f.level + ' ур.' : f.from === 'sp' ? 'вид: ' + f.label : 'черта';
  const AC_WORD = /(?:^|[^А-Яа-яЁё])КД(?![А-Яа-яЁё])|Класс\S*\s+(?:Защиты|Доспеха)/;
  // «Пока вы не носите доспехов, ваш КД равен 10 + модификатор Ловкости + модификатор Мудрости» → { base: 10, abs: ['dex','wis'], pb: false, noShield }
  function acFormulas(paras) {
    const out = [];
    paras.forEach(p => sentences(p).forEach(s => {
      if (!/не\s+носите\s+(?:ни\s+)?(?:доспех|брон)/i.test(s) || !AC_WORD.test(s) || /^(?:Действием|Бонусным|Реакцией)/i.test(s)) return;
      const m = s.match(/(\d+)\s*\+\s*(.+)$/); if (!m) return;
      out.push({ base: +m[1], abs: abIn(m[2]), pb: /бонус\S*\s+(?:мастерства|владения)/i.test(m[2]), noShield: /щит/i.test(s) });
    }));
    return out;
  }
  const acValue = (f, m, pb) => f.base + f.abs.reduce((q, k) => q + m[k], 0) + (f.pb ? pb : 0);
  const acFormulaText = f => f.base + f.abs.map(k => ' + ' + abShort(k)).join('') + (f.pb ? ' + БМ' : '');

  // Умения, повышающие характеристики: «Значения ваших Силы и Телосложения увеличиваются на 4, но не выше 25» (до расчёта модификаторов)
  function abilityFx(S) {
    const out = [];
    [...S.cf, ...S.sf].forEach(f => f.paras.forEach(p => sentences(p).forEach(s => {
      const mm = s.match(/значени\S*\s+(?:ваш\S*\s+)?([А-ЯЁа-яё]+(?:(?:,\s*|\s+и\s+)[А-ЯЁа-яё]+)*)\s+увеличива\S*\s+на\s+(\d+)/i); if (!mm) return;
      const ab = abIn(mm[1]); if (!ab.length) return;
      const cap = (s.match(/не\s+выше\s+(\d+)/i) || f.text.match(/Максимальн\S*\s+значени\S*[^.]*?(\d+)\s*\./i) || [])[1];
      const id = f.from + ':' + f.name + '#ability'; if (out.some(e => e.id === id)) return;
      out.push({ id, k: 'ability', ab, v: +mm[2], cap: cap ? +cap : 30, why: f.name, src: srcLabel(f), on: true, cond: '',
        text: ab.map(abShort).join(', ') + ' ' + sgn(+mm[2]) + (cap ? ' (максимум ' + cap + ')' : '') }); /* cap без числа — не ограничиваем выше 30 */
    })));
    return out;
  }

  const SAVE_PROF = /владени\S*\s+(?:всеми\s+)?спасброск/i, YOU = /(?:^|[^а-яё])(?:вы|вам|вас)(?![а-яё])/i, NOT_YOU = /несущ/i, ALREADY = /(?:^|[^а-яё])уже(?![а-яё])/i;

  // Остальные эффекты. X = { lvl, pb, m, score, lr, worn, src }
  function collectFx(c, D, X) {
    const { lvl, pb, m, score, lr, worn, src: S } = X, out = [], seen = new Set(), all = [...S.cf, ...S.sf, ...S.tr, ...S.ft];
    const put = (f, k, o) => {
      const id = o.id || (f.from + ':' + f.name + '#' + k); if (seen.has(id)) return; seen.add(id);
      const cond = o.need ? COND[o.need] : null;
      out.push(Object.assign({ why: f.name, src: srcLabel(f), on: cond ? cond.f(worn) : true, cond: cond ? cond.t : '' }, o, { id, k }));
    };
    const speedN = t => { const mm = plain(t).match(/скорост\S*(?:\s+ходьбы)?\s+увеличива\S*\s+на\s+(\d+)\s+фут/i); return mm ? +mm[1] : 0; };

    /* скорость */
    S.cf.forEach(f => {
      if (/^(движение|скорость) без доспехов$/i.test(f.name) && lr) {             // монах: прибавка — столбец таблицы класса
        const key = Object.keys(lr.extra).find(k => /движение без доспехов|скорость без доспехов/i.test(k)), v = key ? intOf(lr.extra[key]) : 0;
        if (v) put(f, 'speed', { v, need: 'noArmorShield', text: 'Скорость ' + sgn(v) + ' фт.' });
      } else if (/^(быстрое передвижение|вездеходность)$/i.test(f.name)) {         // варвар (5 ур.), следопыт 2024 (6 ур.)
        const v = speedN(f.text); if (v) put(f, 'speed', { v, need: 'noHeavy', text: 'Скорость ' + sgn(v) + ' фт.' });
      }
    });
    S.sf.forEach(f => { if (/^(превосходная мобильность|аура рвения)$/i.test(f.name)) { const v = speedN(f.text); if (v) put(f, 'speed', { v, text: 'Скорость ' + sgn(v) + ' фт.' }); } });
    S.tr.forEach(f => {                                                              // 2024: «Эльфийский род — Лесные эльфы»: «Ваша Скорость увеличивается до 35 футов»
      const mm = / — /.test(f.name) && f.text.match(/Скорость\S*\s+увеличивается\s+до\s+(\d+)\s+фут/i); if (mm) put(f, 'speed', { set: +mm[1], text: 'Скорость ' + mm[1] + ' фт.' });
    });
    S.ft.forEach(f => f.paras.forEach(p => sentences(p).forEach(s => {              // черты: «Ваша Скорость увеличивается на 10 футов» (Быстрый, Подвижный…)
      const mm = s.match(/^Ваша\s+(?:базовая\s+)?[Сс]корость(?:\s+ходьбы)?\s+увеличивается\s+на\s+(\d+)\s+фут/); if (mm) put(f, 'speed', { v: +mm[1], text: 'Скорость ' + sgn(+mm[1]) + ' фт.' });
    })));

    /* боевые стили (черта или умение 2014): «бонус +1 к КД» в доспехе, «+2 к броскам атаки дальнобойным оружием», «+2 к урону» одноручным рукопашным */
    S.ft.forEach(f => f.paras.forEach(p => sentences(p).forEach(s => {
      let mm = /(?:носите|надет)\S*[^.]*?бонус\s*\+(\d+)\s+к\s+(?:КД|Классу\s+Защиты)/i.exec(s);
      if (mm) { put(f, 'acPlus', { v: +mm[1], need: 'armor', text: 'КД +' + mm[1] }); return; }
      mm = /бонус\s*\+(\d+)\s+к\s+броскам?\s+атаки[^.]*дальнобойн/i.exec(s);
      if (mm) { put(f, 'atkPlus', { v: +mm[1], ranged: true, text: 'Дальнобойные атаки +' + mm[1] }); return; }
      mm = /(?:в\s+одной\s+руке)[^.]*бонус\s*\+(\d+)\s+к\s+броск\S*\s+урона/i.exec(s);
      if (mm) put(f, 'dmgPlus', { v: +mm[1], melee: true, oneHand: true, text: 'Урон +' + mm[1] + ' рукопашным оружием в одной руке' });
    })));

    /* инициатива: «…вы можете добавить к результату ваш модификатор Мудрости», «бонус +5 к проверкам инициативы», «… бонус мастерства» */
    all.forEach(f => f.paras.forEach(p => sentences(p).forEach(s => {
      if (!/инициатив/i.test(s) || !/(добав|получа|прибав)/i.test(s) || /количеств/i.test(s)) return;
      const n = s.match(/бонус\s+\+(\d+)/i), a = s.match(/модификатор\S*\s+(?:ваш\S*\s+)?(Сил|Ловк|Телос|Интел|Мудр|Хариз)\S*/i);
      const v = n ? +n[1] : a ? m[abIn(a[1])[0]] : /бонус\S*\s+(?:мастерства|владения)/i.test(s) ? pb : null;
      if (v == null) return;
      put(f, 'init', { v, id: f.from === 'sp' ? 'sp:init:' + v : undefined, text: 'Инициатива ' + sgn(v) });   // у вида — без повторов (в данных иногда две версии одной особенности)
    })));

    /* «половина бонуса мастерства» (Мастер на все руки, Выдающийся атлет 2014): к навыкам без владения и, если бонус «ко всем проверкам», к инициативе */
    [...S.cf, ...S.sf].forEach(f => f.paras.forEach(p => {
      const mm = plain(p).match(/добав\S*\s+половин\S*\s+(?:ваш\S*\s+)?бонус\S*\s+(?:мастерства|владения)([^.]*)/i); if (!mm) return;
      const tail = mm[1], v = /в\s+большую/i.test(tail) ? Math.ceil(pb / 2) : Math.floor(pb / 2);
      const sc = tail.match(/проверк\S*\s+((?:[А-ЯЁ][а-яё]+(?:,\s*|\s+или\s+|\s+и\s+)?)+)/), abs = sc ? abIn(sc[1]) : null;
      const skillOnly = /навык/i.test(tail) && !/всем\s+проверк/i.test(tail);
      put(f, 'skill', { v, nonprof: true, abs, text: 'Навыки без владения ' + sgn(v) + (abs ? ' (' + abs.map(abShort).join(', ') + ')' : '') });
      if (!skillOnly && (!abs || abs.includes('dex'))) put(f, 'init', { v, text: 'Инициатива ' + sgn(v) });
    }));

    /* бонус к спасброскам, равный модификатору (Аура защиты паладина): «…бонус к спасброскам, равный вашему модификатору Харизмы (минимум +1)» */
    [...S.cf, ...S.sf].forEach(f => f.paras.forEach(p => sentences(p).forEach(s => {
      const mm = s.match(/бонус\S*\s+к\s+спасброс\S*(.*?),?\s*равн\S*\s+(?:вашему\s+)?модификатор\S*\s+(?:ваш\S*\s+)?([А-Яа-яЁё]+)/i); if (!mm) return;
      const vab = abIn(mm[2])[0]; if (!vab) return;
      const tg = abIn(mm[1]), v = /минимум|минимальн/i.test(s) ? Math.max(1, m[vab]) : m[vab];
      put(f, 'save', { v, ab: tg.length ? tg : null, text: 'Спасброски ' + (tg.length ? tg.map(abShort).join(', ') + ' ' : '') + sgn(v) });
    })));

    /* владение спасбросками: «Вы получаете владение спасбросками Мудрости и Харизмы», «…даруют вам владение всеми спасбросками».
       Пропускаем «если вы уже владеете…» (там нужен выбор другой характеристики) и то, что получает не персонаж («Камень … несущему его существу») */
    [...S.cf, ...S.sf].forEach(f => f.paras.forEach(p => sentences(p).forEach(s => {
      if (!SAVE_PROF.test(s) || !YOU.test(s) || NOT_YOU.test(s) || ALREADY.test(s)) return;
      const tail = s.slice(s.search(SAVE_PROF)), all = /^владени\S*\s+всеми\s+спасброск/i.test(tail);
      const lst = tail.match(/спасброск\S*\s+((?:[А-ЯЁ][а-яё]+(?:,\s*|\s+и\s+|\s+или\s+)?)+)/), ab = all ? AB.map(a => a.k) : lst ? abIn(lst[1]) : [];
      if (ab.length) put(f, 'saveProf', { ab, text: 'Владение спасбросками: ' + (all ? 'все' : ab.map(abShort).join(', ')) });
    })));

    /* хиты: «максимум хитов увеличивается на A» + «на 1 за каждый уровень». Крепкий — удвоенный уровень */
    all.forEach(f => {
      if (/^крепкий$/i.test(f.name) && /удвоенн\S*\s+уров/i.test(f.text)) { put(f, 'hp', { v: 2 * lvl, text: 'Хиты ' + sgn(2 * lvl) + ' (2 за уровень)' }); return; }
      f.paras.forEach(p => sentences(p).forEach(s => {
        const a = s.match(/(?:максимум\S*|максимальн\S*\s+значени\S*)\s+(?:ваших\s+)?хит\S*\s+(?:также\s+)?увеличива\S*\s+на\s+(\d+)/i);
        if (!a || /его\s+максимум/i.test(s)) return;
        const per = /(?:кажд\S*|последующ\S*)[^.]*?уров|уров\S*[^.]*?кажд/i.test(s), v = +a[1] + (per ? Math.max(0, lvl - (f.level || 1)) : 0);
        put(f, 'hp', { v, text: 'Хиты ' + sgn(v) + (per ? ' (растут с уровнем)' : '') });
      }));
    });

    /* КД: «Пока вы не носите доспехов, ваш КД равен 10 + модификатор Ловкости + …» — варианты на случай «без доспеха»; считаем лучший */
    all.forEach(f => acFormulas(f.paras).forEach(fm => {
      const v = acValue(fm, m, pb), need = fm.noShield ? 'noArmorShield' : 'noArmor';
      put(f, 'acAlt', { fm, v, need, label: f.from === 'cls' ? f.label.toLowerCase() : f.name, text: 'КД без доспехов: ' + acFormulaText(fm) + ' = ' + v });
    }));
    S.ft.forEach(f => { if (/^мастер средних доспехов$/i.test(f.name)) put(f, 'acCap', { v: 3, id: 'ft:' + f.name + '#acCap', on: false, text: 'Средний доспех: бонус Ловкости до +3' }); });
    out.filter(e => e.k === 'acCap').forEach(e => { e.on = worn.medium && score.dex >= 16; e.cond = 'пока надет средний доспех и Ловкость 16+'; });

    /* пассивные проверки: «бонус +5 к пассивной проверке Мудрости (Восприятие) и … Интеллекта (Расследование)» */
    S.ft.forEach(f => f.paras.forEach(p => sentences(p).forEach(s => {
      const mm = /пассивн/i.test(s) && s.match(/бонус\s+\+(\d+)/i); if (!mm) return;
      const ids = skillsIn(s); if (ids.length) put(f, 'passive', { v: +mm[1], skills: ids, text: 'Пассивные проверки ' + sgn(+mm[1]) });
    })));
    return out;
  }

  /* ---------- ресурсы класса ---------- */
  // Значения из таблицы класса растут с уровнем сами; остальное — по формулам правил (только если умение уже есть у класса).
  const POOL_COL = /^(?:ярость|второе дыхание|дикий облик|проведение божественности|очки |единицы |избранный враг)/i;   // тратятся и восстанавливаются
  const MOVE_COL = /скорост|движени/i;                                                                                   // идёт в скорость, не в ресурсы
  const POOLS = [
    { id: 'lay', cls: 'paladin', feat: /^(возложение|наложение) рук$/i, n: 'Возложение рук', unit: 'хитов', pool: true, at: L => 5 * L },
    { id: 'insp', cls: 'bard', feat: /^(бардовское вдохновение|вдохновение барда)$/i, n: 'Вдохновение барда', pool: true, at: (L, x) => Math.max(1, x.m.cha) },
    { id: 'inspd', cls: 'bard', ed: 14, feat: /^вдохновение барда$/i, n: 'Кость вдохновения', at: L => 'к' + (L >= 15 ? 12 : L >= 10 ? 10 : L >= 5 ? 8 : 6) },
    { id: 'arc', cls: 'wizard', feat: /^магическое восстановление$/i, n: 'Магическое восстановление', unit: 'ур. ячеек', at: L => Math.ceil(L / 2) },
    { id: 'surge', cls: 'fighter', feat: /^всплеск действий$/i, n: 'Всплеск действий', pool: true, at: L => (L >= 17 ? 2 : 1) },
    { id: 'indom', cls: 'fighter', feat: /^(неукротимый|упорный)$/i, n: 'Неукротимый', pool: true, at: L => (L >= 17 ? 3 : L >= 13 ? 2 : 1) },
    { id: 'wind', cls: 'fighter', ed: 14, feat: /^второе дыхание$/i, n: 'Второе дыхание', pool: true, at: () => 1 },
    { id: 'cdc', cls: 'cleric', ed: 14, feat: /^божественный канал$/i, n: 'Божественный канал', pool: true, at: L => (L >= 18 ? 3 : L >= 6 ? 2 : 1) },
    { id: 'cdp', cls: 'paladin', ed: 14, feat: /^божественный канал$/i, n: 'Божественный канал', pool: true, at: () => 1 },
    { id: 'ds', cls: 'paladin', ed: 14, feat: /^божественное чувство$/i, n: 'Божественное чувство', pool: true, at: (L, x) => 1 + Math.max(0, x.m.cha) },
    { id: 'ws', cls: 'druid', ed: 14, feat: /^дикий облик$/i, n: 'Дикий облик', pool: true, at: L => (L >= 20 ? 'без лимита' : 2) },
    { id: 'kidc', cls: 'monk', feat: /^(ци|монашеская сосредоточенность)$/i, n: ed => (ed === 14 ? 'Сл спасброска ци' : 'Сл сосредоточенности'), at: (L, x) => 8 + Math.ceil(L / 4) + 1 + x.m.wis }
  ];
  function resources(c, D, X) {
    const out = [], { lvl, m, lr } = X; if (!D.cls || !lr) return out;
    Object.keys(lr.extra).forEach(k => {
      const v = String(lr.extra[k]).trim(); if (MOVE_COL.test(k) || !v || /^[—–-]+$/.test(v)) return;
      let next = null;
      for (let L = lvl + 1; L <= 20 && !next; L++) { const r = levelRow(D.cls, L), nv = r ? String(r.extra[k]).trim() : v; if (nv !== v) next = { lvl: L, v: lowDie(nv) }; }
      out.push({ id: 'tbl:' + k, n: k, v: lowDie(v), num: /^\d+$/.test(v) ? +v : null, pool: POOL_COL.test(k), next, src: 'table' });
    });
    const has = re => (D.cls.features || []).some(f => (f.level || 0) <= lvl && re.test(f.name));
    POOLS.filter(p => p.cls === D.cls.slug && (!p.ed || p.ed === c.ed) && has(p.feat)).forEach(p => {
      const v = p.at(lvl, { m }); if (v == null) return;
      let next = null; for (let L = lvl + 1; L <= 20 && !next; L++) { const nv = p.at(L, { m }); if (nv != null && nv !== v) next = { lvl: L, v: nv }; }
      out.push({ id: 'calc:' + p.id, n: typeof p.n === 'function' ? p.n(c.ed) : p.n, v, num: typeof v === 'number' ? v : null, unit: p.unit || '', pool: !!p.pool, next, src: 'calc' });
    });
    return out;
  }

  /* ---------- производные значения ---------- */
  // c — персонаж (хранится в браузере); D — загруженные данные {cls, sub, sp, bg, feats, gear}
  function derive(c, D) {
    const lvl = Math.max(1, Math.min(20, c.lvl || 1)), ci = classInfo(D.cls), lr = levelRow(D.cls, lvl);
    const score = {}, src = {};
    AB.forEach(a => { score[a.k] = intOf(c.ab && c.ab[a.k]) || 10; src[a.k] = []; });   // в сохранённых и импортированных листах значение бывает строкой
    const add = (k, v, why) => { if (!k || !v || !src[k]) return; score[k] += v; src[k].push(sgn(v) + ' ' + why); };
    // 2024 — бонусы дают предыстории; 2014 — вид (вводятся вручную)
    if (c.ed === 24 && D.bg && c.bg2) {
      const bgA = (D.bg.abilities || []).map(x => ABK[x]).filter(Boolean);
      if (c.bg2.m === '111') bgA.forEach(k => add(k, 1, 'предыстория'));
      else { add(c.bg2.a, 2, 'предыстория'); add(c.bg2.b, 1, 'предыстория'); }
    }
    AB.forEach(a => add(a.k, intOf(c.bonus && c.bonus[a.k]), c.ed === 14 ? 'вид' : 'прочее'));
    const feats = [];
    const capOf = {}, epic = epicLevel(D.cls), featSaves = [];
    // +1 к выбранной характеристике от черты (и владение её спасброском, если черта его даёт: «Устойчивый»)
    const featPick = (slug, pick) => {
      const fo = (D.feats || []).find(f => f.slug === slug), fa = featAbility(fo);
      if (fa && pick && fa.opts.includes(pick)) { add(pick, 1, 'черта'); capOf[pick] = Math.max(capOf[pick] || 0, fa.cap); if (fa.save) featSaves.push({ ab: pick, slug, why: fo.name_ru }); }
    };
    asiLevels(D.cls).filter(l => l <= lvl).forEach(l => {
      const x = (c.asi || {})[l]; if (!x) return;
      if (x.m === 'feat' || (c.ed === 24 && l === epic)) {
        if (!x.feat) return;
        feats.push({ slug: x.feat, lvl: l });
        featPick(x.feat, x.fa);
      }
      else if (x.m === '11') { add(x.a, 1, 'ур. ' + l); add(x.b, 1, 'ур. ' + l); }
      else if (x.m === '2') add(x.a, 2, 'ур. ' + l);
    });
    // черты, добавленные вручную: выбор характеристики (x.fa) необязателен — без него прибавку вписывают сами, как раньше
    (c.feats || []).forEach(x => { feats.push({ slug: x.slug, lvl: 0, extra: true }); featPick(x.slug, x.fa); });
    // черты (в том числе черта предыстории 2024) и остальные источники умений
    const featObjs = feats.map(x => (D.feats || []).find(f => f.slug === x.slug)).filter(Boolean);
    const bgFeat = bgFeatOf(c, D); if (bgFeat.feat) featObjs.push(bgFeat.feat);
    const styleF = styleFeat(c, D, lvl);                                        // боевой стиль: выбранная черта (2024) или умение (2014) действует как черта
    if (styleF && !featObjs.some(f => f.slug === styleF.slug)) featObjs.push(styleF);
    const S = sourcesOf(c, D, lvl, featObjs), off = c.fxOff || {};
    // умения, повышающие характеристики (Дикий чемпион, Тело и разум): +N с потолком выше обычного
    const abFx = abilityFx(S).map(e => Object.assign(e, { off: !!off[e.id] }));
    abFx.filter(e => !e.off).forEach(e => e.ab.forEach(k => { add(k, e.v, e.why); capOf[k] = Math.max(capOf[k] || 0, e.cap); }));
    AB.forEach(a => { score[a.k] = Math.min(score[a.k], capOf[a.k] || (c.cap20 === false ? 30 : 20)); });
    const m = {}; AB.forEach(a => { m[a.k] = mod(score[a.k]); });
    const pb = lr ? lr.prof : Math.ceil(lvl / 4) + 1;
    const worn = wornGear(c, D);
    const featSaveFx = featSaves.map(e => ({ id: 'ft:' + e.slug + '#saveProf', k: 'saveProf', ab: [e.ab], why: e.why, src: 'черта', on: true, cond: '', text: 'Владение спасбросками: ' + abShort(e.ab) }));
    const fx = [...abFx, ...collectFx(c, D, { lvl, pb, m, score, lr, worn, src: S }), ...featSaveFx].map(e => Object.assign(e, { off: !!off[e.id] }));
    const act = k => fx.filter(e => e.k === k && e.on && !e.off), sum = (list, f) => list.reduce((q, e) => q + (f ? f(e) : e.v), 0);

    const saveProf = new Set(ci ? ci.saves : []), saves = {}, saveFx = act('save'), saveFrom = {};
    saveProf.forEach(k => { saveFrom[k] = ['класс']; });
    act('saveProf').forEach(e => e.ab.forEach(k => { if (!saveProf.has(k)) { saveProf.add(k); saveFrom[k] = []; } if (saveFrom[k][0] !== 'класс' && !saveFrom[k].includes(e.why)) saveFrom[k].push(e.why); }));   // владение от умений и черт: откуда оно, видно в листе
    AB.forEach(a => { saves[a.k] = m[a.k] + (saveProf.has(a.k) ? pb : 0) + sum(saveFx.filter(e => !e.ab || e.ab.includes(a.k))); });

    const bgi = bgSkillInfo(D.bg), bgSk = bgi.fixed;
    const pick = new Set(c.skills || []), extra = new Set(c.skillsExtra || []), exp = new Set(c.exp || []);
    const bgChoice = bgi.choose ? { n: bgi.choose, from: bgi.from, got: bgi.from.filter(id => extra.has(id)).length } : null;
    const skFx = act('skill');
    const skills = SKILLS.map(s => {
      const from = [];
      if (pick.has(s.id)) from.push('класс'); if (bgSk.includes(s.id)) from.push('предыстория'); if (extra.has(s.id)) from.push('другое');
      const lev = exp.has(s.id) && from.length ? 2 : from.length ? 1 : 0;
      const bonus = sum(skFx.filter(e => (!e.nonprof || !lev) && (!e.abs || e.abs.includes(s.ab))));   // «половина бонуса мастерства» — только к навыкам без владения
      return { id: s.id, n: skillName(s, c.ed), ab: s.ab, lev, from, bonus: m[s.ab] + (lev === 2 ? pb * 2 : lev === 1 ? pb : 0) + bonus };
    });
    // пассивные проверки: 10 + бонус навыка (+5 у черты «Внимательный» 2014)
    const psFx = act('passive'), pas = id => 10 + skills.find(s => s.id === id).bonus + sum(psFx.filter(e => e.skills.includes(id)));
    const passive = { perception: pas('perception'), insight: pas('insight'), investigation: pas('investigation') };

    // хиты
    const die = ci ? ci.die : 8;
    const hpLvl = (L) => Math.max(1, Math.floor(die / 2) + 1 + m.con);
    const hpFx = act('hp'), manualHp = c.hpMode === 'manual' && c.hpManual;
    let hp = die + m.con + (lvl - 1) * hpLvl();
    if (manualHp) hp = c.hpManual; else hp += sum(hpFx);                  // свой итог вводят уже с учётом всего
    hp = Math.max(lvl, hp + (c.hpBonus || 0));

    // КД: доспех из справочника, иначе лучший вариант «без доспеха» (10 + Лов, защита без доспехов, драконья чешуя…)
    let ac = 10 + m.dex, acWhy = 'без доспеха';
    if (worn.armor) {
      const p = worn.armor.props.find(x => /класс защиты/i.test(x.label)), base = intOf(String(p.value).match(/\d+/)), dexOk = /ловкост|(?:^|[^а-яё])лов(?![а-яё])/i.test(p.value), cap0 = (String(p.value).match(/(?:не более|макс\.?)\s*(\d)/i) || [])[1];
      let cap = cap0 ? +cap0 : null; if (cap === 2 && act('acCap').length) cap = Math.max(cap, ...act('acCap').map(e => e.v));   // «Мастер средних доспехов»: +3 вместо +2
      ac = base + (dexOk ? (cap != null ? Math.min(m.dex, cap) : m.dex) : 0); acWhy = worn.armor.name_ru;
    } else if (worn.anyArmor) acWhy = 'магический доспех: впишите КД вручную';
    else {
      const alts = fx.filter(e => e.k === 'acAlt' && !e.off), best = alts.filter(e => e.on).reduce((b, e) => (e.v > b.v ? e : b), { v: ac });
      if (best.v > ac) { ac = best.v; acWhy = 'без доспеха (' + best.label + ')'; }
      else { const blocked = alts.find(e => !e.on && e.v > ac); if (blocked) acWhy = 'без доспеха (' + blocked.label + ' не действует со щитом)'; }   // формула сильнее, но со щитом не работает
    }
    if (worn.shield) { ac += 2; acWhy += ' + щит'; }
    act('acPlus').forEach(e => { ac += e.v; acWhy += ' + ' + e.why; });
    if (c.acBonus) ac += c.acBonus;
    if (c.acMode === 'manual' && c.acManual) { ac = c.acManual; acWhy = 'вручную'; }

    // заклинания
    // свои ячейки у класса — берём их; иначе заклинания может давать подкласс (Мистический рыцарь, Мистический ловкач…): тогда свои таблица, список и характеристика
    const ownCast = !!(lr && (lr.slots.some(x => x > 0) || lr.pact)), subC = ownCast ? null : subCasting(D.sub), subRow = subC ? subCastRow(subC, lvl) : null, lrS = subRow ? Object.assign({}, lr, subRow) : lr;
    const spAb = (ci && ci.spellAb) || (subRow && subC.ab), sp = { has: !!(lrS && (lrS.slots.some(x => x > 0) || lrS.pact)) || !!(c.spellAbManual) };
    if (sp.has) {
      const ab = spAb || c.spellAbManual || 'int';
      sp.list = subRow ? subC.list : (D.cls && D.cls.slug) || null; sp.via = subRow ? D.sub.name : ''; sp.schools = subRow && subC.schools; sp.freeLvls = subRow ? subC.free : [];
      sp.ab = ab; sp.dc = 8 + pb + m[ab]; sp.atk = pb + m[ab];
      sp.slots = (c.slotsManual && !lrS) ? c.slotsManual : (lrS ? lrS.slots : new Array(9).fill(0));
      sp.arcanum = D.cls && D.cls.slug === 'warlock' && !subRow ? ARCANUM.map((need, i) => (need && lvl >= need ? i + 1 : 0)).filter(Boolean) : [];   // Таинственный арканум: по одному заклинанию 6–9 уровней, вне общего числа известных/подготовленных
      sp.pact = lrS && lrS.pact; sp.rows = slotRows(sp, D.cls, lvl); sp.rows.forEach((r, i) => { const o = c.slotsOv && c.slotsOv[i]; if (o != null && o !== '') { r.base = r.n; r.n = Math.max(0, Math.min(20, intOf(o))); r.ov = true; } }); sp.maxLevel = Math.max(maxSlotLevel(lrS) || (sp.slots.reduce((q, n, i) => n > 0 ? i + 1 : q, 0)), sp.rows.reduce((q, r, i) => r.n > 0 ? i + 1 : q, 0));
      sp.cantrips = lrS ? lrS.cantrips : null;
      // подготовлено: столбец таблицы (2024) или модификатор + уровень (2014, подготавливающие классы)
      let prep = lrS ? lrS.prepared : null, known = lrS ? lrS.known : null;
      if (prep == null && known == null && c.ed === 14 && D.cls && ['cleric', 'druid', 'wizard', 'artificer'].includes(D.cls.slug)) prep = Math.max(1, m[ab] + (D.cls.slug === 'artificer' ? Math.floor(lvl / 2) : lvl));
      if (prep == null && known == null && c.ed === 14 && D.cls && D.cls.slug === 'paladin') prep = Math.max(1, m[ab] + Math.floor(lvl / 2));
      sp.prepared = prep; sp.known = known;
    }
    // заклинания подкласса: всегда подготовленные (домены, клятвы…) и расширение списка (покровители колдуна 2014)
    const subSp = D.sub && D.spells ? subSpells(D.sub, D.spells, lvl) : { auto: [], extra: [], missing: [] };
    // дикий облик (друид)
    const ws = wildShape(D, c, lvl);
    // навыки и владения от черт, вида и подкласса
    const grants = [];
    featObjs.forEach(f => { const n = skillGrantN(paragraphsOf(f.blocks)); if (n) grants.push({ n, why: f.name_ru }); });
    if (D.sp) speciesTraits(D.sp, { opt: c.spOpt, lvl }).forEach(t => { const n = skillGrantN([t.text]); if (n) grants.push({ n, why: D.sp.name_ru + ': ' + t.name }); });
    const extraN = grants.reduce((q, g) => q + g.n, 0);
    const subTexts = D.sub ? (D.sub.features || []).filter(f => f.level <= lvl).flatMap(f => paragraphsOf(f.blocks)) : [];
    const pg = profGrants([...subTexts, ...featObjs.flatMap(f => paragraphsOf(f.blocks))]);
    let ciX = ci;
    if (ci && (pg.arm.length || pg.wp.length)) {
      const hasA = lc(ci.armor), hasW = lc(ci.weapons), addA = pg.arm.filter(a => !hasA.includes(lc(a).slice(0, 4))), addW = pg.wp.filter(w => !hasW.includes(lc(w).slice(0, 5)));
      ciX = Object.assign({}, ci, {
        armor: addA.length ? (ci.armor && !/^нет$/i.test(ci.armor.trim()) ? ci.armor + '; ' : '') + addA.join(', ') + ' (подкласс/черты)' : ci.armor,
        weapons: addW.length ? (ci.weapons && !/^нет$/i.test(ci.weapons.trim()) ? ci.weapons + '; ' : '') + addW.join('; ') : ci.weapons
      });
    }
    const expN = expertiseSlots(D.cls, lvl, c.ed), expUsed = skills.filter(s => s.lev === 2).length;

    // инициатива и скорость: база + эффекты умений; свою скорость в листе вводят уже итоговой
    const initFx = act('init'), init = m.dex + sum(initFx);
    const spdFx = act('speed'), spdBase = speciesSpeed(D.sp, c.ed, { opt: c.spOpt, lvl });
    const spdSet = Math.max(spdBase, ...spdFx.filter(e => e.set).map(e => e.set)), spdAuto = spdSet + sum(spdFx.filter(e => !e.set));
    const spdOv = c.speed != null && c.speed !== '' ? intOf(c.speed) : null, speed = spdOv != null ? spdOv : spdAuto;
    const whyOf = (base, list) => [base, ...list.map(e => e.why + ' ' + sgn(e.v))].join(', ');
    const res = resources(c, D, { lvl, m, lr });
    return {
      expN, expUsed, extraN, grants, lvl, ci: ciX, lr, score, src, mod: m, pb, saves, saveProf, skills, bgSk, bgChoice, hp, die, ac, acWhy, saveFrom,
      init, initWhy: whyOf('Лов ' + sgn(m.dex), initFx), initFx, hpFx, hpAuto: !manualHp, passive, passiveFx: psFx,
      size: sizeOf(D.sp, c.size), sizeOpts: speciesSizes(D.sp), carry: Math.round(score.str * 15 * (SIZE_MULT[sizeOf(D.sp, c.size)] || 1)),
      jumpHigh: Math.max(0, 3 + m.str), jumpLong: score.str,
      speed, speedAuto: spdAuto, speedBase: spdSet, speedOv: spdOv, speedFx: spdFx, speedWhy: whyOf('вид ' + spdSet, spdFx.filter(e => !e.set)),
      sp, feats, ws, fx, worn, res, bgFeat, picks: classPicks(c, D, lvl, lr, ci), styleF, raceAsi: c.ed === 14 ? speciesAsi(D.sp, c.spOpt) : null, autoSpells: subSp.auto.concat(speciesSpells(D.sp, c.spOpt, lvl, D.spells, c.ed).filter(a => !subSp.auto.some(x => x.slug === a.slug))), extraList: subSp.extra, autoMissing: subSp.missing
    };
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
    if (m.cr == null || m.cr === '') return false;   // призванные духи без опасности («Дух зверя») под Дикий облик не подходят
    if (crNum(m.cr) > ws.cr) return false;
    const sp = m.speed || {};
    if (sp.fly && !ws.fly) return false;
    if (ed === 14 && sp.swim && !ws.swim) return false;
    return true;
  };

  /* ---------- вспомогательное ---------- */
  function newChar(ed) {
    return {
      id: Math.random().toString(36).slice(2, 9), ed: ed || 24, name: '', player: '', cls: '', sub: '', lvl: 1, sp: '', spOpt: '', bg: '', align: '',
      abm: 'std', ab: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, bg2: { m: '21', a: '', b: '' }, bonus: {}, asi: {},
      skills: [], skillsExtra: [], exp: [], hpMode: 'avg', hpManual: 0, hpBonus: 0, hpCur: null, hpTemp: 0, acMode: 'auto', acManual: 0, acBonus: 0,
      speed: '', fxOff: {}, spells: [], spellsAll: false, inv: [], coins: { pm: 0, zm: 0, em: 0, sm: 0, mm: 0 }, forms: [],
      story: { traits: '', ideals: '', bonds: '', flaws: '', look: '', notes: '', langs: '', tools: '' }, printSpells: true, psv: 2, feats: [], picks: { style: '', mastery: [], metamagic: [], invocations: [] }, kit: {}, kitCoins: {}, featTxt: 'short', spellsFree: false
    };
  }
  // Черта предыстории 2024. «Черта Тёмного дара на ваш выбор» (Медиум, Странник Туманов) — название категории, а не черты: выбирается из списка (c.bgFeat);
  // у Преследуемого и Следователя черта названа, но по тексту её можно заменить чертой Тёмного дара.
  const isDarkGift = f => /тёмного\s+дара/i.test((f && f.line) || '');
  function bgFeatOf(c, D) {
    const bf = c.ed === 24 && D.bg && D.bg.feat; if (!bf) return { feat: null, options: [], required: false, name: '' };
    const named = (D.feats || []).find(f => f.name_ru === bf.name), cat = !named && /тёмного\s+дара/i.test(bf.name), alt = !!named && /тёмного\s+дара\s+на\s+ваш\s+выбор/i.test(bf.note || '');
    if (!cat && !alt) return { feat: named || null, options: [], required: false, name: bf.name };
    const options = (D.feats || []).filter(isDarkGift), pick = options.find(f => f.slug === c.bgFeat);
    return { feat: pick || named || null, options, required: cat, name: bf.name, named };
  }
  /* ---------- выборы класса: боевой стиль, оружейное мастерство, метамагия, воззвания ---------- */
  const STYLE_LVL = { fighter: 1, paladin: 2, ranger: 2 };
  // боевые стили 2014 (в данных списка нет): PHB
  const STYLES14 = [
    { slug: 'archery', name: 'Стрельба', cls: ['fighter', 'ranger'], text: 'Вы получаете бонус +2 к броскам атаки дальнобойным оружием.' },
    { slug: 'defense', name: 'Оборона', cls: ['fighter', 'paladin', 'ranger'], text: 'Пока на вас надет доспех, вы получаете бонус +1 к КД.' },
    { slug: 'dueling', name: 'Дуэли', cls: ['fighter', 'paladin', 'ranger'], text: 'Пока вы держите рукопашное оружие в одной руке и не используете другое оружие, вы получаете бонус +2 к броскам урона этим оружием.' },
    { slug: 'great-weapon', name: 'Сражение большим оружием', cls: ['fighter', 'paladin'], text: 'Если при броске урона оружия, которым вы атакуете двумя руками, на кости выпало 1 или 2, вы можете перебросить эту кость и должны использовать новый результат. Оружие должно иметь свойство «двуручное» или «универсальное».' },
    { slug: 'protection', name: 'Защита', cls: ['fighter', 'paladin'], text: 'Когда существо, которое вы видите, атакует не вас, а другую цель в пределах 5 футов от вас, вы можете реакцией наложить помеху на его бросок атаки. Вы должны использовать щит.' },
    { slug: 'two-weapon', name: 'Сражение двумя оружиями', cls: ['fighter', 'ranger'], text: 'Когда вы сражаетесь двумя оружиями, вы можете добавить модификатор характеристики к урону второй атаки.' }
  ];
  const isStyleFeat = f => /боевого\s+стиля/i.test((f && f.line) || '');
  // варианты боевого стиля для класса: [{ slug, name, text }]
  function styleOptions(c, D) {
    const cs = D.cls && D.cls.slug; if (!cs || !STYLE_LVL[cs]) return [];
    if (c.ed === 14) return STYLES14.filter(x => x.cls.includes(cs));
    return (D.feats || []).filter(isStyleFeat).map(f => ({ slug: f.slug, name: f.name_ru, text: flatText(f.blocks).join(' ') }));
  }
  function styleFeat(c, D, lvl) {
    const pk = c.picks && c.picks.style, cs = D.cls && D.cls.slug; if (!pk || !cs || !STYLE_LVL[cs] || lvl < STYLE_LVL[cs]) return null;
    if (c.ed === 14) { const x = STYLES14.find(y => y.slug === pk && y.cls.includes(cs)); return x ? { slug: 'style14-' + x.slug, name_ru: 'Боевой стиль: ' + x.name, blocks: [{ type: 'paragraph', text: x.text }] } : null; }
    return (D.feats || []).find(f => f.slug === pk && isStyleFeat(f)) || null;
  }
  // мастерство оружия 2024 записано в самом оружии: «**Мастерство: Ослабляющее.** Если вы попадаете…»
  function masteryOf(g) {
    for (const b of (g && g.blocks) || []) { const m = String(b.text || '').match(/^\*\*Мастерство:\s*([^.*]+?)\.?\*\*\s*(.*)$/s); if (m) return { name: m[1].trim(), text: m[2].trim() }; }
    return null;
  }
  const MASTERY_CLS = ['barbarian', 'fighter', 'paladin', 'ranger', 'rogue'];
  function masteryCount(cls, lr) {
    const key = lr && Object.keys(lr.extra).find(k => /оружейное мастерство/i.test(k)); if (key) return intOf(lr.extra[key]);
    const f = ((cls && cls.features) || []).find(x => /^оружейное мастерство/i.test(x.name)), t = f ? lc(paragraphsOf(f.blocks).join(' ')) : '', m = t.match(/(двух|трёх|трех|четыр\S+)\s+вид/);
    return m ? (NUMW[m[1]] || (/тр/.test(m[1]) ? 3 : /четыр/.test(m[1]) ? 4 : 2)) : 0;
  }
  function masteryOptions(cls, ci, gear) {
    return (gear || []).filter(g => { const l = lc(g.line || ''); if (!/оружие/.test(l) || /боеприпас|особое|эпох|современн|футурист/.test(l) || !masteryOf(g)) return false;
      if (cls.slug === 'barbarian') return /рукопашн/.test(l);
      if (cls.slug === 'fighter') return true;
      return !!(ci && weaponProf(ci.weapons, g)); });
  }
  // что класс даёт выбрать: [{ key, label, n, kind: 'style'|'weapons'|'text', options, chosen }]
  function classPicks(c, D, lvl, lr, ci) {
    const cls = D.cls; if (!cls) return [];
    const pk = c.picks || {}, out = [], cs = cls.slug;
    if (STYLE_LVL[cs] && lvl >= STYLE_LVL[cs]) { const opts = styleOptions(c, D); out.push({ key: 'style', label: 'Боевой стиль', n: 1, kind: 'style', options: opts, chosen: opts.some(x => x.slug === pk.style) ? [pk.style] : [] }); }
    if (c.ed === 24 && MASTERY_CLS.includes(cs)) {
      const n = masteryCount(cls, lr), opts = masteryOptions(cls, ci, D.gear), ok = new Set(opts.map(g => g.slug));
      if (n) out.push({ key: 'mastery', label: 'Оружейное мастерство', n, kind: 'weapons', options: opts, chosen: (pk.mastery || []).filter(x => ok.has(x)).slice(0, n) });
    }
    if (cs === 'sorcerer') {
      const from = c.ed === 14 ? 3 : 2, step = c.ed === 14 ? 1 : 2, n = lvl < from ? 0 : 2 + (lvl >= 10 ? step : 0) + (lvl >= 17 ? step : 0);
      if (n) out.push({ key: 'metamagic', label: 'Метамагия', n, kind: 'text', chosen: (pk.metamagic || []).slice(0, n) });
    }
    if (cs === 'warlock') {
      const key = lr && Object.keys(lr.extra).find(k => /воззван/i.test(k)), n = key ? intOf(lr.extra[key]) : 0;
      if (n) out.push({ key: 'invocations', label: 'Таинственные воззвания', n, kind: 'text', chosen: (pk.invocations || []).slice(0, n) });
    }
    return out;
  }

  /* ---------- стартовое снаряжение 2014 ---------- */
  // Класс 2014: «• а) секира или б) любое воинское рукопашное оружие» и «• Набор путешественника и четыре метательных копья».
  // Строка = выбор из вариантов (а, б, в) либо обязательная часть. Предмет — {name, n} или «любое оружие» {slot:{kind,cat,mode}, n}.
  const KIT_NUM = { один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, десять: 10 };
  const COIN_RE = /(?:(?:поясной\s+)?(?:кошел\S+|кошё\S+|мешочек|мешок|сумк\S+)\s+с\s+)?(\d+)\s*(зм|см|мм|эм|пм)\.?\s*$/i;
  const COIN_KEY = { зм: 'zm', см: 'sm', мм: 'mm', эм: 'em', пм: 'pm' };
  function kitItem(raw) {
    let t = String(raw).replace(/\*+/g, '').replace(/\(\s*если\s+владеете\s*\)/i, '').replace(/\s+на\s+ваш\s+выбор/i, '').replace(/^[\s.;]+|[\s.;]+$/g, '').trim(); if (!t) return [];
    const q = t.match(/^колчан\s+с\s+(\d+)\s+стрел/i); if (q) return [{ name: 'Колчан', n: 1 }, { name: 'Стрелы', n: +q[1] }];
    let n = 1; const m = t.match(/^(\d+|один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|десять)\s+(.+)$/i);
    if (m) { n = /^\d/.test(m[1]) ? +m[1] : KIT_NUM[lc(m[1])]; t = m[2]; }
    const w = lc(t).match(/^(?:любо[ейе]\s+|одн\S+\s+|один\s+)?(?:другой\s+)?(простое|простых|воинск\S+)\s*(рукопашн\S+|дальнобойн\S+)?\s*оружи\S*$/);
    if (w) return [{ slot: { kind: 'weapon', cat: /прост/.test(w[1]) ? 'simple' : 'martial', mode: !w[2] ? 'any' : /рукоп/.test(w[2]) ? 'melee' : 'ranged' }, n }];
    if (/^(?:любой\s+)?(?:другой\s+)?музыкальн\S*\s+инструмент/i.test(t)) return [{ slot: { kind: 'instrument' }, n }];
    return [{ name: t.charAt(0).toUpperCase() + t.slice(1), n }];
  }
  const kitItems = txt => String(txt).split(/,\s*(?![^()]*\))|\s+и\s+/).flatMap(kitItem);
  const KIT_ALIAS = { 'лёгкий арбалет': 'light-crossbow', 'болтов': 'arbaletnye-bolty', 'болты': 'arbaletnye-bolty', 'деревянный щит': 'shield', 'кожаная броня': 'leather-armor', 'проклёпанная кожа': 'studded-leather-armor', 'стрел': 'arrows', 'стрелы': 'arrows', 'дротиков': 'dart', 'метательных копья': 'javelin', 'метательных копий': 'javelin', 'ручных топора': 'handaxe', 'кинжала': 'dagger', 'коротких меча': 'shortsword' };
  const KIT_ALIAS_LC = Object.fromEntries(Object.keys(KIT_ALIAS).map(k => [lc(k), KIT_ALIAS[k]]));
  // предмет из текста набора → запись справочника: точное имя, псевдоним, затем совпадение по основам слов (неоднозначное не берём)
  function kitGear(gear, bySlug, name) {
    const n = lc(name), exact = gear.find(x => lc(x.name_ru) === n); if (exact) return exact;
    const a = KIT_ALIAS_LC[n]; if (a && bySlug[a]) return bySlug[a];
    const key = wstems(name), hit = gear.filter(x => wstems(x.name_ru) === key);
    return hit.length === 1 ? hit[0] : null;
  }
  // боеприпасы продаются пачкой: «1 зм, 1 фнт., количество 20» — вес и цена относятся ко всей пачке, а в инвентаре считаются штуки
  const packOf = g => { const p = g && (g.props || []).find(x => /^количество$/i.test(x.label)), n = p ? intOf(String(p.value).match(/\d+/)) : 0; return /боеприпас/i.test((g && g.line) || '') && n > 1 ? n : 1; };
  const unitWeight = g => ((g && g.weight_lb) || 0) / packOf(g);
  function kitLines14(txt) {
    const lines = [];
    String(txt || '').split(/\n/).forEach(raw => {
      const l = raw.trim(); if (!/^[•·\-–]/.test(l)) return;
      const body = l.replace(/^[•·\-–]\s*/, ''), marks = [...body.matchAll(/(^|[\s,;]+(?:или\s+)?)([а-г])\)\s*/g)];
      if (!marks.length) { lines.push({ opts: [{ k: '', txt: body, items: kitItems(body), cond: /если\s+владеете/i.test(body) }] }); return; }
      lines.push({ opts: marks.map((m, i) => { const from = m.index + m[0].length, to = i + 1 < marks.length ? marks[i + 1].index : body.length, tx = body.slice(from, to).replace(/[\s,;]+$/, '').replace(/\s+или$/i, '');
        return { k: m[2], txt: tx, items: kitItems(tx), cond: /если\s+владеете/i.test(tx) }; }) });
    });
    const gold = String(txt || '').match(/начн[её]те\s+игру\s+с\s+([^.]*?зм)/i);
    return { lines, gold: gold ? gold[1].replace(/\s+/g, ' ') : '' };
  }
  // Предыстория 2014: проза «…, комплект обычной одежды, поясной кошель с 10 зм» → монеты + предметы (свободный текст, если нет в справочнике)
  function kitBg14(txt) {
    let t = String(txt || '').replace(/\*+/g, '').replace(/[\s.]+$/, ''); const coins = {}, cm = t.match(COIN_RE);
    if (cm) { coins[COIN_KEY[lc(cm[2])]] = +cm[1]; t = t.slice(0, cm.index).replace(/[\s,;]+(?:и\s*)?$/i, '').replace(/\s+и$/i, ''); }
    const parts = []; t.split(/,\s*(?![^()]*\))|;\s*/).forEach(x => { if (parts.length && /^(в\s+котор|котор|что(?![а-яё])|чтобы|где(?![а-яё])|когда|как(?![а-яё])|такой|такие|такая|такое|например)/i.test(x.trim())) parts[parts.length - 1] += ', ' + x; else parts.push(x); });
    const items = parts.flatMap(x => kitItem(x.replace(/^\s*(?:один\s+)?вид\s+/i, '')));
    return { items, coins };
  }

  const API = { AB, ABK, ABN, SKILLS, skillName, STD_ARRAY, BUY_COST, mod, sgn, intOf, lc, trait, classInfo, levelRow, asiLevels, epicLevel, featAbility, expertiseSlots, maxSlotLevel, speciesTraits, speciesChoice, speciesSpeed, speciesSizes, wstems, weaponProps, weaponProf, bgSkillInfo, derive, wildShape, beastOk, crNum, crStr, newChar, skillsIn, abilitiesIn, SPELL_AB, skillGrantN, profGrants, wornGear, resources, sourcesOf, collectFx, abilityFx, subCasting, subCastRow, outOfSchools, subSpells, subSpellTables, spellByName, speciesSpells, speciesAsi, speciesSections, parseAsi, kitLines14, kitBg14, kitGear, COIN_KEY, packOf, unitWeight, classPicks, officialSrc, bgFeatOf, styleOptions, styleFeat, masteryOf, masteryCount, masteryOptions, STYLES14 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CSR = API;
})(typeof window !== 'undefined' ? window : globalThis);
