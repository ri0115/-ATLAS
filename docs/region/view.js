"use strict";
/* Regional UI only renders validated aggregate payloads from the protected API.
   It deliberately does not fetch or embed private records in GitHub Pages. */
(()=>{
const $=id=>document.getElementById(id),state={data:null,basis:"raw",page:0,size:50,search:""};
const number=x=>Number.isFinite(x)?x.toLocaleString("ja-JP",{maximumFractionDigits:2}):"—";
const ratio=x=>Number.isFinite(x)?x.toFixed(1):"—";
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n}
function link(item){const a=node("a",item.name||item.code);a.href="../#procedure";a.title="診療行為検索を開く";return a}
function line(item,basis){const m=item.metrics[basis],row=node("div","","region-row"),name=node("div");name.append(link(item),node("div",item.code,"region-muted"));row.append(name,node("div",ratio(m.index)+" / 100","region-number"),node("div",m.rank+"位 / "+m.eligible+"地域（下位"+m.worstRank+"位）","region-number"),node("div",number(item.count)+" 回","region-number region-amount"));return row}
function list(id,items,basis){const root=$(id);root.replaceChildren();if(!items.length){root.textContent="比較可能な項目はありません";return}for(const x of items)root.append(line(x,basis))}
function draw(){const d=state.data;if(!d)return;list("raw-high",d.top.rawHigh,"raw");list("raw-low",d.top.rawLow,"raw");list("pop-high",d.top.populationHigh,"population");list("pop-low",d.top.populationLow,"population");drawAll()}
function drawAll(){const root=$("region-all");if(!state.data)return;const q=state.search.normalize("NFKC").toLowerCase(),all=state.data.all.filter(x=>!q||(x.code+" "+x.name+" "+x.category).normalize("NFKC").toLowerCase().includes(q));const basis=state.basis;all.sort((a,b)=>Math.abs((b.metrics[basis].index??100)-100)-Math.abs((a.metrics[basis].index??100)-100));const pages=Math.max(1,Math.ceil(all.length/state.size));state.page=Math.min(state.page,pages-1);root.replaceChildren();for(const item of all.slice(state.page*state.size,(state.page+1)*state.size))root.append(line(item,basis));if(!all.length)root.textContent="該当する診療報酬がありません";$("region-paging").hidden=all.length<=state.size;$("region-page").textContent=(state.page+1)+" / "+pages+"（"+number(all.length)+"件）";$("region-prev").disabled=state.page===0;$("region-next").disabled=state.page>=pages-1}
function accept(payload){const result=window.AtlasRegionRanking.analyze(payload);state.data=result;state.page=0;draw();return result}
window.AtlasRegionView={accept}; // Used by a future authenticated API adapter; no global raw data.
document.querySelectorAll("[data-basis]").forEach(b=>b.addEventListener("click",()=>{state.basis=b.dataset.basis;state.page=0;document.querySelectorAll("[data-basis]").forEach(x=>x.classList.toggle("active",x===b));drawAll()}));
$("region-search").addEventListener("input",e=>{state.search=e.target.value;state.page=0;drawAll()});
$("region-prev").addEventListener("click",()=>{state.page--;drawAll()});
$("region-next").addEventListener("click",()=>{state.page++;drawAll()});
})();