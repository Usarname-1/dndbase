/* Проверки правил листа персонажа (charrules.js) на настоящих данных справочника.
   Запуск: node --test tests/        (нужен Node 18+, без установки пакетов)
   Снимок эффектов (tests/fx-snapshot.txt) обновляется так:  UPDATE_SNAPSHOT=1 node --test tests/ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const R = require(path.join(root, 'charrules.js'));
const load = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').normalize('NFC'));
const FILES = { 24: { cls: 'data/class.json', sp: 'data/species.json', bg: 'data/backgrounds.json', ft: 'data/feats.json' }, 14: { cls: 'data14/class.json', sp: 'data14/race.json', bg: 'data14/backgrounds.json', ft: 'data14/feats.json' } };
const DATA = {};
for (const ed of [24, 14]) DATA[ed] = { classes: load(FILES[ed].cls).filter(x => !/sidekick/.test(x.slug)), species: load(FILES[ed].sp), bgs: load(FILES[ed].bg), feats: load(FILES[ed].ft) };
const gear = load('data/equipment.json'), gearBySlug = Object.fromEntries(gear.map(x => [x.slug, x]));
const SPELLS = { 24: load('data/spells.json'), 14: load('data14/spells.json') };

// персонаж + данные для derive(): o = {cls, lvl, sub (часть названия), sp, opt, ab, feats:[slug], inv:[slug снаряжения], asi}
function mk(ed, o) {
  const S = DATA[ed], cls = S.classes.find(x => x.slug === o.cls);
  assert.ok(cls, 'нет класса ' + o.cls);
  const sub = o.sub ? (cls.subclasses || []).find(s => s.name.includes(o.sub)) : null;
  if (o.sub) assert.ok(sub, 'нет подкласса ' + o.sub);
  const sp = o.sp ? S.species.find(x => x.slug === o.sp) : null;
  if (o.sp) assert.ok(sp, 'нет вида ' + o.sp);
  const c = Object.assign(R.newChar(ed), {
    cls: cls.slug, lvl: o.lvl, sub: sub ? sub.name : '', sp: sp ? sp.slug : '', spOpt: o.opt || '', abm: 'manual',
    ab: Object.assign({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, o.ab), asi: o.asi || {},
    feats: (o.feats || []).map(slug => ({ slug })), inv: (o.inv || []).map(slug => ({ slug, n: slug, q: 1, eq: true, sec: 'gear' })), fxOff: o.fxOff || {}
  });
  Object.assign(c, o.set || {});
  return [c, { cls, sub, sp, bg: null, feats: S.feats, spells: SPELLS[ed], gear, gearBySlug, items: [], itemsBySlug: {} }];
}
const run = (ed, o) => { const [c, D] = mk(ed, o); return R.derive(c, D); };
const fxOf = (d, k) => d.fx.filter(e => e.k === k);

/* ---------- данные ---------- */
test('в данных, которые читает лист, нет «й» и «ё» из двух символов', () => {
  // иначе разбор текстов умений (и обычный поиск) не находит слова вроде «Действием» или «Тяжёлый»
  const bad = [];
  for (const f of ['data/class.json', 'data/species.json', 'data/backgrounds.json', 'data/feats.json', 'data/spells.json', 'data/items.json', 'data/equipment.json',
    'data14/class.json', 'data14/race.json', 'data14/backgrounds.json', 'data14/feats.json', 'data14/spells.json', 'data14/items.json', 'data14/bestiary.json', 'data/bestiary.json']) {
    if (!fs.existsSync(path.join(root, f))) continue;
    if (/[̆̈]/.test(fs.readFileSync(path.join(root, f), 'utf8'))) bad.push(f);
  }
  assert.deepEqual(bad, []);
});

/* ---------- скорость вида ---------- */
test('базовая скорость видов', () => {
  const sp14 = n => DATA[14].species.find(x => x.name_ru === n), sp24 = n => DATA[24].species.find(x => x.name_ru === n);
  assert.equal(R.speciesSpeed(sp14('Дварф'), 14, { opt: 'Холмовой' }), 25);
  assert.equal(R.speciesSpeed(sp14('Дварф'), 14, { opt: 'Дуэргар (MPMM)' }), 30);
  assert.equal(R.speciesSpeed(sp14('Полурослик'), 14), 25);
  assert.equal(R.speciesSpeed(sp14('Кентавр'), 14), 40);
  assert.equal(R.speciesSpeed(sp14('Леонин'), 14), 35);
  assert.equal(R.speciesSpeed(sp14('Человек'), 14), 30);
  assert.equal(R.speciesSpeed(sp24('Голиаф'), 24), 35);
  assert.equal(R.speciesSpeed(sp24('Человек'), 24), 30);
  assert.equal(R.speciesSpeed(null, 24), 30);
});
test('скорость лесного эльфа 2024 поднимается до 35 через наследие', () => {
  assert.equal(run(24, { cls: 'rogue', lvl: 1, sp: 'elf', opt: 'Лесные эльфы' }).speed, 35);
  assert.equal(run(24, { cls: 'rogue', lvl: 1, sp: 'elf', opt: 'Дроу' }).speed, 30);
});

/* ---------- монах: скорость и защита без доспехов ---------- */
test('монах 2024: скорость и КД без доспехов, со щитом и в доспехе', () => {
  const o = { cls: 'monk', lvl: 9, ab: { dex: 16, wis: 16 } };   // Лов +3, Муд +3; прибавка к скорости на 9 ур. — +15
  let d = run(24, o);
  assert.equal(d.speed, 45); assert.equal(d.ac, 16);          // 10 + 3 + 3
  d = run(24, Object.assign({ inv: ['shield'] }, o));
  assert.equal(d.speed, 30); assert.equal(d.ac, 15);           // со щитом: 10 + Лов + 2, бонус скорости пропадает
  d = run(24, Object.assign({ inv: ['leather-armor'] }, o));
  assert.equal(d.speed, 30); assert.equal(d.ac, 14);           // кожаный: 11 + Лов
  d = run(24, Object.assign({ fxOff: { [fxOf(run(24, o), 'speed')[0].id]: 1 } }, o));
  assert.equal(d.speed, 30);                                    // отключённый эффект не действует
});
test('монах растёт с уровнем: прибавка скорости по таблице класса', () => {
  const plus = { 1: 0, 2: 10, 5: 10, 6: 15, 9: 15, 10: 20, 13: 20, 14: 25, 17: 25, 18: 30, 20: 30 };
  for (const ed of [24, 14]) for (const [lvl, v] of Object.entries(plus)) assert.equal(run(ed, { cls: 'monk', lvl: +lvl }).speed, 30 + v, `ед.${ed} ур.${lvl}`);
});
test('монах: «Тело и разум» на 20 уровне (2024) — Лов и Муд +4, не выше 25', () => {
  const d = run(24, { cls: 'monk', lvl: 20, ab: { dex: 16, wis: 14 } });
  assert.equal(d.score.dex, 20); assert.equal(d.score.wis, 18);
  assert.equal(run(24, { cls: 'monk', lvl: 20, ab: { dex: 24, wis: 24 } }).score.dex, 25);
  assert.equal(run(24, { cls: 'monk', lvl: 19, ab: { dex: 16, wis: 14 } }).score.dex, 16);
});

