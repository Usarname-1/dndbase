/* Список раздела и фильтры (app.js: filters()/render()). Сама перерисовка завязана на DOM и проверена в браузере;
   здесь — допущения данных, на которых держится подсчёт значений фильтров без Set на каждую запись:
   каждый фильтр каждого раздела возвращает массив (или ничего), а app.js убирает из него повторы один раз при загрузке. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8'), ctx);
const SXS = vm.runInContext('SXS', ctx);

test('каждый фильтр каждого раздела возвращает массив значений (или пусто) для всех записей', () => {
  let checked = 0;
  for (const e of [14, 24]) for (const [k, c] of Object.entries(SXS[e])) {
    const file = path.join(root, e == 14 ? 'data14' : 'data', k + '.json');
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    c.F.forEach(([name, f], i) => {
      for (const m of data) {
        let v; try { v = f(m); } catch (x) { continue; }   // app.js ловит исключения фильтра и подставляет []
        assert.ok(v == null || Array.isArray(v), `${e}/${k}, фильтр «${name}», запись ${m.slug}: ожидался массив, получено ${typeof v}`);
        checked++;
      }
    });
  }
  assert.ok(checked > 50000, 'проверено подозрительно мало значений (пропущены файлы данных?): ' + checked);
});

test('app.js: дедупликация значений фильтров и подсчёт без Set на запись, поиск с debounce, список порциями', () => {
  const s = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.ok(/Array\.isArray\(v\)&&v\.length>1\?\[\.\.\.new Set\(v\)\]:v/.test(s), 'значения фильтров должны дедуплицироваться при загрузке раздела');
  assert.ok(!/new Set\(V\[k\]\[i\]\)/.test(s), 'подсчёт не должен создавать Set на каждую запись при каждой перерисовке');
  assert.ok(/addEventListener\('input',\(\)=>\{clearTimeout\(rT\);rT=setTimeout\(render,\d+\)\}\)/.test(s), 'поле поиска должно перерисовывать с задержкой');
  assert.ok(/addEventListener\('search'/.test(s), 'Enter и крестик в поле поиска должны перерисовывать сразу');
  assert.ok(/\$\('#list'\)\.innerHTML='';shown=0;paint\(CHUNK\)/.test(s) && !/\$\('#list'\)\.innerHTML=view\.map/.test(s), 'список должен рисоваться порциями, а не целиком');
  assert.ok(/showRow\(slug\)/.test(s), 'запись, открытая по адресу, должна догружаться в список');
});
