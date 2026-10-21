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

test('ссылки-подсказки на статьи ведут на существующие записи', () => {
  const slugs = new Set(A.map(m => m.slug));
  for (const x of read('data14/links.json')) if (x[2] === 'a') assert.ok(slugs.has(x[3]), x[3]);
});