/* ---------- варвар ---------- */
test('варвар 2014: защита без доспехов, быстрое передвижение, тяжёлый доспех', () => {
  const o = { cls: 'barbarian', lvl: 5, ab: { dex: 14, con: 16 } };
  let d = run(14, o); assert.equal(d.ac, 15); assert.equal(d.speed, 40);          // 10 + 2 + 3
  d = run(14, Object.assign({ inv: ['shield'] }, o)); assert.equal(d.ac, 17); assert.equal(d.speed, 40);   // щит не мешает защите варвара
  d = run(14, Object.assign({ inv: ['chain-mail'] }, o)); assert.equal(d.ac, 16); assert.equal(d.speed, 30);   // тяжёлый доспех: без бонуса скорости
  assert.equal(run(14, Object.assign({}, o, { lvl: 4 })).speed, 30);
});
test('варвар: «Дикий чемпион» — Сил и Тел +4, потолок 25 (2024) и 24 (2014)', () => {
  for (const [ed, cap] of [[24, 25], [14, 24]]) {
    let d = run(ed, { cls: 'barbarian', lvl: 20, ab: { str: 16, con: 16 } }); assert.equal(d.score.str, 20); assert.equal(d.score.con, 20);
    d = run(ed, { cls: 'barbarian', lvl: 20, ab: { str: 22, con: 22 } }); assert.equal(d.score.str, cap); assert.equal(d.score.con, cap);
    d = run(ed, { cls: 'barbarian', lvl: 19, ab: { str: 16, con: 16 } }); assert.equal(d.score.str, 16);
  }
});

/* ---------- бард, воин ---------- */
test('бард: «Мастер на все руки» — половина бонуса мастерства к навыкам без владения', () => {
  for (const ed of [24, 14]) {
    const d = run(ed, { cls: 'bard', lvl: 5, ab: { str: 8, dex: 14, cha: 16 }, set: { skills: ['persuasion'] } });   // БМ +3 → половина вниз = +1
    const sk = id => d.skills.find(s => s.id === id).bonus;
    assert.equal(sk('athletics'), -1 + 1);       // Сил 8, без владения
    assert.equal(sk('acrobatics'), 2 + 1);       // Лов 14, без владения
    assert.equal(sk('persuasion'), 3 + 3);       // с владением: половина не прибавляется
  }
  assert.equal(run(24, { cls: 'bard', lvl: 5, ab: { dex: 14 } }).init, 2);   // 2024: к инициативе не добавляется
  assert.equal(run(14, { cls: 'bard', lvl: 5, ab: { dex: 14 } }).init, 3);   // 2014: «ко всем проверкам» — и к инициативе
  assert.equal(run(14, { cls: 'bard', lvl: 1, ab: { dex: 14 } }).init, 2);   // умение с 2 уровня
});
test('воин-чемпион 2014: «Выдающийся атлет» — половина БМ вверх к Сил/Лов/Тел без владения', () => {
  const d = run(14, { cls: 'fighter', sub: 'Чемпион', lvl: 7, ab: { str: 10, dex: 14, con: 10, wis: 10 } });   // БМ +3 → +2
  const sk = id => d.skills.find(s => s.id === id).bonus;
  assert.equal(sk('athletics'), 0 + 2); assert.equal(sk('stealth'), 2 + 2); assert.equal(sk('perception'), 0);   // Мудрость — не затрагивается
  assert.equal(d.init, 2 + 2);
});

/* ---------- хиты ---------- */
test('хиты: Крепкий, дварф, Драконья устойчивость, Дар стойкости', () => {
  const base = (ed, o) => run(ed, o).hp;
  // воин, Тел 14 (+2): к10 → 10+2 + (ур−1)·(6+2)
  assert.equal(base(24, { cls: 'fighter', lvl: 8, ab: { con: 14 } }), 12 + 7 * 8);
  assert.equal(base(24, { cls: 'fighter', lvl: 8, ab: { con: 14 }, feats: ['tough'] }), 12 + 7 * 8 + 16);   // 2 хита за уровень
  assert.equal(base(14, { cls: 'fighter', lvl: 8, ab: { con: 14 }, feats: ['tough'] }), 12 + 7 * 8 + 16);
  assert.equal(base(14, { cls: 'fighter', lvl: 5, ab: { con: 14 }, sp: 'dwarf', opt: 'Холмовой' }), 12 + 4 * 8 + 5);   // +1 за уровень
  assert.equal(base(14, { cls: 'fighter', lvl: 5, ab: { con: 14 }, sp: 'dwarf', opt: 'Горный' }), 12 + 4 * 8);        // у горного дварфа этой черты нет
  assert.equal(base(24, { cls: 'fighter', lvl: 5, ab: { con: 14 }, sp: 'dwarf' }), 12 + 4 * 8 + 5);
  // чародей к6, Тел 14: 6+2 + (ур−1)·(4+2)
  const sorc = (ed, lvl, sub) => base(ed, { cls: 'sorcerer', lvl, ab: { con: 14 }, sub });
  assert.equal(sorc(14, 6, 'драконьей крови') - sorc(14, 6, null), 6);     // 1 на 1 ур. и по 1 за каждый следующий
  assert.equal(sorc(24, 3, 'Драконье') - sorc(24, 3, null), 3);             // 2024: +3 на 3 уровне…
  assert.equal(sorc(24, 10, 'Драконье') - sorc(24, 10, null), 10);          // …и по 1 за каждый следующий
  assert.equal(sorc(24, 2, 'Драконье') - sorc(24, 2, null), 0);
  // «Дар стойкости» (дар эпического героя): +40
  const asi19 = { 19: { m: 'feat', feat: 'boon-of-fortitude' } };
  assert.equal(base(24, { cls: 'fighter', lvl: 19, ab: { con: 14 }, asi: asi19 }) - base(24, { cls: 'fighter', lvl: 19, ab: { con: 14 } }), 40);
});
test('хиты: ввод итога вручную не перетирается умениями', () => {
  const d = run(24, { cls: 'fighter', lvl: 8, ab: { con: 14 }, feats: ['tough'], set: { hpMode: 'manual', hpManual: 70, hpBonus: 3 } });
  assert.equal(d.hp, 73); assert.equal(d.hpAuto, false);
});

/* ---------- КД ---------- */
test('КД: чародей-дракон и «Мастер средних доспехов»', () => {
  assert.equal(run(14, { cls: 'sorcerer', sub: 'драконьей крови', lvl: 6, ab: { dex: 14 } }).ac, 15);          // 13 + Лов
  assert.equal(run(14, { cls: 'sorcerer', sub: 'драконьей крови', lvl: 6, ab: { dex: 14 }, inv: ['leather-armor'] }).ac, 13);   // в доспехе формула не работает
  assert.equal(run(14, { cls: 'sorcerer', lvl: 6, ab: { dex: 14 } }).ac, 12);
  const scale = { cls: 'fighter', lvl: 4, ab: { dex: 16 }, inv: ['scale-mail'] };                              // чешуйчатый: 14 + Лов (не более 2)
  assert.equal(run(14, scale).ac, 16); assert.equal(run(14, Object.assign({ feats: ['medium-armor-master'] }, scale)).ac, 17);
  assert.equal(run(14, Object.assign({ feats: ['medium-armor-master'] }, scale, { ab: { dex: 14 } })).ac, 16);   // Лов ниже 16 — без прибавки
  assert.equal(run(14, Object.assign({ feats: ['medium-armor-master'] }, scale, { inv: ['chain-mail'] })).ac, 16);   // не средний доспех
});

