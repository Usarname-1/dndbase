/* ===== Сохранение листа персонажа в PDF-файл без окна печати =====
   Окно печати на телефоне не сохраняет файл сразу: нужно выбрать «Сохранить как PDF» и нажать ещё раз.
   Поэтому страницы листа (.pg) рисуются в картинки (html2canvas, подгружается только по нажатию кнопки),
   а картинки собираются в обычный PDF формата A4 — получается готовый файл, который скачивается одним нажатием.
   Текст в таком PDF — часть картинки (не выделяется); для выделяемого текста остаётся кнопка «Печать». */
(function (root) {
  'use strict';
  const MM = 96 / 25.4;                        // пикселей CSS в одном мм
  const PW = 210, PH = 297;                    // A4, мм
  const PAD_T = 9, PAD_B = 8.5, BODY_H = 279;  // поля и рабочая высота страницы листа, мм (как в @media print у charprint.css)
  const MAX_PX = 12e6;                         // телефоны не дают рисовать на холсте больше ~16 млн точек; берём с запасом
  const K = 2;                                 // точек в пикселе CSS (≈190 dpi на бумаге A4)
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const loading = {};
  function loadScript(src) {
    if (loading[src]) return loading[src];
    return loading[src] = new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = ok; s.onerror = () => { delete loading[src]; no(new Error('не загрузился ' + src)); };
      document.head.append(s);
    });
  }
  const ready = () => root.html2canvas ? Promise.resolve() : loadScript('lib/html2canvas/html2canvas.min.js');

  /* ---- JPEG-страницы → PDF ---- */
  const hex16 = s => '<FEFF' + Array.from(String(s)).map(ch => ch.codePointAt(0).toString(16).padStart(4, '0')).join('').toUpperCase() + '>';   // заголовок в UTF-16BE
  function pdfOf(pages, title) {
    const enc = new TextEncoder(), chunks = [], offs = []; let len = 0;
    const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
    const obj = (n, head, stream) => {
      offs[n] = len; put(n + ' 0 obj\n');
      if (stream) { put(head.replace('>>', '/Length ' + stream.length + ' >>') + '\nstream\n'); put(stream); put('\nendstream\nendobj\n'); }
      else put(head + '\nendobj\n');
    };
    const W = (PW / 25.4 * 72).toFixed(2), H = (PH / 25.4 * 72).toFixed(2), n = pages.length;
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Count ' + n + ' /Kids [' + pages.map((_, i) => (4 + i * 3) + ' 0 R').join(' ') + '] >>');
    obj(3, '<< /Title ' + hex16(title) + ' /Producer (dndbase) /Creator (dndbase) >>');
    pages.forEach((p, i) => {
      const pg = 4 + i * 3;
      obj(pg, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + (pg + 2) + ' 0 R >> >> /Contents ' + (pg + 1) + ' 0 R >>');
      obj(pg + 1, '<< >>', enc.encode('q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q'));
      obj(pg + 2, '<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>', p.data);
    });
    const total = 4 + n * 3, xref = len;
    put('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (let i = 1; i < total; i++) put(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    put('trailer\n<< /Size ' + total + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  /* ---- снимок элемента ---- */
  // crop {x, y, w, h} — в пикселях CSS от левого верхнего угла элемента (так же понимает его библиотека)
  async function shot(el, scale, crop) {
    const r = el.getBoundingClientRect();
    const o = { backgroundColor: '#fff', scale, useCORS: true, logging: false, imageTimeout: 8000,
      windowWidth: Math.max(innerWidth, Math.ceil(r.width)),
      onclone: doc => {
        // контейнер стоит за краем экрана — в копии, которую рисует библиотека, возвращаем его на место
        const b = doc.querySelector('.pdfhost'); if (b) { b.style.left = '0'; b.style.top = '0'; }
        // SVG библиотека рисует отдельной картинкой, и стили из CSS (цвет и толщина линий разлиновки) в неё не попадают — переносим их в атрибуты
        const win = doc.defaultView;
        doc.querySelectorAll('svg').forEach(s => s.querySelectorAll('line,path,rect,circle,ellipse,polygon,polyline').forEach(n => {
          const cs = win.getComputedStyle(n);
          ['fill', 'stroke', 'stroke-width', 'opacity'].forEach(p => { const v = cs.getPropertyValue(p); if (v) n.setAttribute(p, v); });
        }));
      } };
    if (crop) { o.x = crop.x; o.y = crop.y; o.width = Math.ceil(crop.w); o.height = Math.ceil(crop.h); }
    return root.html2canvas(el, o);
  }
  const jpegOf = cv => new Promise((ok, no) => cv.toBlob(b => b ? b.arrayBuffer().then(a => ok({ data: new Uint8Array(a), w: cv.width, h: cv.height }), no) : no(new Error('toBlob')), 'image/jpeg', 0.92));
  // белая страница A4 из кусков: part = { src (холст), sx, sy, sw, sh — откуда (точки холста), dx, dy — куда (мм от левого верхнего угла страницы) }
  async function pageOf(k, parts) {
    const cv = document.createElement('canvas'); cv.width = Math.round(PW * MM * k); cv.height = Math.round(PH * MM * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    parts.forEach(p => { if (p.sh > 0 && p.sw > 0) g.drawImage(p.src, Math.round(p.sx), Math.round(p.sy), Math.round(p.sw), Math.round(p.sh), Math.round(p.dx * MM * k), Math.round(p.dy * MM * k), Math.round(p.sw), Math.round(p.sh)); });
    const j = await jpegOf(cv); cv.width = cv.height = 0; return j;
  }
  const free = cv => { cv.width = cv.height = 0; };

  /* ---- страницы по размеру A4 ---- */
  async function plainPage(el, out) {
    const cv = await shot(el, K);
    out.push(await pageOf(K, [{ src: cv, sx: 0, sy: 0, sw: cv.width, sh: cv.height, dx: 0, dy: 0 }])); free(cv);
  }

  // Тексты умений в две колонки: на печати колонки заполняются по листам (лист 1: левая, правая; лист 2: левая, правая…).
  // Делаем так же: колонкам задаём высоту листа, лишний текст браузер сам переносит в колонки правее, и каждая пара колонок — отдельная страница.
  async function ftxtPages(el, out) {
    const feat = el.querySelector('.pfeat'), gap = parseFloat(getComputedStyle(feat).columnGap) || 0;
    const r0 = el.getBoundingClientRect(), f0 = feat.getBoundingClientRect();
    const top = f0.top - r0.top, left = f0.left - r0.left, w = f0.width, colH = (PAD_T + BODY_H) * MM - top;
    feat.style.height = colH + 'px'; feat.style.columnFill = 'auto'; el.style.minHeight = '0';
    const n = Math.max(1, Math.ceil((feat.scrollWidth + gap) / (w + gap) - 0.02));
    // только до правого края колонок: следующая колонка начинается на 2 мм раньше края страницы, и её начало попало бы в поле
    const head = await shot(el, K, { x: 0, y: 0, w: left + w, h: Math.min(r0.height, PH * MM) });
    out.push(await pageOf(K, [{ src: head, sx: 0, sy: 0, sw: head.width, sh: head.height, dx: 0, dy: 0 }]));
    for (let j = 1; j < n; j++) {
      const cols = await shot(el, K, { x: left + j * (w + gap), y: top, w, h: colH });
      // на следующих листах — тот же заголовок страницы, что и на первом
      out.push(await pageOf(K, [{ src: head, sx: 0, sy: 0, sw: head.width, sh: top * K, dx: 0, dy: 0 }, { src: cols, sx: 0, sy: 0, sw: cols.width, sh: cols.height, dx: left / MM, dy: top / MM }]));
      free(cols);
    }
    free(head);
  }

  // Остальные длинные страницы (описание, снаряжение, облики): делим на листы A4 по границе между блоками, не посреди строки
  function cutPoints(el, topPx, endPx, bodyPx) {
    const r0 = el.getBoundingClientRect(), box = [];
    el.querySelectorAll('.pform, .pcard, .ph, tr, li, p, .ft, .fi, .iti, .st, .pfi, .pfk').forEach(n => {
      const r = n.getBoundingClientRect(); if (r.height > 2) box.push([r.top - r0.top, r.bottom - r0.top]);
    });
    const cuts = []; let start = topPx;
    while (endPx - start > bodyPx + 1) {
      const lim = start + bodyPx; let best = lim, bad = Infinity;
      for (let y = lim; y > start + bodyPx * 0.55; y -= 2) {
        const hit = box.reduce((s, [a, b]) => s + (a + 1 < y && b - 1 > y ? 1 : 0), 0);
        if (hit < bad) { bad = hit; best = y; if (!hit) break; }
      }
      cuts.push(best); start = best;
    }
    return cuts;
  }
  async function slicedPages(el, out) {
    const r = el.getBoundingClientRect(), k = Math.min(K, Math.sqrt(MAX_PX / (r.width * r.height))), cv = await shot(el, k);
    const kk = cv.width / r.width, padT = PAD_T * MM, end = r.height - PAD_B * MM;
    const edge = [padT].concat(cutPoints(el, padT, end, BODY_H * MM), end);
    for (let j = 0; j + 1 < edge.length; j++)
      out.push(await pageOf(kk, [{ src: cv, sx: 0, sy: edge[j] * kk, sw: cv.width, sh: (edge[j + 1] - edge[j]) * kk, dx: 0, dy: PAD_T }]));
    free(cv);
  }

  /* ---- весь лист → PDF ---- */
  async function fromSheet(sh, o) {
    o = o || {}; const say = o.onProgress || (() => {});
    await ready();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await sleep(150);   // шрифты, которые лист только что начал использовать, успевают подгрузиться
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const pgs = Array.from(sh.querySelectorAll('.pg')), out = [];
    for (let i = 0; i < pgs.length; i++) {
      say(i + 1, pgs.length);
      const el = pgs[i], tall = el.getBoundingClientRect().height / MM > PH + 0.6;
      if (!tall) await plainPage(el, out);
      else if (el.classList.contains('ftxt') && el.querySelector('.pfeat')) await ftxtPages(el, out);
      else await slicedPages(el, out);
      await sleep(0);
    }
    if (!out.length) throw new Error('нет страниц');
    return pdfOf(out, o.title || 'Лист персонажа');
  }

  root.CSPDF = { ready, fromSheet, pdfOf };
})(window);
