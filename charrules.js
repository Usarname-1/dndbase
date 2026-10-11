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
  const maxSlotLevel = (lr) => {
    if (!lr) return 0;
    let m = 0; lr.slots.forEach((n, i) => { if (n > 0) m = i + 1; });
    if (lr.pact) m = Math.max(m, lr.pact.lvl);
    return m;
  };

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
  function featAbility(f) {
    const par = ((f && f.blocks) || []).filter(b => b.type === 'paragraph').map(b => String(b.text || ''))
      .find(t => /^\*\*(?:Повышение|Увеличение)\s+(?:значения\s+)?характеристик/i.test(t));
    if (!par) return null;
    const body = par.replace(/^\*\*[^*]+\*\*\.?\s*/, ''), cap = (body.match(/не выше\s+(\d+)/i) || [])[1];
    const any = /одн\S*\s+из\s+(?:ваших\s+)?характеристик/i.test(body);
    const head = body.replace(/на\s+1.*$/i, ''), STEM = { str: 'сил', dex: 'ловк', con: 'телос', int: 'интел', wis: 'мудр', cha: 'хариз' };   // падежи: «Силы», «Ловкости»
    const opts = any ? AB.map(a => a.k) : AB.filter(a => lc(head).includes(STEM[a.k])).map(a => a.k);
    return opts.length ? { opts, cap: cap ? +cap : 20 } : null;
  }
  // сколько навыков класс позволяет усилить Экспертностью к этому уровню (2024)
  function expertiseSlots(cls, lvl, ed) {
    if (!cls || ed === 14) return 0;
    return (cls.features || []).filter(f => f.level <= lvl).reduce((n, f) => n + (/^экспертность$/i.test(f.name) ? 2 : /^(искусный исследователь|академические знания)$/i.test(f.name) ? 1 : 0), 0);
  }

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

  /* ---------- навыки предыстории ---------- */
  // У части предысторий 2014 навыки даны на выбор («Выберите два из…», «История, плюс один из…»).
  // Возвращает {fixed — выдаются сразу, choose — сколько выбрать, from — из чего}.
  function bgSkillInfo(bg) {
    const txt = String((bg && bg.skills_text) || ''), listed = skillsIn(((bg && bg.skills) || []).join(', '));
    const all = skillsIn(((bg && bg.skills) || []).join(', ') + ' ' + txt), fixedAll = { fixed: all, choose: 0, from: [] };
    if (!bg) return { fixed: [], choose: 0, from: [] };
    const t = lc(txt), pick = t.match(/выберите\s+(один|одно|два|три)(?=\s|$)/);
    if (pick && listed.length > NUMW[pick[1]]) return { fixed: [], choose: NUMW[pick[1]], from: listed };
    const plus = t.search(/(?:,\s*плюс|\sи)\s+(?:один|одно)\s/);
    if (plus > 0) {
      const fixed = skillsIn(txt.slice(0, plus)), from = listed.filter(id => !fixed.includes(id));
      if (from.length) return { fixed, choose: 1, from };
    }
    return fixedAll;
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
    AB.forEach(a => add(a.k, intOf(c.bonus && c.bonus[a.k]), c.ed === 14 ? 'вид' : 'прочее'));
    const feats = [];
    const capOf = {}, epic = epicLevel(D.cls);
    asiLevels(D.cls).filter(l => l <= lvl).forEach(l => {
      const x = (c.asi || {})[l]; if (!x) return;
      if (x.m === 'feat' || (c.ed === 24 && l === epic)) {
        if (!x.feat) return;
        feats.push({ slug: x.feat, lvl: l });
        const fa = featAbility((D.feats || []).find(f => f.slug === x.feat));
        if (fa && x.fa && fa.opts.includes(x.fa)) { add(x.fa, 1, 'черта'); capOf[x.fa] = Math.max(capOf[x.fa] || 0, fa.cap); }
      }
      else if (x.m === '11') { add(x.a, 1, 'ур. ' + l); add(x.b, 1, 'ур. ' + l); }
      else if (x.m === '2') add(x.a, 2, 'ур. ' + l);
    });
    (c.feats || []).forEach(x => feats.push({ slug: x.slug, lvl: 0, extra: true }));
    // Дикий чемпион (варвар, 20 ур., 2024): Сила и Телосложение +4, но не выше 25
    if (c.ed === 24 && D.cls && D.cls.slug === 'barbarian' && lvl >= 20) ['str', 'con'].forEach(k => { add(k, 4, 'Дикий чемпион'); capOf[k] = Math.max(capOf[k] || 0, 25); });
    AB.forEach(a => { score[a.k] = Math.min(score[a.k], capOf[a.k] || (c.cap20 === false ? 30 : 20)); });
    const m = {}; AB.forEach(a => { m[a.k] = mod(score[a.k]); });
    const pb = lr ? lr.prof : Math.ceil(lvl / 4) + 1;

    const saveProf = new Set(ci ? ci.saves : []), saves = {};
    AB.forEach(a => { saves[a.k] = m[a.k] + (saveProf.has(a.k) ? pb : 0); });

    const bgi = bgSkillInfo(D.bg), bgSk = bgi.fixed;
    const pick = new Set(c.skills || []), extra = new Set(c.skillsExtra || []), exp = new Set(c.exp || []);
    const bgChoice = bgi.choose ? { n: bgi.choose, from: bgi.from, got: bgi.from.filter(id => extra.has(id)).length } : null;
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
    if (shield && D.cls && D.cls.slug === 'monk' && acWhy === 'без доспеха (монах)') { ac = 10 + m.dex; acWhy = 'со щитом (без защиты монаха)'; }   // защита без доспехов у монаха не работает со Щитом
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
    const expN = expertiseSlots(D.cls, lvl, c.ed), expUsed = skills.filter(s => s.lev === 2).length;
    return { expN, expUsed, lvl, ci, lr, score, src, mod: m, pb, saves, saveProf, skills, bgSk, bgChoice, hp, die, ac, acWhy, init: m.dex, speed: c.speed != null && c.speed !== '' ? intOf(c.speed) : speciesSpeed(D.sp, c.ed), sp, feats, ws };
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
      story: { traits: '', ideals: '', bonds: '', flaws: '', look: '', notes: '', langs: '', tools: '' }, printSpells: false, feats: [], kit: {}, kitCoins: {}, featTxt: 'short', spellsFree: false
    };
  }
  const API = { AB, ABK, ABN, SKILLS, skillName, STD_ARRAY, BUY_COST, mod, sgn, intOf, lc, trait, classInfo, levelRow, asiLevels, epicLevel, featAbility, expertiseSlots, maxSlotLevel, speciesTraits, speciesSpeed, wstems, weaponProps, weaponProf, bgSkillInfo, derive, wildShape, beastOk, crNum, crStr, newChar, skillsIn, abilitiesIn, SPELL_AB };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CSR = API;
})(typeof window !== 'undefined' ? window : globalThis);
