"use strict";
(()=>{
const $=id=>document.getElementById(id);
const PREFS="北海道,青森県,岩手県,宮城県,秋田県,山形県,福島県,茨城県,栃木県,群馬県,埼玉県,千葉県,東京都,神奈川県,新潟県,富山県,石川県,福井県,山梨県,長野県,岐阜県,静岡県,愛知県,三重県,滋賀県,京都府,大阪府,兵庫県,奈良県,和歌山県,鳥取県,島根県,岡山県,広島県,山口県,徳島県,香川県,愛媛県,高知県,福岡県,佐賀県,長崎県,熊本県,大分県,宮崎県,鹿児島県,沖縄県".split(",");
PREFS.forEach((name,i)=>$("region-pref").add(new Option(name,String(i+1).padStart(2,"0"))));
let areaCatalog;
async function loadAreas(){
 if(!areaCatalog)areaCatalog=(async()=>{
  const res=await fetch("../assets/medical-areas-330.svg",{credentials:"same-origin"});if(!res.ok)throw Error("医療圏一覧を取得できません");
  const xml=new DOMParser().parseFromString(await res.text(),"image/svg+xml"),map=new Map();
  for(const n of xml.querySelectorAll("[data-code]")){
   const code=n.getAttribute("data-code"),name=n.getAttribute("data-name")||n.querySelector("title")?.textContent||n.getAttribute("aria-label");
   if(/^[0-9]{4}$/.test(code)&&name)map.set(code,name.trim());
  }
  if(map.size!==330)throw Error("医療圏一覧の照合に失敗しました（"+map.size+"件）");
  return map;
 })().catch(e=>{areaCatalog=null;throw e});
 return areaCatalog;
}
$("region-pref").addEventListener("change",async()=>{
 const pref=$("region-pref").value,area=$("region-area"),notice=$("region-selection-notice");
 area.replaceChildren(new Option("都道府県全体",""));area.disabled=true;
 if(!pref){notice.textContent="都道府県を選択してください。";return}
 notice.textContent="二次医療圏一覧を読み込み中…";
 try{const map=await loadAreas();if($("region-pref").value!==pref)return;
 for(const [code,name] of [...map].sort((a,b)=>a[0].localeCompare(b[0])))if(code.startsWith(pref))area.add(new Option(name,code));
 area.disabled=area.options.length<2;notice.textContent=area.disabled?"該当する医療圏がありません":"二次医療圏を選択してください。";
 }catch(e){if($("region-pref").value===pref)notice.textContent=e.message}
});
const TRANSFER="atlas.region.selection.v1";
const btn=$("region-connect"),spinner=$("region-spinner"),status=$("region-status");
function busy(on,message){btn.disabled=on;spinner.hidden=!on;status.textContent=message}
btn.addEventListener("click",()=>{
 const pref=$("region-pref").value,area=$("region-area").value;
 if(!pref){status.textContent="先に都道府県を選択してください。";$("region-pref").focus();return}
 sessionStorage.setItem(TRANSFER,JSON.stringify({pref,area,scope:$("region-scope").value,at:Date.now()}));
 busy(true,"地域診療ダッシュボードに接続しています…");
 location.assign("../#profile");
});
const pending=sessionStorage.getItem(TRANSFER);
if(pending){try{const x=JSON.parse(pending);if(Date.now()-x.at<1800000&&x.pref){$("region-pref").value=x.pref;status.textContent="選択した地域："+PREFS[Number(x.pref)-1]+"。データ接続待ち";}}catch{}}

})();