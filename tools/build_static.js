#!/usr/bin/env node
/* Статические страницы для поисковиков и для чтения без JavaScript.

   Справочник — одна страница, разделы открываются через «#…», а Google такие адреса не различает: в поиске мог бы появиться
   только index.html. Этот скрипт берёт данные из data/ и data14/ и для КАЖДОЙ записи пишет обычную страницу с адресом вида
     2014/spells/fireball/      (редакция/раздел/запись)
   плюс каталоги разделов (2014/spells/), каталоги редакций (2014/) и sitemap.xml со всеми адресами.

   Карточки рисует тот же код, что и сайт: скрипт запускает inline-скрипт из index.html в jsdom и вызывает функции card()
   разделов. Поэтому внешний вид и состав карточек совпадают с сайтом. Внутренние ссылки в тексте (автоссылки links.js,
   списки записей в статьях) ведут на статические страницы. В «Открыть в справочнике» страница отправляет в приложение с поиском и фильтрами.

   Запуск (из корня репозитория):
     npm install            — один раз, ставит jsdom
     node tools/build_static.js
   После правки данных (data/, data14/) или index.html запустите заново: 2014/, 2024/, static.css и sitemap.xml пересоберутся.
   Адрес сайта берётся из tools/seo.config.json. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const seo = require('./build_seo.js');

const EDS = { 24: { dir: '2024', data: 'data', keys: ['bestiary', 'spells', 'class', 'species', 'backgrounds', 'feats', 'items', 'equipment', 'glossary'] },
  14: { dir: '2014', data: 'data14', keys: ['bestiary', 'spells', 'class', 'race', 'backgrounds', 'feats', 'items', 'equipment', 'glossary', 'articles'] } };
// как называется запись в заголовке страницы и во множественном числе в каталоге
const KIND = { bestiary: ['монстр', 'Бестиарий'], spells: ['заклинание', 'Заклинания'], class: ['класс', 'Классы'], species: ['вид', 'Виды'], race: ['раса', 'Расы'],
  backgrounds: ['предыстория', 'Предыстории'], feats: ['черта', 'Черты'], items: ['магический предмет', 'Магические предметы'], equipment: ['снаряжение', 'Снаряжение'],
  glossary: ['правило', 'Глоссарий'], articles: ['статья', 'Правила и статьи'] };
const LK = { s: 'spells', g: 'glossary', c: 'class', e: 'equipment', m: 'bestiary', i: 'items', f: 'feats', a: 'articles' };
const SELFK = { spells: 's', glossary: 'g', class: 'c', equipment: 'e', bestiary: 'm', items: 'i', feats: 'f', articles: 'a' };
const SWAP = { species: 'race', race: 'species', articles: 'glossary', glossary: 'articles' };

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const urlSlug = s => String(s).toLowerCase();                       // на регистронезависимых дисках «NPC» и «npc» — одна папка
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const ruSort = (a, b) => a.name_ru.localeCompare(b.name_ru, 'ru');

function main() {
  const { JSDOM } = require('jsdom');
  const cfg = seo.readConfig(), SITE = cfg.site;
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  /* ---- код сайта в jsdom ---- */
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: SITE });
  const win = dom.window;
  globalThis.document = win.document; globalThis.NodeFilter = win.NodeFilter;
  const AutoLinks = require('../links.js');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('const HOME='));
  const cut = script.indexOf("['nof','nol'].forEach(c=>ls.get(c)");
  if (!script || cut < 0) throw new Error('не нашёл inline-скрипт index.html или точку обрезки (проводка DOM после функций разделов)');
  const vm = require('vm'), ctx = dom.getInternalVMContext();
  const run = code => new vm.Script(code).runInContext(ctx);            // top-level const/let остаются в общей области, как у настоящей страницы
  run(script.slice(0, cut));
  const SXS = run('SXS'), lines = run('lines'), headFn = run('head'), blocksFn = run('B');
  const FAILED = [];
  const setEd = e => run(`ed=${e};SX=SXS[${e}]`);

  /* ---- данные ---- */
  const DATA = {};                      // DATA[e][k] = отсортированный массив записей
  const PAGES = new Set();              // 'e/k/slug' — какие страницы будут
  for (const e of [24, 14]) {
    DATA[e] = {};
    for (const k of EDS[e].keys) {
      DATA[e][k] = rd(`${EDS[e].data}/${k}.json`).sort((a, b) => a.slug == 'intro' ? -1 : b.slug == 'intro' ? 1 : ruSort(a, b));
      for (const m of DATA[e][k]) PAGES.add(`${e}/${k}/${m.slug}`);
    }
  }
  const IX = { 24: AutoLinks.buildIndex(rd('data/links.json'), { bracketOnlySingle: false }), 14: AutoLinks.buildIndex(rd('data14/links.json'), { bracketOnlySingle: true }) };
  const IMG = rd('img/manifest.json'); for (const e in IMG) for (const s in IMG[e]) IMG[e][s] = new Set(IMG[e][s]);
  const normName = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
  const BYSLUG = {}, BYEN = {};         // для ссылки «Версия 2014/2024»
  for (const e of [24, 14]) for (const k of EDS[e].keys) { BYSLUG[`${e}/${k}`] = new Map(DATA[e][k].map(m => [m.slug, m])); }
  const otherEd = (e, k, m) => {
    const o = e == 14 ? 24 : 14, k2 = DATA[o][k] ? k : SWAP[k];
    if (!k2 || !DATA[o][k2]) return null;
    const s2 = e == 14 && m.url_2024 ? m.url_2024.replace(/\/$/, '').split('/').pop().replace(/^\d+-/, '') : m.slug;
    let t = BYSLUG[`${o}/${k2}`].get(s2);
    if (!t && m.name_en) { const n = normName(m.name_en), c = DATA[o][k2].filter(x => normName(x.name_en) === n); if (c.length === 1) t = c[0]; }
    return t ? { e: o, k: k2, slug: t.slug } : null;
  };

  /* ---- адреса ---- */
  const rootRel = depth => '../'.repeat(depth);
  const pagePath = (e, k, slug) => `${EDS[e].dir}/${k}/${urlSlug(slug)}/`;
  const abs = p => SITE + p;
  // ссылка на запись из страницы глубины depth; если записи нет — в приложение
  const linkTo = (depth, e, k, slug) => PAGES.has(`${e}/${k}/${slug}`) ? rootRel(depth) + pagePath(e, k, slug) : `${rootRel(depth)}index.html#${e == 14 ? '14/' : ''}${k}/${encodeURIComponent(slug)}`;
  const appLink = (depth, e, k, slug) => `${rootRel(depth)}index.html#${e == 14 ? '14/' : ''}${k}${slug ? '/' + encodeURIComponent(slug) : ''}`;

  const CSS_OVERRIDES = `
/* статические страницы */
body.static{display:block;height:auto;min-height:100%}
body.static main{overflow:visible;padding:26px 18px 60px}
body.static nav{position:sticky;top:0;z-index:5;flex-wrap:wrap;row-gap:0}
body.static nav .sp{flex:1}
.stat h1{font:700 27px/1.1 'PT Serif',serif;color:var(--red);margin:0;font-variant:small-caps}
body.static a.xl{cursor:pointer}body.static figure.pic img{cursor:default}
.crumbs{margin:0 0 10px;font:13.5px/1.4 'PT Sans',sans-serif;color:var(--muted)}.crumbs a{color:var(--bar)}
.openapp{margin:12px 0 0;font:14.5px/1.45 'PT Sans',sans-serif}.openapp a{display:inline-block;padding:7px 14px;border:1px solid var(--bar);color:var(--bar);text-decoration:none;border-radius:4px;font-weight:700}
.openapp a:hover{background:var(--bar);color:#fff}
.more{margin:26px 0 0;font:15px/1.45 'PT Sans',sans-serif}.more h2{margin:0 0 6px;font:700 16px 'PT Sans',sans-serif;color:var(--muted)}
.more ul{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:2px 18px}.more a{color:var(--bar)}
.idx h1{font:700 30px/1.1 'PT Serif',serif;color:var(--red);margin:0 0 4px;font-variant:small-caps}
.idx .lead a{color:var(--bar)}.idx .lead{margin:0 0 14px;font:15px/1.5 'PT Sans',sans-serif;color:var(--muted)}
.idx .abc{margin:0 0 14px;font:700 15px 'PT Sans',sans-serif;display:flex;flex-wrap:wrap;gap:4px 10px}.idx .abc a{color:var(--bar)}
.idx h2{margin:18px 0 4px;font:700 20px 'PT Serif',serif;color:var(--red);border-bottom:1px solid var(--line)}
.idx ul{margin:0;padding:0;list-style:none}.idx li{padding:5px 0;border-bottom:1px solid var(--line);font:15px/1.4 'PT Sans',sans-serif}
.idx li a{color:inherit;text-decoration:none}.idx li a:hover b{color:var(--red)}.idx li b{font-family:'PT Serif',serif;font-size:16px}.idx li small{color:var(--muted)}.idx li .s{display:block;font-size:13px;color:var(--muted)}
.idx .secs li a{display:flex;justify-content:space-between;gap:12px}
`;
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  fs.writeFileSync(path.join(ROOT, 'static.css'), style.trim() + '\n' + CSS_OVERRIDES);

  /* ---- общие куски страницы ---- */
  const headTags = ({ depth, title, desc, canon, image, imageAlt, ld }) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canon)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#922610">
