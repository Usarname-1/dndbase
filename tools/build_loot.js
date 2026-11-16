#!/usr/bin/env node
/* Собирает data/loot.json — таблицы генератора лута для экрана мастера.
   Правила берутся из генератора лута 5etools (файл data/loot.json в репозитории 5etools-mirror-3/5etools-src):
   DMG 2014 (добыча с монстра, сокровищницы по ПО, таблицы магических предметов A–I, самоцветы и предметы искусства)
   и DMG 2024 (то же, плюс таблицы «по уровню» и «Арканум / Вооружение / Инструменты / Реликвии» по редкостям).
   Английские названия предметов сопоставляются с нашим справочником (data/items.json, data14/items.json) —
   результат хранит только русские названия и ссылки (slug), так что панель работает без загрузки справочников.

   Запуск из корня репозитория:  node tools/build_loot.js путь/к/5etools/data/loot.json
   Перезапускайте после изменения справочника предметов. Строки, которые не удалось сопоставить, печатаются и роняют сборку. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = process.argv[2];
if (!src) { console.error('Использование: node tools/build_loot.js путь/к/loot.json (из репозитория 5etools)'); process.exit(1); }
const L = JSON.parse(fs.readFileSync(src, 'utf8'));
const load = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8').normalize('NFC'));
const CAT = { 14: { items: load('data14/items.json'), eq: load('data14/equipment.json'), sp: load('data14/spells.json') },
              24: { items: load('data/items.json'), eq: load('data/equipment.json'), sp: load('data/spells.json') } };

const norm = s => String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
const lcs = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
const bad = new Set();                                          // названия, которые не удалось сопоставить

/* ---- редкость ---- */
const RK = { обычн: 'c', необыч: 'u', редк: 'r', очень: 'v', легенд: 'l', артеф: 'a' };
function rarKey(it) {
  const r = lcs(it && it.rarity); if (!r || r.startsWith('редкость')) return '';
  for (const k of Object.keys(RK)) if (r.startsWith(k)) return RK[k];
  return '';
}
const BONUS_R = { w: ['u', 'r', 'v'], a: ['r', 'v', 'l'] };     // +1/+2/+3: оружие, боеприпасы, палочки, жезлы, обмотки — необычное/редкое/очень редкое; доспехи и щиты — редкое/очень редкое/легендарное

/* ---- справочные словари ---- */
const DMG = { acid: 'кислота', cold: 'холод', fire: 'огонь', force: 'силовое поле', lightning: 'электричество', necrotic: 'некротическая энергия', poison: 'яд', psychic: 'психическая энергия', radiant: 'излучение', thunder: 'звук' };
const GIANT = { hill: ['холмового', 'u', 'r'], frost: ['ледяного', 'r', 'v'], stone: ['каменного', 'r', 'v'], fire: ['огненного', 'r', 'v'], cloud: ['облачного', 'v', 'l'], storm: ['штормового', 'l', 'l'] };   // [родительный падеж, редкость зелья, редкость пояса]
const HEAL = { greater: ['Зелье большого лечения', 'u'], superior: ['Зелье отличного лечения', 'r'], supreme: ['Зелье превосходного лечения', 'v'] };
const IOUN = { absorption: ['Поглощение', 'v'], agility: ['Проворство', 'v'], awareness: [{ 14: 'Восприятие', 24: 'Осведомлённость' }, 'r'], fortitude: ['Стойкость', 'v'], 'greater absorption': ['Большое поглощение', 'l'],
  insight: ['Проницательность', 'v'], intellect: ['Рассудок', 'v'], leadership: ['Лидерство', 'v'], mastery: [{ 14: 'Мастерство', 24: 'Искусность' }, 'l'], protection: ['Защита', 'r'], regeneration: ['Регенерация', 'l'],
  reserve: ['Резерв', 'r'], strength: ['Сила', 'v'], sustenance: ['Питание', 'r'] };