/* ---------- спасброски, инициатива, пассивные ---------- */
test('паладин: «Аура защиты» — бонус Харизмы ко всем спасброскам (минимум +1)', () => {
  for (const ed of [24, 14]) {
    const lo = run(ed, { cls: 'paladin', lvl: 5, ab: { cha: 18 } }), hi = run(ed, { cls: 'paladin', lvl: 6, ab: { cha: 18 } });
    R.AB.forEach(a => assert.equal(hi.saves[a.k] - lo.saves[a.k], 4));                          // бонус мастерства на 5 и 6 уровне одинаков (+3)
    assert.equal(run(ed, { cls: 'paladin', lvl: 6, ab: { cha: 8 } }).saves.str, 1);             // Сил 10 даёт +0, а аура при отрицательном модификаторе — минимум +1
  }
});
test('инициатива: Бдительный, Зайцегон, Сумрачный охотник', () => {
  assert.equal(run(24, { cls: 'fighter', lvl: 5, ab: { dex: 14 }, feats: ['alert'] }).init, 2 + 3);     // +БМ
  assert.equal(run(14, { cls: 'fighter', lvl: 5, ab: { dex: 14 }, feats: ['alert'] }).init, 2 + 5);     // +5
  assert.equal(run(14, { cls: 'rogue', lvl: 3, ab: { dex: 14 }, sp: 'harengon' }).init, 2 + 2);         // +БМ (Заячье сердце)
  assert.equal(run(24, { cls: 'ranger', sub: 'Сумрачный', lvl: 3, ab: { dex: 14, wis: 14 } }).init, 2 + 2);
  assert.equal(run(24, { cls: 'ranger', sub: 'Сумрачный', lvl: 2, ab: { dex: 14, wis: 14 } }).init, 2);
});
test('пассивные проверки: «Внимательный» 2014 даёт +5, в 2024 — нет', () => {
  const o = { cls: 'fighter', lvl: 1, ab: { wis: 14, int: 12 } };
  assert.equal(run(14, o).passive.perception, 12); assert.equal(run(14, Object.assign({ feats: ['observant'] }, o)).passive.perception, 17);
  assert.equal(run(14, Object.assign({ feats: ['observant'] }, o)).passive.investigation, 16);
  assert.equal(run(24, Object.assign({ feats: ['observant'] }, o)).passive.perception, 12);
});

/* ---------- скорость от черт и подклассов ---------- */
test('скорость: Подвижный, Быстрый, Скаут, следопыт и «Аура рвения»', () => {
  assert.equal(run(14, { cls: 'fighter', lvl: 1, feats: ['mobile'] }).speed, 40);
  assert.equal(run(24, { cls: 'fighter', lvl: 1, feats: ['speedy'] }).speed, 40);
  assert.equal(run(14, { cls: 'rogue', sub: 'Скаут', lvl: 9 }).speed, 40); assert.equal(run(14, { cls: 'rogue', sub: 'Скаут', lvl: 8 }).speed, 30);
  assert.equal(run(24, { cls: 'ranger', lvl: 6 }).speed, 40); assert.equal(run(24, { cls: 'ranger', lvl: 5 }).speed, 30);
  assert.equal(run(24, { cls: 'ranger', lvl: 6, inv: ['plate-armor'] }).speed, 30);
});
test('своя скорость в листе имеет приоритет', () => {
  const d = run(24, { cls: 'monk', lvl: 9, set: { speed: 50 } });
  assert.equal(d.speed, 50); assert.equal(d.speedAuto, 45); assert.equal(d.speedOv, 50);
});

/* ---------- ресурсы класса ---------- */
test('ресурсы класса растут с уровнем', () => {
  const res = (ed, o) => Object.fromEntries(run(ed, o).res.map(r => [r.n, r]));
  const n = x => Number(x.v);
  let r = res(24, { cls: 'monk', lvl: 9, ab: { wis: 16 } });
  assert.equal(n(r['Очки сосредоточенности']), 9); assert.equal(r['Очки сосредоточенности'].pool, true);
  assert.deepEqual(r['Очки сосредоточенности'].next, { lvl: 10, v: '10' });
  assert.equal(n(r['Сл сосредоточенности']), 8 + 4 + 3);
  r = res(24, { cls: 'paladin', lvl: 11 }); assert.equal(n(r['Возложение рук']), 55); assert.equal(n(r['Проведение божественности']), 3);
  r = res(24, { cls: 'bard', lvl: 5, ab: { cha: 16 } }); assert.equal(n(r['Вдохновение барда']), 3); assert.equal(r['Кость вдохновения'].v, 'к8');
  r = res(14, { cls: 'barbarian', lvl: 17 }); assert.equal(n(r['Ярость']), 6); assert.equal(r['Ярость'].next.v, 'Неограниченно');
  r = res(14, { cls: 'paladin', lvl: 5, ab: { cha: 16 } }); assert.equal(n(r['Божественное чувство']), 4);   // 1 + мод. Харизмы
  r = res(24, { cls: 'wizard', lvl: 5 }); assert.equal(n(r['Магическое восстановление']), 3);
  assert.equal(run(24, { cls: 'fighter', lvl: 1 }).res.find(x => x.n === 'Всплеск действий'), undefined);   // умения ещё нет
});
test('ресурсы: «дальше» согласовано с таблицей класса', () => {
  for (const ed of [24, 14]) for (const cls of DATA[ed].classes) for (const lvl of [1, 4, 9, 14, 19]) {
    const d = run(ed, { cls: cls.slug, lvl, ab: { cha: 14, wis: 14 } });
    for (const r of d.res.filter(x => x.src === 'table' && x.next)) {
      const later = run(ed, { cls: cls.slug, lvl: r.next.lvl, ab: { cha: 14, wis: 14 } }).res.find(x => x.id === r.id);
      assert.ok(later && later.v === r.next.v && later.v !== r.v, `${ed}/${cls.slug}/${lvl}: ${r.n}`);
    }
  }
});

