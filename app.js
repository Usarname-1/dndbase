/* Логика страницы: список, фильтры, карточка, переходы между страницами без перезагрузки.
   Разметка карточек, списков и адресов — в core.js; готовые страницы для поисковиков собирает tools/build_pages.js. */
const $=s=>document.querySelector(s);
const HOMEN={"14":{"bestiary":3141,"spells":535,"class":16,"race":84,"backgrounds":87,"feats":105,"items":934,"equipment":377,"glossary":241,"articles":129},"24":{"bestiary":657,"spells":444,"class":14,"species":19,"backgrounds":70,"feats":195,"items":437,"equipment":197,"glossary":155}};/*home-counts*/
let curKey='',sec,data=[],view=[],flt=[],V=[],NM=[],opts=[],cells=[],sortI=0,desc=false;
async function load(k,e=ed,quiet){const key=e+k;if(!cache[key]){if(!quiet)$('#count').textContent='Загрузка…';const dir=e==14?'data14':'data';try{cache[key]=sortEntries(await(await fetch(`${dir}/${k}.json`)).json())}catch(x){if(!quiet)$('#count').textContent=`Не удалось загрузить ${dir}/${k}.json (открывайте через сервер, не файлом)`;return[]}}return cache[key]}
const ok=(k,skip)=>flt.every((o,i)=>i===skip||!o.s.size||(o.all?[...o.s].every(v=>V[k][i].includes(v)):[...o.s].some(v=>V[k][i].includes(v))));
function filters(){const F=SX[sec].F;
 V=data.map(m=>F.map(([,f])=>{try{return f(m)||[]}catch(e){return[]}}));
 NM=data.map(m=>norm(m.name_ru+' '+(m.name_en||'')));
 opts=F.map(([,,so],i)=>[...new Set(V.flatMap(v=>v[i]))].filter(Boolean).sort(so||ru));
 flt=F.map(()=>({s:new Set(),all:false}));
 sortI=0;desc=false;$('#dir').textContent='↑';$('#sort').innerHTML=SX[sec].SORT.map((s,i)=>`<option value="${i}">${i?'Сортировка: ':''}${esc(s[0])}</option>`).join('');
 $('#fl').innerHTML=F.map(([n,,,mu],i)=>`<section class="g" data-g="${i}"><div class="gh"><span>${esc(n)}</span><span class="gn"></span></div><div class="go">${mu?`<label class="md"><input type="checkbox" data-all="${i}"> должны подходить все (И)</label>`:''}${opts[i].map((v,j)=>`<label class="o"><input type="checkbox" data-i="${i}" data-j="${j}"><span>${esc(v)}</span><em></em></label>`).join('')}</div></section>`).join('');
 cells=F.map((_,i)=>[...document.querySelectorAll(`.o input[data-i="${i}"]`)].map(x=>x.parentNode))}
