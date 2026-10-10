/* ===== Панели экрана мастера =====
   Регистрируются через DM.registerType(id, {name, desc, w, h, init(), render(ctx)}).
   ctx: {p (панель; p.s — её сохраняемое состояние), body, save(), db(), title(текст), addBtn(), onDispose(fn), refresh()} */
(function (root) {
  'use strict';
  const DM = root.DM, h = DM.h;
  const DB = () => root.DB;
  const num = (v, d) => { const n = parseInt(String(v).replace('−', '-'), 10); return isNaN(n) ? (d || 0) : n; };
  const sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const btn = (txt, fn, cls, tip) => h('button', { type: 'button', class: cls || '', title: tip || '', onclick: fn }, txt);
  const inp = (attrs, on) => h('input', Object.assign({ type: 'text', autocomplete: 'off' }, attrs, on ? { oninput: on } : {}));

  /* ---------- Кубики ---------- */
  DM.registerType('dice', {
    name: 'Кубики', desc: 'd4–d100, своя формула, избранное', w: 3, h: 6,
    init: () => ({ fav: ['2к6+3', '8к6'], last: '' }),
    render(ctx) {
      const s = ctx.p.s, res = h('div', { class: 'dres' }, 'Бросьте кубик');
      const go = f => {
        const r = root.Dice.roll(f, { kind: 'dice', label: 'Кубики', src: '', mode: root.Dice.state.mode });
        if (!r) { res.textContent = 'Не понял формулу «' + f + '». Пример: 2к8+3'; res.classList.add('bad'); }
        return r;
      };
      const show = r => {
        res.classList.remove('bad');
        res.textContent = '';
        res.append(h('b', {}, String(r.total)), h('small', {}, r.formula + (r.mode === 'a' ? ' · преим.' : r.mode === 'd' ? ' · помеха' : '')));
        res.classList.remove('pop'); void res.offsetWidth; res.classList.add('pop');
      };
      const listener = r => { if (r.label === 'Кубики') show(r); };
      root.Dice.on(listener); ctx.onDispose(() => root.Dice.off(listener));
      const pad = h('div', { class: 'dpad' }, [4, 6, 8, 10, 12, 20, 100].map(n => btn('к' + n, () => go('1к' + n), 'dd d' + n)));
      const f = inp({ placeholder: 'Формула: 2к8+3', value: s.last || '' });
      const run = () => { if (f.value.trim()) { s.last = f.value.trim(); ctx.save(); go(f.value); } };
      f.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
      const favs = h('div', { class: 'favs' });
      const drawFav = () => {
        favs.textContent = '';
        s.fav.forEach((x, i) => favs.append(h('span', { class: 'fav' }, btn(x, () => go(x)), btn('×', () => { s.fav.splice(i, 1); ctx.save(); drawFav(); }, 'xx', 'Убрать из избранного'))));
      };
      drawFav();
      const modes = h('div', { class: 'seg' }, [['n', 'обыч.'], ['a', 'преим.'], ['d', 'помеха']].map(([m, t]) => {
        const b = btn(t, () => { root.Dice.state.mode = m; root.Dice.syncTray(); sync(); });
        b.dataset.m = m; return b;
      }));
      const sync = () => modes.querySelectorAll('button').forEach(b => b.classList.toggle('act', root.Dice.state.mode === b.dataset.m));
      sync();
      ctx.body.append(h('div', { class: 'dice' }, res, pad,
        h('div', { class: 'row' }, f, btn('Бросить', run, 'pri'), btn('★', () => {
          const v = f.value.trim(); if (!v || !root.Dice.parse(v, 'dice')) return DM.toast('Сначала введите верную формулу');
          if (!s.fav.includes(v)) { s.fav.push(v); ctx.save(); drawFav(); }
        }, '', 'Сохранить формулу в избранное')), favs, modes));
    }
  });

  /* ---------- Инициатива ---------- */
  const COND = ['Бессознательный', 'Ослеплённый', 'Очарованный', 'Оглохший', 'Испуганный', 'Схваченный', 'Недееспособный', 'Невидимый', 'Парализованный', 'Окаменевший', 'Отравленный', 'Сбитый с ног', 'Опутанный', 'Ошеломлённый', 'Истощение', 'Концентрация'];
  const rid = () => Math.random().toString(36).slice(2, 8);
  function sortList(s) {
    const cur = s.list[s.turn] && s.list[s.turn].id;
    s.list = s.list.map((x, i) => [x, i]).sort((a, b) => (b[0].init - a[0].init) || (a[1] - b[1])).map(x => x[0]);
    const i = s.list.findIndex(x => x.id === cur);
    s.turn = i < 0 ? 0 : i;
  }
  function rollInit(mod) { const r = root.Dice.roll('к20' + (mod < 0 ? '−' : '+') + Math.abs(mod), { kind: 'check', silent: true }); return r ? r.total : 10 + mod; }
  function newRow(o) { return Object.assign({ id: rid(), name: 'Участник', init: 10, hp: 0, max: 0, ac: '', cond: [], mon: null, note: '' }, o); }
  DM.INIT = {
    addMonster(s, m, e, qty) {
      qty = Math.max(1, Math.min(30, qty || 1));
      const ab = m.abilities || {}, dex = ab.dex || {};
      const mod = m.initiative && typeof m.initiative.mod === 'number' ? m.initiative.mod : (typeof dex.mod === 'number' ? dex.mod : 0);
      const same = s.list.filter(x => x.mon && x.mon.slug === m.slug && x.mon.e === e).length;
      for (let i = 0; i < qty; i++) {
        const n = same + i + 1, hp = (m.hp && m.hp.avg) || 0;
        s.list.push(newRow({
          name: m.name_ru + (qty > 1 || same ? ' ' + n : ''), init: rollInit(mod), hp, max: hp,
          ac: m.ac != null ? String(typeof m.ac === 'object' ? (m.ac.value || m.ac.ac || '') : m.ac) : '', mon: { e, sec: 'bestiary', slug: m.slug }, mod
        }));
      }
      sortList(s);
    }
  };

  DM.registerType('init', {
    name: 'Инициатива', desc: 'Бой: порядок ходов, хиты, КД, состояния, раунды', w: 6, h: 11,
    init: () => ({ list: [], turn: 0, round: 1, started: false }),
    render(ctx) {
      const s = ctx.p.s, el = ctx.body;
      let allMon = null;
      const lst = h('div', { class: 'ilist' });
      const toolbar = h('div', { class: 'itools' });
      const name = inp({ placeholder: 'Имя или монстр…', list: 'dm-mons-' + ctx.p.id, class: 'iname' });
      const dl = h('datalist', { id: 'dm-mons-' + ctx.p.id });
      const qty = inp({ type: 'number', value: '1', min: '1', max: '30', class: 'iqty', title: 'Сколько' });
      const loadMons = async () => {
        if (allMon) return allMon;
        try { allMon = await DB().load('bestiary', DB().ed); } catch (e) { allMon = []; }
        dl.textContent = ''; allMon.forEach(m => dl.append(h('option', { value: m.name_ru })));
        return allMon;
      };
      name.addEventListener('focus', loadMons);
      const addByName = async () => {
        const v = name.value.trim(); if (!v) return;
        const q = Math.max(1, Math.min(30, num(qty.value, 1)));
        const mons = await loadMons(), nv = DB().norm(v);
        const m = mons.find(x => DB().norm(x.name_ru) === nv) || mons.find(x => DB().norm(x.name_en) === nv);
        if (m) DM.INIT.addMonster(s, m, DB().ed, q);
        else { for (let i = 0; i < q; i++) s.list.push(newRow({ name: q > 1 ? v + ' ' + (i + 1) : v })); sortList(s); }
        name.value = ''; ctx.save(); draw();
      };
      name.addEventListener('keydown', e => { if (e.key === 'Enter') addByName(); });
      const next = () => {
        if (!s.list.length) return;
        s.started = true;
        s.turn++; if (s.turn >= s.list.length) { s.turn = 0; s.round++; }
        ctx.save(); draw();
      };
      toolbar.append(name, qty, btn('Добавить', addByName, 'pri', 'Монстр из бестиария (по названию) или просто участник'), dl,
        btn('Бросить за всех', () => {
          s.list.forEach(x => { if (x.mon) x.init = rollInit(x.mod || 0); }); sortList(s); ctx.save(); draw();
        }, '', 'Перебросить инициативу всем монстрам'),
        btn('След. ход ▶', next, 'pri', 'Передать ход следующему'),
        btn('Сброс боя', () => {
          if (!confirm('Очистить бой?')) return;
          s.list = []; s.turn = 0; s.round = 1; s.started = false; ctx.save(); draw();
        }));
      const upd = (x, f) => { f(x); ctx.save(); };
      function row(x, i) {
        const cur = s.started && i === s.turn, dead = x.max > 0 && x.hp <= 0;
        const r = h('div', { class: 'irow' + (cur ? ' cur' : '') + (dead ? ' dead' : '') });
        const ini = inp({ type: 'number', value: x.init, class: 'iini', title: 'Инициатива', onchange: e => { x.init = num(e.target.value); sortList(s); ctx.save(); draw(); } });
        const nm = x.mon
          ? h('a', { href: DB().hh(x.mon.e, x.mon.sec, x.mon.slug), class: 'inm', title: 'Открыть карточку' }, x.name)
          : h('span', { class: 'inm', contenteditable: 'plaintext-only', spellcheck: 'false', onblur: e => upd(x, o => o.name = e.target.textContent.trim() || 'Участник') }, x.name);
        const hp = inp({ type: 'number', value: x.hp, class: 'ihp', title: 'Хиты сейчас', onchange: e => { x.hp = num(e.target.value); ctx.save(); draw(); } });
        const mx = inp({ type: 'number', value: x.max, class: 'ihp', title: 'Максимум хитов', onchange: e => { x.max = num(e.target.value); ctx.save(); draw(); } });
        const ac = inp({ value: x.ac, class: 'iac', title: 'Класс доспеха', placeholder: 'КД', onchange: e => upd(x, o => o.ac = e.target.value) });
        const dm = inp({ type: 'number', placeholder: 'урон', class: 'idm', title: 'Урон: введите число и Enter. Лечение — число со знаком минус' });
        dm.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          const v = num(dm.value); if (!v) return;
          x.hp = Math.max(0, x.max ? Math.min(x.max, x.hp - v) : x.hp - v);
          ctx.save(); draw();
        });
        const cond = h('span', { class: 'icond' }, x.cond.map(c => h('span', { class: 'chip', title: 'Нажмите, чтобы снять', onclick: () => { x.cond.splice(x.cond.indexOf(c), 1); ctx.save(); draw(); } }, c + ' ×')));
        const sel = h('select', { class: 'icadd', title: 'Добавить состояние', onchange: e => { if (e.target.value) { x.cond.push(e.target.value); ctx.save(); draw(); } } },
          h('option', { value: '' }, '＋'), COND.filter(c => !x.cond.includes(c)).map(c => h('option', { value: c }, c)));
        const del = btn('×', () => { s.list.splice(s.list.indexOf(x), 1); if (s.turn >= s.list.length) s.turn = 0; ctx.save(); draw(); }, 'xx', 'Убрать из боя');
        r.append(ini, nm, h('span', { class: 'ihpw', title: 'Хиты' }, hp, '/', mx), ac, dm, del, h('div', { class: 'ibot' }, cond, sel));
        return r;
      }
      function draw() {
        lst.textContent = '';
        if (!s.list.length) lst.append(h('p', { class: 'dmempty' }, 'Бой пуст. Впишите имя монстра из бестиария (подставится КД, хиты, бросок инициативы) или любое имя, либо нажмите «В инициативу» на карточке монстра.'));
        s.list.forEach((x, i) => lst.append(row(x, i)));
        ctx.title('Инициатива' + (s.list.length ? ' · раунд ' + s.round : ''));
      }
      const head = h('div', { class: 'irow ihead' }, h('span', { title: 'Результат броска инициативы: кто ходит раньше' }, 'Иниц.'), h('span', {}, 'Имя'),
        h('span', { title: 'Хиты сейчас / максимум' }, 'Хиты тек./макс.'), h('span', { title: 'Класс доспеха' }, 'КД'),
        h('span', { title: 'Введите число и Enter: положительное — урон, отрицательное — лечение' }, 'Урон / лечение'), h('span'));
      el.append(toolbar, head, lst);
      draw();
      ctx.el._refresh = draw;
    }
  });

  /* ---------- Запись из базы ---------- */
  DM.registerType('entity', {
    name: 'Запись', desc: 'Карточка из базы: монстр, заклинание, правило…', w: 5, h: 12,
    init: () => ({ e: 24, sec: 'bestiary', slug: '', hist: [] }),
    render(ctx) {
      const s = ctx.p.s, db = DB();
      const secSel = h('select', { class: 'esec', title: 'Раздел' });
      const edSel = h('select', { class: 'eed', title: 'Редакция' }, h('option', { value: '24' }, '2024'), h('option', { value: '14' }, '2014'));
      const q = inp({ placeholder: 'Поиск по названию…', class: 'eq' });
      const res = h('div', { class: 'eres' });
      const card = h('div', { class: 'ecard' });
      const back = btn('←', () => { const p = s.hist.pop(); if (p) go(p.e, p.sec, p.slug, true); }, 'eback', 'Назад');
      const fill = () => {
        secSel.textContent = '';
        db.ORDERS[s.e].forEach(k => secSel.append(h('option', { value: k }, db.SXS[s.e][k].t)));
        secSel.value = s.sec; edSel.value = String(s.e);
      };
      async function go(e, sec, slug, isBack) {
        if (!db.SXS[e] || !db.SXS[e][sec]) { sec = db.ORDERS[e][0]; slug = ''; }
        if (!isBack && s.slug && (s.e !== e || s.sec !== sec || s.slug !== slug)) { s.hist.push({ e: s.e, sec: s.sec, slug: s.slug }); if (s.hist.length > 30) s.hist.shift(); }
        s.e = e; s.sec = sec; s.slug = slug || ''; ctx.save(); fill(); DM.noteEntity(ctx.p.id);
        back.disabled = !s.hist.length;
        card.textContent = '';
        res.textContent = '';
        if (!s.slug) { card.append(h('p', { class: 'dmempty' }, 'Найдите запись выше или нажмите на ссылку в другой панели.')); ctx.title('Запись'); return; }
        const data = await db.load(sec, e);
        const m = data.find(x => x.slug === s.slug);
        if (s.slug !== slug && slug) return;
        if (!m) { card.append(h('p', { class: 'dmempty' }, 'Запись не найдена: ' + s.slug)); return; }
        const box = h('div'); box.innerHTML = db.SXS[e][sec].card(m);
        card.textContent = ''; card.append(box); card.scrollTop = 0;
        ctx.title(m.name_ru);
        db.decorate(card, e, { k: db.SELFK[sec], slug: m.slug });
        if (db.placePic) db.placePic(card, e, sec, m);
        card.querySelectorAll('.stat').forEach(x => x.classList.add('ins'));
      }
      async function search() {
        const v = db.norm(q.value.trim()); res.textContent = '';
        if (!v) return;
        const data = await db.load(s.sec, s.e);
        const hits = data.filter(m => db.norm(m.name_ru + ' ' + (m.name_en || '')).includes(v)).slice(0, 30);
        if (!hits.length) res.append(h('div', { class: 'none' }, 'Ничего не найдено'));
        hits.forEach(m => res.append(h('a', { href: db.hh(s.e, s.sec, m.slug), onclick: ev => { ev.preventDefault(); ev.stopPropagation(); q.value = ''; go(s.e, s.sec, m.slug); } }, m.name_ru, h('small', {}, m.name_en || ''))));
      }
      q.addEventListener('input', search);
      q.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = res.querySelector('a'); if (a) a.click(); } if (e.key === 'Escape') { q.value = ''; res.textContent = ''; } });
      edSel.addEventListener('change', () => { s.e = +edSel.value; s.sec = db.ORDERS[s.e].includes(s.sec) ? s.sec : db.ORDERS[s.e][0]; s.slug = ''; ctx.save(); fill(); go(s.e, s.sec, ''); search(); });
      secSel.addEventListener('change', () => { s.sec = secSel.value; s.slug = ''; ctx.save(); go(s.e, s.sec, ''); search(); });
      ctx.addBtn('↗', 'Открыть на странице', () => { if (s.slug) location.hash = db.hh(s.e, s.sec, s.slug); });
      ctx.body.append(h('div', { class: 'etools' }, back, edSel, secSel, q), res, card);
      ctx.el._nav = (e, sec, slug) => go(e, sec, slug);
      fill();
      go(s.e, s.sec, s.slug, true);
    }
  });

  /* ---------- Справка: состояния и правила ---------- */
  DM.registerType('conds', {
    name: 'Состояния', desc: 'Состояния и правила: список со ссылками на статьи', w: 3, h: 11,
    init: () => ({ e: 0, g: '' }),
    render(ctx) {
      const s = ctx.p.s, db = DB();
      const edSel = h('select', { title: 'Редакция' }, h('option', { value: '24' }, '2024'), h('option', { value: '14' }, '2014'));
      const grp = h('select', { title: 'Группа' });
      const q = inp({ placeholder: 'Поиск…' });
      const list = h('div', { class: 'clist' });
      let data = [];
      const gOf = m => m.group || m.category_ru || 'Прочее';
      async function load() {
        const e = s.e || db.ed, sec = e === 14 ? 'articles' : 'glossary';
        edSel.value = String(e);
        data = await db.load(sec, e);
        const gs = [...new Set(data.map(gOf))];
        grp.textContent = ''; grp.append(h('option', { value: '' }, 'Все группы'));
        gs.forEach(g => grp.append(h('option', { value: g }, g)));
        if (!gs.includes(s.g)) s.g = gs.includes('Состояния') ? 'Состояния' : '';
        grp.value = s.g; draw();
      }
      function draw() {
        const e = s.e || db.ed, sec = e === 14 ? 'articles' : 'glossary', v = db.norm(q.value.trim());
        list.textContent = '';
        data.filter(m => (!s.g || gOf(m) === s.g) && (!v || db.norm(m.name_ru + ' ' + (m.name_en || '')).includes(v)))
          .forEach(m => list.append(h('a', { href: db.hh(e, sec, m.slug) }, m.name_ru, h('small', {}, m.name_en || ''))));
        if (!list.children.length) list.append(h('div', { class: 'none' }, 'Ничего не найдено'));
      }
      edSel.addEventListener('change', () => { s.e = +edSel.value; s.g = ''; ctx.save(); load(); });
      grp.addEventListener('change', () => { s.g = grp.value; ctx.save(); draw(); });
      q.addEventListener('input', draw);
      ctx.body.append(h('div', { class: 'etools' }, edSel, grp), h('div', { class: 'etools' }, q), list);
      load();
    }
  });

  /* ---------- Заметки ---------- */
  DM.registerType('notes', {
    name: 'Заметки', desc: 'Свободный текст, сохраняется сам', w: 3, h: 5,
    init: () => ({ text: '' }),
    render(ctx) {
      const t = h('textarea', { class: 'notes', placeholder: 'Заметки по сцене, имена, секреты…', spellcheck: 'false' });
      t.value = ctx.p.s.text || '';
      t.addEventListener('input', () => { ctx.p.s.text = t.value; ctx.save(); });
      ctx.body.append(t);
    }
  });

  /* ---------- Счётчики ---------- */
  DM.registerType('counters', {
    name: 'Счётчики', desc: 'Ячейки заклинаний, ресурсы, отсчёты', w: 3, h: 6,
    init: () => ({ items: [{ n: 'Счётчик', v: 0 }] }),
    render(ctx) {
      const s = ctx.p.s, box = h('div', { class: 'cnts' });
      const draw = () => {
        box.textContent = '';
        s.items.forEach((c, i) => {
          const v = h('b', { class: 'cv' }, String(c.v));
          const set = d => { c.v += d; v.textContent = c.v; ctx.save(); };
          box.append(h('div', { class: 'cnt' },
            h('span', { class: 'cn', contenteditable: 'plaintext-only', spellcheck: 'false', onblur: e => { c.n = e.target.textContent.trim() || 'Счётчик'; ctx.save(); } }, c.n),
            btn('−', () => set(-1), 'cb2'), v, btn('+', () => set(1), 'cb2'),
            btn('×', () => { s.items.splice(i, 1); ctx.save(); draw(); }, 'xx', 'Убрать')));
        });
      };
      draw();
      ctx.body.append(box, btn('+ Счётчик', () => { s.items.push({ n: 'Счётчик', v: 0 }); ctx.save(); draw(); }, 'pri'));
    }
  });

  /* ---------- Переводчик единиц ---------- */
  DM.registerType('conv', {
    name: 'Единицы и монеты', desc: 'Футы↔метры, фунты↔кг, пересчёт монет', w: 3, h: 7,
    init: () => ({ v: '' }),
    render(ctx) {
      const f = (n, d) => (Math.round(n * (d || 10)) / (d || 10)).toString().replace('.', ',');
      const out = h('div', { class: 'cout' });
      const a = inp({ type: 'number', placeholder: 'Число', value: ctx.p.s.v, class: 'cin' });
      const cur = h('select', {}, [['мм', 'Медные (ММ)', 0.01], ['см', 'Серебряные (СМ)', 0.1], ['эм', 'Электрум (ЭМ)', 0.5], ['зм', 'Золотые (ЗМ)', 1], ['пм', 'Платиновые (ПМ)', 10]].map(([v, t]) => h('option', { value: v, selected: v === 'зм' }, t)));
      const W = { мм: 0.01, см: 0.1, эм: 0.5, зм: 1, пм: 10 };
      const draw = () => {
        const n = parseFloat(String(a.value).replace(',', '.')); ctx.p.s.v = a.value; ctx.save();
        out.textContent = '';
        if (isNaN(n)) return out.append(h('p', { class: 'dmempty' }, 'Введите число — увидите всё сразу.'));
        const gp = n * W[cur.value];
        const row = (l, v) => out.append(h('div', { class: 'cr' }, h('span', {}, l), h('b', {}, v)));
        row('Футы → метры', f(n * 0.3) + ' м'); row('Метры → футы', f(n / 0.3) + ' фт');
        row('Мили → км', f(n * 1.5) + ' км'); row('Км → мили', f(n / 1.5) + ' миль');
        row('Фунты → кг', f(n * 0.5) + ' кг'); row('Кг → фунты', f(n * 2) + ' фнт');
        out.append(h('div', { class: 'csep' }, 'Монеты (число = выбранный номинал)'));
        row('в ПМ', f(gp / 10, 100)); row('в ЗМ', f(gp, 100)); row('в ЭМ', f(gp * 2, 100)); row('в СМ', f(gp * 10, 100)); row('в ММ', f(gp * 100, 100));
      };
      a.addEventListener('input', draw); cur.addEventListener('change', draw);
      ctx.body.append(h('div', { class: 'etools' }, a, cur), out); draw();
    }
  });

  /* ---------- Игровое время ---------- */
  DM.registerType('time', {
    name: 'Игровое время', desc: 'День и время суток, отдыхи', w: 3, h: 5,
    init: () => ({ d: 1, m: 480 }),
    render(ctx) {
      const s = ctx.p.s, big = h('div', { class: 'tbig' }), sub = h('div', { class: 'tsub' });
      const part = m => m < 360 ? 'ночь' : m < 720 ? 'утро' : m < 1080 ? 'день' : 'вечер';
      const draw = () => {
        const hh = Math.floor(s.m / 60), mm = s.m % 60;
        big.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
        sub.textContent = 'День ' + s.d + ' · ' + part(s.m);
      };
      const add = m => { s.m += m; while (s.m >= 1440) { s.m -= 1440; s.d++; } while (s.m < 0) { s.m += 1440; s.d = Math.max(1, s.d - 1); } ctx.save(); draw(); };
      draw();
      ctx.body.append(big, sub, h('div', { class: 'tbtn' },
        btn('+10 мин', () => add(10)), btn('+1 ч', () => add(60)), btn('Корот. отдых +1 ч', () => add(60)), btn('Долгий отдых +8 ч', () => add(480)),
        btn('−10 мин', () => add(-10)), btn('Новый день', () => { s.d++; s.m = 480; ctx.save(); draw(); })));
    }
  });

  /* ---------- Картинка по ссылке ---------- */
  DM.registerType('image', {
    name: 'Картинка', desc: 'Карта или иллюстрация по ссылке (покажите игрокам)', w: 4, h: 7,
    init: () => ({ url: '' }),
    render(ctx) {
      const s = ctx.p.s, box = h('div', { class: 'imgbox' });
      const draw = () => {
        box.textContent = '';
        if (!s.url) return box.append(h('p', { class: 'dmempty' }, 'Вставьте ссылку на изображение (https://…).'));
        const im = new Image(); im.alt = ''; im.src = s.url;
        im.onerror = () => { box.textContent = 'Не удалось загрузить картинку по этой ссылке.'; };
        box.append(im);
      };
      const u = inp({ placeholder: 'https://… ссылка на картинку', value: s.url });
      u.addEventListener('change', () => { const v = u.value.trim(); s.url = /^https?:\/\//i.test(v) || !v ? v : ''; if (v && !s.url) DM.toast('Нужна ссылка, начинающаяся с https://'); ctx.save(); draw(); });
      ctx.body.append(h('div', { class: 'etools' }, u), box); draw();
    }
  });
})(window);
