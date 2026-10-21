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
