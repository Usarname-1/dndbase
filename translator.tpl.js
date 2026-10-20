/* ===== Переводчик =====
   Русский текст → письменность вымышленных языков D&D: знаки Юникода, оригинальные глифы из книг (картинки) и воровской жаргон.
   Данные (алфавиты, звучание, жаргон) взяты из youngdrug6666-ship-it/tracker (translator.html).
   Подключается как вкладка основного приложения: index.html вызывает TR.show(). */
(function (root) {
  'use strict';
  const L = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
  /*__DATA__*/

  // Языки и диалекты: g — алфавит знаков, s — таблица звучания, img — набор картинок-глифов (оригинал из книги)
  const M = {
    'infernal-original': { n: 'Оригинал (BGDIA)', img: 'infernal', s: 'infernal', sc: 'Инфернальная', dl: 'Инфернальный оригинал (BGDIA)' },
    infernal: { n: 'Инфернальный', g: 'infernal', s: 'infernal', sc: 'Инфернальная', dl: 'Инфернальный' },
    abyssal: { n: 'Бездна', g: 'infernal', s: 'abyssal', sc: 'Инфернальная', dl: 'Бездна' },
    'dwarf-original': { n: 'Оригинал (PHB)', img: 'dwarf', s: 'dwarf', sc: 'Дварфийская', dl: 'Дварфийский оригинал (PHB)' },
    dwarf: { n: 'Дварфийский', g: 'dwarf', s: 'dwarf', sc: 'Дварфийская', dl: 'Дварфийский' },
    giant: { n: 'Великаний', g: 'dwarf', s: 'giant', sc: 'Дварфийская', dl: 'Великаний' },
    gnome: { n: 'Гномий', g: 'dwarf', s: 'gnome', sc: 'Дварфийская', dl: 'Гномий' },
    goblin: { n: 'Гоблинский', g: 'dwarf', s: 'goblin', sc: 'Дварфийская', dl: 'Гоблинский' },
    orc: { n: 'Орочий', g: 'dwarf', s: 'orc', sc: 'Дварфийская', dl: 'Орочий' },
    primordial: { n: 'Первичный', g: 'dwarf', s: 'primordial', sc: 'Дварфийская', dl: 'Первичный' },
    elf: { n: 'Эльфийский', g: 'elf', s: 'elf', sc: 'Эльфийская', dl: 'Эльфийский' },
    'elf-original': { n: 'Оригинал (PHB)', img: 'elf', s: 'elf', sc: 'Эльфийская', dl: 'Эльфийский оригинал (PHB)' },
    sylvan: { n: 'Сильван', g: 'elf', s: 'sylvan', sc: 'Эльфийская', dl: 'Сильван' },
    drow: { n: 'Подземный', g: 'elf', s: 'drow', sc: 'Эльфийская', dl: 'Подземный' },
    dragon: { n: 'Драконий', g: 'dragon', s: 'dragon', sc: 'Драконья', dl: 'Драконий' },
    'dragon-original': { n: 'Оригинал (PHB)', img: 'dragon', s: 'dragon', sc: 'Драконья', dl: 'Драконий оригинал (PHB)' },
    celestial: { n: 'Небесный', g: 'celestial', s: 'celestial', sc: 'Небесная', dl: '' },
    druidic: { n: 'Друидический', g: 'druidic', s: 'druidic', sc: 'Друидическая', dl: 'Друидический' },
    deep: { n: 'Глубинная речь', s: 'deep', sc: '', dl: '' },
    thief: { n: 'Воровской жаргон', sc: 'Воровские метки', dl: 'Воровской жаргон' }
  };
  const FAM = [
    { n: 'Инфернальный', v: ['infernal-original', 'infernal', 'abyssal'] },
    { n: 'Дварфийский', v: ['dwarf-original', 'dwarf', 'giant', 'gnome', 'goblin', 'orc', 'primordial'] },
    { n: 'Эльфийский', v: ['elf', 'elf-original', 'sylvan', 'drow'] },
    { n: 'Драконий', v: ['dragon', 'dragon-original'] },
    { n: 'Небесный', v: ['celestial'] },
    { n: 'Друидический', v: ['druidic'] },
    { n: 'Глубинная речь', v: ['deep'] },
    { n: 'Воровской жаргон', v: ['thief'] }
  ];
  const famOf = m => FAM.find(f => f.v.includes(m));

  // обратные таблицы «знак → буква»; если знак у двух букв общий, остаётся последняя (как в оригинале)
  const REV = {};
  for (const k in G) { REV[k] = {}; L.split('').forEach((l, i) => { if (G[k][i]) REV[k][G[k][i]] = l; }); }
  const tab = (arr, l) => { const i = L.indexOf(l); return i < 0 ? undefined : arr[i]; };

  // слипшиеся одинаковые слоги внутри слова схлопываем, слово обрезаем до 6 знаков — так получается «разговорное» звучание
  function dedupe(word) {
    let out = '', last = '';
    for (let i = 0; i < word.length; i++) {
      let syl = word[i];
      if (i + 1 < word.length && /[aeiou]/i.test(word[i + 1])) { syl += word[i + 1]; i++; }
      if (syl !== last) { out += syl; last = syl; }
    }
    return out;
  }
  const squash = t => t.split(/\s+/).filter(Boolean).map(w => dedupe(w).slice(0, 6)).join(' ');
  const reading = (text, sn) => { let r = ''; for (const c of text.toLowerCase()) r += (c === ' ' || c === '\n') ? ' ' : (tab(S[sn], c) || ''); return squash(r); };

  // воровской жаргон: русское слово, воровское слово и значок понимаются как одно и то же, на выходе всегда «воровское слово + значок».
  // \b в JS не видит кириллицу, поэтому границы слов задаём через свойства Юникода
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const edge = (w, tail) => '(?<![\\p{L}\\p{N}_])' + esc(w) + '(?![\\p{L}\\p{N}_])' + (tail || '');
  const THIEF = T.map(([ru, cant, glyph]) => ({ ru, cant, glyph })), TBY = new Map(), TGL = new Map();
  THIEF.forEach(t => { TBY.set(t.ru.toLowerCase(), t); TBY.set(t.cant.toLowerCase(), t); TGL.set(t.glyph, t); });
  const TRX = new RegExp(THIEF.flatMap(t => [
    { w: t.ru.length, p: edge(t.ru) },
    { w: t.cant.length + 2, p: edge(t.cant, '(?:\\s*' + esc(t.glyph) + ')?') },   // «железо ⌘» не удваивается при повторном переводе
    { w: 1, p: esc(t.glyph) }
  ]).sort((a, b) => b.w - a.w).map(x => x.p).join('|'), 'giu');
  const thief = text => text.replace(TRX, m => {
    const k = m.toLowerCase(), t = TGL.get(m) || TBY.get(k) || TBY.get(k.replace(/\s+\S+$/u, ''));
    return t ? t.cant + ' ' + t.glyph : m;
  });

  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
    for (const x of kids.flat()) if (x !== false && x != null) e.append(typeof x === 'object' ? x : document.createTextNode(x));
    return e;
  };
  const KEY = 'tr.v1';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
  const toast = t => root.DM && root.DM.toast ? root.DM.toast(t) : alert(t);
  const imgSrc = (set, l) => 'translator/glyphs/' + set + '-' + String(L.indexOf(l) + 1).padStart(2, '0') + '.png';

  let mode = M[ls.get(KEY + '.mode')] ? ls.get(KEY + '.mode') : 'infernal', built = false, el = {};

  /* ---------- перевод ---------- */
  // чистая функция: режим и текст на входе; на выходе — результат (строка или список элементов) и строка со звучанием
  function run(mode, text) {
    const m = M[mode];
    if (mode === 'thief') return { text: thief(text), read: text.trim() ? 'Воровской жаргон' : '' };
    if (m.img) {
      const nodes = [];
      for (const c of text) {
        const l = c.toLowerCase();
        if (c === '\n') nodes.push({ br: 1 });
        else if (c === ' ') nodes.push({ sp: 1 });
        else if (L.includes(l)) nodes.push({ img: imgSrc(m.img, l), l });
        else nodes.push({ t: c });
      }
      return { nodes, read: text.trim() ? 'Звучание: ' + reading(text, m.s) : '' };
    }
    if (m.g) {
      let out = '', ru = '', rd = '', fromGlyph = false;
      for (const c of text) {
        if (c === ' ' || c === '\n') { out += c; ru += c; rd += c; continue; }
        const r = REV[m.g][c];
        if (r) { fromGlyph = true; ru += r; out += c; rd += tab(S[m.s], r) || ''; }
        else { const l = c.toLowerCase(); ru += l; out += tab(G[m.g], l) || l; rd += tab(S[m.s], l) || ''; }
      }
      return { text: out, read: !text.trim() ? '' : fromGlyph ? 'Перевод на русский: ' + ru : 'Звучание: ' + squash(rd) };
    }
    return { text, read: text.trim() ? 'Звучание: ' + reading(text, m.s) : '' };   // глубинная речь: письменности нет
  }
  function convert() {
    const text = el.input.value, r = run(mode, text);
    ls.set(KEY + '.text', text);
    el.out.className = 'trout ' + mode;
    el.out.replaceChildren();
    if (r.nodes) r.nodes.forEach(n => el.out.append(n.br ? h('br') : n.sp ? h('span', { class: 'sp' }, ' ') : n.img ? h('img', { src: n.img, alt: n.l, onerror: e => { e.target.style.display = 'none'; } }) : n.t));
    else el.out.textContent = r.text;
    el.read.textContent = r.read;
    el.info.replaceChildren(...info(M[mode]));
  }
  function info(m) {
    const bits = [];
    if (m.sc) bits.push(h('span', {}, h('b', {}, 'Письменность: '), m.sc));
    else if (mode === 'deep') bits.push(h('span', {}, 'Глубинная речь · письменности нет'));
    if (m.dl) bits.push(h('span', {}, h('b', {}, 'Диалект: '), m.dl));
    return bits.flatMap((b, i) => i ? [' · ', b] : [b]);
  }

  /* ---------- таблица знаков ---------- */
  function insert(s) {
    const i = el.input, a = i.selectionStart ?? i.value.length, b = i.selectionEnd ?? a;
    i.value = i.value.slice(0, a) + s + i.value.slice(b);
    i.focus(); i.selectionStart = i.selectionEnd = a + s.length;
    convert();
  }
  function table() {
    const m = M[mode], box = el.tbl;
    box.replaceChildren(); box.className = 'trtbl';
    if (mode === 'deep') { box.className = ''; box.append(h('p', { class: 'trnote' }, 'У глубинной речи нет письменности: переводчик покажет только звучание.')); return; }
    if (mode === 'thief') {
      box.classList.add('thief');
      THIEF.forEach(t => box.append(h('button', { type: 'button', class: 'cell w', title: 'Вставить значок в текст', onclick: () => insert(t.glyph + ' ') },
        h('span', {}, h('b', {}, t.ru), ' → ' + t.cant), h('span', { class: 'g' }, t.glyph))));
      return;
    }
    if (m.img) box.classList.add('img');
    L.split('').forEach((l, i) => {
      if (m.img) box.append(h('button', { type: 'button', class: 'cell', title: 'Вставить букву «' + l + '»', onclick: () => insert(l) },
        h('span', { class: 'l' }, l.toUpperCase()), h('img', { src: imgSrc(m.img, l), alt: '', loading: 'lazy', onerror: e => { e.target.style.display = 'none'; } })));
      else { const g = G[m.g][i]; box.append(h('button', { type: 'button', class: 'cell' + (g ? '' : ' none'), title: g ? 'Вставить знак' : 'У этой буквы нет знака', onclick: () => insert(g || l) },
        h('span', { class: 'l' }, l.toUpperCase()), h('span', { class: 'g' }, g || '—'))); }
    });
  }

  /* ---------- выбор языка ---------- */
  function chips() {
    el.fam.replaceChildren(...FAM.map(f => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(f.v.includes(mode)), onclick: () => setMode(f.v.includes(mode) ? mode : f.v[0]) }, f.n)));
    const f = famOf(mode);
    el.vars.replaceChildren(...(f.v.length > 1 ? f.v.map(v => h('button', { type: 'button', class: 'chip sub', 'aria-pressed': String(v === mode), onclick: () => setMode(v) }, M[v].n)) : []));
    el.varsLbl.hidden = f.v.length < 2;
    el.varsLbl.textContent = 'Диалект и вариант письма';
  }
  function setMode(m) {
    mode = m; ls.set(KEY + '.mode', m);
    const orig = !!M[m].img;
    el.copyT.hidden = orig; el.copyI.hidden = !orig;
    chips(); table(); convert();
  }

  /* ---------- копирование ---------- */
  function copyText() {
    const t = el.out.innerText;
    if (!t.trim()) { toast('Нечего копировать: сначала введите текст'); return; }
    navigator.clipboard.writeText(t).then(() => toast('Перевод скопирован'), () => toast('Не удалось скопировать: браузер не разрешил доступ к буферу'));
  }
  async function copyImage() {
    if (!el.out.children.length) { toast('Сначала введите текст'); return; }
    try {
      if (typeof html2canvas === 'undefined') await new Promise((ok, no) => document.head.append(h('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', onload: ok, onerror: no })));
      const cv = await html2canvas(el.out, { backgroundColor: '#fffaf0', scale: 2, useCORS: true, logging: false });
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      if (!blob) throw new Error('пустое изображение');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Картинка скопирована: можно вставлять в мессенджер (Ctrl+V)');
    } catch (e) {
      toast('Не получилось скопировать картинку: ' + (e && e.message || 'браузер не разрешил'));
    }
  }
  function clearAll() { el.input.value = ''; convert(); el.input.focus(); }

  /* ---------- сборка страницы ---------- */
  function build() {
    el.input = h('textarea', { id: 'trin', rows: 3, placeholder: 'Введите текст на русском (или знаки выбранного алфавита для обратного перевода)', spellcheck: 'false', oninput: convert });
    el.input.value = ls.get(KEY + '.text') || '';
    el.fam = h('div', { class: 'trchips', role: 'group', 'aria-label': 'Язык' });
    el.varsLbl = h('span', { class: 'trlbl' });
    el.vars = h('div', { class: 'trchips trvars', role: 'group', 'aria-label': 'Диалект' });
    el.out = h('div', { class: 'trout', 'aria-live': 'polite', 'data-ph': 'Здесь появится перевод' });
    el.read = h('p', { class: 'trread' });
    el.info = h('p', { class: 'trinfo' });
    el.copyT = h('button', { type: 'button', class: 'trbtn main', onclick: copyText }, 'Скопировать перевод');
    el.copyI = h('button', { type: 'button', class: 'trbtn main', onclick: copyImage, hidden: true }, 'Скопировать картинку');
    el.tbl = h('div', { class: 'trtbl' });
    const root_ = document.getElementById('tr');
    root_.append(h('div', { class: 'trwrap' }, h('article', { class: 'stat' },
      h('h2', {}, 'Переводчик'),
      h('p', { class: 'en' }, 'Языки и письменность D&D · Dungeons & Dragons'),
      h('div', { class: 'rule' }),
      h('p', { class: 'trlead' }, 'Переводит русский текст в письменность вымышленных языков и подсказывает, как это произносить.'),
      h('span', { class: 'trlbl' }, 'Язык'), el.fam, el.varsLbl, el.vars,
      h('label', { class: 'trlbl', for: 'trin' }, 'Текст'), el.input,
      h('span', { class: 'trlbl' }, 'Перевод'), el.out, el.read, el.info,
      h('div', { class: 'trbtns' }, el.copyT, el.copyI, h('button', { type: 'button', class: 'trbtn', onclick: clearAll }, 'Очистить')),
      h('span', { class: 'trlbl' }, 'Знаки (нажмите, чтобы вставить в текст)'), el.tbl,
      h('details', { class: 'trhelp' }, h('summary', {}, 'Как пользоваться'), h('ul', {},
        h('li', {}, h('b', {}, 'Обычные языки'), ': текст превращается в особые знаки, а под ним показано примерное звучание.'),
        h('li', {}, h('b', {}, 'Оригинал (PHB, BGDIA)'), ': канонические глифы из книг в виде картинок. «Скопировать картинку» кладёт их в буфер, чтобы вставить в чат.'),
        h('li', {}, h('b', {}, 'Обратный перевод'), ': вставьте знаки обычного алфавита, и переводчик покажет русский текст. Для оригинальных глифов и воровского жаргона он не работает.'),
        h('li', {}, h('b', {}, 'Воровской жаргон'), ': русское слово заменяется воровским и значком; значок в таблице можно вставить кликом.'))))));
    built = true;
  }
  function loadFonts() {
    if (document.getElementById('trfonts')) return;
    document.head.append(h('link', { id: 'trfonts', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&family=Noto+Sans+Math&family=Noto+Sans+Runic&family=Noto+Sans+Coptic&family=Noto+Sans+Cuneiform&family=Noto+Sans+Imperial+Aramaic&family=Noto+Sans+Shavian&display=swap' }));
  }
  function show() {
    loadFonts();
    if (!built) build();
    setMode(mode);
  }

  root.TR = { show, run, MODES: M, FAMILIES: FAM };
})(window);