const HORN = { silver: ['серебряный', 'r'], brass: ['латунный', 'r'], bronze: ['бронзовый', 'v'], iron: ['железный', 'l'] };
const FIG = { 'bronze griffon': ['Бронзовый грифон', 'r'], 'ebony fly': ['Эбеновая муха', 'r'], 'golden lions': ['Золотые львы', 'r'], 'ivory goats': ['Костяные козлы', 'r'], 'marble elephant': ['Мраморный слон', 'r'],
  'obsidian steed': ['Обсидиановый скакун', 'v'], 'onyx dog': ['Ониксовая собака', 'r'], 'serpentine owl': ['Серпентиновая сова', 'r'], 'silver raven': ['Серебряный ворон', 'u'] };
const INSTR = { 'anstruth harp': ['Арфа Анструт', 'v'], 'canaith mandolin': ['Мандолина Канаит', 'r'], 'cli lyre': ['Лира Кли', 'r'], 'doss lute': ['Лютня Досс', 'u'], 'fochlucan bandore': ['Бандура Фоклучан', 'u'],
  'mac-fuirmidh cittern': ['Цитра Мак-Фурмид', 'u'], 'ollamh harp': ['Арфа Оллав', 'l'] };
const BAG = { gray: ['серая', 'u'], rust: ['рыжая', 'u'], tan: ['бежевая', 'u'] };
const QUAAL = { anchor: ['Якорь', 'u'], bird: ['Птица', 'r'], fan: ['Веер', 'u'], 'swan boat': ['Лодка-лебедь', 'r'], tree: ['Дерево', 'u'], whip: ['Кнут', 'r'] };
const GOLEM = { clay: 'глиняным', flesh: 'мясным', iron: 'железным', stone: 'каменным' };
const ELEM = { air: 'Воздух', earth: 'Земля', fire: 'Огонь', water: 'Вода' };
const DRAGON = ['чёрный', 'синий', 'латунный', 'бронзовый', 'медный', 'золотой', 'зелёный', 'красный', 'серебряный', 'белый'].map(c => c + ' дракон');
const CARPET = ['3 × 5 футов', '4 × 6 футов', '5 × 7 футов', '6 × 9 футов'];
const ARTRU = {   // предметы искусства DMG 2014, которых нет в справочнике 2024
  'Small gold bracelet': 'Небольшой золотой браслет', 'Small mirror set in a painted wooden frame': 'Небольшое зеркало в раскрашенной деревянной раме',
  'Large gold bracelet': 'Большой золотой браслет', 'Silk robe with gold embroidery': 'Шёлковая мантия с золотой вышивкой', 'Large well-made tapestry': 'Большой искусно сотканный гобелен',
  'Gold bird cage with electrum filigree': 'Золотая птичья клетка с филигранью из электрума', 'Silver-plated steel longsword with jet set in hilt': 'Посеребрённый стальной длинный меч с гагатом на рукояти',
  'Carved harp of exotic wood with ivory inlay and zircon gems': 'Резная арфа из экзотического дерева с инкрустацией из слоновой кости и цирконами', 'Small gold idol': 'Небольшой золотой идол',
  'Gold dragon comb set with red garnets as eyes': 'Золотой гребень-дракон с глазами из красных гранатов', 'Ceremonial electrum dagger with a black pearl in the pommel': 'Церемониальный кинжал из электрума с чёрной жемчужиной в навершии',
  'Platinum bracelet set with a sapphire': 'Платиновый браслет с сапфиром', 'Eye patch with a mock eye set in blue sapphire and moonstone': 'Повязка на глаз с фальшивым глазом из синего сапфира и лунного камня',
  'Small gold statuette set with rubies': 'Небольшая золотая статуэтка с рубинами', "Painted gold child's sarcophagus": 'Раскрашенный золотой детский саркофаг', 'Jade game board with solid gold playing pieces': 'Нефритовая игровая доска с фигурами из чистого золота',
  'A necklace string of small pink pearls': 'Ожерелье из нанизанных мелких розовых жемчужин' };

