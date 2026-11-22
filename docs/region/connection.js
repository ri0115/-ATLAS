"use strict";
(()=>{
const $=id=>document.getElementById(id),key="atlas.region.session.v1",selection="atlas.region.selection.v1";
let auth=null;
try{auth=JSON.parse(sessionStorage.getItem(key)||"null")}catch{}
sessionStorage.removeItem(key);
if(!auth||!auth.token||!auth.proof||!Number.isFinite(auth.exp)||auth.exp*1000<=Date.now())return;
const status=$("region-status"),spinner=$("region-spinner"),button=$("region-connect"),pref=$("region-pref"),area=$("region-area");
let loading=false;
function setLoading(value,message){loading=value;spinner.hidden=!value;button.disabled=value;status.textContent=message}
async function api(path){if(auth.exp*1000<=Date.now())throw Error("認証期限が切れました。再接続してください");const c=new AbortController(),timer=setTimeout(()=>c.abort(),25000);try{const r=await fetch("https://reimbursement-atlas-gateway.vercel.app"+path,{headers:{Authorization:"Bearer "+auth.token,"X-Atlas-Proof":auth.proof},cache:"no-store",credentials:"omit",signal:c.signal});if(!r.ok)throw Error("API応答 "+r.status);return await r.json()}finally{clearTimeout(timer)}}
async function areas(){if(!pref.value)return;area.disabled=true;area.replaceChildren(new Option("都道府県全体",""));try{const d=await api("/v1/areas?pref="+encodeURIComponent(pref.value));for(const a of d.areas||[])area.add(new Option(a.name,a.code));area.disabled=false;status.textContent="医療圏を選択して「調べる」を押してください"}catch(e){status.textContent="医療圏の取得に失敗しました："+e.message}}
pref.addEventListener("change",areas);
button.addEventListener("click",async()=>{
 if(loading)return;
 if(!pref.value){status.textContent="都道府県を選択してください";return}
 const region=area.value||pref.value,grain=area.value?"secondary":"pref";
 setLoading(true,"診療報酬を集計しています…");
 try{
  const d=await api("/v1/region-profile?"+new URLSearchParams({region,grain,scope:"include",mode:"highlights"}));
  if(!d.top)throw Error("集計結果の形式が未対応です");
  status.textContent="ランキングを取得しました";
  // API response renderer is enabled only after endpoint contract is confirmed.
  for(const [id,key] of [["raw-high","rawHigh"],["raw-low","rawLow"],["pop-high","populationHigh"],["pop-low","populationLow"]]){
   const target=$(id);target.replaceChildren();
   for(const r of d.top[key]||[]){const item=document.createElement("div");item.className="region-row";item.textContent=r.name+"（"+r.code+"）　全国平均比 "+(r.index??"—")+"　順位 "+(r.rank??"—")+"/"+(r.comparable??"—");target.append(item)}
   if(!target.children.length)target.textContent="表示可能な項目がありません";
  }
 }catch(e){status.textContent="集計APIの接続待ち："+e.message}finally{setLoading(false,status.textContent)}
});
let chosen;try{chosen=JSON.parse(sessionStorage.getItem(selection)||"null")}catch{}
if(chosen?.pref){pref.value=chosen.pref;areas().then(()=>{if(chosen.area)area.value=chosen.area})}
status.textContent="認証済み。地域を選択してください";
})();