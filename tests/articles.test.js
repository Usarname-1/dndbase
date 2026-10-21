/* Статьи 2014 («Правила и статьи»): длинные составные статьи разделены на части (tools/split_articles.py). */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
const A = read('data14/articles.json');

test('slug всех записей уникальны', () => {
  assert.equal(new Set(A.map(m => m.slug)).size, A.length);
});

test('части одной статьи согласованы: номера по порядку, список частей совпадает с записями', () => {
  const by = {};
  for (const m of A) if (m.parent) (by[m.parent] = by[m.parent] || []).push(m);
  assert.ok(Object.keys(by).length >= 30, 'ожидалось не меньше 30 разделённых статей');
  for (const [p, parts] of Object.entries(by)) {
    parts.sort((a, b) => a.part - b.part);
    assert.deepEqual(parts.map(x => x.part), parts.map((_, i) => i + 1), p);
    assert.deepEqual(parts[0].parts, parts.map(x => ({ slug: x.slug, name: x.name_ru })), p);
    for (const x of parts) {
      assert.deepEqual(x.parts, parts[0].parts, p); assert.equal(x.slug, `${p}--${x.part}`);
      assert.ok(x.blocks.length > 0 && x.parent_name, p);
    }
    assert.ok(parts.length >= 2, p);
  }
});

test('части не слишком длинные, а мелкие статьи остались целыми', () => {
  for (const m of A) assert.ok(JSON.stringify(m.blocks).length < 60000, `${m.slug}: часть слишком длинная`);
  assert.ok(A.some(m => !m.parent), 'короткие статьи должны остаться целыми');
});

test('ссылки-подсказки 2014 ведут на существующие записи глоссария и статей', () => {
  const g = new Set(read('data14/glossary.json').map(m => m.slug)), art = new Set(A.map(m => m.slug));
  for (const x of read('data14/links.json')) {
    if (x[2] === 'g') assert.ok(g.has(x[3]), 'глоссарий: ' + x[3]);
    if (x[2] === 'a') assert.ok(art.has(x[3]), 'статья: ' + x[3]);
  }
});

test('глоссарий 2014: записи с группой и текстом, slug уникальны; правила вынесены из статей', () => {
  const G = read('data14/glossary.json');
  assert.ok(G.length > 300);
  assert.equal(new Set(G.map(m => m.slug)).size, G.length);
  assert.ok(G.every(m => m.group && m.name_ru && m.blocks.length > 0 && m.section === 'glossary'));
  for (const s of ['sostoyaniya', 'actions', 'poisons', 'drugs-and-substances']) assert.ok(!A.some(m => (m.parent || m.slug) === s), s + ' должна уйти из статей');
  assert.deepEqual(['Вдыхаемый яд', 'Контактный яд', 'Оружейный яд', 'Поглощаемый яд'].filter(n => !G.some(m => m.name_ru === n)), []);
});

test('конкретные яды 2014 лежат в предметах', () => {
  const I = read('data14/items.json'), p = I.find(m => m.slug === 'wyvern-poison');
  assert.ok(p && p.name_ru === 'Яд виверны' && /^Яд/.test(p.type) && p.price === '1 200 зм');
  assert.ok(I.filter(m => /^Яд/.test(m.type)).length >= 18);
});
