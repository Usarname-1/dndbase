/* Общий код сайта: разметка карточек и списков, фильтры, адреса страниц, тексты для поисковиков.
   Здесь нет ничего, что трогает страницу (document, location, fetch): файл читают и браузер, и tools/build_pages.js,
   который по нему собирает готовые страницы для поисковиков. Всё, что работает со страницей, лежит в app.js. */
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmt=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/\n/g,'<br>');
const sg=n=>(n<0?'\u2212':'+')+Math.abs(n),pr=(l,v)=>v?`<p class="pr"><b>${l}</b> ${fmt(v)}</p>`:'';
const T=(rows,h)=>`<div class="sc"><table class="tb">${rows.map((r,i)=>`<tr${h&&!i?' class="h"':''}>${r.map(c=>`<td>${fmt(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
const B=bl=>(bl||[]).map(b=>b.type=='heading'||b.type=='subheader'?`<h4>${fmt(b.text)}</h4>`:b.type=='list'?`<ul>${b.items.map((i,k)=>{const r=b.refs&&b.refs[k];return r?`<li><a class="ref" href="${hh(ed,...r.split('/'))}">${fmt(i)}</a></li>`:`<li>${fmt(i)}</li>`}).join('')}</ul>`:b.type=='table'?T(b.rows,b.header):b.type=='quote'?`<blockquote>${fmt(b.text)}</blockquote>`:b.type=='embed'?(b.name?`<p class="en">См. также: ${esc(b.name)}</p>`:''):`<p>${fmt(b.text)}</p>`).join('');
const head=(m,sub)=>`<h2>${esc(m.name_ru)}</h2>${m.name_en?`<p class="en">${esc(m.name_en)}</p>`:''}${sub?`<p class="sub">${esc(sub)}</p>`:''}<div class="rule"></div>`;
const foot=m=>`</article><p class="meta">${m.sources?.length?'Источники: '+esc(m.sources.join(', '))+'. ':''}<a href="${esc(m.url)}" target="_blank" rel="noopener"></a><span id="xref"></span></p>`;
const props=m=>(m.props||[]).map(p=>pr(esc(p.label),p.value)).join('');
const num=(a,b)=>parseFloat(a)-parseFloat(b),CR=['0','1/8','1/4','1/2',...Array.from({length:30},(_,i)=>''+(i+1))];
const lvl=m=>m.level?m.level+' уровень':'Заговор',rar=m=>(m.rarity||'—');
const ABIL=[['str','СИЛ'],['dex','ЛОВ'],['con','ТЕЛ'],['int','ИНТ'],['wis','МДР'],['cha','ХАР']];
const at=(k,m)=>`<table><tr><th></th><th></th><th>мод</th><th>спас</th></tr>${k.map(([a,r])=>{const x=m.abilities[a];return`<tr><td>${r}</td><td>${x.score}</td><td>${sg(x.mod)}</td><td>${sg(x.save)}</td></tr>`}).join('')}</table>`;
const spRef=u=>{const p=String(u||'').replace(/\/$/,'').split('/'),k=p[3]=='spells'?'s':p[3]=='glossary'?'g':'';return k?k+'/'+p.pop().replace(/^\d+-/,''):''};
const ent=e=>`<p class="it${e.indent||e.n?' ind':''}">${e.n?`<b>${e.n}.</b> `:''}${e.name?`<span class="nm">${esc(e.name)}.</span> `:''}${fmt(e.text)}${(e.rows||[]).map(r=>`<br><i>${esc(r.label)}:</i> `+r.spells.map(s=>`<a href="${esc(s.url)}" data-r="${esc(spRef(s.url))}" target="_blank" rel="noopener"><i>${esc(s.name)}</i></a>`).join(', ')).join('')}</p>`;
const loreBl=l=>(Array.isArray(l)?l:(l&&l.blocks)||[]).map(b=>b.type=='table'&&b.header===undefined?{...b,header:true}:b),
 lore=l=>l&&loreBl(l).length?`<details open><summary>${esc((!Array.isArray(l)&&l.title)||'Описание')}</summary>${!Array.isArray(l)&&l.subtitle?`<p class="sub">${esc(l.subtitle)}</p>`:''}${B(loreBl(l))}</details>`:'',
 loreView=l=>l&&loreBl(l).length?`<div class="rule"></div><div class="lore"><h3>${esc((!Array.isArray(l)&&l.title)||'Описание')}</h3>${!Array.isArray(l)&&l.subtitle?`<p class="sub">${esc(l.subtitle)}</p>`:''}${B(loreBl(l))}</div>`:'';
const S={
bestiary:{t:'Бестиарий',sub:m=>'БО '+m.cr,
 card:m=>{const sl=(m.swarm?`${m.size_text} рой ${m.swarm_of}`:`${m.size_text} ${m.type}`)+(m.tags.length?` (${m.tags.join(', ')})`:'')+`, ${m.alignment_text}`+(m.named_npc?', именной НИП':'');
 return `<article class="stat">${head(m,sl)}<p class="pr"><b>Класс Защиты</b> ${m.ac} &nbsp; <b>Инициатива</b> ${sg(m.initiative.mod)} (${m.initiative.score})</p><p class="pr"><b>Хиты</b> ${m.hp.avg}${m.hp.formula?` (${esc(m.hp.formula)})`:''}</p>${pr('Скорость',m.speed_text)}<div class="rule"></div><div class="abil">${at(ABIL.slice(0,3),m)}${at(ABIL.slice(3),m)}</div><div class="rule"></div>`
 +pr('Навыки',(m.skills||[]).map(s=>`${s.name} ${sg(s.bonus)}`).join(', '))+pr('Уязвимость к урону',m.vulnerabilities)+pr('Сопротивление урону',m.resistances)+pr('Иммунитеты',m.immunities)+pr('Чувства',m.senses)+pr('Языки',m.languages)+`<p class="pr"><b>Опасность</b> ${esc(m.cr)} (${esc(m.xp_text)})</p>`
 +m.sections.map(s=>`<h3>${esc(s.title||'')}</h3>${s.intro?`<p class="intro">${fmt(s.intro)}</p>`:''}${s.items.map(ent).join('')}`).join('')+`<div class="rule"></div>`+pr('Бонус мастерства',sg(m.pb))+pr('Среда обитания',m.habitat)+pr('Сокровища',m.treasure)+loreView(m.lore)+foot(m)}},
spells:{t:'Заклинания',sub:m=>m.level?m.level+' ур.':'загов.',
 card:m=>`<article class="stat">${head(m,m.line)}${pr('Время сотворения',m.cast_time)}${pr('Дистанция',m.range)}${pr('Компоненты',m.components)}${pr('Длительность',m.duration)}${pr('Классы',(m.classes||[]).map(c=>c.name).join(', '))}${pr('Подклассы',m.subclasses)}<div class="rule"></div>${B(m.blocks)}${m.higher?`<p>${fmt(m.higher)}</p>`:''}${m.circle?`<p>${fmt(m.circle)}</p>`:''}${foot(m)}`},
items:{t:'Предметы',sub:rar,
 card:m=>`<article class="stat">${head(m,m.line)}${pr('Рекомендованная стоимость',m.price)}${props(m)}<div class="rule"></div>${B(m.blocks)}${foot(m)}`},
equipment:{t:'Снаряжение',sub:m=>m.cost||'',
 card:m=>`<article class="stat">${head(m,m.line)}${props(m)}${m.blocks?.length?`<div class="rule"></div>${B(m.blocks)}`:''}${foot(m)}`},
feats:{t:'Черты',sub:m=>(m.category||'').replace(' черта','').replace('Черта ',''),
 card:m=>`<article class="stat">${head(m,m.line)}${B(m.blocks)}${foot(m)}`},
backgrounds:{t:'Предыстории',sub:()=>'',
 card:m=>{const f=m.feat,fs=f&&f.url?f.url.replace(/\/$/,'').split('/').pop().replace(/^\d+-/,''):null;
 return `<article class="stat">${head(m,'')}${pr('Характеристики',(m.abilities||[]).join(', '))}${f?`<p class="pr"><b>Черта</b> ${fs?`<a href="#feats/${esc(fs)}">${esc(f.name)}</a>`:esc(f.name)}</p>`:''}${pr('Навыки',(m.skills||[]).join(', '))}${pr('Инструменты',m.tools)}${pr('Снаряжение',m.equipment)}<div class="rule"></div>${B(m.blocks)}${foot(m)}`}},
species:{t:'Виды',sub:()=>'',card:m=>`<article class="stat">${head(m,'')}${props(m)}<div class="rule"></div>${B(m.blocks)}${foot(m)}`},
class:{t:'Классы',sub:()=>'',card:m=>{const tb=m.table;
 return `<article class="stat">${head(m,'')}${(m.core_traits||[]).map(c=>pr(esc(c.label),c.value)).join('')}${tb?`<div class="sc"><table class="tb"><tr>${tb.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>${tb.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`:''}`
 +(m.becoming?m.becoming.parts.map(p=>`<details><summary>${esc(p.title)}</summary>${B(p.blocks)}</details>`).join(''):'')
 +(m.features||[]).map(f=>`<h3>Уровень ${f.level}: ${esc(f.name)}</h3>${B(f.blocks)}`).join('')+`<h3>Подклассы</h3>`
 +(m.subclasses||[]).map(s=>`<details><summary>${esc(s.name)}</summary>${B(s.description)}${s.features.map(f=>`<h4>Уровень ${f.level}: ${esc(f.name)}</h4>${B(f.blocks)}`).join('')}</details>`).join('')+loreView(m.lore)+foot(m)}},
glossary:{t:'Глоссарий',sub:()=>'',card:m=>`<article class="stat">${head(m,m.group||'')}${B(m.blocks)}${foot(m)}`}
};
/* ---- фильтры ---- */
/* ===== фильтры: [название, значения(m)=>[...], сортировка?, multi?] ===== */
const ru=(a,b)=>String(a).localeCompare(b,'ru'),
 ord=l=>(a,b)=>{const x=l.indexOf(a),y=l.indexOf(b);return(x<0?999:x)-(y<0?999:y)||ru(a,b)},
 yn=v=>[v?'Да':'Нет'],
 tx=m=>(m.blocks||[]).map(b=>b.text||(b.items||[]).join(' ')||(b.rows||[]).flat().join(' ')).join(' '),
 rx=(m,list)=>{const t=tx(m);return list.filter(([,r])=>r.test(t)).map(([n])=>n)},
 SRC=m=>[...new Set((m.sources||[]).map(s=>/^Также/.test(s)?'SRD 5.2.1':s))],
 bucket=(n,b)=>{if(n==null||isNaN(n))return null;for(const[l,max]of b)if(n<=max)return l;return b.at(-1)[0]},
 GP=[['до 1 зм',1],['1–10 зм',10],['10–100 зм',100],['более 100 зм',1/0]],
 GPL=GP.map(x=>x[0]),
 PRICE=n=>n==null?'Без цены':bucket(n,[['до 100 зм',100],['100–1 000 зм',1000],['1 000–10 000 зм',1e4],['более 10 000 зм',1/0]]),
 PRICEL=['до 100 зм','100–1 000 зм','1 000–10 000 зм','более 10 000 зм','Без цены'],
 SIZES=['Крошечный','Маленький','Средний','Большой','Огромный','Громадный'],
 DMGT=['Дробящий','Колющий','Рубящий','Кислота','Огонь','Холод','Электричество','Звук','Яд','Излучение','Некротический','Психический','Силовое поле'],
 CONDS=['Бессознательный','Истощение','Испуганный','Окаменевший','Опрокинутый','Опутанный','Оглохший','Ослеплённый','Отравленный','Очарованный','Парализованный','Схваченный','Недееспособный','Ошеломлённый'],
 items_=s=>(s||'').split(/[;,]/).map(t=>t.replace(/\(.*?\)/g,'').trim().replace(/^Силовой$/,'Силовое поле')).filter(Boolean),
 dmg=s=>items_(s).filter(t=>DMGT.includes(t)),cnd=s=>items_(s).filter(t=>CONDS.includes(t)),
 ALIGN={LG:'Принципиальный добрый',NG:'Нейтральный добрый',CG:'Хаотичный добрый',LN:'Принципиальный нейтральный',N:'Нейтральный',CN:'Хаотичный нейтральный',LE:'Принципиальный злой',NE:'Нейтральный злой',CE:'Хаотичный злой',U:'Без мировоззрения'},
 ABIL_RU=['Сила','Ловкость','Телосложение','Интеллект','Мудрость','Харизма'],
 abil=s=>ABIL_RU.filter(a=>new RegExp(a.slice(0,-1)).test(s||'')),
 /* заклинания */
 castT=m=>{const b=(m.cast_time||'').split(/,| или /)[0].replace(/\s*\(.*\)/,'').trim();return /^Бонус/i.test(b)?'Бонусное действие':/^Реакц/i.test(b)?'Реакция':b},
 SEC={'раунд':6,'мин':60,'час':3600,'ч':3600,'дн':86400,'день':86400},
 durT=m=>{const s=m.duration||'';if(/мгнов/i.test(s))return'Мгновенная';if(/пока не рассеяно/i.test(s))return'Пока не рассеяно';
  const r=s.match(/(\d+)\s*(раунд|минут|час|дн|день)/i);if(!r)return'Особая';const u={раунд:'раунд.',минут:'мин',час:'ч',дн:'дн',день:'дн'}[r[2].toLowerCase()];return r[1]+' '+u},
 durSec=l=>{const r=l.match(/^(\d+) (раунд\.|мин|ч|дн)/);return r?r[1]*{'раунд.':6,'мин':60,'ч':3600,'дн':86400}[r[2]]:l=='Мгновенная'?0:1e12},
 rangeT=m=>{const s=(m.range||'').split(' (')[0].trim(),r=s.match(/^(\d+)\s*(фут|миль)/i);return r?(/миль/i.test(r[2])?r[1]+' '+(r[1]==1?'миля':'миль'):r[1]+' фт'):s},
 rangeSec=l=>{const r=l.match(/^(\d+) (фт|миля|миль)/);return l=='На себя'?-2:l=='Касание'?-1:r?r[1]*(r[2]=='фт'?1:5280):1e9},
 SDMG=[['Излучение',/урон[а-яё]*\s+Излучением|Излучения\s+урон/i],['Огонь',/урон[а-яё]*\s+Огнём/i],['Звук',/урон[а-яё]*\s+Звуком/i],['Холод',/урон[а-яё]*\s+Холодом/i],['Электричество',/урон[а-яё]*\s+Электричеством/i],['Кислота',/урон[а-яё]*\s+Кислотой/i],['Яд',/урон[а-яё]*\s+Ядом/i],
  ['Некротический',/Некротическ[а-яё]*\s+урон|урон[а-яё]*\s+Некротическ/i],['Психический',/Психическ[а-яё]*\s+урон|урон[а-яё]*\s+Психическ/i],['Силовое поле',/Силов[а-яё]*\s+урон|урон[а-яё]*\s+Силов/i],['Дробящий',/Дробящ[а-яё]*\s+урон/i],['Колющий',/Колющ[а-яё]*\s+урон/i],['Рубящий',/Рубящ[а-яё]*\s+урон/i]],
 SSAVE=ABIL_RU.map(a=>[a,new RegExp('спасбросок\\s+'+({Сила:'Силы',Ловкость:'Ловкости',Телосложение:'Телосложения',Интеллект:'Интеллекта',Мудрость:'Мудрости',Харизма:'Харизмы'}[a]),'i')]),
 /* предметы */
 RAR=['Обычный','Необычный','Редкий','Очень редкий','Легендарный','Артефакт','Редкость варьируется'],
 rarT=m=>{const r=(m.rarity||'').toLowerCase();return !r?'—':/очень редк/.test(r)?'Очень редкий':/необычн/.test(r)?'Необычный':/обычн/.test(r)?'Обычный':/редкость/.test(r)?'Редкость варьируется':/редк/.test(r)?'Редкий':/легенд/.test(r)?'Легендарный':/артефакт/.test(r)?'Артефакт':r},
 /* снаряжение */
 pv=(m,l)=>((m.props||[]).find(p=>p.label==l)||{}).value||'',
 eqCat=m=>{const l=m.line||'';return !l?'Прочее':/оружие/.test(l)?'Оружие':/доспех|Щит/.test(l)?'Доспех и щиты':/фокусировка/.test(l)?'Заклинательная фокусировка':/Ремесленный/.test(l)?'Ремесленный инструмент':/Инструмент/.test(l)?'Инструмент':/Набор/.test(l)?'Набор снаряжения':/Боеприпас/.test(l)?'Боеприпасы':'Предмет снаряжения'},
 /* черты */
 fprereq=m=>{const p=m.prerequisite||'';return p?rx({blocks:[{text:p}]},[['Эберрон',/Эберрон/],['Равенлофт',/Равенлофт/],['Заклинатель',/Сотворение заклинаний|Магия договора|Посвящённый в магию|Искра/],['Боевой стиль',/Боевой стиль/],['Другая черта',/черт[аы]\s/],['Доспехи / оружие',/тренированность|владение/i]]):['Нет требований']},
 /* виды */
 spText=m=>tx(m);

const FILTERS={
bestiary:[
 ['Опасность',m=>[m.cr],(a,b)=>CR.indexOf(a)-CR.indexOf(b)],
 ['Тип',m=>[m.type].filter(Boolean).flatMap(t=>t.split(' или '))],
 ['Теги',m=>m.tags||[],null,1],
 ['Размер',m=>m.sizes,ord(SIZES),1],
 ['Мировоззрение',m=>[ALIGN[m.alignment]||m.alignment_text],ord(Object.values(ALIGN))],
 ['Среда обитания',m=>m.habitat?m.habitat.split(/,\s*/):[],null,1],
 ['Скорость',m=>Object.keys(m.speed||{}).map(k=>({fly:'Полёт',swim:'Плавание',climb:'Лазание',burrow:'Копание'})[k]).filter(Boolean),null,1],
 ['Чувства',m=>rx({blocks:[{text:m.senses||''}]},[['Тёмное зрение',/Тёмное зрение/],['Слепое зрение',/Слепое зрение/],['Истинное зрение',/Истинное зрение/],['Чувство вибрации',/Чувство вибрации/]]),null,1],
 ['Телепатия',m=>/Телепат/i.test(m.languages||'')?['Есть']:['Нет']],
 ['Класс Защиты',m=>[bucket(m.ac,[['до 11',11],['12–14',14],['15–17',17],['18 и выше',1/0]])],ord(['до 11','12–14','15–17','18 и выше'])],
 ['Хиты',m=>[bucket(m.hp.avg,[['до 20',20],['21–50',50],['51–100',100],['101–200',200],['более 200',1/0]])],ord(['до 20','21–50','51–100','101–200','более 200'])],
 ['Иммунитет к урону',m=>dmg(m.immunities),ord(DMGT),1],
 ['Сопротивление урону',m=>dmg(m.resistances),ord(DMGT),1],
 ['Уязвимость к урону',m=>dmg(m.vulnerabilities),ord(DMGT),1],
 ['Иммунитет к состояниям',m=>cnd(m.immunities),null,1],
 ['Особенности',m=>[...(m.sections||[]).map(s=>({legendary_actions:'Легендарные действия',reactions:'Реакции',bonus_actions:'Бонусные действия'})[s.key]).filter(Boolean),...(m.swarm?['Рой']:[]),...(m.named_npc?['Именной НИП']:[])],null,1],
 ['Источник',SRC,null,1]],
spells:[
 ['Уровень',m=>[lvl(m)],(a,b)=>num(a=='Заговор'?0:a,b=='Заговор'?0:b)],
 ['Школа',m=>[m.school]],
 ['Класс',m=>(m.classes||[]).map(c=>c.name),null,1],
 ['Время сотворения',m=>[castT(m)],ord(['Действие','Бонусное действие','Реакция','1 минута','10 минут','1 час'])],
 ['Ритуал',m=>yn(m.ritual)],
 ['Концентрация',m=>yn(m.concentration)],
 ['Длительность',m=>[durT(m)],(a,b)=>durSec(a)-durSec(b)],
 ['Дистанция',m=>[rangeT(m)],(a,b)=>rangeSec(a)-rangeSec(b)],
 ['Компоненты',m=>m.comp||[],null,1],
 ['Материал',m=>m.material?[...(/\d+\s*зм/i.test(m.material)?['Указана стоимость']:[]),...(/поглощ|расходу|уничтож/i.test(m.material)?['Расходуется']:[])]:[],null,1],
 ['Тип урона',m=>rx(m,SDMG),ord(DMGT),1],
 ['Спасбросок',m=>rx(m,SSAVE),ord(ABIL_RU),1],
 ['Атака заклинанием',m=>/(рукопашн|дальнобойн)[а-яё]*\s+атак[а-яё]*\s+заклинанием|бросок атаки заклинанием/i.test(tx(m))?['Да']:['Нет']],
 ['Источник',SRC,null,1]],
items:[
 ['Редкость',m=>[rarT(m)],ord(RAR)],
 ['Тип',m=>[(m.type||'—').split(' (')[0]]],
 ['Настройка',m=>[m.attunement?'Требуется':'Не требуется']],
 ['Цена',m=>[PRICE(m.price_gp)],ord(PRICEL)],
 ['Источник',SRC,null,1]],
equipment:[
 ['Категория',m=>[eqCat(m)]],
 ['Класс',m=>[(m.line||'').match(/^(Простое|Воинское|Лёгкий|Средний|Тяжёлый)/)?.[1]].filter(Boolean),ord(['Простое','Воинское','Лёгкий','Средний','Тяжёлый'])],
 ['Дистанция оружия',m=>[(m.line||'').match(/(Рукопашное|Дальнобойное)/)?.[1]].filter(Boolean)],
 ['Тип урона',m=>pv(m,'Урон')?[pv(m,'Урон').split(', ').pop()]:[],ord(DMGT)],
 ['Кость урона',m=>pv(m,'Урон')?[pv(m,'Урон').split(', ')[0]]:[]],
 ['Фокусировка для',m=>/фокусировка/.test(m.line||'')?((m.line.match(/\((.*)\)/)||[])[1]||'').split(/,\s*/).filter(Boolean):[],null,1],
 ['Стоимость',m=>[m.cost_gp==null?'Без цены':bucket(m.cost_gp,GP)],ord([...GPL,'Без цены'])],
 ['Источник',SRC,null,1]],
feats:[
 ['Категория',m=>[m.category]],
 ['Требования',fprereq,null,1],
 ['Мин. уровень',m=>[(m.prerequisite||'').match(/(\d+)\s*уровень/)?.[1]].filter(Boolean).map(x=>x+' уровень'),(a,b)=>num(a,b)],
 ['Мин. характеристика',m=>abil(((m.prerequisite||'').match(/[^,]*13\+/g)||[]).join(' ')),ord(ABIL_RU),1],
 ['Источник',SRC,null,1]],
backgrounds:[
 ['Характеристика',m=>m.abilities||[],null,1],
 ['Навык',m=>m.skills||[],null,1],
 ['Черта',m=>m.feat?[m.feat.name]:[]],
 ['Инструмент',m=>m.tools?m.tools.split(/,\s*/).map(t=>t.replace(/^Выберите один (вид|тип) Ремесленных инструментов$/,'Ремесленные инструменты')):[],null,1],
 ['Источник',SRC,null,1]],
species:[
 ['Тип существа',m=>[pv(m,'Тип существа')].filter(Boolean)],
 ['Размер',m=>SIZES.filter(s=>pv(m,'Размер').includes(s)),ord(SIZES),1],
 ['Скорость',m=>[(pv(m,'Скорость').match(/\d+/)||[])[0]].filter(Boolean).map(x=>x+' футов'),(a,b)=>num(a,b)],
 ['Особенности',m=>rx(m,[['Тёмное зрение',/Тёмное зрение/i],['Полёт',/полёт|летать/i],['Сопротивление урону',/Сопротивление/],['Заклинания',/заклинани|заговор/i],['Плавание',/плавани/i],['Лазание',/лазани/i]]),null,1],
 ['Источник',SRC,null,1]],
class:[
 ['Основная характеристика',m=>abil(cv(m,'Основная характеристика')),ord(ABIL_RU),1],
 ['Кость хитов',m=>[(cv(m,'Кость хитов').match(/к(\d+)/i)||[])[1]].filter(Boolean).map(x=>'К'+x),ord(['К6','К8','К10','К12'])],
 ['Заклинательство',m=>[(m.table?.columns||[]).some(c=>/Заговор|Подготовленные заклинания|Ячейки/.test(c))?'Заклинатель':'Не заклинатель']],
 ['Спасброски',m=>abil(cv(m,'Владение спасбросками')),ord(ABIL_RU),1],
 ['Доспехи',m=>[['Лёгкие',/Лёгк/],['Средние',/Средн/],['Тяжёлые',/Тяжёл/],['Щиты',/Щит/]].filter(([,r])=>r.test(cv(m,'Тренированность с доспехами'))).map(x=>x[0]),null,1],
 ['Оружие',m=>[['Простое',/Простое/],['Воинское',/Воинское/]].filter(([,r])=>r.test(cv(m,'Владение оружием'))).map(x=>x[0]),null,1],
 ['Источник',SRC,null,1]],
glossary:[['Группа',m=>[m.group||'—']]]
};
const cv=(m,l)=>((m.core_traits||[]).find(c=>c.label==l)||{}).value||'';

for(const k in S)S[k].F=FILTERS[k]||[];
const cut=(s,n)=>{s=String(s||'').replace(/\*+/g,'');return s.length>n?s.slice(0,n).replace(/\s\S*$/,'')+'…':s},
 L=(l,v)=>v&&v.length?l+' '+(Array.isArray(v)?v.join(', '):v):'';
const SUM={
bestiary:m=>[[m.swarm?`${m.size_text} рой`:`${m.size_text} ${m.type}`,`КД ${m.ac}`,`ХП ${m.hp.avg}`],[m.speed_text]],
spells:m=>[[m.school,castT(m),rangeT(m)],[(m.concentration?'Конц. ':'')+durT(m),(m.comp||[]).join(' '),m.ritual?'Ритуал':''],[(m.classes||[]).map(c=>c.name).join(', ')]],
items:m=>[[m.type,m.attunement?'Настройка':'',m.price]],
equipment:m=>[[m.line,pv(m,'Урон'),pv(m,'Класс защиты')&&'КЗ '+pv(m,'Класс защиты'),pv(m,'Вес')]],
feats:m=>[[m.prerequisite?'Треб.: '+m.prerequisite:'Без требований']],
backgrounds:m=>[[L('Хар.:',m.abilities),m.feat&&m.feat.name],[L('Навыки:',m.skills)]],
species:m=>[[pv(m,'Тип существа'),SIZES.filter(s=>pv(m,'Размер').includes(s)).join(' / '),pv(m,'Скорость')],[FILTERS.species[3][1](m).join(', ')]],
class:m=>[[L('Осн.:',cv(m,'Основная характеристика')),'Хиты '+(FILTERS.class[1][1](m)[0]||'—'),FILTERS.class[2][1](m)[0]],[L('Спасброски:',cv(m,'Владение спасбросками'))]],
glossary:m=>[[cut(((m.blocks||[]).find(b=>b.text)||{}).text,110)]]};
for(const k in S)S[k].sum=SUM[k];
const A=['По алфавиту'],mi=(l,v)=>{const i=l.indexOf(v);return i<0?null:i};
const SORT={
bestiary:[A,['Опасность',m=>mi(CR,m.cr)],['Класс Защиты',m=>m.ac],['Хиты',m=>m.hp.avg],['Размер',m=>mi(SIZES,(m.sizes||[])[0])],['Тип',m=>m.type]],
spells:[A,['Уровень',m=>m.level||0],['Школа',m=>m.school],['Время сотворения',m=>mi(['Действие','Бонусное действие','Реакция','1 минута','10 минут','1 час'],castT(m))??99],['Дистанция',m=>rangeSec(rangeT(m))],['Длительность',m=>durSec(durT(m))]],
items:[A,['Редкость',m=>mi(RAR,rarT(m))],['Цена',m=>m.price_gp],['Тип',m=>(m.type||'').split(' (')[0]]],
equipment:[A,['Стоимость',m=>m.cost_gp],['Вес',m=>m.weight_lb],['Категория',m=>eqCat(m)]],
feats:[A,['Категория',m=>m.category]],
backgrounds:[A],
species:[A,['Тип существа',m=>pv(m,'Тип существа')]],
class:[A,['Кость хитов',m=>parseInt((FILTERS.class[1][1](m)[0]||'').slice(1))||null]],
glossary:[A,['Группа',m=>m.group]]};
for(const k in S)S[k].SORT=SORT[k]||[A];
/* ================= РЕДАКЦИЯ 2014 ================= */
const capf=s=>s?s[0].toUpperCase()+s.slice(1):s,
 ALIGN14={...ALIGN,A:'Любое мировоззрение'},
 CAST14=['Действие','Бонусное действие','Реакция','1 минута','10 минут','1 час','8 часов','12 часов','24 часа'],
 castT14=m=>{const b=(m.cast_time||'').toLowerCase();return /бонусн/.test(b)?'Бонусное действие':/реакц/.test(b)?'Реакция':/^1 действие/.test(b)?'Действие':capf((b.split(/,| или /)[0]||'').trim())},
 durT14=m=>{const s=m.duration||'';if(/мгнов/i.test(s))return'Мгновенная';if(/рассея/i.test(s))return'Пока не рассеяно';const r=s.match(/(\d+)\s*(раунд|минут|час|дн|ден|сут)/i);return r?r[1]+' '+({раунд:'раунд.',минут:'мин',час:'ч',дн:'дн',ден:'дн',сут:'дн'})[r[2].toLowerCase()]:'Особая'},
 SDW=[['Излучение','излучени'],['Огонь','огн[её]м'],['Звук','звуком'],['Холод','холодом'],['Электричество','электричеством'],['Кислота','кислотой'],['Яд','ядом'],['Некротический','некротическ'],['Психический','психическ'],['Силовое поле','силов'],['Дробящий','дробящ'],['Колющий','колющ'],['Рубящий','рубящ']],
 sdmg14=m=>{const t=tx(m).toLowerCase();return SDW.filter(([,w])=>new RegExp('урон[а-яё]*\\s+(?:от\\s+)?'+w).test(t)||new RegExp(w+'[а-яё]*\\s+урон').test(t)).map(x=>x[0])},
 DW=[['Дробящий',/дробящ/],['Колющий',/колющ/],['Рубящий',/рубящ/],['Кислота',/кислот/],['Огонь',/огон|огн/],['Холод',/холод/],['Электричество',/электричеств|молни/],['Звук',/звук/],['Яд',/(?<![а-яё])яд(?![а-яё])/],['Излучение',/излучени/],['Некротический',/некротическ/],['Психический',/психическ/],['Силовое поле',/силов/]],
 dmg14=s=>{const t=(s||'').toLowerCase();return[...DW.filter(([,r])=>r.test(t)).map(x=>x[0]),...(/немагическ|не магическ/.test(t)?['Немагические атаки']:[])]},
 CW=[['Отравленный',/отравлен/],['Очарованный',/очарован/],['Испуганный',/испуг/],['Истощение',/истощен/],['Парализованный',/паралич/],['Окаменевший',/окаменен/],['Опрокинутый',/сбивани/],['Ослеплённый',/ослеплен/],['Опутанный',/опутан/],['Оглохший',/глухот/],['Схваченный',/захват/],['Ошеломлённый',/ошеломлен/],['Бессознательный',/бессознательн/],['Недееспособный',/недееспособн/]],
 cnd14=s=>CW.filter(([,r])=>r.test((s||'').toLowerCase())).map(x=>x[0]),
 RAR14=[...RAR,'Не указана'],rarT14=m=>m.rarity?rarT(m):'Не указана',
 SKILLS14=ABIL_RU,
 cv14=(m,l)=>((m.core_traits||[]).find(c=>c.label.toLowerCase()==l.toLowerCase())||{}).value||'',
 secKeys14={legendary_actions:'Легендарные действия',reactions:'Реакции',bonus_actions:'Бонусные действия',lair_actions:'Действия логова',lair:'Логово',regional_effects:'Региональные эффекты',mythic_actions:'Мифические действия'},
 ent14=e=>e.kind=='table'?T(e.rows,true):`<p class="it">${e.name?`<span class="nm">${esc(e.name)}.</span> `:''}${fmt(e.text)}${e.source?` <i>(${esc(e.source)})</i>`:''}</p>`,
 sub14=(t,x)=>`<${x}>${t}</${x}>`,
 classTable=tb=>tb?`<div class="sc"><table class="tb"><tr>${tb.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>${tb.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`:'',
 cf14=(f,t)=>`<${f.sub?'h4':t}>${f.level?`Уровень ${f.level}: `:''}${esc(f.name)}${f.optional?' <small>(опционально)</small>':''}</${f.sub?'h4':t}>${B(f.blocks)}`,
 asiTxt=m=>(m.asi||[]).map(a=>a.ability+' +'+a.value).join(', ');
const S14={
bestiary:{t:'Бестиарий',sub:m=>m.cr?'БО '+m.cr:'',
 card:m=>{const sl=(m.swarm?`${m.size_text} рой ${m.swarm_of}`:`${m.size_text} ${m.type||''}`)+(m.tags&&m.tags.length?` (${m.tags.join(', ')})`:'')+(m.alignment_text?`, ${m.alignment_text}`:'')+(m.named_npc?', именной НИП':'');
 const ab=m.abilities&&m.abilities.str;
 return `<article class="stat">${head(m,sl)}${pr('Класс Доспеха',m.ac_text||m.ac)}${m.hp_text?pr('Хиты',m.hp_text):m.hp?`<p class="pr"><b>Хиты</b> ${m.hp.avg??''}${m.hp.formula?` (${esc(m.hp.formula)})`:''}</p>`:''}${pr('Скорость',m.speed_text)}`
 +(ab?`<div class="rule"></div><div class="abil">${at(ABIL.slice(0,3),m)}${at(ABIL.slice(3),m)}</div>`:'')+`<div class="rule"></div>`
 +pr('Навыки',Object.entries(m.skills||{}).map(([k,v])=>`${k} ${sg(v)}`).join(', '))+pr('Уязвимость к урону',m.vulnerabilities)+pr('Сопротивление урону',m.resistances)+pr('Иммунитет к урону',m.immunities)+pr('Иммунитет к состояниям',m.condition_immunities)+pr('Чувства',m.senses)+pr('Языки',m.languages)
 +`<p class="pr"><b>Опасность</b> ${m.cr?esc(m.cr)+(m.xp!=null?` (${m.xp} опыта)`:''):'—'}</p>`+(m.pb!=null?pr('Бонус мастерства',sg(m.pb)):'')+pr('Среда обитания',m.habitat?m.habitat.split(/,\s*/).map(capf).join(', '):'')
 +(m.sections||[]).map(s=>`<h3>${esc(s.title||'')}</h3>${s.intro?`<p class="intro">${fmt(s.intro)}</p>`:''}${s.items.map(ent14).join('')}`).join('')
 +loreView(m.lore)+foot(m)}},
spells:{t:'Заклинания',sub:S.spells.sub,card:S.spells.card},
items:{t:'Предметы',sub:m=>m.rarity?rarT(m):'',card:S.items.card},
feats:{t:'Черты',sub:m=>m.prerequisite?'треб.':'',card:S.feats.card},
backgrounds:{t:'Предыстории',sub:()=>'',card:m=>`<article class="stat">${head(m,'')}${B(m.blocks)}${foot(m)}`},
race:{t:'Расы',sub:m=>(m.sizes||[]).join(' / '),card:m=>`<article class="stat">${head(m,'')}${B(m.blocks)}${foot(m)}`},
class:{t:'Классы',sub:m=>m.sidekick?'напарник':'',card:m=>`<article class="stat">${head(m,m.sidekick?'Класс напарника':'')}${(m.core_traits||[]).map(c=>pr(esc(c.label),c.value)).join('')}${classTable(m.table)}`
 +lore(m.lore)+(m.creation&&m.creation.length?`<details><summary>Создание персонажа</summary>${B(m.creation)}</details>`:'')
 +(m.extra||[]).map(x=>`<details><summary>${esc(x.title)}</summary>${B(x.blocks)}</details>`).join('')
 +(m.multiclassing&&m.multiclassing.length?`<details><summary>Мультиклассирование</summary>${B(m.multiclassing)}</details>`:'')
 +(m.features||[]).map(f=>cf14(f,'h3')).join('')+((m.subclasses||[]).length?'<h3>Подклассы</h3>':'')
 +(m.subclasses||[]).map(s=>`<details><summary>${esc(s.name)}${s.official?'':' — неофициальный'}</summary>${s.source?`<p class="en">${esc(s.source)}</p>`:''}${B(s.description)}${s.features.map(f=>cf14(f,'h4')).join('')}</details>`).join('')+foot(m)}
};
const FILTERS14={
bestiary:[
 ['Опасность',m=>[m.cr].filter(Boolean),(a,b)=>CR.indexOf(a)-CR.indexOf(b)],
 ['Тип',m=>[m.type].filter(Boolean)],
 ['Теги',m=>m.tags||[],null,1],
 ['Размер',m=>m.sizes||[],ord(SIZES),1],
 ['Мировоззрение',m=>[ALIGN14[m.alignment]].filter(Boolean),ord(Object.values(ALIGN14))],
 ['Среда обитания',m=>m.habitat?m.habitat.split(/,\s*/).map(capf):[],null,1],
 ['Скорость',m=>Object.keys(m.speed||{}).map(k=>({fly:'Полёт',swim:'Плавание',climb:'Лазание',burrow:'Копание'})[k]).filter(Boolean),null,1],
 ['Чувства',m=>[['Тёмное зрение',/тёмное зрение/i],['Слепое зрение',/слепое зрение/i],['Истинное зрение',/истинное зрение/i],['Чувство вибрации',/вибраци/i]].filter(([,r])=>r.test(m.senses||'')).map(x=>x[0]),null,1],
 ['Телепатия',m=>/телепат/i.test(m.languages||'')?['Есть']:['Нет']],
 ['Класс Доспеха',m=>[bucket(m.ac,[['до 11',11],['12–14',14],['15–17',17],['18 и выше',1/0]])].filter(Boolean),ord(['до 11','12–14','15–17','18 и выше'])],
 ['Хиты',m=>[bucket(m.hp&&m.hp.avg,[['до 20',20],['21–50',50],['51–100',100],['101–200',200],['более 200',1/0]])].filter(Boolean),ord(['до 20','21–50','51–100','101–200','более 200'])],
 ['Иммунитет к урону',m=>dmg14(m.immunities),ord([...DMGT,'Немагические атаки']),1],
 ['Сопротивление урону',m=>dmg14(m.resistances),ord([...DMGT,'Немагические атаки']),1],
 ['Уязвимость к урону',m=>dmg14(m.vulnerabilities),ord(DMGT),1],
 ['Иммунитет к состояниям',m=>cnd14(m.condition_immunities),null,1],
 ['Особенности',m=>[...(m.sections||[]).map(s=>secKeys14[s.key]).filter(Boolean),...((m.sections||[]).some(s=>s.items.some(i=>i.kind=='spellcasting'))?['Заклинатель']:[]),...(m.swarm?['Рой']:[]),...(m.named_npc?['Именной НИП']:[]),...((m.sections||[]).some(s=>s.key=='optional')?['Опциональные правила']:[])],null,1],
 ['Источник',SRC,null,1]],
spells:[
 ['Уровень',m=>[lvl(m)],(a,b)=>num(a=='Заговор'?0:a,b=='Заговор'?0:b)],
 ['Школа',m=>[m.school].filter(Boolean)],
 ['Класс',m=>(m.classes||[]).map(c=>c.name),null,1],
 ['Подкласс',m=>m.subclass_list||[],null,1],
 ['Время накладывания',m=>[castT14(m)],ord(CAST14)],
 ['Ритуал',m=>yn(m.ritual)],
 ['Концентрация',m=>yn(m.concentration)],
 ['Длительность',m=>[durT14(m)],(a,b)=>durSec(a)-durSec(b)],
 ['Дистанция',m=>[rangeT(m)],(a,b)=>rangeSec(a)-rangeSec(b)],
 ['Компоненты',m=>m.comp||[],null,1],
 ['Материал',m=>m.material?[...(/\d+\s*зм/i.test(m.material)?['Указана стоимость']:[]),...(/поглощ|расходу|уничтож|потреб/i.test(m.material)?['Расходуется']:[])]:[],null,1],
 ['Тип урона',sdmg14,ord(DMGT),1],
 ['Спасбросок',m=>rx(m,SSAVE),ord(ABIL_RU),1],
 ['Атака заклинанием',m=>/(рукопашн|дальнобойн)[а-яё]*\s+атак[а-яё]*\s+заклинанием/i.test(tx(m))?['Да']:['Нет']],
 ['Источник',SRC,null,1]],
items:[
 ['Редкость',m=>[rarT14(m)],ord(RAR14)],
 ['Тип',m=>[(m.type||'—').split(' (')[0]]],
 ['Настройка',m=>[m.attunement?'Требуется':'Не требуется']],
 ['Настройка для',m=>m.attunement_by||[],null,1],
 ['Цена',m=>[PRICE(m.price_min_gp)],ord(PRICEL)],
 ['Источник',SRC,null,1]],
feats:[
 ['Требования',m=>m.prereq_tags||[],null,1],
 ['Мин. уровень',m=>[(m.prerequisite||'').match(/(\d+)\s*уровень/)?.[1]].filter(Boolean).map(x=>x+' уровень'),(a,b)=>num(a,b)],
 ['Мин. характеристика',m=>m.prereq_abilities||[],ord(ABIL_RU),1],
 ['Повышает характеристику',m=>[...new Set((m.asi||[]).map(a=>a.ability))],ord([...ABIL_RU,'Все','На выбор']),1],
 ['Источник',SRC,null,1]],
backgrounds:[
 ['Навык',m=>m.skills||[],null,1],
 ['Инструмент',m=>m.tool_tags||[],null,1],
 ['Языки',m=>[m.languages_n==null?'Особые':m.languages_n==0?'Нет':m.languages_n==1?'Один':m.languages_n==2?'Два':'Три'],ord(['Нет','Один','Два','Три','Особые'])],
 ['Источник',SRC,null,1]],
race:[
 ['Увеличение характеристик',m=>[...new Set((m.asi||[]).map(a=>a.ability))],ord([...ABIL_RU,'Все','На выбор']),1],
 ['Размер',m=>m.sizes||[],ord(SIZES),1],
 ['Скорость',m=>(m.speeds||[]).map(x=>x+' футов'),(a,b)=>num(a,b),1],
 ['Подрасы',m=>yn((m.subraces||[]).length)],
 ['Особенности',m=>rx(m,[['Тёмное зрение',/тёмное зрение/i],['Полёт',/полёт|летать/i],['Плавание',/плавани/i],['Лазание',/лазани/i],['Сопротивление урону',/сопротивлени/i],['Заклинания',/заклинани|заговор/i],['Владение навыками',/владение навык|владеете навык|навык[а-я]* на ваш выбор/i],['Владение оружием',/владение .{0,40}оружи|владеете .{0,40}оружи/i],['Языки на выбор',/язык[а-я]* на ваш выбор/i]]),null,1],
 ['Источник',SRC,null,1]],
class:[
 ['Тип',m=>[m.sidekick?'Напарник':'Класс']],
 ['Кость хитов',m=>[(cv14(m,'Кость Хитов').match(/к(\d+)/i)||[])[1]].filter(Boolean).map(x=>'К'+x),ord(['К6','К8','К10','К12'])],
 ['Заклинательство',m=>[(m.table?.columns||[]).some(c=>/Заговор|Ячейки|Известные заклинания|Подготовленные/.test(c))?'Заклинатель':'Не заклинатель']],
 ['Спасброски',m=>abil(cv14(m,'Спасброски')),ord(ABIL_RU),1],
 ['Доспехи',m=>[['Лёгкие',/лёгк/i],['Средние',/средн/i],['Тяжёлые',/тяжёл|все виды/i],['Щиты',/щит/i]].filter(([,r])=>r.test(cv14(m,'Доспехи'))).map(x=>x[0]),null,1],
 ['Оружие',m=>[['Простое',/простое/i],['Воинское',/воинское/i]].filter(([,r])=>r.test(cv14(m,'Оружие'))).map(x=>x[0]),null,1],
 ['Инструменты',m=>[/^(нет|—)?\.?$/i.test(cv14(m,'Инструменты').trim())?'Нет':'Есть']],
 ['Источник',SRC,null,1]]
};
const SUM14={
bestiary:m=>[[m.swarm?`${m.size_text} рой`:`${m.size_text} ${m.type||''}`,m.ac!=null?`КД ${m.ac}`:'',m.hp?`ХП ${m.hp.avg}`:''],[m.speed_text]],
spells:m=>[[m.school,castT14(m),rangeT(m)],[(m.concentration?'Конц. ':'')+durT14(m),(m.comp||[]).join(' '),m.ritual?'Ритуал':''],[(m.classes||[]).map(c=>c.name).join(', ')]],
items:m=>[[m.type,m.attunement?'Настройка':'',m.price]],
feats:m=>[[m.prerequisite?'Треб.: '+m.prerequisite:'Без требований',asiTxt(m)]],
backgrounds:m=>[[L('Навыки:',m.skills),L('Инстр.:',m.tool_tags)]],
race:m=>[[(m.sizes||[]).join(' / '),(m.speeds||[]).length?m.speeds.join('/')+' фт':'',m.subraces&&m.subraces.length?m.subraces.length+' подр.':'']],
class:m=>[[L('Спасб.:',cv14(m,'Спасброски')),'Хиты '+((cv14(m,'Кость Хитов').match(/к\d+/i)||['—'])[0]),FILTERS14.class[2][1](m)[0]]]};
const SORT14={
bestiary:[A,['Опасность',m=>mi(CR,m.cr)],['Класс Доспеха',m=>m.ac],['Хиты',m=>m.hp&&m.hp.avg],['Размер',m=>mi(SIZES,(m.sizes||[])[0])],['Тип',m=>m.type]],
spells:[A,['Уровень',m=>m.level||0],['Школа',m=>m.school],['Время накладывания',m=>mi(CAST14,castT14(m))??99],['Дистанция',m=>rangeSec(rangeT(m))],['Длительность',m=>durSec(durT14(m))]],
items:[A,['Редкость',m=>mi(RAR14,rarT14(m))],['Цена',m=>m.price_min_gp],['Тип',m=>(m.type||'').split(' (')[0]]],
feats:[A],backgrounds:[A],race:[A],
class:[A,['Кость хитов',m=>parseInt((FILTERS14.class[1][1](m)[0]||'').slice(1))||null]]};
const ABBR={"Player's Handbook 2014":'PHB',"Dungeon Master's Guide 2014":'DMG',"Monster Manual 2014":'MM',"Mordenkainen's Tome of Foes":'MToF',"Volo's guide to monsters":'VGtM',"Mordenkainen Presents: Monsters of the Multiverse":'MPMM',"Xanathar's Guide to Everything":'XGtE',"Tasha's Cauldron of Everything":'TCoE'},
 abbr=s=>ABBR[s]||(s||'').split(/[\s:]+/).filter(w=>/^[A-Z]/.test(w)&&!['The','Of'].includes(w)).map(w=>w[0]).join('')||s;
S14.articles={t:'Правила и статьи',sub:m=>m.category_ru,card:m=>`<article class="stat">${head(m,m.category_ru)}${B(m.blocks)}${foot(m)}`};
FILTERS14.articles=[['Рубрика',m=>[m.category_ru]],['Источник',SRC,null,1]];
SUM14.articles=m=>[[m.category_ru,(m.sources||[]).map(abbr).join(', ')]];
SORT14.articles=[A];
/* разделы, выделенные из статей 2014: снаряжение (data14/equipment.json) и глоссарий (data14/glossary.json) */
S14.equipment={t:'Снаряжение',sub:m=>m.cost||'',card:S.equipment.card};
FILTERS14.equipment=[
 ['Категория',m=>[m.category_ru||'Прочее']],
 ['Класс',m=>[(m.line||'').match(/^(Простое|Воинское|Лёгкий|Средний|Тяжёлый)/)?.[1]].filter(Boolean),ord(['Простое','Воинское','Лёгкий','Средний','Тяжёлый'])],
 ['Дистанция оружия',m=>[(m.line||'').match(/(Рукопашное|Дальнобойное)/)?.[1]].filter(Boolean)],
 ['Тип урона',m=>pv(m,'Урон')?[pv(m,'Урон').split(', ').pop()]:[],ord(DMGT)],
 ['Кость урона',m=>pv(m,'Урон')?[pv(m,'Урон').split(', ')[0]]:[]],
 ['Вид яда',m=>m.category_ru=='Яды'?((m.line.match(/\((.*)\)/)||[])[1]||'').split(/\s+или\s+/).map(capf).filter(Boolean):[],null,1],
 ['Стоимость',m=>[m.cost_gp==null?'Без цены':bucket(m.cost_gp,GP)],ord([...GPL,'Без цены'])],
 ['Источник',SRC,null,1]];
SUM14.equipment=m=>[[m.line,pv(m,'Урон'),pv(m,'Класс защиты')&&'КЗ '+pv(m,'Класс защиты'),pv(m,'Вес')]];
SORT14.equipment=[A,['Стоимость',m=>m.cost_gp],['Вес',m=>m.weight_lb],['Категория',m=>m.category_ru]];
S14.glossary={t:'Глоссарий',sub:()=>'',card:S.glossary.card};
FILTERS14.glossary=[['Группа',m=>[m.group||'Общие термины']],['Источник',SRC,null,1]];
SUM14.glossary=m=>[[cut(((m.blocks||[]).find(b=>b.text)||{}).text,110)]];
SORT14.glossary=[A,['Группа',m=>m.group]];
FILTERS14.spells.splice(FILTERS14.spells.length-1,0,['Статус',m=>[m.homebrew?'Homebrew / UA':'Официальное']]);
SUM14.bestiary=(f=>m=>[...f(m),[(m.sources||[]).slice(0,2).map(abbr).join(', ')]])(SUM14.bestiary);
SUM14.race=(f=>m=>[...f(m),[(m.sources||[]).slice(0,2).map(abbr).join(', ')]])(SUM14.race);
for(const k in S14){S14[k].F=FILTERS14[k]||[];S14[k].sum=SUM14[k];S14[k].SORT=SORT14[k]||[A]}
const ORDERS={24:['bestiary','spells','class','species','backgrounds','feats','items','equipment','glossary'],14:['bestiary','spells','class','race','backgrounds','feats','items','equipment','glossary','articles']},
 SXS={24:S,14:S14},cache={},SWAP={species:'race',race:'species',articles:'glossary',glossary:'articles'};
let ed=24,SX=S;

/* ===== адреса страниц =====
   У каждой записи свой адрес: [14/]раздел/слаг/ — 2024 без префикса, 2014 с «14/». Главная: «./» и «14/».
   Адреса считаются от корня сайта: в браузере корень задаёт <base href> страницы, в build_pages.js — настройка site. */
const TOOLS=['dmscreen','sheet','translator'];
const hh=(e,k,slug)=>k?(e==14?'14/':'')+k+'/'+(slug?encodeURIComponent(slug)+'/':''):(e==14?'14/':'./'),
 EDK=e=>({24:'2024',14:'2014'})[e];
// «14/spells/fireball/» → {e:14,k:'spells',slug:'fireball'}; главная — k:''; адрес, которого на сайте нет, — null
function parseRel(rel){
 let p=String(rel||'').split(/[?#]/)[0].split('/').filter(x=>x&&x!='index.html'),e=24;
 if(p[0]=='14'){e=14;p=p.slice(1)}
 if(p.length>2)return null;
 const k=p[0]||'';let slug=p[1]||'';
 if(slug){try{slug=decodeURIComponent(slug)}catch(x){return null}}
 if(!k)return slug?null:{e,k:'',slug:''};
 if(TOOLS.includes(k))return !slug||(k=='translator'&&slug=='doc')?{e,k,slug}:null;
 return ORDERS[e].includes(k)?{e,k,slug}:null}

const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е');
// порядок записей в списке: вводная («intro») первой, остальные по алфавиту
const sortEntries=d=>d.sort((a,b)=>a.slug=='intro'?-1:b.slug=='intro'?1:a.name_ru.localeCompare(b.name_ru,'ru'));
const lines=(c,m)=>c.sum?c.sum(m).map(l=>l.filter(Boolean).join(' · ')).filter(Boolean).map(t=>`<span class="s">${esc(t)}</span>`).join(''):'';
const listItem=(e,k,m)=>{const c=SXS[e][k];return `<li><a href="${hh(e,k,m.slug)}" data-slug="${m.slug}"><span class="t"><b>${esc(m.name_ru)}</b><small>${esc(c.sub(m))}</small></span>${lines(c,m)}</a></li>`};
// карточка на отдельной странице: название записи — главный заголовок <h1> (в панелях и на листах персонажа карточки остаются с <h2>)
const pageCard=(e,k,m)=>SXS[e][k].card(m).replace('<h2>','<h1>').replace('</h2>','</h1>');
// верхнее меню; cur — раздел, который подсвечивается («home», ключ раздела или инструмент)
const navHTML=(e,cur)=>{const c=k=>cur===k?' aria-current="true"':'';
 return `<span class="ed"><a data-e="14" href="${hh(14)}" aria-current="${e==14}">2014</a><a data-e="24" href="${hh(24)}" aria-current="${e==24}">2024</a></span><a href="${hh(e)}" data-s="home"${c('home')}>Главная</a>`
 +ORDERS[e].map(k=>`<a href="${hh(e,k)}" data-s="${k}"${c(k)}>${SXS[e][k].t}</a>`).join('')
 +`<a href="${hh(e,'dmscreen')}" data-s="dmscreen"${c('dmscreen')}>Экран мастера</a><a href="${hh(e,'sheet')}" data-s="sheet"${c('sheet')}>Листы персонажей</a><a href="${hh(e,'translator')}" data-s="translator"${c('translator')}>Переводчик</a><button id="gs" type="button" title="Глобальный поиск (Ctrl+K или /)">🔍 Поиск<kbd>/</kbd></button>`};

/* ===== тексты для поисковиков: заголовок и описание каждой страницы =====
   Одни и те же функции дают <title> в готовых страницах (tools/build_pages.js) и при переходах внутри сайта (app.js). */
const KIND={bestiary:'монстр',spells:'заклинание',class:'класс',species:'вид',race:'раса',backgrounds:'предыстория',feats:'черта',items:'магический предмет',equipment:'снаряжение',glossary:'правило',articles:'статья'};
const BLURB={bestiary:'монстры и существа со статблоками, фильтры по опасности и типу',spells:'заклинания по классу, кругу, школе, ритуалам и концентрации',class:'классы и подклассы с таблицами умений по уровням',species:'виды и их особенности',race:'расы и подрасы с особенностями',backgrounds:'предыстории: навыки, инструменты и снаряжение',feats:'черты с требованиями и описанием',items:'магические предметы по редкости, типу и настройке',equipment:'оружие, доспехи, инструменты, транспорт и яды',glossary:'правила и термины: состояния, действия, перемещение, колдовство',articles:'игровые механики, лор и справочные статьи'};
const TOOLMETA={
 dmscreen:{h:'Экран мастера',t:'Экран мастера D&D 5e онлайн — инициатива, кубики, заметки',d:'Бесплатный экран мастера D&D 5e: инициатива с хитами и состояниями, кубики, заметки, счётчики, игровое время и записи из справочника в одном окне. Без регистрации.'},
 sheet:{h:'Листы персонажей',t:'Лист персонажа D&D 5e онлайн — расчёт и печать на A4',d:'Бесплатный лист персонажа D&D 5e на русском: автоматический расчёт бонусов и хитов, выбор заклинаний, черт и предыстории, печать на A4. Без регистрации.'},
 translator:{h:'Переводчик на языки D&D',t:'Переводчик на языки D&D — драконий, эльфийский, дварфийский',d:'Переводчик русского текста на алфавиты D&D: драконий, эльфийский, дварфийский, инфернальный и другие. Готовые записки и документы для игроков.'},
 'translator/doc':{h:'Переводчик: документ',t:'Документ на языке D&D — записка эльфийским, драконьим и другими',d:'Оформите записку или документ письменностью D&D: эльфийской, драконьей, дварфийской и другими, и сохраните картинкой для игроков.'}};
const entryName=(k,m)=>m.name_ru+(m.name_en&&String(m.name_en).toLowerCase()!=String(m.name_ru).toLowerCase()?` (${m.name_en})`:'');
// у записей с одним названием (версии из разных книг) заголовок различается источником; dups — множество таких названий раздела (dupNames)
const dupNames=d=>{const c={};d.forEach(m=>{const n=norm(m.name_ru+'|'+(m.name_en||''));c[n]=(c[n]||0)+1});return new Set(Object.keys(c).filter(n=>c[n]>1))};
function entryTitle(e,k,m,dups){
 const src=dups&&dups.has(norm(m.name_ru+'|'+(m.name_en||'')))&&m.sources&&m.sources[0]?', '+abbr(m.sources[0]):'',tail=` — ${KIND[k]} D&D 5e (${EDK(e)}${src})`,full=entryName(k,m)+tail;
 return full.length>80?m.name_ru+tail:full}
function entryDesc(e,k,m){
 const txt=b=>b?String(b.text||(b.items&&b.items.join('; '))||''):'',ok=b=>b&&!/^(heading|subheader|table|embed)$/.test(b.type||'')&&txt(b).length>25;
 let lead='',body='';
 try{if(k=='bestiary')lead=[m.swarm?m.size_text+' рой':[m.size_text,m.type].filter(Boolean).join(' '),m.ac!=null?'КД '+m.ac:'',m.hp&&m.hp.avg!=null?'хиты '+m.hp.avg:'',m.cr!=null?'опасность '+m.cr:''].filter(Boolean).join(', ');else lead=m.line||m.category_ru||m.group||''}catch(x){}
 const lore=m.lore&&(Array.isArray(m.lore)?m.lore:m.lore.blocks);
 const pools=[m.blocks,lore,m.features&&m.features[0]&&m.features[0].blocks,m.becoming&&m.becoming.parts&&m.becoming.parts[0]&&m.becoming.parts[0].blocks];
 for(const p of pools){const b=(p||[]).find(ok);if(b){body=txt(b);break}}
 if(!body&&m.sections){const it=m.sections.flatMap(s=>s.items||[]).find(x=>String(x.text||'').length>25);if(it)body=(it.name?it.name+'. ':'')+it.text}
 let d=`${entryName(k,m)} — ${KIND[k]} D&D 5e (${EDK(e)}).`+(lead?' '+String(lead).replace(/\.$/,'')+'.':'')+(body?' '+body:'');
 d=d.replace(/\s+/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1');
 d=cut(d,158);
 return d.length<80?d+' Справочник D&D 5e на русском.':d}
const plural=(n,a,b,c)=>{const m=n%100,d=n%10;return m>10&&m<20?c:d==1?a:d>1&&d<5?b:c};
const sectionTitle=(e,k,n)=>`${SXS[e][k].t} D&D 5e (${EDK(e)}) на русском — ${n} ${plural(n,'запись','записи','записей')}`;
const sectionDesc=(e,k,n)=>`${SXS[e][k].t} D&D 5e, редакция ${EDK(e)}, на русском: ${n} ${plural(n,'запись','записи','записей')} — ${BLURB[k]}. Поиск, фильтры, английские названия.`;
// правая часть страницы раздела, пока запись не выбрана: заголовок для читалок и поисковиков и подсказка
const sectionCard=(e,k)=>`<h1 class="vh">${esc(SXS[e][k].t)} D&amp;D 5e (${EDK(e)}) на русском</h1><p class="empty">Выберите запись в списке.</p>`;
const toolCard=k=>`<article class="stat"><h1>${esc(TOOLMETA[k].h)}</h1><p>${esc(TOOLMETA[k].d)}</p></article>`;
