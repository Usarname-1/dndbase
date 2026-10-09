/* ===== Автоссылки-подсказки =====
   Индекс: data/links.json (2024) и data14/links.json (2014), собирается tools/build_links.py.
   Запись: [name_ru, name_en, kind, slug, head, body, flag]

   Правила поиска (чтобы не было ложных срабатываний):
   • «огненного шара [fireball]» — английское имя в скобках надёжно указывает на запись (основной способ для 2014);
   • многословные названия ищутся с учётом падежей (по «основам» слов), регистр не важен для монстров и предметов;
   • заклинания и черты без скобок — только с заглавной буквы;
   • однословные заклинания и черты — только в точной форме
     (и не перед строчным словом: «Сотворение заклинаний» — это не заклинание «Сотворение»);
   • однословные термины правил (глоссарий), названия классов и снаряжения (2024): с Заглавной буквы в середине предложения, в любой форме
     («с Помехой», «Долгий отдых»); состояния и чувства — ещё и в точной форме где угодно;
   • в 2014 однословные заклинания и черты без скобок не ищутся вообще;
   • состояния 2014 (однословные, строчные) — только после слова «состояние». */
(function (root) {
  const KIND_RU = { s: 'Заклинание', c: 'Класс', e: 'Снаряжение', g: 'Правило', m: 'Монстр', i: 'Предмет', f: 'Черта', a: 'Правила' };
  const SINGLE_OK = new Set(['s', 'g', 'f', 'c', 'e']);          // однословные: только эти виды
  const PRIO = { g: 0, a: 0, c: 1, s: 1, e: 2, f: 2, i: 3, m: 4 }; // при совпадении ключей побеждает меньший
  const MAXN = 7;
  // слишком общие названия: чаще встречаются как обычные слова или заголовки умений, а не как ссылка
  const STOP = new Set(['увеличение характеристик', 'в день', 'карта', 'книга', 'кости', 'сфера', 'боеприпасы', 'костюм', 'кислота', 'духи', 'изготовление', 'регенерация', 'запрет',
    'отражения', 'наблюдение', 'оборона', 'знак', 'шквал', 'умиротворение']);

  // начало предложения (или текстового узла): после . ! ? : ; … или в самом начале строки
  // startsSentence — считать ли началом предложения самое начало строки (см. linkify: после подписи
  // «Классы», «Время сотворения» значение — это не новое предложение)
  const sentenceStart = (t, s, startsSentence) => {
    const p = t.slice(0, s).replace(/[\s\u00a0«"“(—–\-•*]+$/, '');
    return !p ? startsSentence !== false : /[.!?:;…]$/.test(p);
  };

  const SPELLCTX = /сотвор|заклинани|заговор|ячейк|концентраци/i;

  const WORD = /[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/g;
  const normL = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
  const ENDS = /(ыми|ими|ого|его|ому|ему|ами|ями|ый|ий|ой|ая|яя|ое|ее|ые|ие|ую|юю|ым|им|ом|ем|ых|их|ов|ей|ам|ям|ах|ях|ою|ею|а|я|у|ю|ы|и|е|о|ь|й)$/;
  const stemCache = new Map();
  function stem(w) {
    let r = stemCache.get(w);
    if (r !== undefined) return r;
    const n = normL(w), c = n.replace(ENDS, '');
    r = n.length < 4 ? n : (c.length >= 3 ? c : n);
    stemCache.set(w, r);
    return r;
  }

  /* ---------- индекс ---------- */
  // opts.bracketOnlySingle — однословные заклинания/черты находить только по скобкам [en]
  function buildIndex(rows, opts) {
    opts = opts || {};
    const map = new Map(), en = new Map(), first = new Set(), ambig = new Map();
    let maxN = 1;
    for (const r of rows) {
      const e = { ru: r[0], en: r[1], k: r[2], slug: r[3], head: r[4], body: r[5], cond: r[6] === 1, term: r[6] === 2 };
      const ws = (e.ru.replace(/\(.*?\)/g, ' ').match(WORD) || []);
      e.nw = ws.length;
      if (!e.nw || e.nw > MAXN) continue;
      if (e.en) {
        const ek = normL(e.en).replace(/\s+/g, ' ').trim(), old = en.get(ek);
        if (!old || PRIO[e.k] < PRIO[old.k]) en.set(ek, e);
      }
      if (STOP.has(normL(e.ru).replace(/\s+/g, ' ')) && !e.cond) continue;
      if (e.nw === 1) {
        if (!e.cond && !SINGLE_OK.has(e.k)) continue;
        if (ws[0].length < (e.k === 'e' || e.k === 's' ? 3 : 4)) continue;   // «Цеп», «Щит»
        if (opts.bracketOnlySingle && (e.k === 's' || e.k === 'f')) continue;
      }
      const key = ws.map(stem).join(' '), o = map.get(key);
      // одна основа у разных записей: «Цеп» и «Цепь» (разные предметы), «Щит» (заклинание и предмет).
      // Запоминаем всех, выбираем при поиске: по точной форме, а заклинание и предмет — по контексту
      if (o && o.nw === 1 && e.nw === 1 && (o.k === e.k ? o.ru !== e.ru : (o.k + e.k === 'se' || o.k + e.k === 'es'))) {
        if (!ambig.has(key)) ambig.set(key, [o]);
        ambig.get(key).push(e);
      }
      if (o && PRIO[o.k] <= PRIO[e.k]) continue;
      map.set(key, e);
      if (e.nw === 1 && /[йь]$/i.test(ws[0])) {          // «Чародей» ↔ «Чародея»: основы у них разные
        const alt = stem(ws[0] + 'а');
        if (!map.has(alt)) { map.set(alt, e); first.add(alt); }
      }
      first.add(stem(ws[0]));
      if (e.nw > maxN) maxN = e.nw;
    }
    return { map, en, first, maxN, ambig };
  }

  /* ---------- поиск совпадений в строке ---------- */
  // вернёт [{s, e, entry}] — непересекающиеся диапазоны
  function findLinks(text, ix, self, startsSentence) {
    const hits = [], skip = e => self && e.k === self.k && e.slug === self.slug;
    const toks = [...text.matchAll(WORD)].map(m => ({ w: m[0], s: m.index, e: m.index + m[0].length }));
    const gapOK = (a, b) => /^[  ]+$/.test(text.slice(a.e, b.s));
    const used = (s, e) => hits.some(h => s < h.e && e > h.s);

    // 1) привязка по английскому имени в скобках: «огненный шар [fireball]»
    for (const m of text.matchAll(/\[([A-Za-z][A-Za-z' \-]{1,60})\]/g)) {
      const ent = ix.en.get(normL(m[1]).replace(/\s+/g, ' ').trim());
      if (!ent || skip(ent)) continue;
      let j = -1;
      for (let t = toks.length - 1; t >= 0; t--) if (toks[t].e <= m.index) { j = t; break; }
      if (j < 0 || !/^[  ]*$/.test(text.slice(toks[j].e, m.index))) continue;
      let i = j;
      while (i > 0 && j - i + 1 < ent.nw && gapOK(toks[i - 1], toks[i])) i--;
      hits.push({ s: toks[i].s, e: m.index + m[0].length, entry: ent });
    }

    // 2) поиск по основам слов
    for (let i = 0; i < toks.length; i++) {
      if (!ix.first.has(stem(toks[i].w)) || used(toks[i].s, toks[i].e)) continue;
      let run = 1;
      while (i + run < toks.length && run < ix.maxN && gapOK(toks[i + run - 1], toks[i + run])) run++;
      for (let n = run; n >= 1; n--) {
        const key = toks.slice(i, i + n).map(t => stem(t.w)).join(' ');
        let ent = ix.map.get(key);
        if (n === 1 && ix.ambig.has(key)) {
          const c = ix.ambig.get(key).filter(x => x.ru === toks[i].w);
          // заклинание или предмет: рядом «сотворяет», «заклинание», «ячейка» — значит заклинание
          ent = c.length > 1 ? c.find(x => x.k === (SPELLCTX.test(text) ? 's' : 'e')) : c[0];
        }
        if (!ent || skip(ent)) continue;
        const s = toks[i].s, e = toks[i + n - 1].e;
        if (used(s, e)) continue;
        // заклинания и черты без скобок — только с заглавной буквы
        if ((ent.k === 's' || ent.k === 'f') && !/^[А-ЯЁ]/.test(toks[i].w)) continue;
        if (n === 1 && ent.nw === 1) {
          if (ent.cond) {                                       // состояние 2014 — после слова «состояние»
            if (!/состояни[а-яё]*\s*[«"“]?$/i.test(text.slice(Math.max(0, s - 24), s))) continue;
          } else if (ent.k === 'g' || ent.k === 'c' || ent.k === 'e') {
            // термин правил: либо точная форма (состояния, чувства), либо Заглавная буква в середине
            // предложения в любой форме — так 2024 пишет «Долгий отдых», «с Помехой», «Сферой радиусом»
            // «Шесть» — не форма слова «Шест»: окончание -ь/-й бывает только у слов, которые так и заканчиваются
            if (/[ьй]$/i.test(toks[i].w) && !/[ьй]$/i.test(ent.ru)) continue;
            const cap = /^[А-ЯЁ]/.test(toks[i].w), exact = toks[i].w === ent.ru;
            if (!((exact && !ent.term) || (cap && !sentenceStart(text, s, startsSentence)))) continue;
            // внутри «ёлочек» — названия таблиц и умений («Урон ярости»), а не термины
            const before = text.slice(0, s);
            if (ent.term && (before.split('«').length > before.split('»').length)) continue;
          } else {
            if (toks[i].w !== ent.ru) continue;                 // точная форма и регистр
            // «Сотворение заклинаний», «Сопротивление урону» — не названия заклинаний
            if (ent.k !== 'g' && /^[  ]+[а-яё]/.test(text.slice(e, e + 3))) continue;
          }
        }
        hits.push({ s, e, entry: ent });
        i += n - 1;
        break;
      }
    }
    return hits.sort((a, b) => a.s - b.s);
  }

  /* ---------- DOM ---------- */
  const SKIP = 'a,h2,h3,h4,b,th,summary,button,.nm,.en,.sub,.meta,script,style';
  function linkify(el, ix, self, hrefFn) {
    if (!el || !ix) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        if (n.nodeValue.length <= 3 || !n.parentElement || n.parentElement.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        const row = n.parentElement.closest('.pr');          // строка «Компоненты»: «гуано летучей мыши» — не монстр
        if (row && row.firstElementChild && /^Компоненты/.test(row.firstElementChild.textContent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    // что стоит перед текстовым узлом: поднимаемся из строчных обёрток (<i>, <em>) до соседа
    const INLINE = /^(I|EM|SPAN|B|STRONG|SMALL)$/;
    const prevText = n => {
      while (!n.previousSibling && n.parentElement && n.parentElement !== el && INLINE.test(n.parentElement.tagName)) n = n.parentElement;
      return n.previousSibling ? n.previousSibling.textContent : '';
    };
    for (const n of nodes) {
      // начало узла — начало предложения, если перед ним ничего нет или там закончилась фраза;
      // «<b>Классы</b> Друид» и ячейки таблицы — значение, а не новое предложение
      const pt = prevText(n).trim(), par = n.parentElement;
      const startsSentence = !!pt ? /[.!?:;…]$/.test(pt) : !(par && /^(TD|TH)$/.test(par.tagName));
      const t = n.nodeValue, hits = findLinks(t, ix, self, startsSentence);
      if (!hits.length) continue;
      const f = document.createDocumentFragment();
      let p = 0;
      for (const h of hits) {
        if (h.s > p) f.append(t.slice(p, h.s));
        const a = document.createElement('a');
        a.className = 'xl';
        a.href = hrefFn(h.entry);
        a._e = h.entry;
        a.textContent = t.slice(h.s, h.e);
        f.append(a);
        p = h.e;
      }
      if (p < t.length) f.append(t.slice(p));
      n.replaceWith(f);
    }
  }

  /* ---------- подсказка ---------- */
  let tip, tipFor, tipTimer;
  const escH = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function showTip(a) {
    const e = a._e;
    if (!e) return;
    tip = tip || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'tip' });
    tip.innerHTML = `<div class="tk">${KIND_RU[e.k] || ''}</div><b>${escH(e.ru)}</b>${e.en ? ` <i>${escH(e.en)}</i>` : ''}`
      + (e.head ? `<div class="th">${escH(e.head)}</div>` : '') + (e.body ? `<p>${escH(e.body)}</p>` : '');
    tip.style.display = 'block';
    const r = a.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = Math.min(Math.max(8, r.left), innerWidth - tw - 8);
    let y = r.bottom + 6;
    if (y + th > innerHeight - 8) y = Math.max(8, r.top - th - 6);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tipFor = a;
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (tip) tip.style.display = 'none';
    tipFor = null;
  }
  const xl = ev => ev.target.closest && ev.target.closest('a.xl');
  function bindTips(container) {
    const touch = matchMedia('(hover:none)').matches;
    container.addEventListener('mouseover', ev => {
      const a = xl(ev);
      if (!a || touch) return;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => showTip(a), 140);
    });
    container.addEventListener('mouseout', ev => { if (xl(ev)) hideTip(); });
    container.addEventListener('focusin', ev => { const a = xl(ev); if (a) showTip(a); });
    container.addEventListener('focusout', hideTip);
    // на телефонах: первое касание — подсказка, второе — переход
    container.addEventListener('click', ev => {
      const a = xl(ev);
      if (!a) return;
      if (touch && tipFor !== a) { ev.preventDefault(); showTip(a); } else hideTip();
    });
    document.addEventListener('click', ev => { if (!xl(ev)) hideTip(); });
    addEventListener('scroll', hideTip, true);
    addEventListener('hashchange', hideTip);
  }

  const api = { buildIndex, findLinks, linkify, bindTips, stem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoLinks = api;
})(typeof window !== 'undefined' ? window : globalThis);
