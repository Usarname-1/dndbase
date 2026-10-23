/* Проверки статических страниц (tools/build_static.js): у каждой записи есть страница, sitemap.xml их перечисляет,
   у страниц есть заголовок, описание, canonical, h1 и рабочие внутренние ссылки.
   Если не проходит — node tools/build_static.js (нужен npm install). */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const seo = require(path.join(root, 'tools', 'build_seo.js'));
const { EDS, urlSlug } = require(path.join(root, 'tools', 'build_static.js'));
const cfg = seo.readConfig();
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const inMap = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&')));

test('у каждой записи обеих редакций есть страница и адрес в sitemap.xml', () => {
  const missing = [];
  for (const e of [24, 14]) for (const k of EDS[e].keys) for (const m of rd(`${EDS[e].data}/${k}.json`)) {
    const rel = `${EDS[e].dir}/${k}/${urlSlug(m.slug)}/`;
    if (!fs.existsSync(path.join(root, rel, 'index.html')) || !inMap.has(cfg.site + rel)) missing.push(rel);
  }
  assert.deepEqual(missing.slice(0, 10), []);
});

test('в sitemap.xml нет адресов без файла, нет повторов, адрес главной на месте', () => {
  assert.ok(inMap.has(cfg.site));
  const list = [...sitemap.matchAll(/<loc>/g)];
  assert.equal(list.length, inMap.size, 'повторы в sitemap.xml');
  const gone = [...inMap].filter(u => u !== cfg.site && !fs.existsSync(path.join(root, u.slice(cfg.site.length), 'index.html')));
  assert.deepEqual(gone.slice(0, 10), []);
});

test('страницы записей: title ≤ 70 знаков, описание, canonical на свой адрес, один h1, ссылка в приложение', () => {
  const sample = [['14', 'spells', 'fireball'], ['14', 'bestiary', 'adult-red-dragon'], ['24', 'class', 'wizard'], ['14', 'glossary', 'ispugannyj'], ['14', 'equipment', 'chain-mail'], ['24', 'glossary', 'npc']];
  for (const [e, k, s] of sample) {
    const rel = `${e == 14 ? '2014' : '2024'}/${k}/${s}/`, html = fs.readFileSync(path.join(root, rel, 'index.html'), 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    assert.ok(title.length >= 15 && title.length <= 70, rel + ': title ' + title.length);
    const d = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(d.length >= 60 && d.length <= 175, rel + ': описание ' + d.length);
    assert.ok(html.includes(`<link rel="canonical" href="${cfg.site}${rel}">`), rel + ': canonical');
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, rel + ': h1');
    assert.ok(html.includes('index.html#'), rel + ': ссылка в приложение');
  }
});

test('внутренние ссылки и картинки на всех страницах ведут на существующие файлы', () => {
  const bad = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name == 'index.html') check(p); } };
  const check = file => {
    const html = fs.readFileSync(file, 'utf8'), dir = path.dirname(file);
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      let u = m[1]; if (/^(https?:|mailto:|#|data:)/.test(u)) continue;
      u = decodeURIComponent(u.split('#')[0].split('?')[0]); if (!u) continue;
      let t = path.resolve(dir, u); if (u.endsWith('/')) t = path.join(t, 'index.html');
      if (!fs.existsSync(t)) bad.push(path.relative(root, file) + ' -> ' + u);
    }
  };
  walk(path.join(root, '2014')); walk(path.join(root, '2024'));
  assert.deepEqual(bad.slice(0, 10), []);
});
