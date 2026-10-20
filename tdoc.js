/* ===== Документы на языках D&D =====
   Рисует записку, письмо, указ и т. п. на canvas: процедурная бумага (пергамент, обожжённая, рваная…), рамка, печать, чернила.
   Один и тот же рисовальщик работает для превью, экспорта в PNG и панели «Записка» на экране мастера, поэтому везде получается одно и то же.
   Текст переводится через TR.run (translator.js). Состояние документа — обычный JSON (spec), его удобно хранить в localStorage и в панели. */
(function (root) {
  'use strict';
  const W = 720;                                         // логическая ширина листа; в PNG умножается на масштаб
  const SYM = '"Noto Sans Symbols 2","Noto Sans Math","Noto Sans Runic","Noto Sans Coptic","Noto Sans Cuneiform","Noto Sans Imperial Aramaic","Noto Sans Shavian","PT Serif",serif';
  const FONTS = [
    ['serif', 'Книжный', '"PT Serif",Georgia,serif'], ['marck', 'Перо', '"Marck Script",cursive'], ['caveat', 'Быстрый почерк', '"Caveat",cursive'],
    ['uncial', 'Унциал', '"Cormorant Unicial","PT Serif",serif'], ['ruslan', 'Декоративный', '"Ruslan Display","PT Serif",serif'], ['neucha', 'Печатный от руки', '"Neucha",cursive']];
  const INKS = [['black', 'Чёрные', '#1c1610'], ['brown', 'Коричневые', '#4a2c14'], ['red', 'Красные', '#8a1c12'], ['blue', 'Синие', '#1f3a6e']];
  const PAPERS = {
    parchment: { n: 'Пергамент', g: ['#efdcae', '#dcc18a'], tone: '120,80,30', blot: 1 },
    clean: { n: 'Чистая', g: ['#faf6ea', '#f0ead8'], tone: '150,140,110', blot: .35 },
    worn: { n: 'Потёртая', g: ['#e2d1a5', '#cdb887'], tone: '100,80,40', blot: 1, worn: 1 },
    torn: { n: 'Рваная', g: ['#ecd9a9', '#d8bd85'], tone: '120,80,30', blot: 1, torn: 1 },
    burnt: { n: 'Обожжённая', g: ['#e8cf98', '#d1b072'], tone: '110,70,20', blot: 1, burn: 1 },
    stained: { n: 'В пятнах', g: ['#efdcb0', '#dcc58f'], tone: '120,80,30', blot: 1, stains: 1 }
  };
  const FRAMES = [['none', 'Без рамки'], ['line', 'Линия'], ['double', 'Двойная'], ['ornate', 'Узорная'], ['scroll', 'Свиток']];
  const SEALS = [['', 'Нет'], ['red', 'Красная'], ['black', 'Чёрная'], ['blue', 'Синяя'], ['green', 'Зелёная']];
  const SEALC = { red: ['#c0392b', '#8e1b12', '#5a0d08'], black: ['#6a6a6a', '#2e2e2e', '#111'], blue: ['#3b6db3', '#1f406f', '#0e2040'], green: ['#4a9a58', '#28622f', '#103018'] };
  const KINDS = {
    note: { n: 'Записка', paper: 'torn', font: 'marck', frame: 'none', seal: '', ink: 'brown', size: 28, align: 'left', fmt: 'note', ts: 1.3 },
    letter: { n: 'Письмо', paper: 'parchment', font: 'marck', frame: 'none', seal: 'red', ink: 'brown', size: 28, align: 'left', fmt: 'page', ts: 1.4 },
    scroll: { n: 'Свиток', paper: 'parchment', font: 'uncial', frame: 'scroll', seal: '', ink: 'black', size: 28, align: 'left', fmt: 'page', ts: 1.5 },
    decree: { n: 'Указ', paper: 'parchment', font: 'uncial', frame: 'ornate', seal: 'red', ink: 'black', size: 28, align: 'center', fmt: 'page', ts: 1.7 },
    wanted: { n: 'Розыск', paper: 'worn', font: 'serif', frame: 'double', seal: '', ink: 'black', size: 28, align: 'center', fmt: 'page', ts: 2.1 },
    contract: { n: 'Контракт', paper: 'clean', font: 'serif', frame: 'line', seal: 'black', ink: 'blue', size: 24, align: 'left', fmt: 'page', ts: 1.5, line: 1 }
  };
  const T = () => root.TR;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
    for (const x of kids.flat()) if (x !== false && x != null) e.append(typeof x === 'object' ? x : document.createTextNode(x));
    return e;
  };
  const toast = t => root.DM && root.DM.toast ? root.DM.toast(t) : alert(t);
  const rngOf = seed => { let a = (seed || 1) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  function defaults() { return applyKind({ v: 1, mode: 'elf', text: '', title: '', sign: '', tr: true, kind: 'note', seed: 1 + Math.floor(Math.random() * 99999), q: 2 }, 'note'); }
  function applyKind(s, k) { const d = KINDS[k] || KINDS.note; s.kind = k; for (const f of ['paper', 'font', 'frame', 'seal', 'ink', 'size', 'align', 'fmt']) s[f] = d[f]; return s; }
  function normalize(s) { const d = defaults(); for (const k in d) if (s[k] === undefined) s[k] = d[k]; if (!PAPERS[s.paper]) s.paper = 'parchment'; if (!T().MODES[s.mode]) s.mode = 'elf'; s.size = clamp(+s.size || 28, 14, 48); return s; }

  /* ---------- картинки-глифы ---------- */
  const IMG = new Map();
  const loadImg = src => { if (!IMG.has(src)) IMG.set(src, new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; })); return IMG.get(src); };
  const TINT = new Map();
  function tinted(img, color, hgt) {                     // чёрный глиф на прозрачном фоне → нужный цвет чернил
    const k = img.src + color + hgt; if (TINT.has(k)) return TINT.get(k);
    const w = Math.max(1, Math.round(img.width * hgt / img.height)), c = document.createElement('canvas'); c.width = w * 2; c.height = hgt * 2;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    TINT.set(k, c); return c;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  const fontCss = s => (FONTS.find(f => f[0] === s.font) || FONTS[0])[2];

  /* ---------- бумага ---------- */
  function jag(ctx, w, hh, inset, amp, step, rng) {      // рваный/неровный контур по периметру
    const pts = [], edge = (x0, y0, x1, y1) => {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let i = 0; i < n; i++) { const t = i / n, a = rng() < .05 ? amp * 2.6 : amp; pts.push([x0 + (x1 - x0) * t + (rng() - .5) * a, y0 + (y1 - y0) * t + (rng() - .5) * a]); }
    };
    edge(inset, inset, w - inset, inset); edge(w - inset, inset, w - inset, hh - inset); edge(w - inset, hh - inset, inset, hh - inset); edge(inset, hh - inset, inset, inset);
    ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.closePath();
  }
  function paper(ctx, w, hh, kind, rng) {
    const P = PAPERS[kind], tone = P.tone;
    ctx.save();
    if (P.torn) {                                        // тень и рваная кромка
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3; ctx.fillStyle = P.g[0]; ctx.beginPath(); jag(ctx, w, hh, 2, 7, 6, rngOf(7)); ctx.fill(); ctx.restore();
      ctx.beginPath(); jag(ctx, w, hh, 2, 7, 6, rngOf(7)); ctx.clip();
    } else { ctx.beginPath(); ctx.rect(0, 0, w, hh); ctx.clip(); }
    const g = ctx.createLinearGradient(0, 0, w * .4, hh); g.addColorStop(0, P.g[0]); g.addColorStop(1, P.g[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
    for (let i = 0; i < 18; i++) {                       // пятна выцветания
      const x = rng() * w, y = rng() * hh, r = 60 + rng() * 170, b = ctx.createRadialGradient(x, y, 0, x, y, r), a = (.04 + rng() * .07) * P.blot;
      b.addColorStop(0, `rgba(${tone},${a})`); b.addColorStop(1, `rgba(${tone},0)`); ctx.fillStyle = b; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0, n = Math.round(w * hh / 55); i < n; i++) { ctx.fillStyle = `rgba(${tone},${(.04 + rng() * .08) * (P.blot > .5 ? 1 : .6)})`; ctx.fillRect(rng() * w, rng() * hh, .6 + rng() * 1.6, .6 + rng() * 1.6); }
    for (let i = 0; i < 40; i++) { ctx.strokeStyle = `rgba(${tone},.05)`; ctx.lineWidth = .6; ctx.beginPath(); const x = rng() * w, y = rng() * hh; ctx.moveTo(x, y); ctx.lineTo(x + (rng() - .5) * 60, y + (rng() - .5) * 60); ctx.stroke(); }
    if (P.worn) {
      for (const f of [.33 + rng() * .08, .66 + rng() * .06]) { const x = w * f, v = ctx.createLinearGradient(x - 5, 0, x + 5, 0); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.45, 'rgba(60,35,10,.2)'); v.addColorStop(.55, 'rgba(255,250,230,.26)'); v.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = v; ctx.fillRect(x - 5, 0, 10, hh); }
      const y = hh * (.45 + rng() * .1), v = ctx.createLinearGradient(0, y - 5, 0, y + 5); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.45, 'rgba(60,35,10,.2)'); v.addColorStop(.55, 'rgba(255,250,230,.26)'); v.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = v; ctx.fillRect(0, y - 5, w, 10);
      for (let i = 0; i < 38; i++) { ctx.strokeStyle = `rgba(70,45,15,${.05 + rng() * .1})`; ctx.lineWidth = .5 + rng(); ctx.beginPath(); const x = rng() * w, yy = rng() * hh, a = rng() * 6.28, l = 10 + rng() * 50; ctx.moveTo(x, yy); ctx.lineTo(x + Math.cos(a) * l, yy + Math.sin(a) * l); ctx.stroke(); }
    }
    if (P.stains) {
      for (let i = 0; i < 2; i++) { const x = w * (.15 + rng() * .7), y = hh * (.12 + rng() * .76), r = 36 + rng() * 34; ctx.fillStyle = 'rgba(120,80,30,.07)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(110,70,30,.3)'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = 'rgba(110,70,30,.14)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 2, y + 1, r - 5, 0, 7); ctx.stroke(); }
      for (let i = 0; i < 3; i++) {
        const x = w * (.1 + rng() * .8), y = hh * (.1 + rng() * .8);
        for (let j = 0; j < 9; j++) { const px = x + (rng() - .5) * 46, py = y + (rng() - .5) * 46, r = 7 + rng() * 22, b = ctx.createRadialGradient(px, py, 0, px, py, r); b.addColorStop(0, 'rgba(25,20,50,.5)'); b.addColorStop(.7, 'rgba(25,20,50,.28)'); b.addColorStop(1, 'rgba(25,20,50,0)'); ctx.fillStyle = b; ctx.fillRect(px - r, py - r, r * 2, r * 2); }
        for (let j = 0; j < 14; j++) { ctx.fillStyle = 'rgba(25,20,50,.5)'; ctx.beginPath(); ctx.arc(x + (rng() - .5) * 140, y + (rng() - .5) * 140, .6 + rng() * 2, 0, 7); ctx.fill(); }
      }
    }
    const vg = ctx.createRadialGradient(w / 2, hh / 2, Math.min(w, hh) * .38, w / 2, hh / 2, Math.max(w, hh) * .78);   // потемнение к краям
    vg.addColorStop(0, `rgba(${tone},0)`); vg.addColorStop(1, `rgba(${tone},${.16 + .22 * P.blot})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, hh);
    if (P.burn) {
      const bseed = Math.floor(rng() * 1e9);                 // один и тот же контур для обугленной каймы и для свечения
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hh); jag(ctx, w, hh, 26, 20, 10, rngOf(bseed)); ctx.clip('evenodd');
      const c = ctx.createLinearGradient(0, 0, w, hh); c.addColorStop(0, '#120803'); c.addColorStop(1, '#1d0e05'); ctx.fillStyle = c; ctx.fillRect(0, 0, w, hh); ctx.restore();
      const cx = rng() < .5 ? 0 : w, cy = rng() < .5 ? 0 : hh, bb = ctx.createRadialGradient(cx, cy, 0, cx, cy, 190); bb.addColorStop(0, 'rgba(15,8,3,.95)'); bb.addColorStop(.6, 'rgba(40,20,8,.5)'); bb.addColorStop(1, 'rgba(40,20,8,0)'); ctx.fillStyle = bb; ctx.fillRect(0, 0, w, hh);
      ctx.save(); ctx.shadowColor = 'rgba(255,130,30,.85)'; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(95,35,8,.85)'; ctx.lineWidth = 4; ctx.beginPath(); jag(ctx, w, hh, 26, 20, 10, rngOf(bseed)); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  function frame(ctx, w, hh, kind, ink) {
    ctx.save(); ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.globalAlpha = .85;
    if (kind === 'line') { ctx.lineWidth = 2; ctx.strokeRect(30, 30, w - 60, hh - 60); }
    if (kind === 'double' || kind === 'ornate') {
      ctx.lineWidth = 3.2; ctx.strokeRect(24, 24, w - 48, hh - 48); ctx.lineWidth = 1.2; ctx.strokeRect(33, 33, w - 66, hh - 66);
      if (kind === 'ornate') {
        ctx.lineWidth = 1.8; const x0 = 33, y0 = 33, x1 = w - 33, y1 = hh - 33, r = 22, PI = Math.PI;
        [[x0, y0, 0, PI / 2], [x1, y0, PI / 2, PI], [x1, y1, PI, PI * 1.5], [x0, y1, PI * 1.5, PI * 2]].forEach(([x, y, a, b]) => { ctx.beginPath(); ctx.arc(x, y, r, a, b); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * .45, a, b); ctx.stroke(); });
        [[w / 2, 24], [w / 2, hh - 24], [24, hh / 2], [w - 24, hh / 2]].forEach(([x, y]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); });
      }
    }
    ctx.restore();
  }
  function rods(ctx, w, hh) {
    for (const y of [0, hh - 28]) {
      const g = ctx.createLinearGradient(0, y, 0, y + 28); g.addColorStop(0, '#5a3416'); g.addColorStop(.35, '#b07a42'); g.addColorStop(.7, '#7a4b22'); g.addColorStop(1, '#3f2410');
      ctx.fillStyle = g; ctx.fillRect(14, y, w - 28, 28);
      for (const x of [14, w - 14]) { ctx.beginPath(); ctx.arc(x, y + 14, 16, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(30,15,5,.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      const sh = ctx.createLinearGradient(0, y === 0 ? 28 : hh - 28 - 12, 0, y === 0 ? 40 : hh - 28); sh.addColorStop(0, y === 0 ? 'rgba(40,20,5,.35)' : 'rgba(40,20,5,0)'); sh.addColorStop(1, y === 0 ? 'rgba(40,20,5,0)' : 'rgba(40,20,5,.35)'); ctx.fillStyle = sh; ctx.fillRect(14, y === 0 ? 28 : hh - 40, w - 28, 12);
    }
  }
  function wax(ctx, cx, cy, color, rng, drawGlyph) {
    const C = SEALC[color] || SEALC.red, pts = [], n = 40;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 40 + (rng() - .5) * 6 + (i % 7 === 0 ? 4 : 0); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    const g = ctx.createRadialGradient(cx - 12, cy - 12, 4, cx, cy, 46); g.addColorStop(0, C[0]); g.addColorStop(.6, C[1]); g.addColorStop(1, C[2]);
    ctx.fillStyle = g; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 28, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx + .8, cy + .8, 29.5, 0, 7); ctx.stroke();
    drawGlyph(ctx, cx, cy);
  }

  /* ---------- сборка листа ---------- */
  async function render(spec, opts) {
    opts = opts || {}; spec = normalize(Object.assign({}, spec));
    const tr = T(), m = tr.MODES[spec.mode], K = KINDS[spec.kind] || KINDS.note, scale = opts.scale || 2;
    const ink = (INKS.find(i => i[0] === spec.ink) || INKS[0])[2];
    const body = (spec.text || '').slice(0, 3000), meta = s => (spec.tr === false ? { text: s } : tr.run(spec.mode, s));
    const res = s => { const r = (spec.mode === 'deep' && s === body) ? { text: (tr.run('deep', s).read || '').replace(/^Звучание:\s*/, '') } : meta(s); return r; };
    const rb = res(body.trim() ? body : 'Текст записки'), rt = res((spec.title || '').trim() ? spec.title : ''), rs = res((spec.sign || '').trim() ? spec.sign : '');
    const bodyFont = sz => `${sz}px ${m.g ? SYM : fontCss(spec)}`, titleFont = sz => `${m.g ? '' : 'bold '}${sz}px ${m.g ? SYM : fontCss(spec)}`;
    // шрифты и картинки
    const allText = (rb.text || '') + (rt.text || '') + (rs.text || '') + 'АаБб';
    const srcs = new Set(); [rb, rt, rs].forEach(r => (r.nodes || []).forEach(n => n.img && srcs.add(n.img)));
    const first = ((spec.sign || spec.title || spec.text || '').toLowerCase().match(/[а-яё]/) || ['а'])[0], sealIdx = tr.L.indexOf(first);   // буква для печати
    if (spec.seal && m.img) srcs.add(tr.imgSrc(m.img, first));
    await withTimeout(Promise.all([document.fonts.load(bodyFont(28), allText), document.fonts.load(titleFont(28), allText), ...[...srcs].map(loadImg)].map(p => p.catch(() => null))), 3000);
    const imgs = new Map(); for (const s of srcs) imgs.set(s, await loadImg(s));
    const mc = document.createElement('canvas').getContext('2d');
    const size = spec.size, frameK = spec.frame, mx = frameK === 'none' ? 56 : frameK === 'scroll' ? 66 : 74, my = frameK === 'none' ? 54 : frameK === 'scroll' ? 78 : 72, cw = W - mx * 2;
    // блок: переносы строк
    function block(r, sz, font, align) {
      const ih = sz * 1.45, items = [];
      if (r.nodes) r.nodes.forEach(n => { if (n.br) items.push({ k: 'br' }); else if (n.sp) items.push({ k: 'sp', w: sz * .55 }); else if (n.img) items.push({ k: 'i', img: imgs.get(n.img), w: imgs.get(n.img) ? ih * imgs.get(n.img).width / imgs.get(n.img).height + 3 : 0 }); else for (const ch of n.t) items.push({ k: 'c', s: ch }); });
      else for (const ch of (r.text || '')) items.push(ch === '\n' ? { k: 'br' } : (ch === ' ' || ch === '\t') ? { k: 'sp' } : { k: 'c', s: ch });
      mc.font = font; const spw = mc.measureText(' ').width || sz * .3;
      items.forEach(it => { if (it.k === 'c') it.w = mc.measureText(it.s).width; else if (it.k === 'sp' && !it.w) it.w = spw; });
      const lines = []; let cur = [], cwid = 0, word = [], ww = 0;
      const push = () => { while (cur.length && cur[cur.length - 1].k === 'sp') cwid -= cur.pop().w; lines.push({ items: cur, w: Math.max(0, cwid) }); cur = []; cwid = 0; };
      const flush = () => {
        if (!word.length) return;
        if (cwid + ww > cw && cur.length) push();
        if (ww > cw) for (const it of word) { if (cwid + it.w > cw && cur.length) push(); cur.push(it); cwid += it.w; } else { cur.push(...word); cwid += ww; }
        word = []; ww = 0;
      };
      for (const it of items) {
        if (it.k === 'br') { flush(); push(); } else if (it.k === 'sp') { flush(); if (cur.length) { cur.push(it); cwid += it.w; } } else { word.push(it); ww += it.w; }
      }
      flush(); if (cur.length) push();
      return { lines, sz, ih, lh: sz * 1.6, font, align, empty: !items.length };
    }
    const tB = block(rb, size, bodyFont(size), spec.align), hasT = !!(spec.title || '').trim(), hasS = !!(spec.sign || '').trim();
    const tT = hasT ? block(rt, size * K.ts, titleFont(size * K.ts), 'center') : null;
    const sealOn = !!spec.seal, sgSize = size * 1.05;
    const tS = hasS ? block(rs, sgSize, bodyFont(sgSize), 'right') : null;
    const titleH = tT ? tT.lines.length * tT.lh + size * .9 : 0, bodyH = tB.lines.length * tB.lh;
    const signH = tS ? tS.lines.length * tS.lh + (K.line ? 10 : 0) : 0, botH = Math.max(signH, sealOn ? 96 : 0), gap = (tS || sealOn) ? size * .9 : 0;
    let H = Math.ceil(my + titleH + bodyH + gap + botH + my);
    H = spec.fmt === 'page' ? Math.max(H, Math.round(W * 1.414)) : Math.max(H, 250);
    const torn = !!PAPERS[spec.paper].torn, pad = torn ? 20 : 0;
    const cv = document.createElement('canvas'); cv.width = Math.round((W + pad * 2) * scale); cv.height = Math.round((H + pad * 2) * scale);
    const ctx = cv.getContext('2d'); ctx.scale(scale, scale); ctx.translate(pad, pad);
    const rng = rngOf(spec.seed);
    paper(ctx, W, H, spec.paper, rng);
    if (frameK === 'scroll') rods(ctx, W, H); else if (frameK !== 'none') frame(ctx, W, H, frameK, ink);
    // текст
    const drawBlock = (b, y0, xr) => {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ink; ctx.font = b.font; ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = ink + '55'; ctx.shadowBlur = 1.3;
      const right = xr == null ? W - mx : xr;
      b.lines.forEach((ln, i) => {
        let x = b.align === 'center' ? mx + (cw - ln.w) / 2 : b.align === 'right' ? right - ln.w : mx; const top = y0 + i * b.lh, base = top + b.lh * .68;
        for (const it of ln.items) {
          if (it.k === 'c') ctx.fillText(it.s, x, base);
          else if (it.k === 'i' && it.img) { const t = tinted(it.img, ink, Math.round(b.ih)); ctx.drawImage(t, x + 1.5, top + (b.lh - b.ih) / 2, it.w - 3, b.ih); }
          x += it.w;
        }
      });
      ctx.restore();
    };
    let y = my; if (tT) { drawBlock(tT, y); y += titleH; }
    drawBlock(tB, y);
    const bot = H - my - botH;
    if (tS) {
      const sx = sealOn ? W - mx - 104 : W - mx, sy = bot + (botH - signH) / 2 + (K.line ? 10 : 0);
      if (K.line) { ctx.save(); ctx.strokeStyle = ink; ctx.globalAlpha = .7; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx - 220, sy - 4); ctx.lineTo(sx, sy - 4); ctx.stroke(); ctx.restore(); }
      drawBlock(tS, sy, sx);
    }
    if (sealOn) {
      wax(ctx, W - mx - 44, bot + botH / 2, spec.seal, rngOf(spec.seed + 3), (c, cx, cy) => {
        c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
        const ch = m.g ? tr.G[m.g][sealIdx] : null;
        if (m.img) { const im = imgs.get(tr.imgSrc(m.img, first)) || null; if (im) { const t = tinted(im, 'rgba(0,0,0,.45)', 38), t2 = tinted(im, 'rgba(255,230,220,.28)', 38), w2 = t.width / 2; c.drawImage(t2, cx - w2 / 2 - 1, cy - 19 - 1, w2, 38); c.drawImage(t, cx - w2 / 2, cy - 19, w2, 38); } }
        else { c.font = `34px ${m.g ? SYM : '"PT Serif",serif'}`; const s = ch || first.toUpperCase(); c.fillStyle = 'rgba(255,230,220,.28)'; c.fillText(s, cx - 1, cy - 1); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillText(s, cx, cy); }
        c.restore();
      });
    }
    return cv;
  }

  /* ---------- экспорт ---------- */
  const blobOf = async (spec, scale) => { const cv = await render(spec, { scale }); const b = await new Promise(r => cv.toBlob(r, 'image/png')); if (!b) throw new Error('не удалось создать картинку'); return b; };
  async function download(spec, scale) {
    try {
      const b = await blobOf(spec, scale || spec.q || 2), a = h('a', { href: URL.createObjectURL(b), download: 'dnd-' + (spec.kind || 'document') + '.png' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('PNG сохранён');
    } catch (e) { toast('Не получилось сохранить PNG: ' + (e.message || e)); }
  }
  async function copy(spec, scale) {
    try {
      if (!navigator.clipboard || !root.ClipboardItem) throw new Error('браузер не умеет копировать картинки, скачайте PNG');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobOf(spec, scale || 2) })]);
      toast('Картинка скопирована: можно вставлять в чат (Ctrl+V)');
    } catch (e) { toast('Не получилось скопировать: ' + (e.message || e)); }
  }

  /* ---------- конструктор ---------- */
  function designer(spec, opts) {
    opts = opts || {}; normalize(spec);
    const syncs = [], tr = T();
    let seq = 0, tm = 0;
    const prev = h('div', { class: 'tddv' }), key = h('details', { class: 'tddk' }, h('summary', {}, 'Расшифровка (для мастера)'), h('p', {}));
    const draw = async () => {
      const my = ++seq; prev.classList.add('busy');
      try {
        const cv = await render(spec, { scale: 2 });
        if (my !== seq) return; prev.replaceChildren(cv); prev.classList.remove('busy');
      } catch (e) { if (my === seq) { prev.textContent = 'Не удалось нарисовать: ' + e.message; prev.classList.remove('busy'); } }
      key.querySelector('p').textContent = [spec.title, spec.text, spec.sign].filter(Boolean).join('\n\n') || 'Пока пусто'; key.querySelector('p').style.whiteSpace = 'pre-wrap';
    };
    const changed = () => { clearTimeout(tm); tm = setTimeout(draw, 120); opts.onChange && opts.onChange(spec); };
    const fld = (label, node, cls) => h('div', { class: 'tddf ' + (cls || '') }, h('span', { class: 'trlbl' }, label), node);
    const chips = (field, options, after) => {
      const box = h('div', { class: 'trchips', role: 'group' }), bs = options.map(([v, n]) => h('button', { type: 'button', class: 'chip sub', onclick: () => { spec[field] = v; if (after) after(v); sync(); changed(); } }, n));
      box.append(...bs); syncs.push(() => bs.forEach((b, i) => b.setAttribute('aria-pressed', String(spec[field] === options[i][0])))); return box;
    };
    const text = (field, label, max, area) => {
      const el = area ? h('textarea', { rows: 5, maxlength: max, spellcheck: 'false' }) : h('input', { type: 'text', maxlength: max, spellcheck: 'false', autocomplete: 'off' }), cnt = h('small', { class: 'tddn' });
      el.addEventListener('input', () => { spec[field] = el.value; cnt.textContent = el.value.length + ' / ' + max; changed(); });
      syncs.push(() => { if (el.value !== (spec[field] || '')) el.value = spec[field] || ''; cnt.textContent = el.value.length + ' / ' + max; });
      return fld(label, h('div', {}, el, cnt));
    };
    const modeSel = h('select', { 'aria-label': 'Язык' }, tr.FAMILIES.map(f => h('optgroup', { label: f.n }, f.v.map(v => h('option', { value: v }, f.v.length > 1 && tr.MODES[v].n !== f.n ? f.n + ' · ' + tr.MODES[v].n : f.n)))));
    modeSel.addEventListener('change', () => { spec.mode = modeSel.value; changed(); });
    syncs.push(() => { modeSel.value = spec.mode; });
    const trBox = h('input', { type: 'checkbox' }); trBox.addEventListener('change', () => { spec.tr = trBox.checked; changed(); }); syncs.push(() => { trBox.checked = spec.tr !== false; });
    const inkBox = h('div', { class: 'trchips' }), inkBs = INKS.map(([v, n, c]) => h('button', { type: 'button', class: 'tddink', title: n, 'aria-label': n, style: 'background:' + c, onclick: () => { spec.ink = v; sync(); changed(); } }));
    inkBox.append(...inkBs); syncs.push(() => inkBs.forEach((b, i) => b.setAttribute('aria-pressed', String(spec.ink === INKS[i][0]))));
    const fontSel = h('select', { 'aria-label': 'Шрифт' }, FONTS.map(f => h('option', { value: f[0] }, f[1]))); fontSel.addEventListener('change', () => { spec.font = fontSel.value; changed(); }); syncs.push(() => { fontSel.value = spec.font; });
    const size = h('input', { type: 'range', min: 14, max: 48, step: 1, 'aria-label': 'Размер текста' }), sizeV = h('small', { class: 'tddn' });
    size.addEventListener('input', () => { spec.size = +size.value; sizeV.textContent = size.value; changed(); }); syncs.push(() => { size.value = spec.size; sizeV.textContent = spec.size; });
    const qSel = h('select', { 'aria-label': 'Качество PNG' }, [[1, 'Обычное, 720 px'], [2, 'Хорошее, 1440 px'], [3, 'Для печати, 2160 px']].map(([v, n]) => h('option', { value: v }, n))); qSel.addEventListener('change', () => { spec.q = +qSel.value; opts.onChange && opts.onChange(spec); }); syncs.push(() => { qSel.value = spec.q || 2; });
    const sync = () => syncs.forEach(f => f());
    const src = opts.source === false ? null : [fld('Язык', modeSel), text('text', 'Текст (по-русски)', 3000, true), text('title', 'Заголовок', 80), text('sign', 'Подпись', 60), h('label', { class: 'tddc' }, trBox, ' Переводить заголовок и подпись')];
    const ctl = h('div', { class: 'tddc2' }, src,
      fld('Тип документа', chips('kind', Object.entries(KINDS).map(([k, d]) => [k, d.n]), k => applyKind(spec, k))),
      fld('Бумага', chips('paper', Object.entries(PAPERS).map(([k, d]) => [k, d.n]))),
      fld('Рамка', chips('frame', FRAMES)), fld('Печать', chips('seal', SEALS)),
      fld('Чернила', inkBox), fld('Шрифт (для обычных слов)', fontSel),
      fld('Размер текста', h('div', { class: 'tddr' }, size, sizeV)), fld('Выравнивание', chips('align', [['left', 'Слева'], ['center', 'По центру']])),
      fld('Формат листа', chips('fmt', [['note', 'По тексту'], ['page', 'Страница']])),
      h('div', { class: 'trbtns' }, h('button', { type: 'button', class: 'trbtn', onclick: () => { spec.seed = 1 + Math.floor(Math.random() * 99999); changed(); } }, 'Другой узор бумаги')));
    const acts = h('div', { class: 'trbtns' },
      h('button', { type: 'button', class: 'trbtn main', onclick: () => download(spec) }, 'Скачать PNG'),
      h('button', { type: 'button', class: 'trbtn', onclick: () => copy(spec) }, 'Копировать PNG'),
      (opts.actions || []).map(([n, f]) => h('button', { type: 'button', class: 'trbtn', onclick: () => f(spec) }, n)), fld('Качество PNG', qSel, 'tddq'));
    const el = h('div', { class: 'tdd' }, ctl, h('div', { class: 'tddp' }, prev, key, acts));
    sync(); draw();
    return { el, spec, sync: () => { normalize(spec); sync(); draw(); }, redraw: draw };
  }

  /* ---------- окно правки ---------- */
  function edit(spec, onSave) {
    const copyS = JSON.parse(JSON.stringify(spec)), d = designer(copyS);
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc); }, esc = e => { if (e.key === 'Escape') close(); };
    const ov = h('div', { class: 'tdmodal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Правка записки' }, h('div', { class: 'tdbox' },
      h('div', { class: 'tdhd' }, h('b', {}, 'Правка документа'), h('button', { type: 'button', class: 'trbtn', onclick: close }, 'Отмена'), h('button', { type: 'button', class: 'trbtn main', onclick: () => { Object.assign(spec, copyS); close(); onSave && onSave(spec); } }, 'Сохранить')), d.el));
    document.body.append(ov); document.addEventListener('keydown', esc);
  }

  /* ---------- панель «Записка» на экране мастера ---------- */
  function registerPanel() {
    if (!root.DM || !root.DM.registerType) return;
    root.DM.registerType('note', {
      name: 'Записка', desc: 'Документ на языке D&D: письмо, указ, записка. Картинка, которую можно скачать', w: 7, h: 8,
      init: () => { const s = defaults(); s.fmt = 'note'; return s; },
      render(ctx) {
        const s = normalize(ctx.p.s), box = h('div', { class: 'tdn' }), key = h('details', { class: 'tddk' }, h('summary', {}, 'Расшифровка'), h('p', {}));
        let seq = 0;
        const draw = async () => {
          const my = ++seq; ctx.title(s.title || 'Записка');
          key.querySelector('p').textContent = [s.title, s.text, s.sign].filter(Boolean).join('\n\n') || 'Пока пусто'; key.querySelector('p').style.whiteSpace = 'pre-wrap';
          try { const cv = await render(s, { scale: 2 }); if (my === seq) box.replaceChildren(cv, key); } catch (e) { box.textContent = 'Не удалось нарисовать записку: ' + e.message; }
        };
        const openEdit = () => edit(s, () => { Object.assign(ctx.p.s, s); ctx.save(); draw(); });
        ctx.addBtn('✎', 'Править записку', openEdit); ctx.addBtn('⇩', 'Скачать PNG', () => download(s));
        ctx.body.append(box); box.textContent = 'Рисую…'; draw();
        if (!(s.text || '').trim() && !ctx.p.s._seen) { ctx.p.s._seen = 1; setTimeout(openEdit, 50); }
      }
    });
  }
  registerPanel();

  root.TDoc = { render, download, copy, designer, edit, defaults, applyKind, normalize, KINDS, PAPERS };
})(window);