<link rel="icon" href="${rootRel(depth)}favicon.svg" type="image/svg+xml"><link rel="icon" href="${rootRel(depth)}favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="${rootRel(depth)}apple-touch-icon.png">
<meta property="og:type" content="article"><meta property="og:site_name" content="${esc(seo.TEXT.name)}"><meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canon)}">
<meta property="og:image" content="${esc(image)}"><meta property="og:image:alt" content="${esc(imageAlt)}"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${rootRel(depth)}static.css">`;

  const navHTML = (depth, e, appHref) => {
    const o = e == 14 ? 24 : 14;
    return `<nav><span class="ed"><a href="${rootRel(depth)}${EDS[14].dir}/" aria-current="${e == 14}">2014</a><a href="${rootRel(depth)}${EDS[24].dir}/" aria-current="${e == 24}">2024</a></span>`
      + `<a href="${rootRel(depth)}index.html${e == 14 ? '#14' : '#24'}">Главная</a>`
      + EDS[e].keys.map(k => `<a href="${rootRel(depth)}${EDS[e].dir}/${k}/">${KIND[k][1]}</a>`).join('')
      + `<span class="sp"></span><a href="${appHref}">Поиск и фильтры</a></nav>`;
  };
  const shell = (e, depth, appHref, head, body) => `<!doctype html>\n<html lang="ru"><head>\n${head}\n</head>\n<body class="static${e == 14 ? ' e14' : ''}">\n${navHTML(depth, e, appHref)}\n<main><div class="wrap">\n${body}\n</div></main>\n</body></html>\n`;
  const clip = (s, n) => { s = s.replace(/\s+/g, ' ').trim(); if (s.length <= n) return s; const c = s.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf(' '), n - 20)).replace(/[\s,;:—-]+$/, '') + '…'; };

  /* ---- вывод ---- */
  for (const e of [24, 14]) fs.rmSync(path.join(ROOT, EDS[e].dir), { recursive: true, force: true });
  const urls = [SITE];
  const write = (rel, text) => { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  let nPages = 0, bytes = 0;

  for (const e of [24, 14]) {
    setEd(e);
    const ed = EDS[e];
    for (const k of ed.keys) {
      const list = DATA[e][k], card = SXS[e][k].card, [kind, plural] = KIND[k];
      const sec = SXS[e][k];
      list.forEach((m, i) => {
        const depth = 3, slugP = pagePath(e, k, m.slug);
        const hrefFn = x => linkTo(depth, e, LK[x.k], x.slug);
        const div = win.document.createElement('div');
        try { div.innerHTML = card(m); } catch (err) {
          FAILED.push(`${e}/${k}/${m.slug}: ${err.message}`);
          div.innerHTML = `<article class="stat">${headFn(m, '')}${blocksFn(m.blocks)}</article>`;
        }
        AutoLinks.hydrate(div, IX[e], hrefFn);
        AutoLinks.linkify(div, IX[e], { k: SELFK[k], slug: m.slug }, hrefFn);
        // «#14/spells/x» из текстов и списков -> статические страницы; прочее остаётся ссылкой в приложение
        div.querySelectorAll('a[href^="#"]').forEach(a => {
          const p = a.getAttribute('href').slice(1).split('/'); let ee = 24;
          if (p[0] == '14') { ee = 14; p.shift(); } else if (p[0] == '24') p.shift();
          const slug = p[1] && decodeURIComponent(p[1]);
          a.setAttribute('href', slug && DATA[ee][p[0]] ? linkTo(depth, ee, p[0], slug) : `${rootRel(depth)}index.html${a.getAttribute('href')}`);
        });
        // картинка
        const ms = IMG[e] || {}, art = ms[k] && ms[k].has(m.slug), tk = !art && ms[k + '~t'] && ms[k + '~t'].has(m.slug);
        let imgUrl = '';
        const rule = div.querySelector('.rule');
        if ((art || tk) && rule) {
          imgUrl = `img/${e}/${tk ? k + '-token' : k}/${encodeURIComponent(m.slug)}.webp`;
          const fig = win.document.createElement('figure'); fig.className = 'pic' + (tk ? ' tok' : '');
          fig.innerHTML = `<img src="${rootRel(depth)}${imgUrl}" alt="${esc(m.name_ru)}" loading="lazy" decoding="async">`;
          rule.after(fig);
        }
        // версия другой редакции
        const x = div.querySelector('#xref'), o = otherEd(e, k, m);
        if (x) { if (o) x.innerHTML = ` · <a href="${linkTo(depth, o.e, o.k, o.slug)}">Версия ${EDS[o.e].dir}</a>`; x.removeAttribute('id'); }
        const h2 = div.querySelector('h2'); if (h2) { const h1 = win.document.createElement('h1'); h1.innerHTML = h2.innerHTML; h2.replaceWith(h1); }
        // сведения для <head>
        const plain = el => { const c = el.cloneNode(true); c.querySelectorAll('p,li,td,th,tr,h1,h2,h3,h4,div,br,summary').forEach(x => x.append(' ')); return c.textContent.replace(/\s+/g, ' ').trim(); };
        // описание: строка типа («3 уровень, Воплощение») и первый содержательный абзац, а не строки характеристик
        const sub = (div.querySelector('.sub') || {}).textContent || '';
        const para = [...div.querySelectorAll('p:not(.pr):not(.en):not(.sub):not(.meta), li')].map(plain).find(t => t.length > 60) || '';
        const body = [sub.trim(), para || plain(div).replace(m.name_ru, '').replace(m.name_en || '\u0000', '')].filter(Boolean).join('. ').replace(/\.\./g, '.');
        const nameFull = m.name_en ? `${m.name_ru} (${m.name_en})` : m.name_ru;
        let title = `${nameFull} — ${kind} D&D 5e, ${ed.dir}`;
        if (title.length > 70) title = `${m.name_ru} — ${kind} D&D 5e, ${ed.dir}`;
        const desc = clip(`${nameFull}: ${kind} для D&D 5e (редакция ${ed.dir}). ${body}`, 158);
        const canon = abs(slugP), appH = appLink(depth, e, k, m.slug);
        const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: seo.TEXT.name, item: SITE },
          { '@type': 'ListItem', position: 2, name: `${plural}, ${ed.dir}`, item: abs(`${ed.dir}/${k}/`) },
          { '@type': 'ListItem', position: 3, name: m.name_ru, item: canon }] };
        const near = [...list.slice(Math.max(0, i - 4), i), ...list.slice(i + 1, i + 5)];
        const crumbs = `<p class="crumbs"><a href="${rootRel(depth)}index.html${e == 14 ? '#14' : '#24'}">Главная</a> / <a href="${rootRel(depth)}${ed.dir}/">Редакция ${ed.dir}</a> / <a href="${rootRel(depth)}${ed.dir}/${k}/">${esc(plural)}</a></p>`;
        const more = near.length ? `<section class="more"><h2>Ещё в разделе «${esc(plural)}»</h2><ul>${near.map(n => `<li><a href="${linkTo(depth, e, k, n.slug)}">${esc(n.name_ru)}</a></li>`).join('')}</ul></section>` : '';
        const open = `<p class="openapp"><a href="${appH}">Открыть в справочнике</a> с поиском по разделу, фильтрами и экраном мастера.</p>`;
        const head = headTags({ depth, title, desc, canon, image: imgUrl ? abs(imgUrl) : abs(seo.TEXT.image.file), imageAlt: m.name_ru, ld });
        const out = shell(e, depth, appH, head, `${crumbs}\n<div id="card">${div.innerHTML}</div>\n${open}\n${more}`);
        write(slugP + 'index.html', out); nPages++; bytes += out.length; urls.push(abs(slugP));
      });

      // каталог раздела
      {
        const depth = 2, rel = `${ed.dir}/${k}/`;
        const groups = new Map();
        for (const m of list) { const ch = (m.name_ru.replace(/^[^A-Za-zА-Яа-яЁё0-9]+/, '')[0] || '#').toUpperCase(); (groups.get(ch) || groups.set(ch, []).get(ch)).push(m); }
        const letters = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
        const abc = letters.length > 5 ? `<p class="abc">${letters.map(l => `<a href="#l-${encodeURIComponent(l)}">${esc(l)}</a>`).join('')}</p>` : '';
        const ul = ms => `<ul>${ms.map(m => { const sub = (() => { try { return sec.sub(m) || ''; } catch (x) { return ''; } })(); const sm = (() => { try { return lines(sec, m); } catch (x) { return ''; } })();
          return `<li><a href="${linkTo(depth, e, k, m.slug)}"><b>${esc(m.name_ru)}</b>${m.name_en ? ` <small>${esc(m.name_en)}</small>` : ''}${sub ? ` <small>· ${esc(sub)}</small>` : ''}${sm}</a></li>`; }).join('')}</ul>`;
        const body = `<div class="idx"><h1>${esc(plural)} D&amp;D 5e, редакция ${ed.dir}</h1><p class="lead">${list.length} ${list.length % 10 == 1 && list.length % 100 != 11 ? 'запись' : 'записей'} на русском языке с английскими названиями. Откройте страницу записи или <a href="${appLink(depth, e, k)}">найдите нужную в справочнике</a> — там есть поиск и фильтры.</p>${abc}`
          + (letters.length > 5 ? letters.map(l => `<h2 id="l-${encodeURIComponent(l)}">${esc(l)}</h2>${ul(groups.get(l))}`).join('') : ul(list)) + '</div>';
        const title = `${plural} D&D 5e, редакция ${ed.dir} — список на русском`;
        const desc = clip(`${plural} D&D 5e (${ed.dir}) на русском: ${list.slice(0, 14).map(m => m.name_ru).join(', ')} и другие. Всего ${list.length}.`, 158);
        const head = headTags({ depth, title, desc, canon: abs(rel), image: abs(seo.TEXT.image.file), imageAlt: seo.TEXT.imageAlt, ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: abs(rel), inLanguage: 'ru' } });
        const out = shell(e, depth, appLink(depth, e, k), head, body);
        write(rel + 'index.html', out); bytes += out.length; urls.push(abs(rel));
      }
    }
    // каталог редакции
    {
      const depth = 1, rel = `${ed.dir}/`;
      const body = `<div class="idx"><h1>Справочник D&amp;D 5e, редакция ${ed.dir}</h1><p class="lead">Разделы справочника. Для поиска и фильтров <a href="${rootRel(depth)}index.html${e == 14 ? '#14' : '#24'}">откройте справочник</a>.</p><ul class="secs">`
        + ed.keys.map(k => `<li><a href="${rootRel(depth)}${ed.dir}/${k}/"><b>${esc(KIND[k][1])}</b><small>${DATA[e][k].length}</small></a></li>`).join('') + '</ul></div>';
      const title = `Справочник D&D 5e, редакция ${ed.dir} — разделы`;
      const desc = `Разделы справочника D&D 5e (${ed.dir}) на русском: ${ed.keys.map(k => KIND[k][1].toLowerCase()).join(', ')}.`;
      const head = headTags({ depth, title, desc, canon: abs(rel), image: abs(seo.TEXT.image.file), imageAlt: seo.TEXT.imageAlt, ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: abs(rel), inLanguage: 'ru' } });
      write(rel + 'index.html', shell(e, depth, `${rootRel(depth)}index.html${e == 14 ? '#14' : '#24'}`, head, body)); urls.push(abs(rel));
    }
  }

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  if (FAILED.length) console.warn(`Карточка не отрисовалась (в приложении тоже ошибка?), страница собрана упрощённо: ${FAILED.length}\n  ` + FAILED.slice(0, 20).join('\n  '));
  console.log(`Страниц записей: ${nPages}, адресов в sitemap.xml: ${urls.length}, объём HTML ≈ ${(bytes / 1048576).toFixed(0)} МБ`);
}

module.exports = { EDS, KIND, urlSlug };
if (require.main === module) main();
