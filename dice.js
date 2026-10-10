/* ===== Кликабельные броски =====
   Dice.roll('2к8+10', {kind:'dmg'})   — бросок по формуле (к и d равнозначны, «+17» = к20+17)
   Dice.linkify(root)                  — превращает формулы и бонусы в тексте в кнопки-броски
   Dice.on(fn)                         — подписка на результаты (лоток внизу экрана тоже подписан)

   Что становится кнопкой в тексте:
   • формулы «1к6», «2к8 + 10», «к20» (кроме заголовков и ссылок);
   • бонус атаки: «+17 к попаданию», «+8, досягаемость …»;
   • «Навыки Восприятие +5», «Инициатива +12»;
   • модификаторы и спасброски в таблице характеристик монстра;
   • кость в таблицах классов («К8»).
   Клик с Shift — преимущество, с Alt/Ctrl — помеха; постоянный режим и «Крит» (удвоение костей урона) — в лотке. */
(function (root) {
  'use strict';
  const MAXN = 100, MAXS = 1000;

  /* ---------- случайность ---------- */
  function rnd(n) {                                     // 1..n без смещения
    const c = root.crypto;
    if (!c || !c.getRandomValues) return 1 + Math.floor(Math.random() * n);
    const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n;
    do c.getRandomValues(a); while (a[0] >= lim);
    return (a[0] % n) + 1;
  }

  /* ---------- разбор формулы ---------- */
  const norm = f => String(f).replace(/[кКkKdD]/g, 'd').replace(/[−–—]/g, '-').replace(/[\s ]+/g, '');
  const FULL = /^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/;
  function parse(formula, kind) {
    let f = norm(formula);
    if (kind === 'check' && /^[+-]\d+$/.test(f)) f = 'd20' + f;
    if (!FULL.test(f)) return null;
    const terms = [];
    for (const m of f.matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/g)) {
      const sign = m[1] === '-' ? -1 : 1;
      if (m[3]) {
        const n = m[2] === '' ? 1 : +m[2], sides = +m[3];
        if (n < 1 || n > MAXN || sides < 2 || sides > MAXS) return null;
        terms.push({ sign, n, sides });
      } else terms.push({ sign, c: +m[4] });
    }
    return terms.length ? terms : null;
  }
  const show = terms => terms.map((t, i) => (i || t.sign < 0 ? (t.sign < 0 ? ' − ' : ' + ') : '') + (t.c != null ? t.c : t.n + 'к' + t.sides)).join('');

  /* ---------- бросок ---------- */
  // opt: {kind:'check'|'dmg'|'dice', mode:'n'|'a'|'d', crit:bool, label, src}
  function roll(formula, opt) {
    opt = opt || {};
    const kind = opt.kind || 'dice';
    let terms = parse(formula, kind);
    if (!terms) return null;
    const crit = !!opt.crit && kind === 'dmg';
    if (crit) terms = terms.map(t => t.c != null ? t : { ...t, n: Math.min(MAXN, t.n * 2) });
    // преимущество и помеха действуют на единственную к20
    const d20 = terms.filter(t => t.c == null && t.sides === 20 && t.n === 1 && t.sign > 0);
    const mode = kind !== 'dmg' && d20.length === 1 && (opt.mode === 'a' || opt.mode === 'd') ? opt.mode : 'n';
    let total = 0, nat = null;
    const parts = terms.map(t => {
      if (t.c != null) { total += t.sign * t.c; return { sign: t.sign, c: t.c }; }
      const rolls = Array.from({ length: t.n }, () => rnd(t.sides));
      let kept = rolls, dropped = [];
      if (mode !== 'n' && t === d20[0]) {
        const second = rnd(20), a = rolls[0];
        const pick = mode === 'a' ? Math.max(a, second) : Math.min(a, second);
        kept = [pick]; dropped = [pick === a ? second : a];
      }
      const sum = kept.reduce((x, y) => x + y, 0);
      total += t.sign * sum;
      if (t === d20[0] && d20.length === 1) nat = kept[0];
      return { sign: t.sign, n: t.n, sides: t.sides, rolls: kept, dropped };
    });
    const res = {
      formula: show(terms), total, parts, mode, crit, nat: kind === 'dmg' ? null : nat,
      kind, label: opt.label || '', src: opt.src || '', time: Date.now()
    };
    if (!opt.silent) emit(res);
    return res;
  }

  /* ---------- подписчики и состояние ---------- */
  const subs = [], hist = [];
  const state = { mode: 'n', crit: false };
  function emit(res) { hist.unshift(res); if (hist.length > 40) hist.pop(); subs.forEach(fn => { try { fn(res); } catch (e) { console.error(e); } }); }
  const on = fn => { subs.push(fn); };
  const off = fn => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };

  /* ---------- поиск бросков в строке ---------- */
  const FORM = /(?<![A-Za-zА-Яа-яЁё\d])\d*[кd]\d+(?:\s*[+\-−–]\s*(?:\d*[кd]\d+|\d+))*(?![\dA-Za-zА-Яа-яЁё])/g;
  const ATK = /([+\-−–]\d+)(?=\s*(?:к попаданию|,\s*(?:досягаемость|дистанция)))/g;
  // ctx.label — подпись строки («Навыки», «Инициатива»); ctx.cell — весь узел — одна кость вида «К8»
  function findRolls(text, ctx) {
    ctx = ctx || {};
    const out = [];
    const add = (s, e, f, kind, label) => { if (!out.some(o => s < o.e && e > o.s)) out.push({ s, e, f, kind, label }); };
    if (ctx.cell && /^[КK]\d+$/.test(text.trim())) {
      const s = text.indexOf(text.trim()); add(s, s + text.trim().length, text.trim(), 'dice', 'Бросок');
      return out;
    }
    for (const m of text.matchAll(ATK)) add(m.index, m.index + m[0].length, m[1], 'check', 'Бросок атаки');
    for (const m of text.matchAll(FORM)) {
      const before = text.slice(Math.max(0, m.index - 60), m.index);
      const terms = parse(m[0]);
      if (!terms) continue;
      const isD20 = terms.length === 1 && terms[0].n === 1 && terms[0].sides === 20;
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
      const cl = ctx.label || '';
      const label = isD20 ? 'Проверка'
        : /^Урон/i.test(cl) || /урон|Попадани/i.test(before) || /^[\s)]*(?:[А-Яа-яЁё]+\s+){0,2}урон/i.test(after) ? 'Урон'
        : /^Хит/i.test(cl) || /Хит/i.test(before) ? 'Хиты' : 'Бросок';
      add(m.index, m.index + m[0].length, m[0], label === 'Урон' ? 'dmg' : isD20 ? 'check' : 'dice', label);
    }
    if (ctx.label === 'Навыки') {
      for (const m of text.matchAll(/([А-Яа-яЁё][А-Яа-яЁё ]*?)\s+([+\-−–]\d+)/g)) {
        const s = m.index + m[0].length - m[2].length;
        add(s, s + m[2].length, m[2], 'check', m[1].trim());
      }
    } else if (ctx.label === 'Инициатива') {
      const m = text.match(/[+\-−–]\d+/);
      if (m) add(m.index, m.index + m[0].length, m[0], 'check', 'Инициатива');
    }
    return out.sort((a, b) => a.s - b.s);
  }

  /* ---------- DOM ---------- */
  if (typeof document === 'undefined') {
    const api = { roll, parse, findRolls, on, off, state, history: hist, norm };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Dice = api;
    return;
  }

  const SKIP = 'a,h2,h3,h4,th,summary,button,textarea,input,select,.nm,.en,.sub,.meta,.rl,script,style,#tip,#rolls,[contenteditable]';
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function mk(text, f, kind, label) {
    const s = document.createElement('span');
    s.className = 'rl';
    s.dataset.f = f; s.dataset.k = kind; s.dataset.l = label;
    s.tabIndex = 0; s.setAttribute('role', 'button');
    s.title = 'Бросить ' + f.replace(/\s+/g, ' ') + ' (Shift — преимущество, Alt — помеха)';
    s.textContent = text;
    return s;
  }
  function linkify(el) {
    if (!el) return;
    // 1) таблица характеристик монстра: модификатор и спасбросок
    el.querySelectorAll('.abil tr').forEach(tr => {
      const td = tr.children;
      if (td.length < 4 || td[0].tagName !== 'TD' || td[2].querySelector('.rl')) return;
      const nm = td[0].textContent.trim();
      [[2, 'проверка'], [3, 'спасбросок']].forEach(([i, what]) => {
        const v = td[i].textContent.trim();
        if (/^[+\-−–]\d+$/.test(v)) { const s = mk(v, v, 'check', nm + ' — ' + what); td[i].textContent = ''; td[i].append(s); }
      });
    });
    // 2) текст
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeValue.length > 1 && n.parentElement && !n.parentElement.closest(SKIP)
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      const t = n.nodeValue, par = n.parentElement, prev = n.previousSibling;
      let label = '';
      if (prev && prev.nodeName === 'B') label = prev.textContent.trim();
      else if (par.matches('p.pr') && par.firstElementChild && par.firstElementChild.nodeName === 'B') label = par.firstElementChild.textContent.trim();
      const hits = findRolls(t, { label, cell: /^(TD)$/.test(par.tagName) });
      if (!hits.length) continue;
      const f = document.createDocumentFragment();
      let p = 0;
      for (const h of hits) {
        if (h.s > p) f.append(t.slice(p, h.s));
        f.append(mk(t.slice(h.s, h.e), h.f, h.kind, h.label));
        p = h.e;
      }
      if (p < t.length) f.append(t.slice(p));
      n.replaceWith(f);
    }
  }

  /* ---------- лоток результатов ---------- */
  let tray, lastEl, histEl, histOpen = false;
  function partsHtml(r) {
    return r.parts.map((p, i) => {
      const sg = i || p.sign < 0 ? (p.sign < 0 ? ' − ' : ' + ') : '';
      if (p.c != null) return sg + p.c;
      const dice = p.rolls.map(v => {
        const c = r.nat != null && p.sides === 20 && p.n === 1 ? (v === 20 ? ' class="n20"' : v === 1 ? ' class="n1"' : '') : '';
        return `<b${c}>${v}</b>`;
      }).join(', ');
      const dr = p.dropped.length ? ` <s>${p.dropped.join(', ')}</s>` : '';
      return `${sg}[${dice}${dr}]`;
    }).join('');
  }
  const MODE = { n: '', a: ' · преимущество', d: ' · помеха' };
  function lineHtml(r) {
    return `<span class="rt">${esc(r.label || 'Бросок')}${r.src ? ' · ' + esc(r.src) : ''}</span>`
      + `<span class="rb">${esc(r.formula)}${MODE[r.mode]}${r.crit ? ' · крит' : ''} → ${partsHtml(r)}</span>`;
  }
  function ensureTray() {
    if (tray) return;
    tray = document.createElement('div');
    tray.id = 'rolls';
    tray.innerHTML = `<div class="rh"><span>Броски</span><span class="rm">
        <button type="button" data-m="n" title="Обычный бросок">обыч.</button><button type="button" data-m="a" title="Преимущество">преим.</button><button type="button" data-m="d" title="Помеха">помеха</button>
        <button type="button" data-c title="Критическое попадание: удвоить кости урона">крит</button></span>
        <span class="rx"><button type="button" data-h title="История">≡</button><button type="button" data-x title="Скрыть">×</button></span></div>
      <div class="rl1"></div><div class="rhist"></div>`;
    document.body.append(tray);
    lastEl = tray.querySelector('.rl1'); histEl = tray.querySelector('.rhist');
    tray.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.m) state.mode = state.mode === b.dataset.m ? 'n' : b.dataset.m;
      else if ('c' in b.dataset) state.crit = !state.crit;
      else if ('h' in b.dataset) histOpen = !histOpen;
      else if ('x' in b.dataset) tray.classList.remove('on');
      syncTray();
    });
  }
  function syncTray() {
    if (!tray) return;
    tray.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('act', state.mode === b.dataset.m || (state.mode === 'n' && b.dataset.m === 'n')));
    tray.querySelector('[data-c]').classList.toggle('act', state.crit);
    tray.classList.toggle('hopen', histOpen);
    histEl.innerHTML = hist.slice(1).map(r => `<div class="hr"><b>${r.total}</b>${lineHtml(r)}</div>`).join('');
  }
  function showResult(r) {
    ensureTray();
    const cls = r.nat === 20 ? ' n20' : r.nat === 1 ? ' n1' : '';
    lastEl.innerHTML = `<div class="big${cls}">${r.total}</div><div class="det">${lineHtml(r)}${r.nat === 20 ? '<em class="n20">Критический успех!</em>' : r.nat === 1 ? '<em class="n1">Критический провал</em>' : ''}</div>`;
    lastEl.classList.remove('pop'); void lastEl.offsetWidth; lastEl.classList.add('pop');
    tray.classList.add('on');
    syncTray();
  }
  on(showResult);

  /* ---------- клики ---------- */
  function srcOf(el) {
    const p = el.closest('.dmp');
    if (p) return (p.querySelector('.dmt') || {}).textContent || '';
    const h = document.querySelector('#card h2');
    return h ? h.textContent : '';
  }
  function fromEl(el, ev) {
    const mode = ev && ev.shiftKey ? 'a' : ev && (ev.altKey || ev.ctrlKey || ev.metaKey) ? 'd' : state.mode;
    return roll(el.dataset.f, { kind: el.dataset.k, label: el.dataset.l, src: srcOf(el), mode, crit: state.crit });
  }
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('.rl[data-f]');
    if (el) { e.preventDefault(); fromEl(el, e); }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.rl[data-f]')) { e.preventDefault(); fromEl(e.target, e); }
  });

  const api = { roll, parse, findRolls, linkify, on, off, state, history: hist, norm, mk, syncTray };
  root.Dice = api;
})(typeof window !== 'undefined' ? window : globalThis);
