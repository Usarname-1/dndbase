#!/usr/bin/env node
/* Собирает готовые страницы сайта, чтобы поисковики видели каждую запись отдельно:
     /spells/fireball/         — запись редакции 2024 (в 2014 — /14/spells/fireball/)
     /spells/                  — раздел со списком всех записей (ссылки на каждую)
     /, /14/                   — главные 2024 и 2014
     /dmscreen/, /sheet/, /translator/, /translator/doc/ (и то же под /14/) — инструменты
     /404.html                 — страница «не найдено»
   плюс sitemap.xml, robots.txt, home.js и .nojekyll.

   Страница — тот же каркас, что и раньше (tools/templates/shell.html), только с уже подставленной карточкой, названием и описанием.
   Карточки рисует тот же код (core.js), что и в браузере, поэтому после загрузки скриптов страница выглядит и работает как прежде,
   а переходы между страницами идут без перезагрузки (app.js).

   Запуск из корня репозитория:
     node tools/build_pages.js            — записать страницы
     node tools/build_pages.js --check    — только проверить, что страницы соответствуют данным и настройкам (код возврата 1, если нет)
   Запускать после правки data/*.json, data14/*.json, core.js, tools/seo.config.json или шаблонов в tools/templates/. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const seo = require('./build_seo.js');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// каталоги, которые целиком создаёт этот скрипт (перед записью очищаются, чтобы не оставались страницы удалённых записей)
const GENERATED_DIRS = ['14', 'bestiary', 'spells', 'class', 'species', 'race', 'backgrounds', 'feats', 'items', 'equipment', 'glossary', 'articles'];
const SLUG_OK = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function loadCore() {
  const ctx = vm.createContext({ console });
  vm.runInContext(read('core.js'), ctx, { filename: 'core.js' });
  const get = n => vm.runInContext(n, ctx);
  return { ctx, get, setEd: e => vm.runInContext(`ed=${e};SX=SXS[ed]`, ctx) };
}

const fmtN = n => n.toLocaleString('ru-RU');
const htmlText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Главная одной редакции: то же, что делают land() и homeLinks() в app.js, только заранее
function homeHTML(tpl, C, e, counts) {
  const { ORDERS, SWAP, EDK, hh } = C;
  let h = tpl;
  h = h.replace(/<a data-s="(\w+)" href="[^"]*">([\s\S]*?)<\/a>/g, (all, k, inner) => {
    let kk = k;
    if (!['dmscreen', 'sheet', 'translator'].includes(k)) { if (!ORDERS[e].includes(kk)) kk = SWAP[kk]; if (!ORDERS[e].includes(kk)) return inner; }
    return `<a data-s="${k}" href="${hh(e, kk)}">${inner}</a>`;
  });
  h = h.replace(/(<a href="[^"]*" data-e="(\d+)")>/g, (all, a, n) => `${a} aria-current="${+n === e}">`);
  const N = counts[e];
  h = h.replace(/<em data-n="(\w+)"><\/em>/g, (all, k) => { const n = N[e === 14 && k === 'species' ? 'race' : k]; return `<em data-n="${k}">${n == null ? '' : fmtN(n)}</em>`; });
  const tot = Object.values(N).reduce((a, c) => a + c, 0);
  h = h.replace('<p class="en" id="tocsub">Редакции 2014 и 2024</p>', `<p class="en" id="tocsub">Редакция ${EDK(e)}: ${fmtN(tot)} записей</p>`);
  if (e === 14) h = h.replace('class="runes"', 'class="runes f-elvish"');
  return h.trim();
}

function build() {
  const cfg = seo.readConfig(), site = cfg.site;
  const { ctx, get, setEd } = loadCore();
  const C = { ORDERS: get('ORDERS'), SWAP: get('SWAP'), EDK: get('EDK'), hh: get('hh') };
  const { ORDERS, hh, EDK } = C;
  const fns = Object.fromEntries(['pageCard', 'listItem', 'sortEntries', 'dupNames', 'navHTML', 'entryTitle', 'entryDesc', 'sectionTitle', 'sectionDesc', 'sectionCard', 'toolCard'].map(n => [n, get(n)]));
  const TOOLMETA = get('TOOLMETA'), SXS = get('SXS');
  const shell = read('tools/templates/shell.html'), homeTpl = read('tools/templates/home.html');
  const out = new Map();           // относительный путь → содержимое
  const urls = [];                 // адреса для sitemap.xml

  const fill = (o) => shell.replace('{{HEAD}}', () => o.head).replace('{{BODYCLASS}}', () => o.cls ? ` class="${o.cls}"` : '')
    .replace('{{NAV}}', () => o.nav).replace('{{LIST}}', () => o.list || '').replace('{{COUNT}}', () => o.count || '').replace('{{CARD}}', () => o.card);
  const cls = (...a) => a.filter(Boolean).join(' ');
  const abs = rel => site + rel.replace(/^\.\/$/, '');
  const put = (rel, html) => out.set(rel, html);
  const dirIndex = rel => (rel === './' ? '' : rel) + 'index.html';

  // данные и числа записей
  const data = {}, counts = {};
  for (const e of [24, 14]) {
    counts[e] = {};
    for (const k of ORDERS[e]) {
      const d = fns.sortEntries(JSON.parse(read((e === 14 ? 'data14/' : 'data/') + k + '.json')));
      data[e + k] = d; counts[e][k] = d.length;
    }
  }

  // --- home.js: разметка главной и заголовки для переходов между главными без перезагрузки
  const homeMeta = { 24: { title: seo.TEXT.title, description: seo.TEXT.description }, 14: seo.TEXT.home14 };
  put('home.js', `/* Создаётся tools/build_pages.js — руками не править. Разметка главной (из tools/templates/home.html) и заголовки главных страниц. */\nconst HOME=${JSON.stringify(homeTpl.trim())};\nconst HOMEMETA=${JSON.stringify(homeMeta)};\n`);

  for (const e of [24, 14]) {
    setEd(e);
    // --- главная
    const hrel = hh(e), hurl = abs(hrel);
    put(dirIndex(hrel), fill({
      head: seo.headBlock(cfg, { title: homeMeta[e].title, description: homeMeta[e].description, url: hurl, ogTitle: e === 24 ? seo.TEXT.ogTitle : homeMeta[e].title, ld: [seo.websiteLd(cfg)] }),
      cls: cls('land', 'open', e === 14 && 'e14'), nav: fns.navHTML(e, 'home'), card: homeHTML(homeTpl, C, e, counts)
    }));
    urls.push(hurl);

    // --- разделы и записи
    for (const k of ORDERS[e]) {
      const d = data[e + k], dups = fns.dupNames(d), n = d.length, srel = hh(e, k), surl = abs(srel), secName = SXS[e][k].t;
      const homeCrumb = ['Главная', abs(hh(e))];
      put(dirIndex(srel), fill({
        head: seo.headBlock(cfg, { title: fns.sectionTitle(e, k, n), description: fns.sectionDesc(e, k, n), url: surl, ld: [seo.breadcrumbLd([homeCrumb, [secName, surl]])] }),
        cls: cls(e === 14 && 'e14'), nav: fns.navHTML(e, k), list: d.map(m => fns.listItem(e, k, m)).join(''), count: `Найдено: ${n} из ${n}`, card: fns.sectionCard(e, k)
      }));
      urls.push(surl);
      for (const m of d) {
        if (!SLUG_OK.test(m.slug) || /^\.+$/.test(m.slug)) throw new Error(`${e}/${k}: недопустимый слаг «${m.slug}»`);
        const rel = hh(e, k, m.slug), url = abs(rel);
        let card;
        try { card = fns.pageCard(e, k, m); } catch (err) { console.warn(`! ${e}/${k}/${m.slug}: карточка не собралась (${err.message}), на странице будет только название`); card = `<article class="stat"><h1>${htmlText(m.name_ru)}</h1></article>`; }
        put(dirIndex(rel), fill({
          head: seo.headBlock(cfg, { title: fns.entryTitle(e, k, m, dups), description: fns.entryDesc(e, k, m), url, ld: [seo.breadcrumbLd([homeCrumb, [secName, surl], [m.name_ru, url]])] }),
          cls: cls('open', e === 14 && 'e14'), nav: fns.navHTML(e, k), card
        }));
        urls.push(url);
      }
    }

    // --- инструменты: у версии 2014 тот же текст, поэтому каноническим считается адрес без «14/»
    const toolCls = { dmscreen: 'dm', sheet: 'cs', translator: 'tr' };
    for (const t of ['dmscreen', 'sheet', 'translator', 'translator/doc']) {
      const [k, slug] = t.split('/'), rel = hh(e, k, slug), canon = abs(hh(24, k, slug));
      put(dirIndex(rel), fill({
        head: seo.headBlock(cfg, { title: TOOLMETA[t].t, description: TOOLMETA[t].d, url: canon, ld: [seo.breadcrumbLd([['Главная', abs(hh(24))], [TOOLMETA[k].h, abs(hh(24, k))]])] }),
        cls: cls(toolCls[k], 'open', e === 14 && 'e14'), nav: fns.navHTML(e, k), card: fns.toolCard(t === 'translator/doc' ? 'translator' : k)
      }));
      if (e === 24) urls.push(canon);
    }
  }

  // --- 404: GitHub Pages отдаёт её на любой несуществующий адрес; приложение само разберёт, что показать
  put('404.html', fill({
    head: seo.headBlock(cfg, { title: 'Страница не найдена — D&D 5e на русском', description: '', url: '', noindex: true }),
    cls: 'open', nav: fns.navHTML(24, ''), card: '<p class="empty">Такой страницы нет. <a href="./">На главную</a></p>'
  }));

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  put('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  put('robots.txt', seo.robotsTxt(cfg));
  put('.nojekyll', '');
  return out;
}

// удаляет и записывает; stale — что не совпало (для --check)
function sync(out, check) {
  const stale = [];
  const want = new Set(out.keys());
  // лишние страницы в каталогах, которые создаём мы
  const walk = (dir, rel) => {
    let ents; try { ents = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch (e) { return; }
    for (const ent of ents) {
      const r = rel + ent.name;
      if (ent.isDirectory()) walk(dir + '/' + ent.name, r + '/'); else if (!want.has(r)) { stale.push(r + ' (лишний)'); if (!check) fs.unlinkSync(path.join(ROOT, r)); }
    }
  };
  for (const d of GENERATED_DIRS) walk(d, d + '/');
  for (const [rel, text] of out) {
    const p = path.join(ROOT, rel);
    let now = null; try { now = fs.readFileSync(p, 'utf8'); } catch (e) { /* нет файла */ }
    if (now === text) continue;
    stale.push(rel);
    if (!check) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); }
  }
  if (!check) for (const d of GENERATED_DIRS) { // пустые каталоги после удаления лишнего
    const prune = dir => { let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; } for (const x of ents) if (x.isDirectory()) prune(path.join(dir, x.name)); if (dir !== ROOT && !fs.readdirSync(dir).length) fs.rmdirSync(dir); };
    prune(path.join(ROOT, d));
  }
  return stale;
}

function main() {
  const check = process.argv.includes('--check'), t0 = Date.now();
  const out = build(), stale = sync(out, check);
  if (check) {
    if (stale.length) { console.error(`Страницы не соответствуют данным или настройкам (${stale.length}): ${stale.slice(0, 8).join(', ')}${stale.length > 8 ? '…' : ''}. Запустите: node tools/build_pages.js`); process.exit(1); }
    console.log(`Страницы актуальны (${out.size} файлов).`);
  } else console.log(stale.length ? `Обновлено файлов: ${stale.length} из ${out.size} за ${((Date.now() - t0) / 1000).toFixed(1)} с` : 'Всё уже актуально.');
}

module.exports = { build, sync, main, GENERATED_DIRS };
if (require.main === module) main();
