/* Проверки поисковой оптимизации: метатеги, превью, иконки, sitemap.xml и robots.txt.
   Запуск: node --test tests/  (вместе с остальными проверками) */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const seo = require(path.join(root, 'tools', 'build_seo.js'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), cfg = seo.readConfig();
const meta = (attr, name) => { const m = html.match(new RegExp('<meta ' + attr + '="' + name + '" content="([^"]*)"')); return m && m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); };
const pngSize = f => { const b = fs.readFileSync(path.join(root, f)); assert.equal(b.slice(1, 4).toString(), 'PNG', f + ': не PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('SEO-файлы соответствуют tools/seo.config.json (если нет — запустите node tools/build_seo.js)', () => {
  const want = seo.build(cfg), stale = Object.keys(want).filter(f => read(f) !== want[f]);
  assert.deepEqual(stale, []);
});

test('заголовок и описание: есть и не длиннее, чем показывают поисковики', () => {
  const title = (html.match(/<title>([^<]*)<\/title>/g) || []);
  assert.equal(title.length, 1, 'должен быть один <title>');
  const text = title[0].replace(/<\/?title>/g, '').replace(/&amp;/g, '&');
  assert.ok(text.length >= 20 && text.length <= 70, 'заголовок ' + text.length + ' знаков: ' + text);
  const d = meta('name', 'description');
  assert.ok(d && d.length >= 70 && d.length <= 175, 'описание ' + (d && d.length) + ' знаков');
  assert.equal(meta('property', 'og:description'), d);
  assert.match(html, /<html lang="ru">/);
});

test('адрес сайта одинаков в canonical, og:url, разметке schema.org, sitemap.xml и robots.txt', () => {
  assert.match(html, new RegExp('<link rel="canonical" href="' + cfg.site.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '">'));
  assert.equal(meta('property', 'og:url'), cfg.site);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'WebSite'); assert.equal(ld.url, cfg.site); assert.equal(ld.inLanguage, 'ru');
  assert.ok(read('sitemap.xml').includes('<loc>' + cfg.site + '</loc>'));
  assert.ok(read('robots.txt').includes('Sitemap: ' + cfg.site + 'sitemap.xml'));
});

test('картинка для превью и иконки лежат в репозитории и нужного размера', () => {
  assert.deepEqual(pngSize(seo.TEXT.image.file), [seo.TEXT.image.width, seo.TEXT.image.height]);
  assert.equal(meta('property', 'og:image'), cfg.site + seo.TEXT.image.file);
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
  const ord = html.match(/ORDERS=\{24:\[([^\]]*)\],14:\[([^\]]*)\]\}/);
  assert.ok(ord, 'не нашёл список разделов ORDERS в index.html');
  const known = new Set((ord[1] + ',' + ord[2]).match(/'([a-z]+)'/g).map(s => s.replace(/'/g, '')).concat(['dmscreen', 'sheet']));
  const used = [...card[1].matchAll(/data-s="([a-z]+)"/g)].map(m => m[1]);
  assert.ok(used.length >= 8, 'во вводном тексте мало ссылок на разделы');
  assert.deepEqual(used.filter(k => !known.has(k)), []);
});
