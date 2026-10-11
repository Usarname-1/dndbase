/* ===== Экран мастера =====
   Свободное полотно: панели лежат где угодно (в пикселях), не прилипают друг к другу и не сдвигают соседей.
   По полотну можно ездить (перетаскивание пустого места, колесо, Пробел/средняя кнопка) и менять масштаб.
   Вкладки-экраны, сохранение в localStorage, экспорт/импорт JSON. Сами панели — в dmpanels.js (DM.registerType).
   Связь с основным приложением — через window.DB (см. index.html). */
(function (root) {
  'use strict';
  const COLW = 80, ROWH = 44, GAP = 6;       // размеры панелей в TYPES.w/h заданы в «клетках» — переводим в пиксели
  const KEY = 'dm.v1', VER = 2, GRID = 40, ZMIN = .3, ZMAX = 1.6, MINW = 200, MINH = 110, MAXS = 6000, EDGE = 36;
  const TYPES = {}, ORDER = [];
  let zoomT = 0, S = null, ui = null, saveT = 0, undo = null, lastEntity = null, panmode = false;
  const els = new Map();                     // id панели -> {pe, ctx, disp}

  const uid = () => Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d, a, b) => typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : d;
  const DB = () => root.DB;
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const x of kids.flat()) if (x !== false && x != null) e.append(typeof x === 'object' ? x : document.createTextNode(x));
    return e;
  }

  /* ---------- состояние ---------- */
  function registerType(id, def) { TYPES[id] = def; ORDER.push(id); }
  const dimOf = t => ({ w: (TYPES[t].w || 4) * COLW - GAP, h: (TYPES[t].h || 6) * ROWH - GAP });
  const mkPanel = (t, x, y, w, hh, s, z) => ({ id: uid(), t, x, y, w, h: hh, z: z || 1, s: s || (TYPES[t].init ? TYPES[t].init() : {}) });
  function defaults() {
    return {
      v: VER, tab: 't1', tabs: [{
        id: 't1', name: 'Экран 1', view: { x: 0, y: 0, z: 1 }, panels: [
          mkPanel('init', 16, 16, 480, 480, null, 1), mkPanel('dice', 512, 16, 234, 258, null, 2),
          mkPanel('conds', 762, 16, 234, 480, null, 3), mkPanel('notes', 512, 290, 234, 206, null, 4)]
      }]
    };
  }
  // приводит любые данные (из localStorage или файла) к корректному виду; старые сохранения (сетка) переводит в пиксели
  function normalize(j) {
    if (!j || typeof j !== 'object' || !Array.isArray(j.tabs)) return null;
    const old = !(j.v >= VER), tabs = [], tid = new Set();
    for (const t of j.tabs) {
      if (!t || typeof t !== 'object' || !Array.isArray(t.panels)) continue;
      const ps = [], pid = new Set();
      for (const p of t.panels) {
        if (!p || typeof p !== 'object' || !TYPES[p.t]) continue;
        const d = dimOf(p.t), n = ps.length;
        let x = p.x, y = p.y, w = p.w, hh = p.h;
        if (old && [x, y, w, hh].every(k => typeof k === 'number' && isFinite(k))) { x = 8 + x * COLW; y = 8 + y * ROWH; w = w * COLW - GAP; hh = hh * ROWH - GAP; }
        const q = {
          id: typeof p.id === 'string' && p.id && !pid.has(p.id) ? p.id : uid(), t: p.t,
          x: num(x, 16 + (n % 10) * 28, -MAXS, MAXS), y: num(y, 16 + (n % 10) * 28, -MAXS, MAXS),
          w: num(w, d.w, MINW, MAXS), h: num(hh, d.h, MINH, MAXS),
          z: Math.round(num(old ? n + 1 : p.z, n + 1, 0, 1e6)),
          s: Object.assign(TYPES[p.t].init ? TYPES[p.t].init() : {}, p.s && typeof p.s === 'object' && !Array.isArray(p.s) ? p.s : {})
        };
        if (typeof p.title === 'string' && p.title) q.title = p.title.slice(0, 60);
        pid.add(q.id); ps.push(q);
      }
      const v = t.view && typeof t.view === 'object' ? t.view : {};
      const id = typeof t.id === 'string' && t.id && !tid.has(t.id) ? t.id : uid();
      tid.add(id);
      tabs.push({ id, name: (typeof t.name === 'string' && t.name.trim() ? t.name : 'Экран ' + (tabs.length + 1)).slice(0, 40), panels: ps,
        view: { x: num(v.x, 0, -MAXS, MAXS), y: num(v.y, 0, -MAXS, MAXS), z: num(v.z, 1, ZMIN, ZMAX) } });
    }
    if (!tabs.length) return null;
    return { v: VER, tab: tabs.some(t => t.id === j.tab) ? j.tab : tabs[0].id, tabs };
  }
  function readStore() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return null; }
  }
  function ensure() { if (!S) S = readStore() || defaults(); return S; }
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); }
      catch (e) { toast('Не удалось сохранить: память браузера заполнена. Сделайте экспорт.'); }
    }, 250);
  }
  const tab = () => ensure().tabs.find(t => t.id === S.tab);
  const panels = () => tab().panels;
  const view = () => tab().view;
  const topZ = () => Math.max(0, ...panels().map(p => p.z || 0));

  /* ---------- отображение ---------- */
  const stackMode = () => root.matchMedia('(max-width:720px)').matches;
  const vis = () => ({ w: ui.ws.clientWidth || 1000, h: ui.ws.clientHeight || 600 });

  function geom(pn) {
    const e = els.get(pn.id); if (!e) return;
    Object.assign(e.pe.style, { left: pn.x + 'px', top: pn.y + 'px', width: pn.w + 'px', height: pn.h + 'px', zIndex: pn.z });
  }
  function applyView() {
    if (!ui || !ui.grid) return;
    const v = view();
    ui.grid.style.transform = `translate(${-v.x * v.z}px,${-v.y * v.z}px) scale(${v.z})`;
    const g = GRID * v.z;
    Object.assign(ui.bg.style, { backgroundSize: g + 'px ' + g + 'px', backgroundPosition: (-v.x * v.z) + 'px ' + (-v.y * v.z) + 'px' });
    ui.zlab.textContent = Math.round(v.z * 100) + '%';
  }
  function layout() {
    if (!ui || !ui.grid) return;
    const stack = stackMode(), list = panels().slice();
    ui.ws.classList.toggle('stack', stack); ui.bar.classList.toggle('stackm', stack);
    if (stack) {
      list.sort((a, b) => a.y - b.y || a.x - b.x);
      list.forEach((pn, i) => {
        const e = els.get(pn.id); if (!e) return;
        Object.assign(e.pe.style, { left: '', top: '', width: '', height: pn.h + 'px', zIndex: '', order: i });
        e.pe.classList.toggle('first', i === 0); e.pe.classList.toggle('last', i === list.length - 1);
      });
      ui.grid.style.transform = '';
      return;
    }
    list.forEach(pn => { const e = els.get(pn.id); if (e) { e.pe.style.order = ''; geom(pn); } });
    applyView();
  }
  const bounds = () => {
    const l = panels(); if (!l.length) return null;
    const x0 = Math.min(...l.map(p => p.x)), y0 = Math.min(...l.map(p => p.y));
    return { x: x0, y: y0, w: Math.max(...l.map(p => p.x + p.w)) - x0, h: Math.max(...l.map(p => p.y + p.h)) - y0 };
  };
  function setZoom(z, cx, cy) {                // масштаб вокруг точки экрана (cx, cy относительно рабочей области)
    const v = view(), V = vis();
    if (cx == null) { cx = V.w / 2; cy = V.h / 2; }
    const nz = clamp(z, ZMIN, ZMAX), wx = v.x + cx / v.z, wy = v.y + cy / v.z;
    v.z = nz; v.x = clamp(wx - cx / nz, -MAXS, MAXS); v.y = clamp(wy - cy / nz, -MAXS, MAXS);
    applyView(); persist();
  }
  function fit() {
    const b = bounds(), v = view(), V = vis();
    if (!b) { Object.assign(v, { x: 0, y: 0, z: 1 }); }
    else {
      v.z = clamp(Math.min(V.w / (b.w + 80), V.h / (b.h + 80), 1), ZMIN, ZMAX);
      v.x = b.x + b.w / 2 - V.w / 2 / v.z; v.y = b.y + b.h / 2 - V.h / 2 / v.z;
    }
    applyView(); persist();
  }
  function reveal(pn) {                        // если панель за краем экрана — подъехать к ней
    const v = view(), V = vis();
    const l = (pn.x - v.x) * v.z, t = (pn.y - v.y) * v.z, r = l + pn.w * v.z, b = t + pn.h * v.z;
    if (l >= 0 && t >= 0 && r <= V.w && b <= V.h) return;
    v.x = pn.x + pn.w / 2 - V.w / 2 / v.z; v.y = pn.y + Math.min(pn.h, V.h / v.z - 40) / 2 - V.h / 2 / v.z;
    applyView(); persist();
  }
  // свободное место в видимой части полотна (если всё занято — каскадом со смещением)
  function freeSpot(w, hh) {
    const v = view(), V = vis(), vw = V.w / v.z, vh = V.h / v.z, list = panels();
    const hit = (x, y) => list.some(o => x < o.x + o.w + 8 && x + w + 8 > o.x && y < o.y + o.h + 8 && y + hh + 8 > o.y);
    for (let y = v.y + 16; y + hh <= v.y + vh; y += 24) for (let x = v.x + 16; x + w <= v.x + vw; x += 24) if (!hit(x, y)) return { x: Math.round(x), y: Math.round(y) };
    const k = list.length % 10;
    return { x: Math.round(v.x + 24 + k * 28), y: Math.round(v.y + 24 + k * 28) };
  }
  // «Упорядочить»: выложить панели рядами по ширине экрана без наложений (можно отменить)
  function arrange() {
    const list = panels().slice().sort((a, b) => a.y - b.y || a.x - b.x); if (!list.length) return;
    const saved = list.map(p => [p, p.x, p.y]), v = view(), W = vis().w / v.z - 32;
    let x = v.x + 16, y = v.y + 16, rowH = 0;
    list.forEach(p => {
      if (x > v.x + 16 && x + p.w > v.x + 16 + W) { x = v.x + 16; y += rowH + 12; rowH = 0; }
      p.x = Math.round(x); p.y = Math.round(y); x += p.w + 12; rowH = Math.max(rowH, p.h); geom(p);
    });
    persist();
    toast('Панели выложены рядами', 'Отменить', () => { saved.forEach(([p, px, py]) => { p.x = px; p.y = py; geom(p); }); persist(); });
  }

  /* ---------- панели ---------- */
  function buildPanel(pn) {
    const def = TYPES[pn.t];
    const pe = h('div', { class: 'dmp t-' + pn.t, 'data-id': pn.id });
    const title = h('span', { class: 'dmt', title: 'Двойной клик — переименовать' }, pn.title || def.name);
    const btns = h('span', { class: 'dmx' });
    const body = h('div', { class: 'dmb' });
    const rez = h('span', { class: 'dmr', title: 'Потяните, чтобы изменить размер' });
    pe.append(h('div', { class: 'dmh' }, title, btns), body, rez);
    const disp = [];
    const ctx = {
      p: pn, body, el: pe, save: persist, db: DB,
      title(t) { pn.autoTitle = t; if (!pn.title) title.textContent = t || def.name; },
      addBtn(txt, tip, fn) { const b = h('button', { type: 'button', title: tip, onclick: fn }, txt); btns.prepend(b); return b; },
      onDispose(fn) { disp.push(fn); },
      refresh() { if (pe._refresh) pe._refresh(); }
    };
    btns.append(
      h('button', { type: 'button', class: 'mv up', title: 'Выше', onclick: () => move(pn, -1) }, '↑'),
      h('button', { type: 'button', class: 'mv dn', title: 'Ниже', onclick: () => move(pn, 1) }, '↓'),
      h('button', { type: 'button', title: 'Закрыть панель', onclick: () => removePanel(pn) }, '×'));
    title.addEventListener('dblclick', () => {
      const t = prompt('Название панели', pn.title || pn.autoTitle || def.name);
      if (t === null) return;
      pn.title = t.trim(); title.textContent = pn.title || pn.autoTitle || def.name; persist();
    });
    els.set(pn.id, { pe, ctx, disp });
    pe.addEventListener('pointerdown', () => raise(pn));
    pe.querySelector('.dmh').addEventListener('pointerdown', ev => startDrag(ev, pn, pe));
    rez.addEventListener('pointerdown', ev => startResize(ev, pn, pe));
    try { def.render(ctx); } catch (e) { console.error(e); body.textContent = 'Ошибка панели: ' + e.message; }
    if (pn.autoTitle && !pn.title) title.textContent = pn.autoTitle;
    geom(pn);
    return pe;
  }
  function raise(pn) {                         // вынести панель поверх остальных
    if (stackMode()) return;
    const l = panels();
    if (l.every(o => o === pn || o.z < pn.z)) return;
    pn.z = topZ() + 1;
    if (pn.z > 100000) { l.slice().sort((a, b) => a.z - b.z).forEach((p, i) => { p.z = i + 1; geom(p); }); }
    geom(pn); persist();
  }

  function renderTab() {
    for (const [, e] of els) e.disp.forEach(f => { try { f(); } catch (x) { /* ок */ } });
    els.clear();
    ui.grid.textContent = '';
    panels().forEach(pn => ui.grid.append(buildPanel(pn)));
    renderBar();
    layout();
  }

  function addPanel(type, opt) {
    opt = opt || {};
    const def = TYPES[type]; if (!def) return null;
    const d = dimOf(type), w = opt.w || d.w, hh = opt.h || d.h;
    const pn = mkPanel(type, 0, 0, w, hh, opt.s, topZ() + 1);
    const live = ui && ui.grid && root.document.body.classList.contains('dm');
    const spot = live ? freeSpot(w, hh) : { x: 16 + (panels().length % 10) * 28, y: 16 + (panels().length % 10) * 28 };
    pn.x = opt.x != null ? opt.x : spot.x; pn.y = opt.y != null ? opt.y : spot.y;
    panels().push(pn);
    if (live) { ui.grid.append(buildPanel(pn)); layout(); }
    persist();
    return pn;
  }
  function removePanel(pn) {
    const t = tab(), i = t.panels.indexOf(pn); if (i < 0) return;
    t.panels.splice(i, 1);
    const e = els.get(pn.id);
    if (e) { e.disp.forEach(f => { try { f(); } catch (x) { /* ок */ } }); e.pe.remove(); els.delete(pn.id); }
    undo = { tab: t.id, pn };
    layout(); persist();
    toast('Панель закрыта', 'Вернуть', () => {
      if (!undo) return;
      const tt = S.tabs.find(x => x.id === undo.tab); if (!tt) return;
      tt.panels.push(undo.pn); undo = null;
      if (tt.id === S.tab) { ui.grid.append(buildPanel(tt.panels[tt.panels.length - 1])); layout(); }
      persist();
    });
  }
  function move(pn, d) {                       // в режиме «столбиком» меняем порядок
    const list = panels().slice().sort((a, b) => a.y - b.y || a.x - b.x), i = list.indexOf(pn), j = i + d;
    if (j < 0 || j >= list.length) return;
    const o = list[j];
    [pn.x, o.x] = [o.x, pn.x]; [pn.y, o.y] = [o.y, pn.y];
    layout(); persist();
  }

  /* ---------- перетаскивание панелей, размер, езда по полотну ---------- */
  // общий жест: apply(worldX, worldY) вызывается при движении мыши и при автопрокрутке у края экрана
  function gesture(ev, pe, apply, done) {
    const v = view(); let cx = ev.clientX, cy = ev.clientY, raf = 0, live = true;
    pe.classList.add('drag'); pe.setPointerCapture(ev.pointerId);
    const upd = () => { const r = ui.ws.getBoundingClientRect(); apply(v.x + (cx - r.left) / v.z, v.y + (cy - r.top) / v.z); };
    const edge = (p, a, b) => p < a + EDGE ? -(a + EDGE - p) : p > b - EDGE ? p - (b - EDGE) : 0;
    const tick = () => {
      if (!live) return;
      const r = ui.ws.getBoundingClientRect(), dx = clamp(edge(cx, r.left, r.right), -EDGE, EDGE), dy = clamp(edge(cy, r.top, r.bottom), -EDGE, EDGE);
      if (dx || dy) {
        v.x = clamp(v.x + dx * .4 / v.z, -MAXS, MAXS); v.y = clamp(v.y + dy * .4 / v.z, -MAXS, MAXS);
        applyView(); upd();
      }
      raf = requestAnimationFrame(tick);
    };
    const mv = e => { cx = e.clientX; cy = e.clientY; upd(); };
    const up = () => {
      live = false; cancelAnimationFrame(raf);
      pe.removeEventListener('pointermove', mv); pe.removeEventListener('pointerup', up); pe.removeEventListener('pointercancel', up);
      pe.classList.remove('drag'); done(); persist();
    };
    pe.addEventListener('pointermove', mv); pe.addEventListener('pointerup', up); pe.addEventListener('pointercancel', up);
    upd(); tick();
  }
  const pointWorld = ev => { const v = view(), r = ui.ws.getBoundingClientRect(); return { x: v.x + (ev.clientX - r.left) / v.z, y: v.y + (ev.clientY - r.top) / v.z }; };
  function startDrag(ev, pn, pe) {
    if (ev.button !== 0 || stackMode() || ev.target.closest('button,input,select,textarea,.dmx')) return;
    ev.preventDefault();
    const p0 = pointWorld(ev), ox = p0.x - pn.x, oy = p0.y - pn.y;
    gesture(ev, pe, (wx, wy) => { pn.x = Math.round(clamp(wx - ox, -MAXS, MAXS)); pn.y = Math.round(clamp(wy - oy, -MAXS, MAXS)); geom(pn); }, () => { });
  }
  function startResize(ev, pn, pe) {
    if (ev.button !== 0 || stackMode()) return;
    ev.preventDefault(); ev.stopPropagation(); raise(pn);
    const p0 = pointWorld(ev), ox = pn.x + pn.w - p0.x, oy = pn.y + pn.h - p0.y;
    gesture(ev, pe, (wx, wy) => { pn.w = Math.round(clamp(wx + ox - pn.x, MINW, MAXS)); pn.h = Math.round(clamp(wy + oy - pn.y, MINH, MAXS)); geom(pn); }, () => { });
  }
  function startPan(ev) {
    ev.preventDefault();
    const v = view(); let lx = ev.clientX, ly = ev.clientY;
    ui.ws.classList.add('panning'); ui.ws.setPointerCapture(ev.pointerId);
    const mv = e => {
      v.x = clamp(v.x - (e.clientX - lx) / v.z, -MAXS, MAXS); v.y = clamp(v.y - (e.clientY - ly) / v.z, -MAXS, MAXS);
      lx = e.clientX; ly = e.clientY; applyView();
    };
    const up = () => {
      ui.ws.removeEventListener('pointermove', mv); ui.ws.removeEventListener('pointerup', up); ui.ws.removeEventListener('pointercancel', up);
      ui.ws.classList.remove('panning'); persist();
    };
    ui.ws.addEventListener('pointermove', mv); ui.ws.addEventListener('pointerup', up); ui.ws.addEventListener('pointercancel', up);
  }
  // внутри панели колесо прокручивает её содержимое, если есть что прокручивать
  function scrollsInside(el, dy) {
    for (; el && el !== ui.ws; el = el.parentElement) {
      if (el.nodeType !== 1) continue;
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1 && (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
    }
    return false;
  }
  function onWheel(e) {
    if (stackMode()) return;
    const r = ui.ws.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {                // один «щелчок» колеса = ±10%
      e.preventDefault();
      const now = performance.now(); if (now - zoomT < 60 || !e.deltaY) return; zoomT = now;
      setZoom(Math.round(view().z * 10 + (e.deltaY < 0 ? 1 : -1)) / 10, e.clientX - r.left, e.clientY - r.top); return;
    }
    if (scrollsInside(e.target, e.deltaY)) return;
    e.preventDefault();
    const v = view(), k = e.deltaMode === 1 ? 32 : 1;
    let dx = e.deltaX * k, dy = e.deltaY * k; if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    v.x = clamp(v.x + dx / v.z, -MAXS, MAXS); v.y = clamp(v.y + dy / v.z, -MAXS, MAXS);
    applyView(); persist();
  }
  const typing = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  function setPanmode(on) { panmode = on; if (ui) ui.ws.classList.toggle('panmode', on); }

  /* ---------- верхняя панель: вкладки и кнопки ---------- */
  function renderBar() {
    const bar = ui.tabs; bar.textContent = '';
    ensure().tabs.forEach(t => {
      const b = h('button', { type: 'button', class: 'dmtab' + (t.id === S.tab ? ' act' : ''), title: 'Двойной клик — переименовать' }, t.name);
      b.addEventListener('click', () => { if (S.tab !== t.id) { S.tab = t.id; persist(); renderTab(); } });
      b.addEventListener('dblclick', () => {
        const n = prompt('Название экрана', t.name); if (n && n.trim()) { t.name = n.trim().slice(0, 40); persist(); renderBar(); }
      });
      bar.append(b);
    });
    bar.append(h('button', { type: 'button', class: 'dmtab add', title: 'Новый экран', onclick: () => {
      const t = { id: uid(), name: 'Экран ' + (S.tabs.length + 1), panels: [], view: { x: 0, y: 0, z: 1 } }; S.tabs.push(t); S.tab = t.id; persist(); renderTab();
    } }, '+'));
    if (S.tabs.length > 1) bar.append(h('button', { type: 'button', class: 'dmtab del', title: 'Удалить этот экран', onclick: () => {
      if (!confirm('Удалить экран «' + tab().name + '» вместе со всеми панелями?')) return;
      S.tabs = S.tabs.filter(t => t.id !== S.tab); S.tab = S.tabs[0].id; persist(); renderTab();
    } }, '×'));
  }
  function menu() {
    const m = ui.menu;
    m.textContent = '';
    ORDER.forEach(id => {
      const d = TYPES[id];
      m.append(h('button', { type: 'button', onclick: () => { m.classList.remove('on'); addPanel(id); } }, h('b', {}, d.name), h('small', {}, d.desc || '')));
    });
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(ensure(), null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'экран-мастера.json' });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importJson(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = normalize(JSON.parse(r.result));
        if (!j) throw new Error('формат');
        if (!confirm('Заменить текущие экраны загруженными из файла?')) return;
        S = j; persist(); renderTab(); toast('Экраны загружены');
      } catch (e) { toast('Не получилось прочитать файл: это не экран мастера'); }
    };
    r.readAsText(file);
  }

  function build() {
    const host = document.getElementById('dm');
    ui = {};
    ui.tabs = h('div', { class: 'dmtabs' });
    ui.menu = h('div', { class: 'dmmenu' });
    const addBtn = h('button', { type: 'button', class: 'dmbtn pri', onclick: e => { e.stopPropagation(); menu(); ui.menu.classList.toggle('on'); } }, '+ Панель');
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; } });
    ui.zlab = h('button', { type: 'button', class: 'dmbtn zl', title: 'Масштаб 100%', onclick: () => setZoom(1) }, '100%');
    const zoom = h('span', { class: 'dmz' },
      h('button', { type: 'button', class: 'dmbtn', title: 'Уменьшить', onclick: () => setZoom(Math.round(view().z * 10 - 1) / 10) }, '−'),
      ui.zlab,
      h('button', { type: 'button', class: 'dmbtn', title: 'Увеличить', onclick: () => setZoom(Math.round(view().z * 10 + 1) / 10) }, '+'),
      h('button', { type: 'button', class: 'dmbtn', title: 'Показать все панели', onclick: fit }, 'Все'),
      h('button', { type: 'button', class: 'dmbtn', title: 'Выложить панели рядами без наложений', onclick: arrange }, 'Упорядочить'));
    ui.bar = h('div', { class: 'dmbar' }, ui.tabs, h('span', { class: 'dmsp' }), zoom,
      h('span', { class: 'dmmw' }, addBtn, ui.menu),
      h('button', { type: 'button', class: 'dmbtn', title: 'Сохранить все экраны в файл', onclick: exportJson }, 'Экспорт'),
      h('button', { type: 'button', class: 'dmbtn', title: 'Загрузить экраны из файла', onclick: () => file.click() }, 'Импорт'),
      h('button', { type: 'button', class: 'dmbtn', title: 'Вернуть стандартный экран', onclick: () => {
        if (!confirm('Сбросить ВСЕ экраны к стандартному? Заметки и бой будут потеряны (сначала можно сделать экспорт).')) return;
        S = defaults(); persist(); renderTab();
      } }, 'Сброс'), file);
    ui.bg = h('div', { class: 'dmbg' });
    ui.grid = h('div', { class: 'dmg' });
    ui.ws = h('div', { class: 'dmws', title: '' }, ui.bg, ui.grid);
    host.textContent = '';
    host.append(ui.bar, ui.ws);
    document.addEventListener('click', e => { if (!e.target.closest('.dmmw')) ui.menu.classList.remove('on'); });
    new ResizeObserver(() => layout()).observe(ui.ws);
    root.matchMedia('(max-width:720px)').addEventListener('change', layout);
    // езда по полотну: пустое место, средняя кнопка, Пробел + мышь; колесо; Ctrl+колесо — масштаб
    ui.ws.addEventListener('pointerdown', ev => {
      if (stackMode()) return;
      const onPanel = ev.target.closest('.dmp');
      if ((ev.button === 0 && (!onPanel || panmode)) || ev.button === 1) startPan(ev);
    });
    ui.ws.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
    ui.ws.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', e => {
      if (e.code !== 'Space' || !document.body.classList.contains('dm') || typing(e.target) || e.target.closest('button')) return;
      e.preventDefault(); setPanmode(true);
    });
    document.addEventListener('keyup', e => { if (e.code === 'Space') setPanmode(false); });
    root.addEventListener('blur', () => setPanmode(false));
    // ссылки внутри панелей открывают записи в панелях, а не уводят с экрана
    host.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]'); if (!a || a.closest('.dmbar')) return;
      const m = a.getAttribute('href').match(/^#(14\/)?([a-z]+)\/(.+)$/);
      if (!m) return;
      e.preventDefault();
      const pe = a.closest('.dmp'), info = pe && els.get(pe.dataset.id);
      const ed = m[1] ? 14 : 24, sec = m[2], slug = decodeURIComponent(m[3]);
      if (info && info.ctx.p.t === 'entity' && !(e.ctrlKey || e.metaKey) && pe._nav) pe._nav(ed, sec, slug);
      else showEntity({ e: ed, sec, slug }, e.ctrlKey || e.metaKey || !!(info && (info.ctx.p.t === 'init' || info.ctx.p.t === 'conds')));
    });
    if (root.AutoLinks) AutoLinks.bindTips(host);
  }

  /* ---------- общее API ---------- */
  function show() {
    ensure();
    if (!ui) build();
    renderTab();
  }
  // показать запись: в последней открытой панели «Запись», иначе в новой
  function showEntity(ref, forceNew) {
    ensure();
    let pn = !forceNew && lastEntity && panels().find(p => p.id === lastEntity);
    if (!pn && !forceNew) pn = panels().find(p => p.t === 'entity');
    if (pn) {
      const e = els.get(pn.id);
      if (e && e.pe._nav) { e.pe._nav(ref.e, ref.sec, ref.slug); raise(pn); reveal(pn); lastEntity = pn.id; return pn; }
    }
    pn = addPanel('entity', { s: { e: ref.e, sec: ref.sec, slug: ref.slug, hist: [] } });
    if (pn) lastEntity = pn.id;
    return pn;
  }
  function noteEntity(id) { lastEntity = id; }
  function findPanel(type) {
    ensure();
    return panels().find(p => p.t === type) || S.tabs.flatMap(t => t.panels.map(p => [t, p])).find(([, p]) => p.t === type)?.[1] || null;
  }
  function refresh(pn) { const e = els.get(pn.id); if (e) e.pe._refresh && e.pe._refresh(); }

  /* ---------- кнопки на карточках ---------- */
  function cardActions(m, e, sec) {
    const card = document.getElementById('card'); if (!card || card.querySelector('.acts')) return;
    const bar = h('div', { class: 'acts' },
      h('button', { type: 'button', onclick: () => { ensure(); const pn = addPanel('entity', { s: { e, sec, slug: m.slug, hist: [] } }); toast('Добавлено на экран мастера', 'Открыть', () => { location.hash = DB().hh(DB().ed, 'dmscreen'); }); void pn; } }, 'На экран мастера'));
    if (sec === 'bestiary') bar.append(h('button', { type: 'button', onclick: () => addCombatants(e, m.slug, 1, true) }, 'В инициативу'));
    card.append(bar);
  }
  async function addCombatants(e, slug, qty, notify) {
    const INIT = root.DM.INIT; if (!INIT) return;
    ensure();
    let pn = findPanel('init');
    if (!pn) pn = addPanel('init');
    let data;
    try { data = await DB().load('bestiary', e); } catch (x) { toast('Не удалось загрузить бестиарий'); return; }
    const m = data.find(x => x.slug === slug); if (!m) return;
    INIT.addMonster(pn.s, m, e, qty);
    refresh(pn); persist();
    if (notify) toast('Добавлено в инициативу: ' + m.name_ru, 'Открыть', () => { location.hash = DB().hh(DB().ed, 'dmscreen'); });
  }

  let toastEl, toastT;
  function toast(text, actText, act) {
    if (!toastEl) { toastEl = h('div', { class: 'dmtoast' }); document.body.append(toastEl); }
    toastEl.textContent = text;
    if (actText) toastEl.append(' ', h('button', { type: 'button', onclick: () => { toastEl.classList.remove('on'); act && act(); } }, actText));
    toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), actText ? 6000 : 3000);
  }

  root.DM = { registerType, show, showEntity, noteEntity, addPanel, addCombatants, cardActions, toast, h, save: persist, ensure, findPanel, refresh, types: TYPES };
})(window);
