/* ===== Глобальный поиск =====
   Ищет во всех разделах выбранной редакции — 2024 или 2014 — по названиям (рус / eng) и по тексту записей;
   галочка «в обеих редакциях» добавляет вторую редакцию.
   Индексы: data/search.json и data14/search.json (названия), data/text/<раздел>.json и data14/text/<раздел>.json (полный текст),
   сборка — tools/build_search.py. Названия грузятся при первом открытии, тексты — когда набрано 3 буквы.
   Открытие: кнопка «Поиск» в верхней панели, Ctrl/⌘+K или «/». */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const IX = {};                       // редакция → промис с названиями
  const TX = {};                       // редакция → { k: [{raw, n}] } после загрузки текстов
  const TXP = {};                      // редакция → промис загрузки текстов
  const OPT = { both: DB_ls('gs.both') == '1', text: DB_ls('gs.text') != '0' };
  let box, inp, list, chips, hint, stat, rows = [], sel = 0, sect = '', lastFocus = null, token = 0, timer = 0;

  function DB_ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  const save = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { } };
  const dir = e => e == 14 ? 'data14' : 'data';

  const index = e => IX[e] || (IX[e] = fetch(dir(e) + '/search.json')
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(a => { const c = {}; return a.map(x => ({ e, ru: x[0], en: x[1], k: x[2], slug: x[3], sub: x[4], j: c[x[2]] = (c[x[2]] ?? -1) + 1, n: DB.norm(x[0]), ne: DB.norm(x[1]) })); })
    .catch(() => { delete IX[e]; return null; }));

  // тексты всех разделов редакции; onProgress(готово, всего)
  function loadText(e, onProgress) {
    if (TXP[e]) return TXP[e];
    const keys = DB.ORDERS[e]; let done = 0;
    TX[e] = {};
    return TXP[e] = Promise.all(keys.map(k => fetch(`${dir(e)}/text/${k}.json`).then(r => { if (!r.ok) throw 0; return r.json(); })
      .then(a => { TX[e][k] = a.map(t => ({ raw: t, n: DB.norm(t) })); onProgress && onProgress(++done, keys.length); })))
      .then(() => true).catch(() => { delete TXP[e]; delete TX[e]; return false; });
  }

  // оценка совпадения по названию: меньше — лучше; null — не подходит
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
    for (const t of toks) { let i = t ? n.indexOf(t) : -1; while (i >= 0) { for (let j = i; j < i + t.length; j++) hit[j] = true; i = n.indexOf(t, i + t.length); } }
    let out = '', on = false;
    for (let i = 0; i < s.length; i++) {
      if (hit[i] !== on) { out += on ? '</mark>' : '<mark>'; on = hit[i]; }
      out += DB.esc(s[i]);
    }
    return out + (on ? '</mark>' : '');
  }

  // фрагмент текста вокруг первого совпадения
  function snippet(d, toks) {
    let at = -1; for (const t of toks) { const i = find(d.n, t); if (i >= 0 && (at < 0 || i < at)) at = i; }
    if (at < 0) return '';
    const a = Math.max(0, at - 55), b = Math.min(d.raw.length, at + 110);
    let s = d.raw.slice(a, b);
    if (a > 0) s = '…' + s.slice(s.indexOf(' ') + 1 || 0);
    if (b < d.raw.length) s = s.slice(0, s.lastIndexOf(' ') > 40 ? s.lastIndexOf(' ') : s.length) + '…';
    return s;
  }

  // слово из текста: совпадение с начала слова («снаряд» найдёт «снарядов», но не «Крупнокалиберный»);
  // у длинных слов отбрасываем окончание, чтобы находились другие падежи («слепота» → «слепоты»)
  const stemOf = t => t.length >= 9 ? t.slice(0, -2) : t.length >= 6 ? t.slice(0, -1) : t;
  const WCH = /[\p{L}\p{N}]/u;
  function find(n, t, from) {
    let i = n.indexOf(t, from || 0);
    while (i > 0 && WCH.test(n[i - 1])) i = n.indexOf(t, i + 1);
    return i;
  }
  const count = (n, t) => { let c = 0, i = find(n, t); while (i >= 0 && c < 30) { c++; i = find(n, t, i + t.length); } return c; };
  const eds = () => OPT.both ? [DB.ed, DB.ed == 14 ? 24 : 14] : [DB.ed];
  const secTitle = (e, k) => (DB.SXS[e][k] || DB.SXS[e == 14 ? 24 : 14][k] || { t: k }).t;

  function status(msg) { stat.textContent = msg || ''; stat.hidden = !msg; }

  async function run() {
    const my = ++token, E = eds(), q = DB.norm(inp.value.trim()), toks = q.split(/\s+/).filter(Boolean);
    $('.gs-ed', box).textContent = OPT.both ? 'Обе редакции' : 'Редакция ' + DB.EDK(DB.ed);
    if (!q) { rows = []; chips.innerHTML = ''; list.innerHTML = ''; status(''); hint.textContent = 'Введите название или слово из описания — на русском или английском: «огненный шар», «Fireball», «слепота».'; hint.hidden = false; return; }
    const ixs = await Promise.all(E.map(index));
    if (my !== token) return;
    if (ixs.some(x => !x)) { list.innerHTML = ''; chips.innerHTML = ''; status(''); hint.textContent = 'Не удалось загрузить индекс поиска. Проверьте соединение.'; hint.hidden = false; return; }

    const res = [], seen = new Set();
    E.forEach((e, ei) => { const ord = DB.ORDERS[e];
      for (const it of ixs[ei]) { const s = score(it, q, toks); if (s !== null) { res.push({ it, s, o: ord.indexOf(it.k), ei, c: 0 }); seen.add(e + it.k + it.slug); } } });

    // текст записей
    const tt = toks.filter(t => t.length >= 2).map(stemOf);
    let waiting = false;
    if (OPT.text && q.length >= 3 && tt.length) {
      const need = E.filter(e => !TX[e] || !TXP[e]);
      if (need.length) {
        waiting = true;
        let msg = () => status('Ищу по тексту записей — загружаю тексты…');
        msg();
        Promise.all(need.map(e => loadText(e, (d, n) => status(`Ищу по тексту записей — загрузка ${DB.EDK(e)}: ${d} из ${n}…`)))).then(ok => {
          if (my !== token) return;
          if (ok.every(Boolean)) run(); else status('Тексты не загрузились — показаны только названия.');
        });
      } else {
        E.forEach((e, ei) => { const ord = DB.ORDERS[e];
          for (const it of ixs[ei]) {
            if (seen.has(e + it.k + it.slug)) continue;
            const d = TX[e][it.k] && TX[e][it.k][it.j]; if (!d) continue;
            if (!tt.every(t => find(d.n, t) >= 0)) continue;
            res.push({ it, s: find(d.n, tt.length > 1 ? tt.join(' ') : tt[0]) >= 0 ? 5 : 6, o: ord.indexOf(it.k), ei, c: count(d.n, tt[0]), d });
          } });
      }
    }
    if (!waiting) status('');
    res.sort((a, b) => a.s - b.s || b.c - a.c || a.ei - b.ei || a.o - b.o || a.it.ru.length - b.it.ru.length);

    const cnt = {}; res.forEach(r => cnt[r.it.k] = (cnt[r.it.k] || 0) + 1);
    if (sect && !cnt[sect]) sect = '';
    const shown = res.filter(r => !sect || r.it.k === sect), all = res.length;
    rows = shown.slice(0, 80);
    const order = [...new Set(E.flatMap(e => DB.ORDERS[e]))];
    chips.innerHTML = all ? `<button type="button" data-k=""${sect ? '' : ' class="on"'}>Все ${all}</button>` +
      order.filter(k => cnt[k]).map(k => `<button type="button" data-k="${k}"${sect === k ? ' class="on"' : ''}>${DB.esc(secTitle(E[0], k))} ${cnt[k]}</button>`).join('') : '';
    hint.hidden = !!all || waiting;
    if (!all && !waiting) hint.textContent = 'Ничего не найдено' + (OPT.both ? '' : ' в редакции ' + DB.EDK(DB.ed)) + '. Попробуйте другое написание' + (OPT.both ? '.' : ', английское название или поиск в обеих редакциях.');
    sel = 0;
    list.innerHTML = rows.map((r, i) => { const it = r.it;
      return `<li><a href="${DB.hh(it.e, it.k, it.slug)}" data-i="${i}"${i ? '' : ' aria-selected="true"'}><span class="gt"><b>${r.d ? DB.esc(it.ru) : mark(it.ru, toks)}</b>${it.en ? `<i>${r.d ? DB.esc(it.en) : mark(it.en, toks)}</i>` : ''}${r.d ? `<span class="gsn">${mark(snippet(r.d, tt), tt)}</span>` : ''}</span>` +
        `<span class="gm">${OPT.both ? `<u class="ge">${DB.EDK(it.e)}</u> ` : ''}${it.sub ? DB.esc(it.sub) + ' · ' : ''}<em>${DB.esc(secTitle(it.e, it.k))}</em></span></a></li>`; }).join('') +
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
      '<div class="gs-opts"><label><input type="checkbox" id="gs-both"> Искать в обеих редакциях (2014 и 2024)</label><label><input type="checkbox" id="gs-text"> Искать по тексту записей</label></div>' +
      '<div class="gs-chips"></div><p class="gs-stat" hidden></p><p class="gs-hint"></p><ul class="gs-list"></ul>' +
      '<div class="gs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> выбор</span><span><kbd>Enter</kbd> открыть</span><span><kbd>Esc</kbd> закрыть</span><span class="gs-ed"></span></div></div>';
    document.body.appendChild(box);
    inp = $('#gs-q', box); list = $('.gs-list', box); chips = $('.gs-chips', box); hint = $('.gs-hint', box); stat = $('.gs-stat', box);
    $('#gs-both', box).checked = OPT.both; $('#gs-text', box).checked = OPT.text;
    inp.addEventListener('input', () => { sect = ''; clearTimeout(timer); timer = setTimeout(run, 120); });
    $('#gs-both', box).addEventListener('change', e => { OPT.both = e.target.checked; save('gs.both', OPT.both); sect = ''; run(); inp.focus(); });
    $('#gs-text', box).addEventListener('change', e => { OPT.text = e.target.checked; save('gs.text', OPT.text); sect = ''; run(); inp.focus(); });
    chips.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; sect = b.dataset.k; run(); inp.focus(); });
    box.addEventListener('click', e => { if (e.target.closest('.gs-bg,.gs-x')) close(); else if (e.target.closest('.gs-list a')) setTimeout(close, 0); });
    box.addEventListener('keydown', e => {
      if (e.key == 'Escape') { e.preventDefault(); close(); }
      else if (e.key == 'ArrowDown') { e.preventDefault(); pick(sel + 1); }
      else if (e.key == 'ArrowUp') { e.preventDefault(); pick(sel - 1); }
      else if (e.key == 'Enter' && e.target === inp) { const a = list.querySelectorAll('a')[sel]; if (a) { e.preventDefault(); DB.go(a.getAttribute('href')); close(); } }
    });
    list.addEventListener('mousemove', e => { const a = e.target.closest('a'); if (a && +a.dataset.i !== sel) pick(+a.dataset.i); });
  }

  function open(prefill) {
    if (!box) build();
    if (!box.hidden) { inp.focus(); inp.select(); return; }
    lastFocus = document.activeElement; box.hidden = false; document.body.classList.add('gs-on');
    if (typeof prefill == 'string') inp.value = prefill;
    run(); inp.focus(); inp.select(); eds().forEach(index);
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
  // переход по ссылке — закрыть окно
  addEventListener('routechange', () => close());
  window.GSearch = { open, close };
})();
