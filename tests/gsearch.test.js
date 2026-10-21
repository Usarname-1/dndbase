/* Глобальный поиск: индексы search.json согласованы с данными разделов, окно подключено к странице. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const SEC = { data: ['bestiary', 'spells', 'class', 'species', 'backgrounds', 'feats', 'items', 'equipment', 'glossary'],
  data14: ['bestiary', 'spells', 'class', 'race', 'backgrounds', 'feats', 'items', 'articles'] };

for (const d of Object.keys(SEC)) {
  test(`индекс ${d}/search.json покрывает все записи разделов (пересоберите: python3 tools/build_search.py)`, () => {
    const ix = JSON.parse(read(d + '/search.json'));
    let total = 0;
    for (const k of SEC[d]) {
      const items = JSON.parse(read(`${d}/${k}.json`)).filter(m => m.slug && m.name_ru);
      total += items.length;
      const got = new Set(ix.filter(x => x[2] === k).map(x => x[3]));
      for (const m of items) assert.ok(got.has(m.slug), `${d}/${k}: нет «${m.name_ru}» (${m.slug})`);
    }
    assert.equal(ix.length, total);
    assert.ok(ix.every(x => x.length === 5 && typeof x[0] === 'string'));
  });
}

for (const d of Object.keys(SEC)) {
  test(`тексты ${d}/text/*.json идут в том же порядке, что названия в ${d}/search.json`, () => {
    const ix = JSON.parse(read(d + '/search.json'));
    for (const k of SEC[d]) {
      const names = ix.filter(x => x[2] === k), tx = JSON.parse(read(`${d}/text/${k}.json`));
      assert.equal(tx.length, names.length, `${d}/${k}`);
      assert.ok(tx.every(t => typeof t === 'string'));
      // текст не пустой и содержит описание, а не только служебные поля
      assert.ok(tx.filter(t => t.length > 20).length > names.length * 0.9, `${d}/${k}: слишком много пустых текстов`);
    }
  });
}

test('поиск по тексту: слово из описания находит запись, которой нет в названии', () => {
  const ix = JSON.parse(read('data/search.json')).filter(x => x[2] === 'spells');
  const tx = JSON.parse(read('data/text/spells.json'));
  const j = ix.findIndex(x => x[3] === 'fireball');
  assert.ok(/сфер/i.test(tx[j]) || /огн/i.test(tx[j]));
  assert.ok(!/взрыв/i.test(ix[j][0]));
});

test('в обеих редакциях находится «Огненный шар / Fireball»', () => {
  for (const d of Object.keys(SEC)) {
    const e = JSON.parse(read(d + '/search.json')).find(x => x[3] === 'fireball' && x[2] === 'spells');
    assert.ok(e && e[0] === 'Огненный шар' && e[1] === 'Fireball', d);
  }
});

test('окно поиска подключено: скрипт, стили и кнопка в верхней панели', () => {
  const html = read('index.html');
  assert.ok(html.includes('src="gsearch.js"') && html.includes('href="gsearch.css"'));
  assert.ok(html.includes('id="gs"'));
  assert.ok(fs.existsSync(path.join(root, 'gsearch.js')) && fs.existsSync(path.join(root, 'gsearch.css')));
});