/* ---------- разбор текстов (на выдуманном классе) ---------- */
function synth(blocksByName, extra) {
  const features = Object.entries(blocksByName).map(([name, v]) => ({ name, level: v.level || 1, blocks: v.blocks.map(b => typeof b === 'string' ? { type: 'paragraph', text: b } : b) }));
  return Object.assign({ slug: 'testcls', name_ru: 'Тест', core_traits: [], features, subclasses: [] }, extra);
}
const runSynth = (cls, lvl, ed = 24) => { const c = Object.assign(R.newChar(ed), { cls: 'testcls', lvl, abm: 'manual' }); return R.derive(c, { cls, sub: null, sp: null, bg: null, feats: [], gear: [], gearBySlug: {}, items: [], itemsBySlug: {} }); };
test('разбор: хиты «+N и +1 за каждый уровень» растут с уровнем', () => {
  const cls = synth({ 'Крепкий орешек': { level: 3, blocks: ['Ваш максимум хитов увеличивается на 3 и увеличивается на 1 каждый раз, когда вы получаете уровень в этом классе.'] } });
  assert.equal(runSynth(cls, 2).fx.length, 0);
  for (const lvl of [3, 4, 10, 20]) assert.equal(fxOf(runSynth(cls, lvl), 'hp')[0].v, 3 + lvl - 3);
});
test('разбор: активируемое умение («Действием вы можете…») КД не меняет', () => {
  const cls = synth({ 'Каменная кожа': { blocks: ['Действием вы можете получить базовый КД равный 13 + ваш модификатор Телосложения, если вы не носите броню.'] },
    'Защита': { blocks: ['Пока вы не носите доспехов, ваш КД равен 12 + модификатор Ловкости.'] } });
  const d = runSynth(cls, 1); assert.deepEqual(fxOf(d, 'acAlt').map(e => e.why), ['Защита']);
});
test('разбор: временные состояния и варианты на выбор не применяются сами', () => {
  const cls = synth({
    'Сердце дракона': { blocks: ['Пока вы носите драконье сердце, вы получаете следующие преимущества:', { type: 'list', items: ['Вы получаете бонус к спасброскам Мудрости, равный вашему модификатору Интеллекта.'] }] },
    'Проклятие': { blocks: ['Выберите проклятие, которое лежит на вас.', '**Проклятие первое**. Максимум ваших хитов увеличивается на 1 на каждом уровне.', '**Проклятие второе**. Вы совершаете проверки с помехой.'] },
    'Перечень': { blocks: ['Вы получаете следующие преимущества:', '**Здоровяк.** Максимум ваших хитов увеличивается на 2.', '**Прыгун.** Вы прыгаете дальше.'] }
  });
  const d = runSynth(cls, 5);
  assert.equal(fxOf(d, 'save').length, 0);
  assert.deepEqual(fxOf(d, 'hp').map(e => e.why), ['Перечень']);   // перечень преимуществ разбирается, варианты на выбор — нет
});
test('разбор: «й» и «ё» из двух символов не мешают', () => {
  const nfd = t => { const x = t.normalize('NFD'); assert.notEqual(x, t); return x; };
  const act = nfd('Действием вы можете получить базовый КД равный 13 + ваш модификатор Телосложения, если вы не носите броню.');   // «Действием» — с «й»
  const aura = nfd('Пока вы не носите доспехов, ваш базовый КД равен 11 + ваш модификатор Ловкости.');
  const d = runSynth(synth({ 'Каменная кожа': { blocks: [act] }, 'Мутация': { blocks: [aura] } }), 1);
  assert.deepEqual(fxOf(d, 'acAlt').map(e => e.why), ['Мутация']);
});

/* ---------- обход всех сочетаний ---------- */
test('derive() на всех класс × подкласс × уровень (обе редакции): без ошибок, чисел NaN и повторяющихся id', () => {
  let n = 0;
  for (const ed of [24, 14]) for (const cls of DATA[ed].classes) for (const sub of [null, ...(cls.subclasses || [])]) for (let lvl = 1; lvl <= 20; lvl++) {
    const c = Object.assign(R.newChar(ed), { cls: cls.slug, lvl, sub: sub ? sub.name : '', abm: 'manual', ab: { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 } });
    const d = R.derive(c, { cls, sub, sp: null, bg: null, feats: DATA[ed].feats, gear, gearBySlug, items: [], itemsBySlug: {} }); n++;
    for (const k of ['hp', 'ac', 'init', 'speed', 'pb']) assert.ok(Number.isFinite(d[k]), `${ed}/${cls.slug}/${lvl}: ${k}`);
    R.AB.forEach(a => { assert.ok(Number.isFinite(d.saves[a.k]) && Number.isFinite(d.score[a.k])); });
    d.skills.forEach(s => assert.ok(Number.isFinite(s.bonus)));
    Object.values(d.passive).forEach(v => assert.ok(Number.isFinite(v)));
    const ids = d.fx.map(e => e.id); assert.equal(new Set(ids).size, ids.length, `${ed}/${cls.slug}/${sub && sub.name}/${lvl}: повтор id`);
    // без активных эффектов числа равны «чистым» правилам
    const act = k => d.fx.some(e => e.k === k && e.on);
    if (!act('hp') && c.hpMode !== 'manual') { const die = d.die, m = d.mod.con; assert.equal(d.hp, Math.max(lvl, die + m + (lvl - 1) * Math.max(1, Math.floor(die / 2) + 1 + m))); }
    if (!act('init')) assert.equal(d.init, d.mod.dex);
    if (!act('speed')) assert.equal(d.speed, 30);
    if (!act('acAlt')) assert.equal(d.ac, 10 + d.mod.dex);
  }
  assert.ok(n > 8000);
});
test('derive() для каждого вида и подвида (обе редакции)', () => {
  for (const ed of [24, 14]) for (const sp of DATA[ed].species) for (const opt of (R.speciesChoice(sp) ? R.speciesChoice(sp).options : [''])) for (const lvl of [1, 9, 20]) {
    const d = run(ed, { cls: 'fighter', lvl, sp: sp.slug, opt });
    assert.ok(d.speed >= 20 && d.speed <= 60, `${sp.name_ru}/${opt}: скорость ${d.speed}`);
    assert.ok(Number.isFinite(d.hp) && Number.isFinite(d.init) && Number.isFinite(d.ac));
  }
});

/* ---------- снимок: что именно разобралось из текстов ---------- */
function snapshot() {
  const map = new Map();
  const add = (ed, who, d, only) => d.fx.filter(only || (() => true)).forEach(e => { const key = [ed, e.k, e.id, e.text, e.on ? '' : '(выкл: ' + e.cond + ')'].join(' | '); (map.get(key) || map.set(key, []).get(key)).push(who); });
  for (const ed of [24, 14]) {
    const S = DATA[ed], fighter = S.classes.find(x => x.slug === 'fighter'), ab = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 };
    for (const cls of S.classes) for (const sub of [null, ...(cls.subclasses || [])]) {
      const c = Object.assign(R.newChar(ed), { cls: cls.slug, lvl: 20, sub: sub ? sub.name : '', abm: 'manual', ab });
      add(ed, cls.slug + (sub ? '/' + sub.name : ''), R.derive(c, { cls, sub, sp: null, bg: null, feats: S.feats, gear, gearBySlug, items: [], itemsBySlug: {} }));
    }
    for (const sp of S.species) for (const opt of (R.speciesChoice(sp) ? R.speciesChoice(sp).options : [''])) {
      const c = Object.assign(R.newChar(ed), { cls: 'fighter', lvl: 20, sp: sp.slug, spOpt: opt, abm: 'manual', ab });
      add(ed, 'вид ' + sp.name_ru + (opt ? '/' + opt : ''), R.derive(c, { cls: fighter, sub: null, sp, bg: null, feats: S.feats, gear, gearBySlug, items: [], itemsBySlug: {} }), e => e.id.startsWith('sp:'));
    }
    for (const f of S.feats) {
      const c = Object.assign(R.newChar(ed), { cls: 'fighter', lvl: 20, feats: [{ slug: f.slug }], abm: 'manual', ab });
      add(ed, 'черта ' + f.name_ru, R.derive(c, { cls: fighter, sub: null, sp: null, bg: null, feats: S.feats, gear, gearBySlug, items: [], itemsBySlug: {} }), e => e.id.startsWith('ft:'));
    }
  }
  return [...map.entries()].map(([k, w]) => k + ' | ×' + w.length + ' | ' + w[0]).sort().join('\n') + '\n';
}
test('снимок эффектов, разобранных из текстов умений', () => {
  const file = path.join(__dirname, 'fx-snapshot.txt'), now = snapshot();
  if (process.env.UPDATE_SNAPSHOT || !fs.existsSync(file)) { fs.writeFileSync(file, now); return; }
  const was = fs.readFileSync(file, 'utf8');
  if (was !== now) {
    const a = new Set(was.split('\n')), b = new Set(now.split('\n'));
    const gone = [...a].filter(x => !b.has(x)), came = [...b].filter(x => !a.has(x));
    assert.fail('Набор эффектов изменился (данные или правила разбора).\nПропало:\n  ' + gone.join('\n  ') + '\nПоявилось:\n  ' + came.join('\n  ') + '\nЕсли так и задумано: UPDATE_SNAPSHOT=1 node --test tests/');
  }
});
test('каждое правило находит своё умение в данных', () => {
  const snap = snapshot();
  const must = [
    '24 | speed | cls:Движение без доспехов#speed', '14 | speed | cls:Движение без доспехов#speed', '24 | speed | cls:Быстрое передвижение#speed', '14 | speed | cls:Быстрое передвижение#speed',
    '24 | speed | cls:Вездеходность#speed', '14 | speed | sub:Превосходная мобильность#speed', '24 | speed | sp:Эльфийский род — Лесные эльфы#speed', '24 | speed | ft:Быстрый#speed', '14 | speed | ft:Подвижный#speed',
    '24 | ability | cls:Дикий чемпион#ability', '14 | ability | cls:Дикий чемпион#ability', '24 | ability | cls:Тело и разум#ability',
    '24 | hp | sub:Драконья устойчивость#hp', '14 | hp | sub:Драконья устойчивость#hp', '24 | hp | sp:Дварфийская крепость#hp', '14 | hp | sp:Дварфийская выдержка#hp', '24 | hp | ft:Крепкий#hp', '14 | hp | ft:Крепкий#hp', '24 | hp | ft:Дар стойкости#hp',
    '24 | skill | cls:Мастер на все руки#skill', '14 | skill | cls:Мастер на все руки#skill', '14 | init | cls:Мастер на все руки#init', '14 | skill | sub:Выдающийся атлет#skill',
    '24 | init | ft:Бдительный#init', '14 | init | ft:Бдительный#init', '14 | init | sp:init:6', '24 | init | sub:Угроза из засады#init',
    '24 | save | cls:Аура защиты#save', '14 | save | cls:Аура защиты#save', '14 | passive | ft:Внимательный#passive',
    '24 | acAlt | cls:Защита без доспехов#acAlt', '14 | acAlt | cls:Защита без доспехов#acAlt', '14 | acAlt | sub:Драконья устойчивость#acAlt', '24 | acAlt | sub:Драконья устойчивость#acAlt',
    '24 | acCap | ft:Мастер средних доспехов#acCap', '14 | acCap | ft:Мастер средних доспехов#acCap',
    '24 | saveProf | cls:Дисциплина сохранения#saveProf', '14 | saveProf | cls:Алмазная душа#saveProf', '24 | saveProf | cls:Скользкий ум#saveProf', '14 | saveProf | cls:Скользкий ум#saveProf'
  ];
  const lacking = must.filter(m => !snap.split('\n').some(l => l.startsWith(m + ' | ')));
  assert.deepEqual(lacking, []);
});

