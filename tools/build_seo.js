#!/usr/bin/env node
/* Поисковая оптимизация: тексты и метатеги страниц, robots.txt.
   Сами страницы (по одной на запись, раздел и инструмент), sitemap.xml и home.js собирает tools/build_pages.js, он берёт отсюда блок <head>.
   Запуск этого файла напрямую делает то же, что node tools/build_pages.js (оставлено, чтобы старая команда не ломалась).

   Всё, что знает только владелец сайта, лежит в tools/seo.config.json:
     site                — адрес главной страницы с «/» на конце. Сменили домен — поменяйте здесь и пересоберите страницы;
     googleVerification  — код из Google Search Console (способ «HTML-тег», значение content);
     yandexVerification  — код из Яндекс Вебмастера (способ «Метатег», значение content).
   Пустые значения кода в страницу не попадают. */
'use strict';
const fs = require('fs'), path = require('path');

const CONFIG = path.join(__dirname, 'seo.config.json');

// Тексты для поисковиков и превью в мессенджерах. Название в заголовке — то, что люди набирают в поиске: «справочник», «D&D 5e», «на русском».
const TEXT = {
  name: 'D&D — русская база',
  alternateName: ['Русская база D&D 5e', 'D&D Base'],
  title: 'Справочник D&D 5e на русском — бестиарий, заклинания, классы',
  ogTitle: 'D&D 5e на русском — справочник мастера и игрока',
  description: 'Бесплатный справочник D&D 5e (ДнД) на русском: бестиарий, заклинания, классы, расы, черты, магические предметы. Редакции 2014 и 2024, экран мастера, листы персонажей.',
  // главная редакции 2014 — отдельная страница со своим адресом /14/
  home14: {
    title: 'Справочник D&D 5e (редакция 2014) на русском',
    description: 'Справочник D&D 5e на русском, редакция 2014: бестиарий, заклинания, классы, расы, предыстории, черты, магические предметы, снаряжение, правила и статьи.'
  },
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

// Старые ссылки вида #spells/fireball (так сайт выглядел до отдельных страниц) переводим на новые адреса
const LEGACY_HASH = `<script>(function(h){if(!/^#[A-Za-z0-9_%.\\/-]+$/.test(h))return;var p=h.slice(1).split('/').filter(Boolean);if(p[0]=='24'||p[0]=='home'){p.shift();if(!p.length)try{localStorage.setItem('ed','24')}catch(e){}}if(p.length>3)return;location.replace(document.querySelector('base').href+p.join('/')+(p.length?'/':''))})(location.hash)</script>`;

/* Блок для <head>. page: { title, description, url (канонический адрес), ogTitle?, ld? (список объектов schema.org), noindex? }
   Без page — главная (как раньше). */
function headBlock(cfg, page) {
  page = page || { title: TEXT.title, description: TEXT.description, url: cfg.site, ogTitle: TEXT.ogTitle, ld: [websiteLd(cfg)] };
  const img = cfg.site + TEXT.image.file;
  const base = '/' + cfg.site.replace(/^https?:\/\/[^/]+\/?/, '');
  const L = [
    `<base href="${esc(base)}">`,
    LEGACY_HASH,
    `<title>${esc(page.title)}</title>`,
    page.description && `<meta name="description" content="${esc(page.description)}">`,
    page.url && !page.noindex && `<link rel="canonical" href="${esc(page.url)}">`,
    page.noindex ? `<meta name="robots" content="noindex,follow">` : `<meta name="robots" content="index,follow,max-image-preview:large">`,
    cfg.google && `<meta name="google-site-verification" content="${esc(cfg.google)}">`,
    cfg.yandex && `<meta name="yandex-verification" content="${esc(cfg.yandex)}">`,
    `<meta name="theme-color" content="${TEXT.themeColor}">`,
    `<link rel="icon" href="favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="favicon.ico" sizes="48x48">`,
    `<link rel="apple-touch-icon" href="apple-touch-icon.png">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(TEXT.name)}">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta property="og:title" content="${esc(page.ogTitle || page.title)}">`,
    page.description && `<meta property="og:description" content="${esc(page.description)}">`,
    page.url && !page.noindex && `<meta property="og:url" content="${esc(page.url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:width" content="${TEXT.image.width}">`,
    `<meta property="og:image:height" content="${TEXT.image.height}">`,
    `<meta property="og:image:alt" content="${esc(TEXT.imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    ...(page.ld || []).map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`)
  ];
  return L.filter(Boolean).join('\n');
}

const websiteLd = cfg => ({
  '@context': 'https://schema.org', '@type': 'WebSite', name: TEXT.name, alternateName: TEXT.alternateName, url: cfg.site, inLanguage: 'ru', description: TEXT.description
});
const breadcrumbLd = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url }))
});

const robotsTxt = cfg => `User-agent: *\nAllow: /\n\nSitemap: ${cfg.site}sitemap.xml\n`;

module.exports = { TEXT, readConfig, headBlock, websiteLd, breadcrumbLd, robotsTxt };
if (require.main === module) require('./build_pages.js').main();
