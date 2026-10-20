#!/usr/bin/env node
/* Поисковая оптимизация сайта: пересобирает блок метатегов в index.html, sitemap.xml и robots.txt.

   Запуск из корня репозитория:
     node tools/build_seo.js            — записать файлы
     node tools/build_seo.js --check    — только проверить, что файлы соответствуют настройкам (код возврата 1, если нет)

   Всё, что знает только владелец сайта, лежит в tools/seo.config.json:
     site                — адрес главной страницы с «/» на конце. Сменили домен — поменяйте здесь и запустите скрипт заново;
     googleVerification  — код из Google Search Console (способ «HTML-тег», значение content);
     yandexVerification  — код из Яндекс Вебмастера (способ «Метатег», значение content).
   Пустые значения кода в страницу не попадают.

   Блок в index.html ограничен маркерами <!--seo:begin--> … <!--seo:end-->: вручную внутри него ничего не правьте. */
'use strict';
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(__dirname, 'seo.config.json');
const BEGIN = '<!--seo:begin-->', END = '<!--seo:end-->';

// Тексты для поисковиков и превью в мессенджерах. Название в заголовке — то, что люди набирают в поиске: «справочник», «D&D 5e», «на русском».
const TEXT = {
  name: 'D&D — русская база',
  alternateName: ['Русская база D&D 5e', 'D&D Base'],
  title: 'Справочник D&D 5e на русском — бестиарий, заклинания, классы',
  ogTitle: 'D&D 5e на русском — справочник мастера и игрока',
  description: 'Бесплатный справочник D&D 5e (ДнД) на русском: бестиарий, заклинания, классы, расы, черты, магические предметы. Редакции 2014 и 2024, экран мастера, листы персонажей.',
  imageAlt: 'D&D 5e, русская база: бестиарий, заклинания, классы, расы, черты, предметы. Редакции 2014 и 2024.',
  themeColor: '#922610',
  image: { file: 'og-image.png', width: 1200, height: 630 }
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function readConfig() {
  const c = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const site = String(c.site || '').trim();
  if (!/^https?:\/\/[^\s/]+(\/\S*)?$/.test(site)) throw new Error('tools/seo.config.json: поле site должно быть адресом вида https://example.ru/ или https://user.github.io/repo/');
  return { site: site.replace(/\/*$/, '/'), google: String(c.googleVerification || '').trim(), yandex: String(c.yandexVerification || '').trim() };
}

// Блок для <head>: заголовок, описание, canonical, превью для соцсетей, иконки, разметка schema.org
function headBlock(cfg) {
  const url = cfg.site, img = url + TEXT.image.file;
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebSite', name: TEXT.name, alternateName: TEXT.alternateName, url, inLanguage: 'ru', description: TEXT.description
  };
  const L = [
    `<title>${esc(TEXT.title)}</title>`,
    `<meta name="description" content="${esc(TEXT.description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    cfg.google && `<meta name="google-site-verification" content="${esc(cfg.google)}">`,
    cfg.yandex && `<meta name="yandex-verification" content="${esc(cfg.yandex)}">`,
    `<meta name="theme-color" content="${TEXT.themeColor}">`,
    `<link rel="icon" href="favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="favicon.ico" sizes="48x48">`,
    `<link rel="apple-touch-icon" href="apple-touch-icon.png">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(TEXT.name)}">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta property="og:title" content="${esc(TEXT.ogTitle)}">`,
    `<meta property="og:description" content="${esc(TEXT.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:width" content="${TEXT.image.width}">`,
    `<meta property="og:image:height" content="${TEXT.image.height}">`,
    `<meta property="og:image:alt" content="${esc(TEXT.imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ];
  return L.filter(Boolean).join('\n');
}

const sitemapXml = cfg => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${esc(cfg.site)}</loc>\n  </url>\n</urlset>\n`;
const robotsTxt = cfg => `User-agent: *\nAllow: /\n\nSitemap: ${cfg.site}sitemap.xml\n`;

function inject(html, block) {
  const re = new RegExp(BEGIN + '[\\s\\S]*?' + END);
  if (!re.test(html)) throw new Error(`В index.html нет маркеров ${BEGIN} … ${END}`);
  return html.replace(re, () => BEGIN + '\n' + block + '\n' + END);
}

// что должно лежать в файлах при текущих настройках: { 'index.html': текст, 'sitemap.xml': …, 'robots.txt': … }
function build(cfg) {
  cfg = cfg || readConfig();
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return { 'index.html': inject(html, headBlock(cfg)), 'sitemap.xml': sitemapXml(cfg), 'robots.txt': robotsTxt(cfg) };
}

function main() {
  const out = build(), check = process.argv.includes('--check'), stale = [];
  for (const [file, text] of Object.entries(out)) {
    const p = path.join(ROOT, file), now = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (now === text) continue;
    stale.push(file);
    if (!check) fs.writeFileSync(p, text);
  }
  if (check) {
    if (stale.length) { console.error('Не соответствуют настройкам: ' + stale.join(', ') + '. Запустите: node tools/build_seo.js'); process.exit(1); }
    console.log('SEO-файлы актуальны.');
  } else console.log(stale.length ? 'Обновлено: ' + stale.join(', ') : 'Всё уже актуально.');
}

module.exports = { TEXT, BEGIN, END, readConfig, headBlock, sitemapXml, robotsTxt, build };
if (require.main === module) main();
