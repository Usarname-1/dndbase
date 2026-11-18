/* Ленивая загрузка инструментов: экран мастера, листы персонажей и переводчик подгружаются из app.js (need()),
   а не стоят на каждой странице. Тесты защищают два инварианта:
   1) шаблон и собранные страницы не подключают модули инструментов заранее (иначе вернётся лишние ~400 КБ JS на каждую карточку);
   2) всё, что регистрирует тип панели экрана мастера, входит в группу dm — иначе сохранённые панели будут молча удалены (normalize). */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');

const LAZY = new Function('return ' + read('app.js').match(/const LAZY=(\{.*?\});\n/s)[1])();
const lazyFiles = Object.values(LAZY).flatMap(g => [...(g.js || []), ...(g.css || [])]);

test('все файлы ленивых групп существуют, группы ссылаются только на известные группы', () => {
  assert.ok(lazyFiles.length >= 8);
  for (const f of lazyFiles) assert.ok(fs.existsSync(path.join(root, f)), 'нет файла ' + f);
  for (const g of Object.values(LAZY)) if (g.need) assert.ok(LAZY[g.need], 'неизвестная группа ' + g.need);
});

test('шаблон страниц и собранные страницы не подключают ленивые модули; скрипты ядра с defer', () => {
  for (const f of ['tools/templates/shell.html', 'index.html', '404.html', 'bestiary/aboleth/index.html', 'dmscreen/index.html', 'sheet/index.html', 'translator/index.html']) {
    const html = read(f);
    for (const lz of lazyFiles) assert.ok(!html.includes(`"${lz}"`), `${f} подключает ${lz} заранее`);
    for (const tag of html.match(/<script src="[^"]+"[^>]*>/g) || []) assert.ok(/\sdefer>/.test(tag), `${f}: без defer ${tag}`);
  }
});

test('каждый файл, регистрирующий тип панели экрана мастера, грузится в группе dm (иначе нормализация удалит сохранённые панели)', () => {
  const regs = fs.readdirSync(root).filter(f => f.endsWith('.js') && f !== 'dmscreen.js' && /DM\.registerType\(/.test(read(f)));
  assert.ok(regs.includes('dmpanels.js') && regs.includes('tdoc.js'));
  for (const f of regs) assert.ok(LAZY.dm.js.includes(f), `${f} регистрирует панели, но не входит в группу dm`);
  const ds = read('dmscreen.js');
  assert.ok(/DM_READY\(\)/.test(ds) && /throw new Error\('панели экрана мастера/.test(ds), 'ensure() должен отказывать, пока панели не загружены');
});

test('инструменты не нужны для карточек: ядро не обращается к ним при загрузке', () => {
  for (const f of ['core.js', 'home.js', 'links.js', 'dice.js', 'gsearch.js'])
    assert.ok(!/\b(TR|TDoc|CS|CSP|CharRules)\./.test(read(f)), `${f} использует ленивый модуль напрямую`);
});
