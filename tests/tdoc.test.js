/* Проверки текста документа: разбор Delta редактора на абзацы и привязка перевода к исходному тексту (стили кусков переносятся на перевод).
   Запуск: node --test tests/*.test.js. Рисование на canvas здесь не проверяется — это делается в браузере. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const win = {}; win.window = win;
const ctx = vm.createContext(win);
for (const f of ['translator.js', 'tdoc.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const { TR, TDoc } = win;
const plain = x => JSON.parse(JSON.stringify(x));      // значения из vm-контекста имеют чужой Array.prototype, deepEqual их не примет

const flat = segs => segs.map(s => s.n.map(n => n.br ? '\n' : n.sp ? ' ' : n.set ? '[' + n.l + ']' : n.t).join('')).join('');
const parts = (mode, text, read) => plain(TR.segs(mode, text, read).map(s => [text.slice(s.a, s.b), flat([s])]));

test('segs: куски покрывают весь исходный текст подряд, без пропусков и наложений', () => {
  const text = 'Скрыть оружие и украсть золото!\nЁжик, Hello 123';
  for (const mode of Object.keys(TR.MODES)) {
    let pos = 0;
    for (const s of TR.segs(mode, text, false)) { assert.equal(s.a, pos, mode); assert.ok(s.b > s.a, mode); pos = s.b; }
    assert.equal(pos, text.length, mode);
  }
});

test('segs: перевод совпадает с TR.run (знаки алфавита и воровской жаргон)', () => {
  const text = 'Скрыть оружие и украсть золото, магический предмет! Привет\nмир';
  for (const mode of ['elf', 'dragon', 'infernal', 'dwarf', 'celestial', 'druidic', 'thief']) assert.equal(flat(TR.segs(mode, text, false)), TR.run(mode, text).text, mode);
});

test('segs: воровской жаргон меняет длину, но кусок остаётся привязан к фразе', () => {
  assert.deepEqual(parts('thief', 'Мы скрыть оружие и всё'), [['М', 'М'], ['ы', 'ы'], [' ', ' '], ['скрыть оружие', 'принаряжаемся ⌵'], [' ', ' '], ['и', 'и'], [' ', ' '], ['в', 'в'], ['с', 'с'], ['ё', 'ё']]);
});

test('segs: картинки-глифы — буква становится картинкой, пробел фиксированной ширины, прочие знаки остаются текстом', () => {
  const s = TR.segs('dragon-original', 'а, б\nв', false);
  assert.deepEqual(plain(s.map(x => x.n[0].set || (x.n[0].br ? 'br' : x.n[0].sp ? 'sp' : x.n[0].t))), ['dragon', ',', 'sp', 'dragon', 'br', 'dragon']);
  assert.equal(s[2].n[0].f, 1);
});

test('segs: глубинная речь — со read слова заменяются звучанием, без read остаются как есть', () => {
  assert.equal(flat(TR.segs('deep', 'да нет', true)).replace(/ /g, ''), TR.run('deep', 'да нет').read.replace(/^Звучание: /, '').replace(/ /g, ''));
  assert.equal(flat(TR.segs('deep', 'да нет', false)), 'да нет');
});

test('paragraphs: без delta каждая строка — абзац, завершающий перевод строки пустого абзаца не даёт', () => {
  const p = TDoc.paragraphs({ text: 'один\n\nтри\n' });
  assert.deepEqual(plain(p.map(x => x.text)), ['один', '', 'три']);
  assert.deepEqual(plain(TDoc.paragraphs({ text: '' }).map(x => x.text)), ['']);
});

test('paragraphs: Delta — куски с атрибутами, а атрибуты абзаца берутся с перевода строки', () => {
  const p = TDoc.paragraphs({ delta: [
    { insert: 'Указ' }, { insert: '\n', attributes: { header: 1 } },
    { insert: 'жирно', attributes: { bold: true } }, { insert: ' и ' }, { insert: 'красно', attributes: { color: '#8a1c12' } }, { insert: '\n' },
    { insert: 'пункт' }, { insert: '\n', attributes: { list: 'bullet' } }] });
  assert.deepEqual(plain(p.map(x => x.text)), ['Указ', 'жирно и красно', 'пункт']);
  assert.equal(p[0].blk.header, 1); assert.equal(p[2].blk.list, 'bullet'); assert.deepEqual(plain(p[1].blk), {});
  assert.deepEqual(plain(p[1].runs.map(r => [r.a, r.b, !!r.at.bold, r.at.color || null])), [[0, 5, true, null], [5, 8, false, null], [8, 14, false, '#8a1c12']]);
});

test('paragraphs: пустые абзацы сохраняются, мусорные операции пропускаются, длина ограничена 3000 знаков', () => {
  assert.deepEqual(plain(TDoc.paragraphs({ delta: [{ insert: 'а\n\nб\n' }, { insert: 5 }, null, { retain: 3 }] }).map(x => x.text)), ['а', '', 'б']);
  const long = TDoc.paragraphs({ delta: [{ insert: 'я'.repeat(5000) + '\n' }] });
  assert.equal(long.reduce((n, x) => n + x.text.length, 0), 3000);
});

test('normalize: испорченный delta отбрасывается, setPlain возвращает обычный текст', () => {
  const s = TDoc.normalize({ delta: 'не массив', text: 'т' });
  assert.equal(s.delta, undefined);
  const d = TDoc.setPlain({ delta: [{ insert: 'x\n' }], text: 'x' }, 'новый');
  assert.equal(d.text, 'новый'); assert.equal(d.delta, undefined);
});

test('styleOf: числовой размер — абсолютный (px листа / база), главнее заголовка; старые small/large/huge работают', () => {
  assert.equal(TDoc.styleOf({ size: '42px' }, 1, 0, 28).z, 1.5);
  assert.equal(TDoc.styleOf({ size: '42px' }, 1.7, 1, 28).z, 1.5);          // у заголовка явный размер важнее его кегля
  assert.equal(TDoc.styleOf({}, 1.7, 1, 28).z, 1.7);
  assert.equal(TDoc.styleOf({ size: '1px' }, 1, 0, 28).z, 8 / 28);          // слишком мелкий и слишком крупный размеры ограничены
  assert.equal(TDoc.styleOf({ size: '900' }, 1, 0, 28).z, 160 / 28);
  assert.equal(TDoc.styleOf({ size: 'large' }, 1, 0, 28).z, 1.4);
  assert.equal(TDoc.styleOf({ size: 'мусор' }, 1, 0, 28).z, 1);
});

test('чернила: ключ типа документа или любой цвет #rrggbb, normalize приводит значение к допустимому', () => {
  assert.equal(TDoc.inkOf('brown'), '#4a2c14');
  assert.equal(TDoc.inkOf('#1F7A4D'), '#1f7a4d');
  assert.equal(TDoc.inkOf('#abc'), '#aabbcc');
  assert.equal(TDoc.inkOf('rgb(10, 20, 30)'), '#0a141e');
  assert.equal(TDoc.inkOf('мусор'), '#1c1610');
  assert.equal(TDoc.normalize({ ink: '#ABC' }).ink, '#aabbcc');
  assert.equal(TDoc.normalize({ ink: 'blue' }).ink, 'blue');
  assert.equal(TDoc.normalize({ ink: 'мусор' }).ink, 'black');
});

test('заглавные: у знаков и картинок-глифов стоит признак cap, у звучания и жаргона — заглавная буква в начале слова', () => {
  const caps = (mode, text) => plain(TR.segs(mode, text, false).map(s => s.n.some(n => n.cap) ? 1 : 0)).join('');
  assert.equal(caps('elf', 'Привет Мир'), '1000000100');
  assert.equal(caps('elf', 'аБв'), '010');
  assert.equal(caps('dragon-original', 'аБв'), '010');
  assert.equal(caps('elf', 'абв'), '000');
  assert.equal(caps('elf', 'Hello'), '00000');                               // латиница не переводится — крупнее не становится
  assert.equal(TR.run('elf', 'аБ').parts[1].cap, 1);
  assert.equal(TR.run('elf', 'аб').parts[1].cap, undefined);
  assert.equal(TR.run('dragon-original', 'аБ').nodes[1].cap, 1);
  assert.match(TR.run('elf', 'Привет мир').read, /^Звучание: [A-Z][a-z]* [a-z]/);
  assert.match(TR.run('deep', 'Привет мир').read, /^Звучание: [A-Z][a-z]* [a-z]/);
  assert.equal(flat(TR.segs('deep', 'Да нет', true)).replace(/ /g, '')[0], flat(TR.segs('deep', 'Да нет', true))[0].toUpperCase());
  assert.equal(TR.run('thief', 'Скрыть оружие').text, 'Принаряжаемся ⌵');
  assert.equal(TR.run('thief', 'скрыть оружие').text, 'принаряжаемся ⌵');
});

test('регистр не теряется: латиница и знаки без перевода остаются как были', () => {
  assert.equal(TR.run('elf', 'Hello, World!').text, 'Hello, World!');
  assert.equal(flat(TR.segs('dwarf', 'Hello 5', false)), 'Hello 5');
});

test('лист: по умолчанию простой белый без рамки и печати, а типы документов остаются доступными', () => {
  const d = TDoc.defaults();
  assert.deepEqual(plain([d.paper, d.frame, d.seal, d.font, d.ink, d.align]), ['white', 'none', '', 'serif', 'black', 'left']);
  const dec = TDoc.applyKind(TDoc.defaults(), 'decree');
  assert.deepEqual(plain([dec.paper, dec.frame, dec.seal]), ['parchment', 'ornate', 'red']);
  assert.ok(Object.keys(TDoc.PAPERS).length >= 6);
});

test('отступы: пробелы и табы сохраняются в переводе, таб помечен признаком tab', () => {
  const kinds = (mode, text, read) => plain(TR.segs(mode, text, read).map(s => s.n.map(n => n.tab ? 'T' : n.sp ? 'S' : n.br ? 'N' : 'x').join('')).join(''));
  assert.equal(kinds('elf', '\tа  б', false), 'TxSSx');
  assert.equal(kinds('dragon-original', '\tа  б', false), 'TxSSx');
  assert.equal(kinds('dwarf', '  а\tб', false), 'SSxTx');
  assert.equal(kinds('thief', '\tа', false), 'Tx');
  assert.equal(kinds('deep', '  \tда  нет', true).replace(/x+/g, 'x'), 'SSTxSSx');          // у глубинной речи отступ в начале и пробелы между словами не пропадают
  assert.equal(TR.run('dragon-original', '\tа').nodes[0].tab, 1);
});
