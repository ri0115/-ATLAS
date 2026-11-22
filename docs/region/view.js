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
const PREFS="北海道,青森県,岩手県,宮城県,秋田県,山形県,福島県,茨城県,栃木県,群馬県,埼玉県,千葉県,東京都,神奈川県,新潟県,富山県,石川県,福井県,山梨県,長野県,岐阜県,静岡県,愛知県,三重県,滋賀県,京都府,大阪府,兵庫県,奈良県,和歌山県,鳥取県,島根県,岡山県,広島県,山口県,徳島県,香川県,愛媛県,高知県,福岡県,佐賀県,長崎県,熊本県,大分県,宮崎県,鹿児島県,沖縄県".split(",");
PREFS.forEach((name,i)=>$("region-pref").add(new Option(name,String(i+1).padStart(2,"0"))));
$("region-pref").addEventListener("change",()=>{
 const pref=$("region-pref").value;
 $("region-area").replaceChildren(new Option("都道府県全体",""));
 $("region-area").disabled=true;
 const link=document.querySelector('a[href="../#profile"]');
 if(link)link.href="../#profile";
 const notice=document.getElementById("region-selection-notice");
 if(notice)notice.textContent=pref?PREFS[Number(pref)-1]+"を選択しました。二次医療圏の取得には認証APIとの接続が必要です。":"都道府県を選択してください。";
});
const TRANSFER="atlas.region.selection.v1";
const btn=$("region-connect"),spinner=$("region-spinner"),status=$("region-status");
function busy(on,message){btn.disabled=on;spinner.hidden=!on;status.textContent=message}
btn.addEventListener("click",()=>{
 const pref=$("region-pref").value,area=$("region-area").value;
 if(!pref){status.textContent="先に都道府県を選択してください。";$("region-pref").focus();return}
 sessionStorage.setItem(TRANSFER,JSON.stringify({pref,area,at:Date.now()}));
 busy(true,"認証付きデータに接続しています…");
 location.assign("../#profile");
});
const pending=sessionStorage.getItem(TRANSFER);
if(pending){try{const x=JSON.parse(pending);if(Date.now()-x.at<1800000&&x.pref){$("region-pref").value=x.pref;status.textContent="選択した地域："+PREFS[Number(x.pref)-1]+"。データ接続待ち";}}catch{}}
document.querySelectorAll("[data-basis]").forEach(b=>b.addEventListener("click",()=>{state.basis=b.dataset.basis;state.page=0;document.querySelectorAll("[data-basis]").forEach(x=>x.classList.toggle("active",x===b));drawAll()}));
$("region-search").addEventListener("input",e=>{state.search=e.target.value;state.page=0;drawAll()});
$("region-prev").addEventListener("click",()=>{state.page--;drawAll()});
$("region-next").addEventListener("click",()=>{state.page++;drawAll()});
})();