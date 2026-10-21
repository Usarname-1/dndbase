/* ===== Глобальный поиск =====
   Ищет по названиям (рус / eng) во всех разделах выбранной редакции — 2024 или 2014.
   Индекс: data/search.json и data14/search.json (tools/build_search.py), грузится при первом открытии.
   Открытие: кнопка «Поиск» в верхней панели, Ctrl/⌘+K или «/». */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const IX = {};                       // редакция → промис с записями
  let box, inp, list, chips, hint, rows = [], sel = 0, sect = '', lastFocus = null, token = 0;

  const index = e => IX[e] || (IX[e] = fetch((e == 14 ? 'data14' : 'data') + '/search.json')
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(a => a.map(x => ({ ru: x[0], en: x[1], k: x[2], slug: x[3], sub: x[4], n: DB.norm(x[0]), ne: DB.norm(x[1]) })))
    .catch(() => { delete IX[e]; return null; }));

  // оценка совпадения: меньше — лучше; null — не подходит
  function score(it, q, toks) {
    const hay = it.n + ' ' + it.ne;
    for (const t of toks) if (!hay.includes(t)) return null;
    if (it.n === q || it.ne === q) return 0;
    const wp = s => s.split(/[\s\-\/(),:]+/), wn = wp(it.n), we = wp(it.ne);
    if (toks.every(t => wn.includes(t) || we.includes(t))) return 1;                    // слова названия целиком
    if (it.n.startsWith(q) || it.ne.startsWith(q)) return 2;
    if (toks.every(t => wn.some(w => w.startsWith(t)) || we.some(w => w.startsWith(t)))) return 3;
    return 4;
  }

  function mark(s, toks) {
    const n = DB.norm(s), hit = new Array(s.length).fill(false);
    for (const t of toks) { let i = n.indexOf(t); while (i >= 0 && t) { for (let j = i; j < i + t.length; j++) hit[j] = true; i = n.indexOf(t, i + t.length); } }
    let out = '', on = false;
    for (let i = 0; i < s.length; i++) {
      if (hit[i] !== on) { out += on ? '</mark>' : '<mark>'; on = hit[i]; }
      out += DB.esc(s[i]);
    }
    return out + (on ? '</mark>' : '');
  }

  async function run() {
    const my = ++token, e = DB.ed, q = DB.norm(inp.value.trim()), toks = q.split(/\s+/).filter(Boolean);
    if (!q) { rows = []; chips.innerHTML = ''; list.innerHTML = ''; hint.textContent = 'Введите название на русском или английском — «огненный шар», «Fireball», «дракон».'; hint.hidden = false; return; }
    const ix = await index(e);
    if (my !== token) return;
    if (!ix) { list.innerHTML = ''; chips.innerHTML = ''; hint.textContent = 'Не удалось загрузить индекс поиска. Проверьте соединение.'; hint.hidden = false; return; }
    const ord = DB.ORDERS[e], res = [];
    for (const it of ix) { const s = score(it, q, toks); if (s !== null) res.push([s, ord.indexOf(it.k), it.ru.length, it]); }
    res.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const cnt = {}; res.forEach(r => cnt[r[3].k] = (cnt[r[3].k] || 0) + 1);
    if (sect && !cnt[sect]) sect = '';
    const shown = res.filter(r => !sect || r[3].k === sect), all = res.length;
    rows = shown.slice(0, 80).map(r => r[3]);
    const SX = DB.SXS[e];
    chips.innerHTML = all ? `<button type="button" data-k=""${sect ? '' : ' class="on"'}>Все ${all}</button>` +
      ord.filter(k => cnt[k]).map(k => `<button type="button" data-k="${k}"${sect === k ? ' class="on"' : ''}>${DB.esc(SX[k].t)} ${cnt[k]}</button>`).join('') : '';
    hint.hidden = !!all; if (!all) hint.textContent = 'Ничего не найдено в редакции ' + DB.EDK(e) + '. Попробуйте другое написание или английское название.';
    sel = 0;
    list.innerHTML = rows.map((it, i) => `<li><a href="${DB.hh(e, it.k, it.slug)}" data-i="${i}"${i ? '' : ' aria-selected="true"'}><span class="gt"><b>${mark(it.ru, toks)}</b>${it.en ? `<i>${mark(it.en, toks)}</i>` : ''}</span><span class="gm">${it.sub ? DB.esc(it.sub) + ' · ' : ''}<em>${DB.esc(SX[it.k].t)}</em></span></a></li>`).join('') +
      (shown.length > rows.length ? `<li class="more">Показаны первые ${rows.length} из ${shown.length} — уточните запрос</li>` : '');
  }

  function pick(i) {
    const a = list.querySelectorAll('a'); if (!a.length) return;
    sel = (i + a.length) % a.length;
    a.forEach((x, j) => x.toggleAttribute('aria-selected', j === sel));
    a[sel].scrollIntoView({ block: 'nearest' });
  }

  function build() {
    box = document.createElement('div'); box.id = 'gs-box'; box.hidden = true;
    box.innerHTML = '<div class="gs-bg"></div><div class="gs-win" role="dialog" aria-modal="true" aria-label="Глобальный поиск">' +
      '<div class="gs-top"><input type="search" id="gs-q" placeholder="Поиск по всей базе (рус / eng)" autocomplete="off" spellcheck="false"><button type="button" class="gs-x" aria-label="Закрыть">✕</button></div>' +
      '<div class="gs-chips"></div><p class="gs-hint"></p><ul class="gs-list"></ul>' +
      '<div class="gs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> выбор</span><span><kbd>Enter</kbd> открыть</span><span><kbd>Esc</kbd> закрыть</span><span class="gs-ed"></span></div></div>';
    document.body.appendChild(box);
    inp = $('#gs-q', box); list = $('.gs-list', box); chips = $('.gs-chips', box); hint = $('.gs-hint', box);
    inp.addEventListener('input', () => { sect = ''; run(); });
    chips.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; sect = b.dataset.k; run(); inp.focus(); });
    box.addEventListener('click', e => { if (e.target.closest('.gs-bg,.gs-x')) close(); else if (e.target.closest('.gs-list a')) setTimeout(close, 0); });
    box.addEventListener('keydown', e => {
      if (e.key == 'Escape') { e.preventDefault(); close(); }
      else if (e.key == 'ArrowDown') { e.preventDefault(); pick(sel + 1); }
      else if (e.key == 'ArrowUp') { e.preventDefault(); pick(sel - 1); }
      else if (e.key == 'Enter') { const a = list.querySelectorAll('a')[sel]; if (a) { e.preventDefault(); location.hash = a.getAttribute('href'); close(); } }
    });
    list.addEventListener('mousemove', e => { const a = e.target.closest('a'); if (a && +a.dataset.i !== sel) pick(+a.dataset.i); });
  }

  function open(prefill) {
    if (!box) build();
    if (!box.hidden) { inp.focus(); inp.select(); return; }
    lastFocus = document.activeElement; box.hidden = false; document.body.classList.add('gs-on');
    $('.gs-ed', box).textContent = 'Редакция ' + DB.EDK(DB.ed);
    if (typeof prefill == 'string') inp.value = prefill;
    run(); inp.focus(); inp.select(); index(DB.ed);
  }
  function close() {
    if (!box || box.hidden) return;
    box.hidden = true; document.body.classList.remove('gs-on');
    if (lastFocus && lastFocus.focus && lastFocus.isConnected) lastFocus.focus();
  }

  document.addEventListener('click', e => { if (e.target.closest('#gs')) { e.preventDefault(); open(); } });
  document.addEventListener('keydown', e => {
    const t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() == 'k') { e.preventDefault(); open(); }
    else if (e.key == '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
  });
  // смена редакции или раздела: закрыть окно (результаты относятся к прежней редакции)
  addEventListener('hashchange', () => close());
  window.GSearch = { open, close };
})();
