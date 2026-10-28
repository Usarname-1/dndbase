/* Проверки поисковой оптимизации: у каждой записи, раздела и инструмента своя готовая страница с заголовком, описанием и адресом;
   sitemap.xml и robots.txt; метатеги главной, превью, иконки.
   Запуск: node --test tests/*.test.js. Если страницы устарели — node tools/build_pages.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.join(__dirname, '..');
const seo = require(path.join(root, 'tools', 'build_seo.js'));
const pages = require(path.join(root, 'tools', 'build_pages.js'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), cfg = seo.readConfig();
const meta = (h, attr, name) => { const m = h.match(new RegExp('<meta ' + attr + '="' + name + '" content="([^"]*)"')); return m && m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); };
const pngSize = f => { const b = fs.readFileSync(path.join(root, f)); assert.equal(b.slice(1, 4).toString(), 'PNG', f + ': не PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const core = (() => { const ctx = vm.createContext({}); vm.runInContext(read('core.js'), ctx); return n => vm.runInContext(n, ctx); })();
const decode = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const siteRel = u => u.slice(cfg.site.length);
const sitemapUrls = () => [...read('sitemap.xml').matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => decode(m[1]));
const fileOf = rel => (rel ? rel : '') + 'index.html';

test('страницы, sitemap.xml и robots.txt соответствуют данным и tools/seo.config.json (если нет — запустите node tools/build_pages.js)', () => {
  assert.deepEqual(pages.sync(pages.build(), true), []);
});

test('заголовок и описание главной: есть и не длиннее, чем показывают поисковики', () => {
  const title = (html.match(/<title>([^<]*)<\/title>/g) || []);
  assert.equal(title.length, 1, 'должен быть один <title>');
  const text = title[0].replace(/<\/?title>/g, '').replace(/&amp;/g, '&');
  assert.ok(text.length >= 20 && text.length <= 70, 'заголовок ' + text.length + ' знаков: ' + text);
  const d = meta(html, 'name', 'description');
  assert.ok(d && d.length >= 70 && d.length <= 175, 'описание ' + (d && d.length) + ' знаков');
  assert.equal(meta(html, 'property', 'og:description'), d);
  assert.match(html, /<html lang="ru">/);
});

test('адрес сайта одинаков в <base>, canonical, og:url, разметке schema.org, sitemap.xml и robots.txt', () => {
  assert.match(html, new RegExp('<link rel="canonical" href="' + cfg.site.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '">'));
  assert.equal(meta(html, 'property', 'og:url'), cfg.site);
  assert.ok(html.includes('<base href="/' + cfg.site.replace(/^https?:\/\/[^/]+\/?/, '') + '">'), 'в <head> нет <base> с путём сайта');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'WebSite'); assert.equal(ld.url, cfg.site); assert.equal(ld.inLanguage, 'ru');
  assert.ok(sitemapUrls().includes(cfg.site));
  assert.ok(read('robots.txt').includes('Sitemap: ' + cfg.site + 'sitemap.xml'));
});

test('картинка для превью и иконки лежат в репозитории и нужного размера', () => {
  assert.deepEqual(pngSize(seo.TEXT.image.file), [seo.TEXT.image.width, seo.TEXT.image.height]);
  assert.equal(meta(html, 'property', 'og:image'), cfg.site + seo.TEXT.image.file);
  assert.deepEqual(pngSize('apple-touch-icon.png'), [180, 180]);
  assert.ok(read('favicon.svg').includes('<svg'));
  const ico = fs.readFileSync(path.join(root, 'favicon.ico'));
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1], 'favicon.ico: не ICO');
  for (const href of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']) assert.ok(html.includes('href="' + href + '"'), 'в <head> нет ссылки на ' + href);
});

test('главная без JavaScript: один h1, вводный текст и ссылки только на существующие разделы', () => {
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, 'на странице должен быть один <h1>');
  const card = html.match(/<div id="card">([\s\S]*?)<\/article><\/div>/);
  assert.ok(card && /Dungeons &amp; Dragons/.test(card[1]) && /<h2>/.test(card[1]), 'во вводном тексте нет названия игры или заголовка');
  const ORDERS = core('ORDERS');
  const known = new Set([...ORDERS[24], ...ORDERS[14], 'dmscreen', 'sheet', 'translator']);
  const used = [...card[1].matchAll(/data-s="([a-z]+)"/g)].map(m => m[1]);
  assert.ok(used.length >= 8, 'во вводном тексте мало ссылок на разделы');
  assert.deepEqual(used.filter(k => !known.has(k)), []);
});

test('каждый адрес из sitemap.xml — готовая страница с одним h1, своим canonical, заголовком и описанием', () => {
  const urls = sitemapUrls();
  assert.ok(urls.length > 7800, 'в sitemap.xml мало адресов: ' + urls.length);
  assert.equal(new Set(urls).size, urls.length, 'в sitemap.xml есть повторы');
  const bad = [];
  for (const u of urls) {
    assert.ok(u.startsWith(cfg.site), u);
    const f = path.join(root, fileOf(siteRel(u)));
    if (!fs.existsSync(f)) { bad.push('нет файла: ' + u); continue; }
    const h = fs.readFileSync(f, 'utf8');
    const title = (h.match(/<title>([^<]+)<\/title>/) || [])[1], desc = meta(h, 'name', 'description');
    if ((h.match(/<h1[ >]/g) || []).length !== 1) bad.push('h1≠1: ' + u);
    if (!h.includes('<link rel="canonical" href="' + u.replace(/&/g, '&amp;') + '">') && !/Экран мастера|Листы персонажей|Переводчик/.test(title || '')) bad.push('canonical: ' + u);
    if (!title || title.length > 125) bad.push('заголовок: ' + u);
    if (!desc || desc.length < 70 || desc.length > 175) bad.push('описание: ' + u + ' (' + (desc && desc.length) + ')');
    if (/noindex/.test(h)) bad.push('noindex: ' + u);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('заголовки страниц записей не повторяются: версии из разных книг различаются источником', () => {
  const seen = new Map(), dup = [];
  for (const u of sitemapUrls()) {
    const rel = siteRel(u); if (!/\/[^/]+\/$/.test(rel) || /^(14\/)?[a-z]+\/$/.test(rel) || /^(dmscreen|sheet|translator)/.test(rel)) continue;
    const t = fs.readFileSync(path.join(root, fileOf(rel)), 'utf8').match(/<title>([^<]+)<\/title>/)[1];
    if (seen.has(t)) dup.push(t + ' — ' + seen.get(t) + ', ' + rel); else seen.set(t, rel);
  }
  // допускаем единичные совпадения, когда у двух версий и название, и книга одинаковые
  assert.ok(dup.length <= 12, dup.length + ' повторов, например: ' + dup.slice(0, 3).join(' | '));
});

test('404.html: не индексируется, а <base> и скрипты те же', () => {
  const h = read('404.html');
  assert.match(h, /<meta name="robots" content="noindex,follow">/);
  assert.ok(!h.includes('rel="canonical"'));
  assert.ok(h.includes('src="app.js"') && h.includes('<base href='));
});

test('старые ссылки вида #spells/fireball переводятся на новые адреса (скрипт в <head> каждой страницы)', () => {
  const m = html.match(/<script>(\(function\(h\)\{if\(!\/\^#[^<]*)<\/script>/);
  assert.ok(m, 'нет скрипта перенаправления');
  const run = hash => { let to = null; const ctx = vm.createContext({ location: { hash, replace: u => { to = u; } }, document: { querySelector: () => ({ href: 'https://x.test/dndbase/' }) } }); vm.runInContext(m[1], ctx); return to; };
  assert.equal(run('#spells/fireball'), 'https://x.test/dndbase/spells/fireball/');
  assert.equal(run('#14/bestiary/goblin'), 'https://x.test/dndbase/14/bestiary/goblin/');
  assert.equal(run('#14'), 'https://x.test/dndbase/14/');
  assert.equal(run('#24'), 'https://x.test/dndbase/');
  assert.equal(run('#translator/doc'), 'https://x.test/dndbase/translator/doc/');
  assert.equal(run(''), null);
  assert.equal(run('#:~:text=abc'), null, 'текстовые фрагменты браузера трогать нельзя');
});
