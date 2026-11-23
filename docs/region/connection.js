"use strict";
(()=>{
 const $=id=>document.getElementById(id),status=$("region-status"),button=$("region-connect"),spinner=$("region-spinner"),root=$("region-all"),paging=$("region-paging"),pageText=$("region-page");
 let payload=null;try{payload=JSON.parse(sessionStorage.getItem("atlas.region.result.v1")||"null")}catch{}
 sessionStorage.removeItem("atlas.region.result.v1");
 if(!payload||!Array.isArray(payload.rows)||Date.now()-payload.at>1800000){
  status.textContent="都道府県を選び「調べる」を押してください。認証後はこのページへ戻ります。";
  return;
 }
 spinner.hidden=true;button.disabled=false;
 const rows=payload.rows,search=$("region-search");let page=0;const pageSize=30;
 const heading=document.createElement("p");heading.className="region-muted";
 heading.textContent="既存の認証APIによる参考換算額ベースの分析です。算定回数の全国順位・4種類のTOP30とは異なります。";
 function draw(){
  const q=search.value.normalize("NFKC").toLowerCase().trim();
  const matches=rows.filter(x=>(x.name+" "+x.code+" "+x.category).normalize("NFKC").toLowerCase().includes(q));
  const totalPages=Math.max(1,Math.ceil(matches.length/pageSize));page=Math.min(page,totalPages-1);
  root.replaceChildren(heading);
  for(const x of matches.slice(page*pageSize,(page+1)*pageSize)){
   const row=document.createElement("div");row.className="region-row";
   const name=document.createElement("div");name.textContent=x.name+"（"+x.code+"）";
   const index=document.createElement("div");index.className="region-number";index.textContent="全国比 "+(Number.isFinite(x.nationalIndex)?x.nationalIndex.toFixed(1):"—");
   const rank=document.createElement("div");rank.className="region-number";rank.textContent="分析順位 "+(x.rank??"—");
   const amount=document.createElement("div");amount.className="region-number region-amount";amount.textContent=Number.isFinite(x.amount)?Math.round(x.amount).toLocaleString("ja-JP")+" 円":"—";
   row.append(name,index,rank,amount);root.append(row);
  }
  if(!matches.length)root.append(document.createTextNode("検索条件に一致する項目がありません"));
  paging.hidden=matches.length<=pageSize;pageText.textContent=(page+1)+" / "+totalPages+"（"+matches.length+"件）";
  $("region-prev").disabled=page===0;$("region-next").disabled=page>=totalPages-1;
 }
 search.addEventListener("input",()=>{page=0;draw()});
 // Capture paging clicks before the provisional view.js handler.
 for(const [id,delta] of [["region-prev",-1],["region-next",1]])$(id).addEventListener("click",e=>{e.stopImmediatePropagation();page=Math.max(0,page+delta);draw()},true);
 status.textContent=payload.regionName+"｜認証済みデータ "+rows.length+"件を取得しました";
 for(const id of ["raw-high","raw-low","pop-high","pop-low"])$(id).textContent="算定回数の地域別比較APIは未接続です";
 draw();
})();