/* ---- каталоги ---- */
const idx = { 14: new Map(), 24: new Map() }, eqIdx = { 14: new Map(), 24: new Map() };
for (const e of [14, 24]) {
  for (const x of CAT[e].items) if (x.name_en) idx[e].set(norm(x.name_en), x);
  for (const x of CAT[e].eq) if (x.name_en) eqIdx[e].set(norm(x.name_en), x);
}
const bySlug = (e, slug) => CAT[e].items.find(x => x.slug === slug);
const ARMOR_LINES = ['Лёгкий доспех', 'Средний доспех', 'Тяжёлый доспех'];
function eqList(e) {
  const q = CAT[e].eq, nm = x => [x.slug, x.name_ru];
  const w = q.filter(x => /^(простое|воинское)/i.test(x.line || '') && !/современн/i.test(x.line)).map(nm);
  const a = q.filter(x => ARMOR_LINES.some(l => lcs(x.line) === lcs(l))).map(nm);
  const s = q.filter(x => x.line === 'Щит').map(nm);
  const am = q.filter(x => x.line === 'Боеприпас').map(nm);
  return { w, a, s, am };
}
const EQ = { 14: eqList(14), 24: eqList(24) };
const armorSlug = (e, name) => { const x = eqIdx[e].get(norm(name)); return x && ARMOR_LINES.some(l => lcs(x.line) === lcs(l)) ? x : null; };

/* ---- словарь предметов, попадающих в результат ---- */
const IT = {};                                                   // "ed/slug" → [название, редкость, настройка, цена]
function use(e, it) {
  const k = e + '/' + it.slug;
  if (!IT[k]) IT[k] = [it.name_ru, rarKey(it), /требуется настройка/i.test(it.attunement || '') ? 1 : 0, it.price || ''];   // в поле attunement справочника бывает и редкость («+1 необычный, …»), поэтому ищем именно «требуется настройка»
  return k;
}
const pickEd = (name, ed) => {
  const n = norm(name);
  if (idx[ed].has(n)) return [ed, idx[ed].get(n)];
  const o = ed === 14 ? 24 : 14;
  if (idx[o].has(n)) return [o, idx[o].get(n)];
  return null;
};
const baseRef = (ed, slug, extra) => {                           // ссылка на предмет-основу по slug (в своей редакции, иначе в другой)
  for (const e of [ed, ed === 14 ? 24 : 14]) { const it = bySlug(e, slug); if (it) return Object.assign({ i: use(e, it) }, extra); }
  throw new Error('нет предмета ' + slug);
};
const nameOf = ref => IT[ref.i][0];
const lvName = n => n === 0 ? 'заговор' : n + ' ур.';