function render(){const c=SX[sec],q=norm($('#q').value.trim()),hit=k=>!q||NM[k].includes(q);
 const idx=[];data.forEach((m,k)=>{if(hit(k)&&ok(k))idx.push(k)});
 const kf=(c.SORT[sortI]||[])[1],K=data.map((m,k)=>kf?kf(m):k),pin=k=>data[k].slug=='intro';
 idx.sort((a,b)=>{if(pin(a)!=pin(b))return pin(a)?-1:1;const x=K[a],y=K[b];if(x==null||y==null)return x==null&&y==null?a-b:x==null?1:-1;const r=(typeof x=='number'&&typeof y=='number'?x-y:String(x).localeCompare(String(y),'ru'))*(desc?-1:1);return r||a-b});
 view=idx.map(k=>data[k]);
 $('#count').textContent=`Найдено: ${view.length} из ${data.length}`;
 $('#list').innerHTML=view.map(m=>listItem(ed,sec,m)).join('');
 c.F.forEach((_,i)=>{const cnt={};data.forEach((m,k)=>{if(hit(k)&&ok(k,i))new Set(V[k][i]).forEach(v=>cnt[v]=(cnt[v]||0)+1)});
  cells[i].forEach((lab,j)=>{const n=cnt[opts[i][j]]||0;lab.lastChild.textContent=n;lab.classList.toggle('z',!n)});
  const g=document.querySelector(`.g[data-g="${i}"]`),n=flt[i].s.size;if(g)g.querySelector('.gn').textContent=n||''});
 const n=flt.filter(o=>o.s.size).length;$('#fn').textContent=n||'';$('#ftoggle').textContent='Фильтры'+(n?` (${n})`:'')}
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
// корень сайта задаёт <base href> страницы: /dndbase/ на GitHub Pages, / на своём домене
const ROOT=new URL(document.baseURI).pathname.replace(/\/*$/,'/'),SITE_ORIGIN=location.origin;
const relOf=p=>p.startsWith(ROOT)?p.slice(ROOT.length):null;
function parseLoc(){const r=relOf(location.pathname);return r==null?null:parseRel(r)}
// ссылка внутри сайта → разобранный адрес, иначе null (внешние ссылки, «#», файлы)
function parseHref(href){if(!href||href[0]=='#')return null;let u;try{u=new URL(href,document.baseURI)}catch(e){return null}
 if(u.origin!==location.origin)return null;const r=relOf(u.pathname);return r==null?null:parseRel(r)}
function setMeta(title,desc,canon){document.title=title;
 const set=(s,a,v)=>{const el=document.querySelector(s);if(el&&v!=null)el.setAttribute(a,v)};
 if(desc!=null){set('meta[name=description]','content',desc);set('meta[property="og:description"]','content',desc)}
 set('meta[property="og:title"]','content',title);
 if(canon!=null){const u=SITE_ORIGIN+ROOT+canon;set('link[rel=canonical]','href',u);set('meta[property="og:url"]','content',u)}}
// переход на другую страницу сайта без перезагрузки; тот же адрес — ничего не делает, как раньше с #
function go(href,replace){const u=new URL(href,document.baseURI);
 if(u.pathname+u.search===location.pathname+location.search&&!replace)return;
 history[replace?'replaceState':'pushState'](null,'',u.pathname+u.search+u.hash);return route()}
function edLinks(){const dm=document.body.classList.contains('dm')||document.body.classList.contains('cs')||document.body.classList.contains('tr');document.querySelectorAll('.ed a').forEach(a=>{const e=+a.dataset.e;let k=sec;if(document.body.classList.contains('land')){a.href=hh(e);a.setAttribute('aria-current',e==ed);return}if(dm){a.href=hh(e,document.body.classList.contains('tr')?'translator':document.body.classList.contains('cs')?'sheet':'dmscreen');a.setAttribute('aria-current',e==ed);return}if(e!=ed){if(!SXS[e][k])k=SWAP[k]||k;if(!SXS[e][k])k='bestiary'}a.href=hh(e,k);a.setAttribute('aria-current',e==ed)})}
async function xref(m,h){if(!$('#xref'))return;const o=ed==14?24:14;let k2=SXS[o][sec]?sec:SWAP[sec];if(!k2||!SXS[o][k2])return;
 const s2=ed==14&&m.url_2024?m.url_2024.replace(/\/$/,'').split('/').pop().replace(/^\d+-/,''):m.slug;
 const d=await load(k2,o,true);if(location.pathname!==h)return;
 let t=d.find(x=>x.slug===s2);
 // slug может отличаться («enlargereduce» ↔ «enlarge-reduce»): тогда ищем по английскому названию, но только если оно одно
 if(!t&&m.name_en){const n=norm(m.name_en),c=d.filter(x=>norm(x.name_en)===n);if(c.length===1)t=c[0]}
 if(!t)return;const el=$('#xref');if(el)el.innerHTML=` · <a href="${hh(o,k2,t.slug)}">Версия ${EDK(o)}</a>`}
const LK={s:'spells',g:'glossary',c:'class',e:'equipment',m:'bestiary',i:'items',f:'feats',a:'articles'},SELFK={spells:'s',glossary:'g',class:'c',equipment:'e',bestiary:'m',items:'i',feats:'f',articles:'a'},lix={};
function linkIndex(e){return lix[e]||(lix[e]=fetch((e==14?'data14':'data')+'/links.json').then(r=>r.json()).then(r=>AutoLinks.buildIndex(r,{bracketOnlySingle:e==14})).catch(()=>null))}
async function autolink(m,h){const e=ed,k=sec,ix=await linkIndex(e);if(!ix||location.pathname!==h||ed!==e||sec!==k)return;const href=x=>hh(e,LK[x.k],x.slug);AutoLinks.hydrate($('#card'),ix,href);AutoLinks.linkify($('#card'),ix,{k:SELFK[k],slug:m.slug},href)}
let IMGM;const imgManifest=()=>IMGM||(IMGM=fetch('img/manifest.json').then(r=>r.json()).then(j=>{for(const e in j)for(const s in j[e])j[e][s]=new Set(j[e][s]);return j}).catch(()=>({})));
function placePic(root,e,k,m,ok){const ms=(IMGM_V||{})[e]||{},art=ms[k]&&ms[k].has(m.slug),tk=!art&&ms[k+'~t']&&ms[k+'~t'].has(m.slug);if((!art&&!tk)||root.querySelector('figure.pic'))return;const rule=root.querySelector('.rule');if(!rule)return;
 const fig=document.createElement('figure'),im=new Image();fig.className='pic'+(tk?' tok':'');im.alt=m.name_ru;im.loading='lazy';im.decoding='async';im.onerror=()=>fig.remove();im.onclick=()=>fig.classList.toggle('big');im.src=`img/${e}/${tk?k+'-token':k}/${encodeURIComponent(m.slug)}.webp`;fig.append(im);rule.after(fig)}
let IMGM_V;
async function addPic(m,h){IMGM_V=await imgManifest();const e=ed,k=sec;if(location.pathname!==h||ed!==e||sec!==k)return;placePic($('#card'),e,k,m)}
async function decorate(root,e,self){Dice.linkify(root);const ix=await linkIndex(e);if(!ix||!root.isConnected)return;const href=x=>hh(e,LK[x.k],x.slug);AutoLinks.hydrate(root,ix,href);AutoLinks.linkify(root,ix,self,href)}
window.DB={get ed(){return ed},go:(h,r)=>go(h,r),parseHref,ROOT,SXS,ORDERS,load:(k,e)=>load(k,e,true),hh,esc,norm,B:typeof B!=='undefined'?B:null,EDK,decorate,LK,SELFK,ls,
 placePic:async(root,e,k,m)=>{IMGM_V=await imgManifest();placePic(root,e,k,m)}};
// ссылки вводного текста ведут в разделы выбранной редакции; разделов, которых в ней нет (например, снаряжения в 2014), — без ссылки
function homeLinks(){document.querySelectorAll('#card a[data-s]').forEach(a=>{let k=a.dataset.s;if(k!='dmscreen'&&k!='sheet'&&k!='translator'){if(!SX[k])k=SWAP[k];if(!SX[k]){a.replaceWith(...a.childNodes);return}}a.href=hh(ed,k)})}
function notFound(){const b=document.body;b.classList.remove('land','dm','cs','tr');b.classList.add('open');curKey='';$('#nav').innerHTML=navHTML(ed);edLinks();
 $('#card').innerHTML='<p class="empty">Такой страницы нет. <a href="'+hh(ed)+'">На главную</a></p>';setMeta('Страница не найдена — D&D 5e на русском')}
let dupsKey='',dupsSet;const dupsOf=()=>dupsKey===curKey?dupsSet:(dupsKey=curKey,dupsSet=dupNames(data));
let firstRoute=true;
async function route(){dispatchEvent(new Event('routechange'));let P=parseLoc();if(!P){notFound();return}
 if(firstRoute){firstRoute=false;if(!P.k&&P.e==24&&ls.get('ed')=='14'){history.replaceState(null,'',ROOT+hh(14));P={e:14,k:'',slug:''}}}   // вернувшийся читатель 2014 попадает на главную 2014, как раньше
 const k=P.k,slug=P.slug;document.body.classList.remove('land');if($('#card .home')){$('#card').innerHTML='';document.body.classList.remove('open')}
 if(P.e!==ed){ed=P.e;SX=SXS[ed]}
 if(k=='translator'){document.body.classList.remove('dm','cs');document.body.classList.add('tr','open');document.body.classList.toggle('e14',ed==14);ls.set('ed',ed);curKey='';$('#nav').innerHTML=navHTML(ed);document.querySelectorAll('nav a[data-s]').forEach(a=>a.setAttribute('aria-current',a.dataset.s==='translator'));edLinks();{const t=TOOLMETA[slug=='doc'?'translator/doc':'translator'];setMeta(t.t,t.d,hh(24,'translator',slug))}TR.show(slug);return}
 if(k=='dmscreen'){document.body.classList.remove('cs','tr');document.body.classList.add('dm','open');document.body.classList.toggle('e14',ed==14);ls.set('ed',ed);curKey='';$('#nav').innerHTML=navHTML(ed);document.querySelectorAll('nav a[data-s]').forEach(a=>a.setAttribute('aria-current',a.dataset.s==='dmscreen'));edLinks();{const t=TOOLMETA.dmscreen;setMeta(t.t,t.d,hh(24,'dmscreen'))}DM.show();return}
 if(k=='sheet'){document.body.classList.add('cs','open');document.body.classList.remove('dm','tr');document.body.classList.toggle('e14',ed==14);ls.set('ed',ed);curKey='';$('#nav').innerHTML=navHTML(ed);document.querySelectorAll('nav a[data-s]').forEach(a=>a.setAttribute('aria-current',a.dataset.s==='sheet'));edLinks();{const t=TOOLMETA.sheet;setMeta(t.t,t.d,hh(24,'sheet'))}CS.show();return}

 document.body.classList.remove('dm','cs','tr');
 if(!k){land();return}
 const s=k,key=ed+s;
 document.body.classList.toggle('e14',ed==14);ls.set('ed',ed);
 if(key!==curKey){curKey=key;sec=s;$('#nav').innerHTML=navHTML(ed);$('#q').value='';$('#list').innerHTML='';$('#fl').innerHTML='';$('#fn').textContent='';const d=await load(s);if(curKey!==key)return;data=d;filters();render();document.querySelectorAll('nav a[data-s]').forEach(a=>a.setAttribute('aria-current',a.dataset.s===s))}
 edLinks();
 const m=slug&&data.find(x=>x.slug===slug);
 document.querySelectorAll('#list a').forEach(a=>a.setAttribute('aria-current',a.dataset.slug===slug));
 if(!m){$('#card').innerHTML=sectionCard(ed,sec);setMeta(sectionTitle(ed,sec,data.length),sectionDesc(ed,sec,data.length),hh(ed,sec));document.body.classList.remove('open');return}
 $('#card').innerHTML=pageCard(ed,sec,m);Dice.linkify($('#card'));setMeta(entryTitle(ed,sec,m,dupsOf()),entryDesc(ed,sec,m),hh(ed,sec,m.slug));document.body.classList.add('open');$('main').scrollTop=0;
 const a=$(`#list a[data-slug="${CSS.escape(slug)}"]`);a&&a.scrollIntoView({block:'nearest'});xref(m,location.pathname);addPic(m,location.pathname);autolink(m,location.pathname);DM.cardActions&&DM.cardActions(m,ed,sec)}

const RUNES=['dwarvish','elvish','draconic','infernal'];let runeI=0;
function land(){const b=document.body;b.classList.add('land','open');b.classList.toggle('e14',ed==14);ls.set('ed',ed);curKey='';
 $('#nav').innerHTML=navHTML(ed);document.querySelectorAll('nav a[data-s]').forEach(a=>a.setAttribute('aria-current',a.dataset.s==='home'));
 $('#card').innerHTML=HOME;homeLinks();edLinks();
 const N=HOMEN[ed],fmtN=n=>n.toLocaleString('ru-RU');
 $('#card').querySelectorAll('[data-n]').forEach(x=>{const n=N[ed==14&&x.dataset.n=='species'?'race':x.dataset.n];x.textContent=n==null?'':fmtN(n)});
 const tot=Object.values(N).reduce((a,c)=>a+c,0);$('#tocsub').textContent='Редакция '+EDK(ed)+': '+fmtN(tot)+' записей';
 $('#card').querySelectorAll('.eds a').forEach(a=>a.setAttribute('aria-current',+a.dataset.e==ed));
 runeI=ed==14?1:0;const r=$('#runes');r.className='runes'+(runeI?' f-'+RUNES[runeI]:'');
 {const t=HOMEMETA[ed];setMeta(t.title,t.description,hh(ed))}$('main').scrollTop=0}
$('#card').addEventListener('click',e=>{const t=e.target.closest('#runes,#hs,[data-q]');if(!t)return;
 if(t.id=='runes'){runeI=(runeI+1)%RUNES.length;t.className='runes'+(runeI?' f-'+RUNES[runeI]:'');t.style.animation='none'}
 else window.GSearch&&GSearch.open(t.dataset.q||'')});
['nof','nol'].forEach(c=>ls.get(c)=='1'&&document.body.classList.add(c));
document.addEventListener('click',e=>{const b=e.target.closest('[data-col]');if(!b)return;const c='no'+b.dataset.col,on=document.body.classList.toggle(c);ls.set(c,on?'1':'0')});
$('#q').addEventListener('input',render);
$('#sort').addEventListener('change',e=>{sortI=+e.target.value;$('#list').scrollTop=0;render()});
$('#dir').addEventListener('click',()=>{desc=!desc;$('#dir').textContent=desc?'↓':'↑';$('#list').scrollTop=0;render()});
$('#fl').addEventListener('change',e=>{const t=e.target,d=t.dataset;if(d.all!==undefined)flt[d.all].all=t.checked;else if(d.j!==undefined){const i=+d.i,v=opts[i][+d.j];t.checked?flt[i].s.add(v):flt[i].s.delete(v)}else return;render()});
$('#reset').addEventListener('click',()=>{flt.forEach(o=>{o.s.clear();o.all=false});$('#fl').querySelectorAll('input').forEach(x=>x.checked=false);render()});
$('#ftoggle').addEventListener('click',()=>document.body.classList.add('fshow'));$('#fdone').addEventListener('click',()=>document.body.classList.remove('fshow'));
AutoLinks.bindTips($('#card'));
// переходы по ссылкам внутри сайта — без перезагрузки; Ctrl/⌘/Shift-клик, средняя кнопка и «открыть в новой вкладке» работают как у обычной ссылки
document.addEventListener('click',e=>{
 if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
 const a=e.target.closest&&e.target.closest('a[href]');if(!a||(a.target&&a.target!='_self')||a.hasAttribute('download'))return;
 if(!parseHref(a.getAttribute('href')))return;
 e.preventDefault();go(a.getAttribute('href'))});
addEventListener('popstate',()=>route());
route();
$('#back').addEventListener('click',()=>{document.body.classList.remove('open');history.replaceState(null,'',ROOT+hh(ed,sec))});
