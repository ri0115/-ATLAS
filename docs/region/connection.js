"use strict";
(()=>{
 const status=document.getElementById("region-status"),button=document.getElementById("region-connect");
 const root=document.getElementById("region-all"),spinner=document.getElementById("region-spinner");
 let result=null;try{result=JSON.parse(sessionStorage.getItem("atlas.region.result.v1")||"null")}catch{}
 sessionStorage.removeItem("atlas.region.result.v1");
 if(!result||!Array.isArray(result.rows)||Date.now()-result.at>1800000){status.textContent="地域を選択して調べると、認証後にこの画面へ戻ります";return}
 spinner.hidden=true;button.disabled=false;
 status.textContent=result.regionName+"｜人口当たり全国平均比の分析結果 "+result.rows.length+"件（取得対象の一部）";
 const description=document.createElement("p");description.className="region-muted";description.textContent="既存APIによる参考換算額ベースの地域特化分析です。算定回数の全国順位・4種TOP30とは異なります。";
 root.replaceChildren(description);
 for(const x of result.rows){
  const row=document.createElement("div");row.className="region-row";
  const name=document.createElement("div");name.textContent=x.name+"（"+x.code+"）";
  const ratio=document.createElement("div");ratio.textContent="人口当たり全国平均比 "+(Number.isFinite(x.nationalIndex)?x.nationalIndex.toFixed(1):"—");
  const rank=document.createElement("div");rank.textContent="分析順位 "+(x.rank??"—");
  const amount=document.createElement("div");amount.textContent=Number.isFinite(x.amount)?Math.round(x.amount).toLocaleString("ja-JP")+"円":"—";
  row.append(name,ratio,rank,amount);root.append(row);
 }
 document.querySelectorAll("#raw-high,#raw-low,#pop-high,#pop-low").forEach(el=>el.textContent="算定回数の地域別比較APIは未接続です");
 document.getElementById("region-paging").hidden=true;
})();