/* ---- сопоставление названия 5etools с нашим предметом ---- */
const FIXR = { 'potion of healing': 'c', 'crystal ball': 'l' };   // в справочнике у этих предметов редкость «варьируется»
const clean = s => String(s).replace(/\{@item ([^|}]*)(?:\|[^}]*)?\}.*/, '$1').replace(/\|.*$/, '').trim();
function resolveName(raw, ed) {
  const name = clean(raw), n = norm(name);
  let m;
  const hit = pickEd(name, ed);
  if (hit) { const r = { i: use(hit[0], hit[1]) }; if (!rarKey(hit[1]) && FIXR[n]) r.r = FIXR[n]; return r; }
  // свиток заклинания
  if ((m = /^spell scroll \((cantrip|(?:level )?(\d)(?:st|nd|rd|th)?(?: level)?)\)$/i.exec(name))) return scrollRef(ed, /cantrip/i.test(m[1]) ? 0 : +m[2]);
  // заговорённое оружие, доспех, посох
  if ((m = /^enspelled (weapon|armor|staff) \((cantrip|level (\d))\)$/i.exec(name))) {
    const base = baseRef(ed, 'enspelled-' + m[1].toLowerCase()), lv = /cantrip/i.test(m[2]) ? 0 : +m[3];
    return Object.assign(base, { n: nameOf(base) + ' (' + lvName(lv) + ')' });
  }
  // +N к оружию, боеприпасам, доспехам, щитам, палочкам, жезлам, обмоткам
  if ((m = /^\+(\d) (.+)$/.exec(name))) {
    const b = +m[1], what = norm(m[2]), P = ed === 14 ? '-1-2-3' : '-1-2-or-3', bonus = ' +' + b;
    const gen = (slug, o) => { const r = baseRef(ed, slug, Object.assign({ b }, o)); r.r = (o.w === 'a' || o.w === 's' ? BONUS_R.a : BONUS_R.w)[b - 1]; return r; };
    if (what === 'weapon') return gen('weapon' + P, { w: 'w' });
    if (what === 'ammunition') return gen('ammunition' + P, { w: 'am' });
    if (what === 'armor') return gen('armor' + P, { w: 'a' });
    if (what === 'shield') return gen('shield' + P, { w: 's' });
    const fixed = (slug, ruName, kind) => { const r = baseRef(ed, slug, { b }); r.n = ruName + bonus; r.r = BONUS_R[kind][b - 1]; return r; };
    if (what === 'wand of the war mage') return fixed('wand-of-the-war-mage' + P, 'Волшебная палочка боевого мага', 'w');
    if (what === 'rod of the pact keeper') return fixed('rod-of-the-pact-keeper', 'Жезл хранителя договора', 'w');
    if (what === 'wraps of unarmed power') return fixed('wraps-of-unarmed-power', 'Обмотки безоружной мощи', 'w');
    const ar = armorSlug(ed, what);
    if (ar) { const r = baseRef(ed, 'armor' + P, { b, a: ar.slug }); r.n = ar.name_ru + bonus; r.r = BONUS_R.a[b - 1]; return r; }
  }
  // доспех сопротивления: «Chain Mail of Acid Resistance»
  if ((m = /^(.+) of (acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder) resistance$/i.exec(name))) {
    const ar = armorSlug(ed, m[1]); if (ar) return baseRef(ed, 'armor-of-resistance', { a: ar.slug, d: m[2].toLowerCase(), n: 'Доспех сопротивления: ' + ar.name_ru.toLowerCase() + ' ({d})', r: 'r' });
  }
  if ((m = /^adamantine (.+)$/i.exec(name))) {
    const ar = armorSlug(ed, m[1]); if (ar) return baseRef(ed, 'adamantine-armor', { a: ar.slug, n: 'Адамантиновый доспех: ' + ar.name_ru.toLowerCase(), r: 'u' });
  }
  if ((m = /^(belt|potion) of (hill|frost|stone|fire|cloud|storm) giant strength$/i.exec(name))) {
    const g = GIANT[m[2].toLowerCase()], belt = /belt/i.test(m[1]);
    return baseRef(ed, belt ? 'belt-of-giant-strength' : 'potion-of-giant-strength', { n: (belt ? 'Пояс' : 'Зелье') + ' силы ' + g[0] + ' великана', r: belt ? g[2] : g[1] });
  }
  if ((m = /^potion of (greater|superior|supreme) healing$/i.exec(name))) { const h = HEAL[m[1].toLowerCase()]; return baseRef(ed, 'potion-of-healing', { n: h[0], r: h[1] }); }
  if ((m = /^manual of (clay|flesh|iron|stone) golems$/i.exec(name))) return baseRef(ed, 'manual-of-golems', { n: 'Справочник по ' + GOLEM[m[1].toLowerCase()] + ' големам', r: 'v' });
  if ((m = /^ring of (air|earth|fire|water) elemental command$/i.exec(name)) || (m = /^ring of elemental command \((air|earth|fire|water)\)$/i.exec(name)))
    return baseRef(ed, 'ring-of-elemental-command', { n: 'Кольцо командования элементалями (' + ELEM[m[1].toLowerCase()].toLowerCase() + ')', r: 'l' });
  // «Предмет, вариант»
  if ((m = /^(ioun stone|horn of valhalla|figurine of wondrous power|instrument of the bards|bag of tricks|quaal's feather token), (.+)$/i.exec(name))) {
    const base = norm(m[1]), v = norm(m[2]), t = { 'ioun stone': IOUN, 'horn of valhalla': HORN, 'figurine of wondrous power': FIG, 'instrument of the bards': INSTR, 'bag of tricks': BAG, "quaal's feather token": QUAAL }[base][v];
    if (!t) return null;
    const lab = typeof t[0] === 'object' ? t[0][ed] : t[0], slug = base.replace(/ /g, '-').replace(/'/g, '');
    const it = pickEd(m[1], ed)[1], r = Object.assign({ i: use(pickEd(m[1], ed)[0], it) });
    r.n = it.name_ru + ' (' + lab + ')'; r.r = t[1]; return r;
  }
  return null;
}
function scrollRef(ed, lv) {
  const r = baseRef(ed, 'spell-scroll', { sc: lv });
  r.n = nameOf(r) + ' (' + lvName(lv) + ')'; r.r = ['c', 'c', 'u', 'u', 'r', 'r', 'v', 'v', 'v', 'l'][lv]; return r;
}

/* ---- «по группе» из 5etools ---- */
function groupRef(name, ed) {
  const n = norm(clean(name));
  if (n === 'potion of resistance') return baseRef(ed, 'potion-of-resistance', { d: '*', n: 'Зелье сопротивления ({d})', r: 'u' });
  if (n === 'armor of vulnerability') return baseRef(ed, 'armor-of-vulnerability', { v: ['дробящий урон', 'колющий урон', 'рубящий урон'], n: 'Доспех уязвимости ({v})', r: 'r' });
  if (n === 'carpet of flying') return baseRef(ed, 'carpet-of-flying', { v: CARPET, n: 'Ковёр-самолёт ({v})', r: 'v' });
  if (n === 'dragon scale mail') return baseRef(ed, 'dragon-scale-mail', { v: DRAGON, n: 'Доспех из драконьей чешуи ({v})', r: 'v' });
  if (n === 'manual of golems') return { any: ['clay', 'flesh', 'iron', 'stone'].map(g => resolveName('Manual of ' + g + ' Golems', ed)) };
  const hit = pickEd(clean(name), ed); return hit ? { i: use(hit[0], hit[1]) } : null;
}

/* ---- строка таблицы магических предметов ---- */
const RAR_KEY = { common: 'c', uncommon: 'u', rare: 'r', 'very rare': 'v', legendary: 'l' };
function oneOf(list) { const u = []; for (const r of list) if (!u.some(x => JSON.stringify(x) === JSON.stringify(r))) u.push(r); return u.length === 1 ? u[0] : { any: u }; }
function need(ref, raw, ed) { if (!ref) { bad.add(ed + ' ' + raw); return { x: raw }; } return ref; }
function rowRef(row, ed) {
  if (row.table) return { sub: row.table.map(s => [s.min, s.max || s.min, need(resolveName(s.item, ed), s.item, ed)]) };
  if (row.choose) {
    const c = row.choose;
    if (c.fromMatching) { const k = Object.keys(c.fromMatching); if (k.length !== 1 || k[0] !== 'rarity') throw new Error('fromMatching: ' + JSON.stringify(c)); return { rar: RAR_KEY[c.fromMatching.rarity] }; }
    if (c.fromGroup) return oneOf(c.fromGroup.map(g => need(groupRef(g, ed), g, ed)));
    if (c.fromGeneric) return oneOf(c.fromGeneric.map(g => need(resolveName(g, ed) || groupRef(g, ed), g, ed)));
    if (c.fromItems) {                                              // десять вариантов одного доспеха сопротивления — одна запись с выбором вида урона
      const refs = c.fromItems.map(g => need(resolveName(g, ed), g, ed));
      if (refs.every(r => r.d && r.a === refs[0].a)) return Object.assign({}, refs[0], { d: '*' });
      return oneOf(refs);
    }
    throw new Error('choose: ' + JSON.stringify(c));
  }
  if (row.spellLevel != null) return scrollRef(ed, row.spellLevel);
  return need(resolveName(row.item, ed), row.item, ed);
}
function buildTable(t, ed, key) {
  const rarFromKey = (key.split('.')[1] || '').replace(/^./, c => c);
  const rows = t.table.map(r => [r.min, r.max || r.min, rowRef(r, ed)]);
  const rk = RAR_KEY[rarFromKey];                                 // в таблицах 2024 «категория.редкость» редкость известна из самой таблицы
  if (rk) rows.forEach(r => fillRar(r[2], rk));
  return rows;
}
function fillRar(ref, rk) { if (ref.any) ref.any.forEach(x => fillRar(x, rk)); else if (ref.sub) ref.sub.forEach(s => fillRar(s[2], rk)); else if (!ref.r && ref.i && !IT[ref.i][1]) ref.r = rk; }

/* ---- самоцветы и предметы искусства ---- */
const GA = {};                                                   // имя → [русское название, slug в справочнике снаряжения 2024]
function gaRef(raw) {
  const name = clean(raw), x = eqIdx[24].get(norm(name));
  if (x) return [x.name_ru, x.slug];
  if (ARTRU[name]) return [ARTRU[name], ''];
  bad.add('gem/art ' + name); return [name, ''];
}

/* ---- дроби и кубики ---- */
const diceRe = /^(\d+)d(\d+)(?:([*+-])(\d+))?$/;
const dd = s => { if (!diceRe.test(String(s)) && !/^\d+$/.test(String(s))) throw new Error('формула кубиков: ' + s); return String(s); };

const out = { v: 1, ind: { 14: [], 24: [] }, hoard: { 14: [], 24: [] }, tab: { 14: {}, 24: {} }, gem: { 14: {}, 24: {} }, art: { 14: {}, 24: {} }, it: IT, sc: { 14: {}, 24: {} }, eq: EQ, rp: {}, dmg: DMG };
const edOf = s => s === 'DMG' ? 14 : 24;
const cr = o => [o.crMin, o.crMax];
const coinsOf = c => { const r = {}; for (const k of Object.keys(c)) r[k] = dd(c[k]); return r; };

for (const o of L.individual) out.ind[edOf(o.source)].push({ cr: cr(o), t: o.table.map(r => [r.min, r.max || r.min, coinsOf(r.coins)]) });
for (const o of L.hoard) {
  const e = edOf(o.source), h = { cr: cr(o), c: coinsOf(o.coins), t: [] };
  for (const r of o.table) {
    const row = {};
    if (r.gems) row.g = [r.gems.type, dd(r.gems.amount)];
    if (r.artObjects) row.a = [r.artObjects.type, dd(r.artObjects.amount)];
    if (r.magicItems) row.m = r.magicItems.map(m => [m.type, dd(m.amount)]);
    h.t.push([r.min, r.max || r.min, row]);
  }
  out.hoard[e].push(h);
}
for (const t of L.magicItems) out.tab[edOf(t.source)][t.type] = buildTable(t, edOf(t.source), t.type);
for (const [k, key] of [['gems', 'gem'], ['artObjects', 'art']])
  for (const t of L[k]) out[key][edOf(t.source)][t.type] = t.table.map(gaRef);
// случайный выбор по редкости («Предмет по уровню»): все предметы справочника 2024 нужной редкости, кроме предметов с меняющейся редкостью и артефактов
for (const rk of ['c', 'u', 'r', 'v', 'l']) out.rp[rk] = CAT[24].items.filter(x => rarKey(x) === rk).map(x => use(24, x));
// заклинания по уровням (для свитков)
for (const e of [14, 24]) for (const s of CAT[e].sp) (out.sc[e][s.level] = out.sc[e][s.level] || []).push([s.slug, s.name_ru]);

if (bad.size) { console.error('Не сопоставлено (' + bad.size + '):\n' + [...bad].join('\n')); process.exit(2); }
const file = path.join(ROOT, 'data', 'loot.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log('data/loot.json: ' + (fs.statSync(file).size / 1024).toFixed(0) + ' КБ, предметов: ' + Object.keys(IT).length);