/* ---------- облики зверей ---------- */
test('Дикий облик: у друида 20 уровня остаются звери с опасностью 1, а существа без опасности не попадают в список', () => {
  for (const ed of [24, 14]) {
    const beasts = load(ed === 24 ? 'data/bestiary.json' : 'data14/bestiary.json');
    const [c, D] = mk(ed, { cls: 'druid', lvl: 20 }), ws = R.wildShape(D, c, 20);
    assert.ok(ws, ed + ': нет Дикого облика на 20 уровне');
    const ok = beasts.filter(m => R.beastOk(m, ws, ed));
    assert.ok(ok.some(m => R.crNum(m.cr) === 1), ed + ': нет ни одного зверя с ОП 1');
    assert.ok(ok.every(m => m.cr != null && m.cr !== '' && R.crNum(m.cr) <= ws.cr), ed + ': в списке зверь без ОП или сильнее предела');
    const beast = cr => ({ type: 'Зверь', cr, speed: {} });
    assert.equal(R.beastOk(beast(null), ws, ed), false);
    assert.equal(R.beastOk(beast(''), ws, ed), false);
    assert.equal(R.beastOk(beast('1'), ws, ed), true);
    assert.equal(R.beastOk(beast('2'), ws, ed), false);
  }
});
test('Дикий облик: Круг Луны — опасность до уровня ÷ 3', () => {
  for (const ed of [24, 14]) {
    const [c, D] = mk(ed, { cls: 'druid', lvl: 20, sub: 'луны' });
    assert.equal(R.wildShape(D, c, 20).cr, 6, ed + ': 20 уровень');
    assert.equal(R.wildShape(D, c, 9).cr, 3, ed + ': 9 уровень');
  }
});

/* ---------- устойчивость к странным данным ---------- */
test('derive(): характеристики в сохранённом листе могут быть строками или мусором', () => {
  for (const ed of [24, 14]) {
    const [c, D] = mk(ed, { cls: 'fighter', lvl: 5 });
    c.ab = { str: '16', dex: ' 14 ', con: null, int: undefined, wis: 'abc', cha: NaN, luck: 18 };
    const d = R.derive(c, D);
    assert.equal(d.score.str, 16); assert.equal(d.score.dex, 14);
    ['con', 'int', 'wis', 'cha'].forEach(k => assert.equal(d.score[k], 10, ed + ' ' + k));
    assert.ok(Object.values(d.score).every(Number.isFinite) && Number.isFinite(d.hp) && Number.isFinite(d.ac));
  }
});

/* ---------- особенности вида 2014 ---------- */
test('особенности вида 2014: справочные абзацы (имена, «Лидер», «Об эльфах», «Источник») особенностями не считаются', () => {
  const LORE = /:\s*$|^Источник|^Смотрите статью|^Об? \S+(ах|ях)$|(^| )(имена|имён)( |$)|^(Лидеры?|Штаб-?[Кк]вартира)$/i;
  const bad = [];
  for (const sp of DATA[14].species) {
    const ch = R.speciesChoice(sp);
    for (const opt of ch ? ch.options : ['']) R.speciesTraits(sp, { opt, lvl: 20 }).forEach(t => { if (LORE.test(t.name)) bad.push(sp.slug + ': ' + t.name); });
  }
  assert.deepEqual(bad, []);
  const dw = DATA[14].species.find(x => x.slug === 'dwarf'), names = R.speciesTraits(dw, { opt: 'Горный', lvl: 1 }).map(t => t.name);
  ['Тёмное зрение', 'Дварфийская устойчивость', 'Знание камня', 'Владение доспехами дварфов'].forEach(n => assert.ok(names.includes(n), 'пропала особенность «' + n + '»'));
  assert.ok(!names.includes('Об эльфах') && !names.includes('Мужские имена'));
});

