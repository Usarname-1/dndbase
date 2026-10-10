/* ===== Экран мастера =====
   Сетка панелей (12 колонок), вкладки-экраны, перетаскивание и изменение размера,
   сохранение в localStorage, экспорт/импорт JSON. Сами панели — в dmpanels.js (DM.registerType).
   Связь с основным приложением — через window.DB (см. index.html). */
(function (root) {
  'use strict';
  const COLS = 12, ROWH = 44, GAP = 6, KEY = 'dm.v1', STACK_W = 720;
  const TYPES = {}, ORDER = [];
  let S = null, ui = null, saveT = 0, undo = null, lastEntity = null;
  const els = new Map();                     // id панели -> {pe, ctx, disp}

  const uid = () => Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
  const mkPanel = (t, x, y, w, hh, s) => ({ id: uid(), t, x, y, w, h: hh, s: s || (TYPES[t].init ? TYPES[t].init() : {}) });
  function defaults() {
    return {
      v: 1, tab: 't1', tabs: [{
        id: 't1', name: 'Экран 1', panels: [
          mkPanel('init', 0, 0, 6, 11), mkPanel('dice', 6, 0, 3, 6), mkPanel('conds', 9, 0, 3, 11), mkPanel('notes', 6, 6, 3, 5)]
      }]
    };
  }
  function readStore() {
    try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && Array.isArray(j.tabs) && j.tabs.length) return j; } catch (e) { /* пусто */ }
    return null;
  }
  function ensure() { if (!S) { S = readStore() || defaults(); if (!S.tabs.some(t => t.id === S.tab)) S.tab = S.tabs[0].id; } return S; }
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); }
      catch (e) { toast('Не удалось сохранить: память браузера заполнена. Сделайте экспорт.'); }
    }, 250);
  }
  const tab = () => ensure().tabs.find(t => t.id === S.tab);
  const panels = () => tab().panels;

  /* ---------- геометрия ---------- */
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const isFree = (pn, x, y, w, hh) => !panels().some(o => o !== pn && overlap({ x, y, w, h: hh }, o));
  function nearest(pn, wx, wy, w, hh) {
    if (isFree(pn, wx, wy, w, hh)) return { x: wx, y: wy };
    const maxY = Math.max(0, ...panels().filter(o => o !== pn).map(o => o.y + o.h)) + hh;
    let best = null, bd = 1e9;
    for (let y = 0; y <= maxY; y++) for (let x = 0; x <= COLS - w; x++) {
      if (!isFree(pn, x, y, w, hh)) continue;
      const d = Math.abs(x - wx) + Math.abs(y - wy) * 1.2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best || { x: 0, y: maxY };
  }
  const metrics = () => { const w = ui.ws.clientWidth || 1000; return { w, cw: w / COLS, stack: w < STACK_W }; };

  function layout() {
    if (!ui || !ui.grid) return;
    const M = metrics(), list = panels().slice();
    ui.ws.classList.toggle('stack', M.stack);
    if (M.stack) {
      list.sort((a, b) => a.y - b.y || a.x - b.x);
      ui.grid.style.height = 'auto';
      list.forEach((pn, i) => {
        const e = els.get(pn.id); if (!e) return;
        Object.assign(e.pe.style, { left: '', top: '', width: '', height: pn.h * ROWH - GAP + 'px' });
        e.pe.style.order = i;
        e.pe.classList.toggle('first', i === 0); e.pe.classList.toggle('last', i === list.length - 1);
      });
      return;
    }
    const bottom = Math.max(0, ...list.map(p => p.y + p.h));
    ui.grid.style.height = (bottom + 3) * ROWH + 'px';
    list.forEach(pn => {
      const e = els.get(pn.id); if (!e) return;
      Object.assign(e.pe.style, {
        left: pn.x * M.cw + 'px', top: pn.y * ROWH + 'px',
        width: pn.w * M.cw - GAP + 'px', height: pn.h * ROWH - GAP + 'px', order: ''
      });
    });
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
    pe.addEventListener('pointerdown', () => raise(pe));
    pe.querySelector('.dmh').addEventListener('pointerdown', ev => startDrag(ev, pn, pe));
    rez.addEventListener('pointerdown', ev => startResize(ev, pn, pe));
    try { def.render(ctx); } catch (e) { console.error(e); body.textContent = 'Ошибка панели: ' + e.message; }
    if (pn.autoTitle && !pn.title) title.textContent = pn.autoTitle;
    return pe;
  }
  const raise = pe => { ui.grid.querySelectorAll('.dmp.top').forEach(x => x.classList.remove('top')); pe.classList.add('top'); };

  function renderTab() {
    for (const [, e] of els) e.disp.forEach(f => { try { f(); } catch (x) { /* ок */ } });
    els.clear();
    ui.grid.textContent = '';
    ui.ghost = h('div', { class: 'dmghost' }); ui.grid.append(ui.ghost);
    panels().forEach(pn => ui.grid.append(buildPanel(pn)));
    renderBar();
    layout();
  }

  function addPanel(type, opt) {
    opt = opt || {};
    const def = TYPES[type]; if (!def) return null;
    const w = opt.w || def.w || 4, hh = opt.h || def.h || 6;
    const pn = mkPanel(type, 0, 0, w, hh, opt.s);
    const spot = nearest(pn, 0, 0, w, hh); pn.x = spot.x; pn.y = spot.y;
    panels().push(pn);
    if (ui && ui.grid && root.document.body.classList.contains('dm')) {
      ui.grid.append(buildPanel(pn)); layout();
      const e = els.get(pn.id); if (e) { raise(e.pe); e.pe.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
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

  /* ---------- перетаскивание и размер ---------- */
  function startDrag(ev, pn, pe) {
    if (ev.button !== 0 || metrics().stack || ev.target.closest('button,input,select,textarea,.dmx')) return;
    ev.preventDefault();
    const M = metrics(), gr = ui.grid.getBoundingClientRect(), r = pe.getBoundingClientRect();
    const ox = ev.clientX - r.left, oy = ev.clientY - r.top;
    pe.classList.add('drag'); pe.setPointerCapture(ev.pointerId);
    let gx = pn.x, gy = pn.y;
    const ghost = (x, y, w, hh, bad) => {
      Object.assign(ui.ghost.style, { display: 'block', left: x * M.cw + 'px', top: y * ROWH + 'px', width: w * M.cw - GAP + 'px', height: hh * ROWH - GAP + 'px' });
      ui.ghost.classList.toggle('bad', !!bad);
    };
    ghost(gx, gy, pn.w, pn.h);
    const mv = e => {
      const left = e.clientX - gr.left - ox, top = e.clientY - gr.top - oy + ui.ws.scrollTop - (ui.ws.getBoundingClientRect().top - gr.top) * 0;
      pe.style.left = left + 'px'; pe.style.top = clamp(top, 0, 1e5) + 'px';
      gx = clamp(Math.round(left / M.cw), 0, COLS - pn.w); gy = Math.max(0, Math.round(top / ROWH));
      ghost(gx, gy, pn.w, pn.h, !isFree(pn, gx, gy, pn.w, pn.h));
    };
    const up = () => {
      pe.removeEventListener('pointermove', mv); pe.removeEventListener('pointerup', up); pe.removeEventListener('pointercancel', up);
      pe.classList.remove('drag'); ui.ghost.style.display = 'none';
      const s = nearest(pn, gx, gy, pn.w, pn.h); pn.x = s.x; pn.y = s.y;
      layout(); persist();
    };
    pe.addEventListener('pointermove', mv); pe.addEventListener('pointerup', up); pe.addEventListener('pointercancel', up);
  }
  function startResize(ev, pn, pe) {
    if (ev.button !== 0 || metrics().stack) return;
    ev.preventDefault(); ev.stopPropagation();
    const M = metrics(), r0 = pe.getBoundingClientRect();
    pe.classList.add('drag'); pe.setPointerCapture(ev.pointerId);
    let nw = pn.w, nh = pn.h;
    const mv = e => {
      nw = clamp(Math.round((e.clientX - r0.left) / M.cw), 2, COLS - pn.x);
      nh = Math.max(2, Math.round((e.clientY - r0.top) / ROWH));
      Object.assign(pe.style, { width: nw * M.cw - GAP + 'px', height: nh * ROWH - GAP + 'px' });
      const bad = !isFree(pn, pn.x, pn.y, nw, nh);
      Object.assign(ui.ghost.style, { display: 'block', left: pn.x * M.cw + 'px', top: pn.y * ROWH + 'px', width: nw * M.cw - GAP + 'px', height: nh * ROWH - GAP + 'px' });
      ui.ghost.classList.toggle('bad', bad);
    };
    const up = () => {
      pe.removeEventListener('pointermove', mv); pe.removeEventListener('pointerup', up); pe.removeEventListener('pointercancel', up);
      pe.classList.remove('drag'); ui.ghost.style.display = 'none';
      if (isFree(pn, pn.x, pn.y, nw, nh)) { pn.w = nw; pn.h = nh; persist(); } else toast('Здесь тесно: размер не изменён');
      layout();
    };
    pe.addEventListener('pointermove', mv); pe.addEventListener('pointerup', up); pe.addEventListener('pointercancel', up);
  }

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
      const t = { id: uid(), name: 'Экран ' + (S.tabs.length + 1), panels: [] }; S.tabs.push(t); S.tab = t.id; persist(); renderTab();
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
        const j = JSON.parse(r.result);
        if (!j || !Array.isArray(j.tabs) || !j.tabs.length || !j.tabs.every(t => Array.isArray(t.panels) && t.panels.every(p => TYPES[p.t]))) throw new Error('формат');
        if (!confirm('Заменить текущие экраны загруженными из файла?')) return;
        S = j; if (!S.tabs.some(t => t.id === S.tab)) S.tab = S.tabs[0].id; persist(); renderTab(); toast('Экраны загружены');
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
    ui.bar = h('div', { class: 'dmbar' }, ui.tabs, h('span', { class: 'dmsp' }),
      h('span', { class: 'dmmw' }, addBtn, ui.menu),
      h('button', { type: 'button', class: 'dmbtn', title: 'Сохранить все экраны в файл', onclick: exportJson }, 'Экспорт'),
      h('button', { type: 'button', class: 'dmbtn', title: 'Загрузить экраны из файла', onclick: () => file.click() }, 'Импорт'),
      h('button', { type: 'button', class: 'dmbtn', title: 'Вернуть стандартный экран', onclick: () => {
        if (!confirm('Сбросить ВСЕ экраны к стандартному? Заметки и бой будут потеряны (сначала можно сделать экспорт).')) return;
        S = defaults(); persist(); renderTab();
      } }, 'Сброс'), file);
    ui.grid = h('div', { class: 'dmg' });
    ui.ws = h('div', { class: 'dmws' }, ui.grid);
    host.textContent = '';
    host.append(ui.bar, ui.ws);
    document.addEventListener('click', e => { if (!e.target.closest('.dmmw')) ui.menu.classList.remove('on'); });
    new ResizeObserver(() => layout()).observe(ui.ws);
    // ссылки внутри панелей открывают записи в панелях, а не уводят с экрана
    host.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]'); if (!a || a.closest('.dmbar')) return;
      const m = a.getAttribute('href').match(/^#(14\/)?([a-z]+)\/(.+)$/);
      if (!m) return;
      e.preventDefault();
      const pe = a.closest('.dmp'), info = pe && els.get(pe.dataset.id);
      const ed = m[1] ? 14 : 24, sec = m[2], slug = decodeURIComponent(m[3]);
      if (info && info.ctx.p.t === 'entity' && !(e.ctrlKey || e.metaKey) && pe._nav) pe._nav(ed, sec, slug);
      else showEntity({ e: ed, sec, slug }, e.ctrlKey || e.metaKey || !!(info && info.ctx.p.t === 'init'));
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
      if (e && e.pe._nav) { e.pe._nav(ref.e, ref.sec, ref.slug); raise(e.pe); lastEntity = pn.id; return pn; }
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
