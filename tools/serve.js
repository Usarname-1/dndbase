#!/usr/bin/env node
/* Локальный сервер для просмотра сайта, устроенный как GitHub Pages: у папок есть index.html, а для несуществующих адресов отдаётся 404.html.
   Запуск из корня репозитория:
     node tools/serve.js                 — сайт на http://localhost:8000/<путь из site в tools/seo.config.json>
     node tools/serve.js 8080            — другой порт
     node tools/serve.js 8080 --prefix / — отдавать сайт с корня (нужно, если в seo.config.json указан домен без пути; для проверки старой версии)
     node tools/serve.js --dir ../копия  — другая папка с сайтом
   Страницы собраны под путь из поля site (например, /dndbase/), поэтому открывать их нужно по этому адресу, а не просто http://localhost:8000/. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.md': 'text/markdown; charset=utf-8' };

function sitePrefix(root) {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'seo.config.json'), 'utf8'));
    return new URL(c.site).pathname.replace(/\/*$/, '/');
  } catch (e) { return '/'; }
}

function createServer(opts) {
  const root = path.resolve(opts.dir), prefix = opts.prefix.replace(/\/*$/, '/');
  const send = (res, code, file, head) => {
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...head });
    fs.createReadStream(file).pipe(res);
  };
  return http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
    if (!p.startsWith(prefix)) {
      if (p === '/') { res.writeHead(302, { Location: prefix }); return res.end(); }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Сайт открывается по адресу ' + prefix);
    }
    const rel = p.slice(prefix.length), file = path.join(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    let st = null;
    try { st = fs.statSync(file); } catch (e) { /* нет такого файла */ }
    if (st && st.isDirectory()) {
      if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
      const idx = path.join(file, 'index.html');
      if (fs.existsSync(idx)) return send(res, 200, idx);
      st = null;
    }
    if (st && st.isFile()) return send(res, 200, file);
    const nf = path.join(root, '404.html');
    if (fs.existsSync(nf)) return send(res, 404, nf);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
  });
}

function main() {
  const a = process.argv.slice(2), root = path.join(__dirname, '..');
  const opt = k => { const i = a.indexOf(k); return i < 0 ? null : a[i + 1]; };
  const port = +(a.find(x => /^\d+$/.test(x)) || 8000);
  const dir = opt('--dir') || root, prefix = opt('--prefix') || sitePrefix(dir);
  createServer({ dir, prefix }).listen(port, () => console.log(`Сайт: http://localhost:${port}${prefix}  (папка ${path.resolve(dir)}). Остановить: Ctrl+C`));
}

module.exports = { createServer, sitePrefix };
if (require.main === module) main();