/* ---------- владение спасбросками от умений и черт ---------- */
test('монах: «Алмазная душа» (2014) / «Дисциплина сохранения» (2024) — владение всеми спасбросками с 14 уровня', () => {
  for (const ed of [14, 24]) {
    const o = { cls: 'monk', ab: { dex: 14, wis: 14, str: 10 } };
    let d = run(ed, Object.assign({ lvl: 13 }, o)); assert.equal(d.saveProf.size, 2, `ед.${ed} ур.13`);
    d = run(ed, Object.assign({ lvl: 14 }, o)); assert.equal(d.saveProf.size, 6, `ед.${ed} ур.14`);
    assert.equal(d.saves.wis, 2 + 5, `ед.${ed}: Мудрость +2 и бонус мастерства +5`);     // у монаха 14 уровня БМ +5
    assert.deepEqual(d.saveFrom.int, [fxOf(d, 'saveProf')[0].why]);                      // откуда владение видно в листе
    assert.deepEqual(d.saveFrom.str, ['класс']);
  }
});
test('плут: «Скользкий ум» — Мудрость (2014) и Мудрость с Харизмой (2024) с 15 уровня', () => {
  const o = { cls: 'rogue', ab: { wis: 12, cha: 14 } };
  for (const ed of [14, 24]) assert.ok(!run(ed, Object.assign({ lvl: 14 }, o)).saveProf.has('wis'), `ед.${ed} ур.14`);
  let d = run(14, Object.assign({ lvl: 15 }, o)); assert.ok(d.saveProf.has('wis')); assert.ok(!d.saveProf.has('cha')); assert.equal(d.saves.wis, 1 + 5);
  d = run(24, Object.assign({ lvl: 15 }, o)); assert.ok(d.saveProf.has('wis') && d.saveProf.has('cha')); assert.equal(d.saves.cha, 2 + 5);
});
test('владение спасбросками от подклассов; «Камень преобразования» и «если вы уже владеете» не считаются', () => {
  assert.ok(run(24, { cls: 'ranger', sub: 'Сумрачный охотник', lvl: 7 }).saveProf.has('wis') === true);
  assert.ok(run(24, { cls: 'ranger', sub: 'Сумрачный охотник', lvl: 6 }).saveProf.size === 2);
  assert.ok(run(24, { cls: 'cleric', sub: 'Домен знаний', lvl: 6 }).saveProf.has('int'));
  assert.ok(run(14, { cls: 'fighter', sub: 'Самурай', lvl: 7 }).saveProf.has('wis'));
  assert.equal(run(14, { cls: 'fighter', sub: 'Самурай', lvl: 7 }).saveProf.size, 3);       // «Если у вас уже есть …» — не вторая прибавка
  for (const [ed, sub] of [[14, 'Школа Преобразования'], [24, 'Преобразователь']]) assert.equal(run(ed, { cls: 'wizard', sub, lvl: 14 }).saveProf.size, 2, `камень не даёт владения магу (ед.${ed})`);
});
test('черта «Устойчивый»: +1 и владение спасброском выбранной характеристики (2014 и 2024)', () => {
  for (const ed of [14, 24]) {
    const f = DATA[ed].feats.find(x => x.slug === 'resilient'), fa = R.featAbility(f);
    assert.ok(fa && fa.save && fa.opts.length === 6 && fa.cap === 20, `разбор черты (ед.${ed})`);
    const base = run(ed, { cls: 'fighter', lvl: 4, ab: { dex: 13 } });
    assert.ok(!base.saveProf.has('dex'));
    // выбрана при увеличении характеристик на 4 уровне
    let d = run(ed, { cls: 'fighter', lvl: 4, ab: { dex: 13 }, asi: { 4: { m: 'feat', feat: 'resilient', fa: 'dex' } } });
    assert.equal(d.score.dex, 14); assert.ok(d.saveProf.has('dex')); assert.deepEqual(d.saveFrom.dex, ['Устойчивый']); assert.equal(d.saves.dex, 2 + 2);
    // без выбора характеристики ничего не меняется
    d = run(ed, { cls: 'fighter', lvl: 4, ab: { dex: 13 }, asi: { 4: { m: 'feat', feat: 'resilient', fa: '' } } });
    assert.equal(d.score.dex, 13); assert.ok(!d.saveProf.has('dex'));
    // добавлена вручную (вкладка «Основа»)
    d = run(ed, { cls: 'fighter', lvl: 1, ab: { wis: 14 }, set: { feats: [{ slug: 'resilient', fa: 'wis' }] } });
    assert.equal(d.score.wis, 15); assert.ok(d.saveProf.has('wis'));
    // эффект можно отключить: прибавка остаётся, владение пропадает
    const id = fxOf(d, 'saveProf')[0].id;
    d = run(ed, { cls: 'fighter', lvl: 1, ab: { wis: 14 }, set: { feats: [{ slug: 'resilient', fa: 'wis' }], fxOff: { [id]: 1 } } });
    assert.equal(d.score.wis, 15); assert.ok(!d.saveProf.has('wis'));
    // черты без выбора характеристики по-прежнему не затронуты
    assert.equal(run(ed, { cls: 'fighter', lvl: 1, feats: ['alert'] }).saveProf.size, 2);
  }
  assert.ok(R.featAbility(DATA[24].feats.find(x => x.slug === 'resilient')).notProf);
  assert.ok(!R.featAbility(DATA[14].feats.find(x => x.slug === 'resilient')).notProf);
});

/* ---------- прибавка к характеристике у черт ---------- */
test('черты 2014: «Увеличьте значение Силы или Ловкости на 1» из списка и «по вашему выбору» разбираются', () => {
  const fa = (ed, slug) => R.featAbility(DATA[ed].feats.find(x => x.slug === slug));
  assert.deepEqual(fa(14, 'athlete').opts, ['str', 'dex']);
  assert.deepEqual(fa(14, 'actor').opts, ['cha']);
  assert.deepEqual(fa(14, 'heavy-armor-master').opts, ['str']);
  assert.deepEqual(fa(14, 'telepathic').opts, ['int', 'wis', 'cha']);
  assert.deepEqual(fa(14, 'elven-accuracy').opts, ['dex', 'int', 'wis', 'cha']);
  for (const slug of ['agent-of-order', 'baleful-scion', 'cohort-of-chaos', 'outlands-envoy', 'righteous-heritor', 'skill-expert']) assert.equal(fa(14, slug).opts.length, 6, slug);
  assert.equal(fa(14, 'athlete').cap, 20);
  // у каждой черты 2014, где в тексте есть «Увеличьте … на 1», прибавка разобрана; у черт без неё — нет
  const left = DATA[14].feats.filter(f => !R.featAbility(f) && /[Уу]величь\S*\s+(?:значение\s+)?[^.]{0,60}на\s+\+?1/.test(JSON.stringify(f.blocks || [])));
  assert.deepEqual(left.map(f => f.name_ru), []);
  assert.equal(R.featAbility(DATA[14].feats.find(x => x.slug === 'alert')), null);
});
test('черта «Увеличение характеристик» 2024 («+2 к одной или +1 к двум») не принимается за «+1»', () => {
  assert.equal(R.featAbility(DATA[24].feats.find(x => x.slug === 'ability-score-improvement')), null);
});
test('черта 2014 вместо увеличения характеристик: +1 к выбранной из списка, потолок 20', () => {
  const asi = { 4: { m: 'feat', feat: 'athlete', fa: 'dex' } };
  let d = run(14, { cls: 'fighter', lvl: 4, ab: { dex: 15 }, asi }); assert.equal(d.score.dex, 16); assert.match(d.src.dex.join(), /черта/);
  d = run(14, { cls: 'fighter', lvl: 4, ab: { dex: 20 }, asi }); assert.equal(d.score.dex, 20);                       // выше 20 не растёт
  d = run(14, { cls: 'fighter', lvl: 4, ab: { dex: 15 }, asi: { 4: { m: 'feat', feat: 'athlete', fa: 'wis' } } }); assert.equal(d.score.wis, 10);   // не из списка черты — не применяется
  d = run(14, { cls: 'fighter', lvl: 1, ab: { str: 14 }, set: { feats: [{ slug: 'athlete', fa: 'str' }] } }); assert.equal(d.score.str, 15);   // добавлена вручную (Человек-вариант)
  d = run(14, { cls: 'fighter', lvl: 1, ab: { str: 14 }, feats: ['athlete'] }); assert.equal(d.score.str, 14);          // без выбора характеристики — как раньше
});

/* ---------- заклинания, которые даёт подкласс ---------- */
const subOf = (ed, cls, name) => DATA[ed].classes.find(x => x.slug === cls).subclasses.find(s => s.name === name);
test('Мистический рыцарь и Мистический ловкач: ячейки, заговоры и число заклинаний по таблицам PHB (2014 и 2024)', () => {
  const SLOTS = { 3: [2], 4: [3], 6: [3], 7: [4, 2], 9: [4, 2], 10: [4, 3], 13: [4, 3, 2], 16: [4, 3, 3], 19: [4, 3, 3, 1], 20: [4, 3, 3, 1] };
  const KNOWN = { 3: 3, 4: 4, 7: 5, 8: 6, 10: 7, 11: 8, 13: 9, 14: 10, 16: 11, 19: 12, 20: 13 };
  for (const ed of [14, 24]) for (const [cls, sub, can0] of [['fighter', 'Мистический рыцарь', 2], ['rogue', 'Мистический ловкач', 3]]) {
    for (const lvl of [3, 4, 6, 7, 9, 10, 13, 16, 19, 20]) {
      const d = run(ed, { cls, sub, lvl, ab: { int: 16 } }), ex = SLOTS[lvl].concat([0, 0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 9), tag = `ед.${ed} ${cls} ур.${lvl}`;
      assert.ok(d.sp.has, tag); assert.deepEqual(d.sp.rows.map(r => r.n), ex, tag);
      assert.equal(d.sp.cantrips, can0 + (lvl >= 10 ? 1 : 0), tag + ' заговоры');
      assert.equal(d.sp.ab, 'int', tag); assert.equal(d.sp.dc, 8 + d.pb + 3, tag + ' Сл'); assert.equal(d.sp.atk, d.pb + 3, tag + ' атака');
      assert.equal(d.sp.maxLevel, SLOTS[lvl].length, tag + ' макс. круг'); assert.equal(d.sp.list, 'wizard', tag);
    }
    for (const [lvl, n] of Object.entries(KNOWN)) { const d = run(ed, { cls, sub, lvl: +lvl }); assert.equal(ed === 14 ? d.sp.known : d.sp.prepared, n, `ед.${ed} ${cls} ур.${lvl}: число заклинаний`); assert.equal(ed === 14 ? d.sp.prepared : d.sp.known, null); }
    assert.ok(!run(ed, { cls, sub, lvl: 2 }).sp.has, `ед.${ed} ${cls}: до 3 уровня заклинаний нет`);
  }
});
test('заклинания подкласса: другой список и характеристика (Костяной рыцарь — жрец, Мистический воин — чародей)', () => {
  let d = run(14, { cls: 'fighter', sub: 'Костяной рыцарь', lvl: 7, ab: { wis: 16, int: 8 } });
  assert.equal(d.sp.list, 'cleric'); assert.equal(d.sp.ab, 'wis'); assert.equal(d.sp.dc, 8 + 3 + 3); assert.deepEqual(d.sp.rows.map(r => r.n).slice(0, 3), [4, 2, 0]);
  d = run(24, { cls: 'monk', sub: 'Мистический воин', lvl: 7, ab: { wis: 16 } });
  assert.equal(d.sp.list, 'sorcerer'); assert.equal(d.sp.ab, 'wis'); assert.equal(d.sp.prepared, 5);
});
test('школы подкласса 2014: Воплощение и Ограждение (воин), Иллюзия и Очарование (плут); исключения — 8, 14, 20 уровни', () => {
  const sp = (cls, sub) => run(14, { cls, sub, lvl: 8 }).sp;
  let s = sp('fighter', 'Мистический рыцарь');
  assert.deepEqual(s.schools.map(x => x.name), ['Воплощение', 'Ограждение']); assert.deepEqual(s.freeLvls, [8, 14, 20]);
  assert.ok(!R.outOfSchools(s, 'Воплощение') && !R.outOfSchools(s, 'Ограждение') && R.outOfSchools(s, 'Прорицание'));
  s = sp('rogue', 'Мистический ловкач');
  assert.deepEqual(s.schools.map(x => x.name), ['Иллюзия', 'Очарование']); assert.ok(R.outOfSchools(s, 'Воплощение') && !R.outOfSchools(s, 'Иллюзия'));
  assert.equal(run(24, { cls: 'fighter', sub: 'Мистический рыцарь', lvl: 8 }).sp.schools, null);        // в 2024 школ нет
  assert.ok(!R.outOfSchools(run(14, { cls: 'wizard', lvl: 8 }).sp, 'Воплощение'));                      // у класса без школ ничего не помечается
});
test('таблицу заклинателя находят только у подклассов, где она есть; у остальных блока заклинаний нет', () => {
  const found = [];
  for (const ed of [14, 24]) for (const cls of DATA[ed].classes) for (const s of cls.subclasses || []) if (R.subCasting(s)) found.push(`${ed} ${cls.slug}/${s.name}`);
  assert.deepEqual(found.sort(), ['14 fighter/Костяной рыцарь', '14 fighter/Мистический рыцарь', '14 rogue/Божественный вестник', '14 rogue/Мистический ловкач', '14 rogue/Тёмный проситель', '24 fighter/Мистический рыцарь', '24 monk/Мистический воин', '24 rogue/Мистический ловкач'].sort());
  for (const ed of [14, 24]) { assert.ok(!run(ed, { cls: 'fighter', sub: ed === 14 ? 'Чемпион' : 'Чемпион', lvl: 10 }).sp.has); assert.ok(!run(ed, { cls: 'rogue', lvl: 10 }).sp.has); }
  assert.equal(R.subCasting(null), null);
});
test('у класса с собственными ячейками таблица подкласса не подменяет таблицу класса', () => {
  for (const ed of [14, 24]) { const d = run(ed, { cls: 'wizard', lvl: 5 }); assert.deepEqual(d.sp.rows.map(r => r.n).slice(0, 3), [4, 3, 2]); assert.equal(d.sp.list, 'wizard'); assert.equal(d.sp.via, ''); }
});

/* ---------- заклинания, которые выдаёт подкласс ---------- */
const names = d => d.autoSpells.map(x => x.name).sort();
test('домен жизни 2024: заклинания домена появляются с уровней таблицы и не требуют выбора', () => {
  const at = l => names(run(24, { cls: 'cleric', sub: 'Домен жизни', lvl: l }));
  assert.deepEqual(at(2), []);
  assert.deepEqual(at(3), ['Благословение', 'Лечение ран', 'Малое восстановление', 'Подмога']);
  assert.equal(at(5).length, 6); assert.ok(at(5).includes('Возвращение к жизни'));    // в тексте домена «Возрождение» — это Raise Dead
  assert.equal(at(9).length, 10);
  const d = run(24, { cls: 'cleric', sub: 'Домен жизни', lvl: 5 });
  assert.ok(d.autoSpells.every(x => x.auto && x.free && x.prep && x.at <= 5)); assert.deepEqual(d.autoMissing, []);
});
test('2014: домен жизни — заклинания с 1 уровня жреца; расширенный список колдуна не выдаётся, а добавляется в каталог', () => {
  assert.deepEqual(names(run(14, { cls: 'cleric', sub: 'Домен жизни', lvl: 1 })), ['Благословение', 'Лечение ран']);
  assert.equal(run(14, { cls: 'cleric', sub: 'Домен жизни', lvl: 3 }).autoSpells.length, 4);
  const d = run(14, { cls: 'warlock', sub: 'Исчадие', lvl: 5 });
  assert.deepEqual(d.autoSpells, []); assert.ok(d.extraList.length >= 10); assert.ok(d.extraList.includes('burning-hands'));
  assert.ok(!run(14, { cls: 'wizard', lvl: 5 }).extraList.length);
});
test('подклассы без таблицы заклинаний ничего не выдают; у воина-чемпиона и плута-вора пусто', () => {
  for (const ed of [14, 24]) { assert.deepEqual(run(ed, { cls: 'fighter', sub: 'Чемпион', lvl: 10 }).autoSpells, []); assert.deepEqual(run(ed, { cls: 'rogue', lvl: 10 }).autoSpells, []); }
  assert.deepEqual(R.subSpells(null, [], 5), { auto: [], extra: [], missing: [] });
});
test('названия заклинаний подклассов: «[en]», лишние знаки, псевдонимы и неизвестные', () => {
  const sp = SPELLS[14];
  assert.equal(R.spellByName(sp, 'лечение ран [cure wounds]').slug, 'cure-wounds');
  assert.equal(R.spellByName(sp, 'Лечение ран').slug, 'cure-wounds');
  assert.equal(R.spellByName(sp, '*огненные ладони [burning hands]*').slug, 'burning-hands');
  assert.equal(R.spellByName(SPELLS[24], 'Удержание чудовища').slug, 'hold-monster');
  assert.equal(R.spellByName(sp, 'маяк надежды [beacon] of hope]').slug, 'beacon-of-hope');   // сломанная скобка в данных: находится по русскому названию
  assert.equal(R.spellByName(sp, 'заклинание [no such spell]'), null);
  assert.equal(R.spellByName(sp, 'заклинание которого нет'), null);
  assert.equal(R.spellByName(null, 'щит'), null);
  const r = R.subSpells({ features: [{ blocks: [{ type: 'table', rows: [['Уровень Жреца', 'Заклинания'], ['3', 'Щит веры, Придуманное заклинание']] }] }] }, SPELLS[24], 3);
  assert.deepEqual(r.auto.map(x => x.slug), ['shield-of-faith']); assert.deepEqual(r.missing, ['Придуманное заклинание']);
});
test('таблицы подклассов: каждая «Уровень <класса> | Заклинания» даёт автозаклинания, а в 2024 все названия найдены в справочнике', () => {
  for (const ed of [14, 24]) {
    let tables = 0;
    for (const cls of DATA[ed].classes) for (const sub of cls.subclasses || []) {
      const t = R.subSpellTables(sub); tables += t.always.length + t.expanded.length;
      const r = R.subSpells(sub, SPELLS[ed], 20);
      if (t.always.length) assert.ok(r.auto.length + r.missing.length > 0, `${ed} ${cls.slug}/${sub.name}`);
      if (ed === 24) assert.deepEqual(r.missing, [], `ед.24 ${cls.slug}/${sub.name}: названия не из справочника`);
    }
    assert.ok(tables > 0);
  }
});
test('автозаклинания не дублируют выбранные вручную и не меняют лимиты', () => {
  const [c, D] = mk(24, { cls: 'cleric', sub: 'Домен жизни', lvl: 3 });
  c.spells = [{ slug: 'bless', name: 'Благословение', lvl: 1, prep: true, free: true }];
  const d = R.derive(c, D);
  assert.equal(d.autoSpells.length, 4); assert.equal(d.sp.prepared, run(24, { cls: 'cleric', lvl: 3 }).sp.prepared);   // число подготовленных заклинаний то же
});

/* ---------- подвиды 2014 ---------- */
const spec14 = slug => DATA[14].species.find(x => x.slug === slug);
test('2014: подрасы, лежащие под своими заголовками, находятся и дают выбор', () => {
  for (const slug of ['elf', 'halfling', 'human', 'half-elf', 'tiefling', 'genasi', 'aasimar', 'gith']) {
    const ch = R.speciesChoice(spec14(slug));
    assert.ok(ch && ch.options.length > 1, slug);
  }
  assert.equal(R.speciesChoice(spec14('elf')).optional, false);
  assert.equal(R.speciesChoice(spec14('tiefling')).optional, true);   // все подрасы заменяют базовые бонусы — выбор необязателен
});
test('2014: бонусы вида складываются из общих и подрасы', () => {
  const asi = (slug, opt) => R.speciesAsi(spec14(slug), opt);
  assert.deepEqual(asi('elf', 'Высший эльф').fixed, { dex: 2, int: 1 });
  assert.deepEqual(asi('elf', 'Лесной эльф').fixed, { dex: 2, wis: 1 });
  assert.deepEqual(asi('halfling', 'Коренастый').fixed, { dex: 2, con: 1 });
  assert.deepEqual(asi('elf', undefined).fixed, { dex: 2 });
  assert.deepEqual(asi('human', undefined).fixed, { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
  assert.deepEqual(asi('half-elf', undefined), { fixed: { cha: 2 }, picks: [{ n: 2, v: 1 }], traits: ['Увеличение характеристик'] });
  assert.deepEqual(asi('gith', 'Гитъянки').fixed, { int: 1, str: 2 });   // у гитов подраса прибавляется к базе
  assert.deepEqual(asi('genasi', 'Дженази огня').fixed, { con: 2, int: 1 });
});
test('2014: заменяющие подрасы не складываются с общими бонусами', () => {
  const asi = (slug, opt) => R.speciesAsi(spec14(slug), opt).fixed;
  assert.deepEqual(asi('tiefling', 'Тифлинг Фаэруна (SCAG)'), { dex: 2, int: 1 });
  assert.deepEqual(asi('tiefling', 'Левистус (MTF)'), { cha: 2, con: 1 });
  assert.deepEqual(asi('human', 'Дом Тарашк'), { wis: 2, con: 1 });   // метка дома вместо «+1 ко всем»
  assert.deepEqual(asi('goblin', 'Особенности гоблинов Данквуда'), { dex: 2, wis: 1 });
});
test('2014: скорость и особенности зависят от подрасы', () => {
  const speed = (slug, opt) => R.speciesSpeed(spec14(slug), 14, { opt });
  assert.equal(speed('elf', 'Лесной эльф'), 35); assert.equal(speed('elf', 'Высший эльф'), 30);
  assert.equal(speed('halfling', 'Коренастый'), 25);
  const names = (slug, opt) => R.speciesTraits(spec14(slug), { opt, lvl: 1 }).map(t => t.name);
  assert.ok(names('elf', 'Высший эльф').includes('Заговор') || names('elf', 'Высший эльф').some(n => /заговор/i.test(n)));
  assert.ok(names('elf', 'Лесной эльф').includes('Быстрые ноги'));
  assert.ok(!names('elf', 'Лесной эльф').includes('Заговор'));
  const g = names('goblin', 'Особенности гоблинов Данквуда');
  assert.equal(g.filter(n => n === 'Шустрый побег').length, 1); assert.equal(g.filter(n => /^Тёмное зрение/.test(n)).length, 1);
  assert.equal(names('goblin', undefined).filter(n => n === 'Шустрый побег').length, 1);   // повтор раздела из другой книги отброшен
});
test('2014: derive отдаёт бонусы вида и скорость выбранной подрасы', () => {
  const d = run(14, { cls: 'fighter', lvl: 1, sp: 'elf', opt: 'Лесной эльф' });
  assert.deepEqual(d.raceAsi.fixed, { dex: 2, wis: 1 }); assert.equal(d.speed, 35);
  assert.equal(run(24, { cls: 'fighter', lvl: 1, sp: 'elf' }).raceAsi, null);
});
