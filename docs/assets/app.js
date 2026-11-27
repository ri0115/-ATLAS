"use strict";
const $=id=>document.getElementById(id);
const names=["profile","procedure","compare","guidebook","guide"],panes={profile:"appViewProfile",procedure:"appViewProcedure",compare:"appViewCompare",guidebook:"appViewGuidebook",guide:"appViewGuide"};
function setView(view){if(!names.includes(view))view="profile";for(const b of document.querySelectorAll(".app-top-tab")){const on=b.dataset.view===view;b.classList.toggle("is-active",on);b.setAttribute("aria-selected",String(on))}for(const v of names)$(panes[v]).hidden=v!==view;if(location.hash!=="#"+view)history.replaceState(null,"","#"+view);if(view==="compare")document.dispatchEvent(new Event("atlas-rank"));if(view==="procedure")document.dispatchEvent(new Event("atlas-procedure"));if(view==="guidebook")document.dispatchEvent(new Event("atlas-guidebook"));if(view==="profile")document.dispatchEvent(new Event("atlas-profile"))}
function setSub(sub){for(const b of document.querySelectorAll("[data-sub]"))b.classList.toggle("active",b.dataset.sub===sub);$("profileBoard").hidden=sub!=="category";$("techBoard").hidden=sub!=="tech";$("specialBoard").hidden=sub!=="special";if(sub==="tech")document.dispatchEvent(new Event("atlas-tech"));if(sub==="special")document.dispatchEvent(new Event("atlas-special"))}
function initNav(){$("region-open-shared")?.addEventListener("click",()=>{setView("profile");setSub("special");if(!connected&&!starting)connect()});if(sessionStorage.getItem("atlas.region.selection.v1")){setView("profile");setSub("special")}for(const b of document.querySelectorAll(".app-top-tab"))b.addEventListener("click",()=>setView(b.dataset.view));for(const b of document.querySelectorAll("[data-sub]"))b.addEventListener("click",()=>setSub(b.dataset.sub));window.addEventListener("hashchange",()=>setView(location.hash.slice(1)));setView(location.hash.slice(1));if(sessionStorage.getItem("atlas.region.selection.v1")){setView("profile");setSub("special")}}

const num=v=>v==null?"—":Math.round(v).toLocaleString("ja-JP"),yen=v=>v==null?"—":num(v)+" 円",pct=v=>v==null?"—":(100*v).toFixed(2)+"%",idx=v=>v==null?"—":Number(v).toFixed(2),short=v=>v==null?"—":(v/100000000).toFixed(2)+" 億円";
const el=(t,v="",c="")=>{const x=document.createElement(t);x.textContent=v;if(c)x.className=c;return x};
const BACKEND="https://reimbursement-atlas-private.vercel.app",GATEWAY="https://reimbursement-atlas-gateway.vercel.app";
const PENDING="atlas.session.v1.pending",SESSION_TTL=3600;
// Every API route uses the same production gateway.
let connected=false,starting=false,initializing=false,connectionGeneration=0,session=null,expiryTimer=null,requests=new Map();
const placeholders=new Map();
const controls=["rank-scope","compare-limit","tech-scope","tech-grain","category-region","category-area","category-scope","category-grain","category-sort","pref","area","compare-pref","compare-area","rank-level","rank-pref","basis","metric"];
function status(msg){$("connection-status").textContent=msg;$("cover-status").textContent=msg}
const encoded=u=>btoa(String.fromCharCode(...u)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const randomProof=()=>encoded(crypto.getRandomValues(new Uint8Array(32)));
const safeProof=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{43}$/.test(x);
function decodeClaims(token){try{const part=token.split(".")[0];return JSON.parse(atob(part.replace(/-/g,"+").replace(/_/g,"/")))}catch{return null}}
function clearPending(){try{sessionStorage.removeItem(PENDING)}catch{}}
function takeCallback(){if(!location.hash.startsWith("#atlas-auth="))return null;const q=new URLSearchParams(location.hash.slice(1)),token=q.get("atlas-auth"),state=q.get("state");let pending;try{pending=JSON.parse(sessionStorage.getItem(PENDING)||"null")}catch{}clearPending();const view=names.includes(pending?.view)?pending.view:"profile";const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete("atlas-preview");cleanUrl.hash=view;history.replaceState(null,"",cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
if(q.size!==2||!pending||!safeProof(state)||state!==pending.state||!safeProof(pending.proof)||!Number.isFinite(pending.at)||Date.now()-pending.at>30*60*1000||Date.now()<pending.at-30000||typeof token!=="string"||token.length>1500||!/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.test(token))return {error:"認証の確認に失敗しました。ENTERから再接続してください。"};
const claims=decodeClaims(token),now=Math.floor(Date.now()/1000);
if(!claims||claims.iss!=="reimbursement-atlas-private"||claims.aud!=="atlas-gateway-v1"||claims.state!==state||!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.exp<=now||claims.exp-claims.iat!==SESSION_TTL||claims.iat>now+30)return {error:"認証期限を確認できません。ENTERから再接続してください。"};
return {session:{token,proof:pending.proof,exp:claims.exp}}}
const redirectCallback=takeCallback();
async function api(path,signal){if(signal?.aborted)throw new DOMException("Aborted","AbortError");if(!connected||!session)throw Error("データ未接続です");if(!path.startsWith("/v1/")||path.length>512)throw Error("無効なAPIです");const g=connectionGeneration,id=crypto.randomUUID(),c=new AbortController();const abort=()=>c.abort();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;c.abort()},25000);signal?.addEventListener("abort",abort,{once:true});requests.set(id,c);try{const r=await fetch(GATEWAY+path,{method:"GET",headers:{"Authorization":"Bearer "+session.token,"X-Atlas-Proof":session.proof},credentials:"omit",cache:"no-store",redirect:"error",signal:c.signal});if(g!==connectionGeneration||c.signal.aborted)throw new DOMException("Aborted","AbortError");if(r.status===401){disconnect("認証期限が切れました。ENTERから再接続してください。");throw Error("認証期限切れ")}if(!r.ok)throw Error("データ取得エラー（"+r.status+"）");if(!r.headers.get("content-type")?.includes("application/json"))throw Error("応答形式が正しくありません");return await r.json()}catch(e){if(timedOut)throw Error("API応答がタイムアウトしました");throw e}finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);requests.delete(id)}}
function restore(){for(const [id,nodes] of placeholders)$(id).replaceChildren(...nodes.map(n=>n.cloneNode(true)));for(const id of controls)$(id).disabled=true;for(const id of ["category-region","pref","compare-pref","rank-pref"]){const s=$(id);for(let i=s.options.length-1;i>=0;i--)if(/^\d{2}$/.test(s.options[i].value))s.remove(i);s.selectedIndex=0}for(const id of ["category-area","area","compare-area"]){$(id).replaceChildren(new Option("都道府県全体",""));} $("category-detail").hidden=true;$("v15Stack").classList.remove("atlas-live-chart");category=null}

function disconnect(msg="データ未接続｜ENTERから再開できます。"){try{sessionStorage.removeItem("atlas.region.selection.v1")}catch{}regionDashboardController?.reset();$("atlas-region-transition").classList.remove("active");connectionGeneration++;clearTimeout(expiryTimer);expiryTimer=null;session=null;clearPending();catRequest?.abort();techRequest?.abort();rankRequest?.abort();for(const c of requests.values())c.abort();requests.clear();connected=starting=initializing=false;$("connect-data").disabled=false;$("connect-data").textContent="データ接続";$("disconnect-data").disabled=true;$("connection-banner").classList.remove("atlas-connected");restore();procedureReset();gbReset();specialReset();modalityReset();compareReset();document.body.classList.remove("atlas-entered");$("cover-enter").disabled=false;$("cover-cancel").hidden=true;status(msg)}
async function connect(){if(connected||starting)return;const g=++connectionGeneration;starting=true;$("cover-enter").disabled=true;$("cover-cancel").hidden=false;$("connect-data").disabled=true;status("認証接続の準備中…");try{const state=randomProof(),proof=randomProof(),challenge=encoded(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(proof))));if(g!==connectionGeneration||!starting)return;const view=names.includes(location.hash.slice(1))?location.hash.slice(1):"profile";sessionStorage.setItem(PENDING,JSON.stringify({state,proof,view,at:Date.now()}));status("データ接続を確認しています。完了後はこの画面へ戻ります。");location.assign(BACKEND+"/atlas-session/start?"+new URLSearchParams({state,challenge}))}catch(e){if(g===connectionGeneration)disconnect("認証準備に失敗しました。ブラウザの設定を確認してENTERを押してください。")}}
async function resumeSession(){if(!redirectCallback)return;if(redirectCallback.error){status(redirectCallback.error);sessionStorage.removeItem("atlas.region.selection.v1");$("atlas-region-transition").classList.remove("active");return}session=redirectCallback.session;redirectCallback.session=null;connected=true;starting=false;const g=++connectionGeneration;$("cover-enter").disabled=true;$("cover-cancel").hidden=false;$("connect-data").disabled=true;$("disconnect-data").disabled=false;status("データ接続中…");expiryTimer=setTimeout(()=>disconnect("認証期限が切れました。ENTERから再接続してください。"),Math.max(0,session.exp*1000-Date.now()));try{await activate(g);if(g!==connectionGeneration)return;$("connect-data").textContent="認証接続済み";$("connection-banner").classList.add("atlas-connected");document.body.classList.add("atlas-entered");$("cover-cancel").hidden=true;const until=new Date(session.exp*1000).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});status("データ接続済み｜有効期限 "+until);const regionSelection=sessionStorage.getItem("atlas.region.selection.v1");if(regionSelection){try{const chosen=JSON.parse(regionSelection);if(chosen.pref&&Date.now()-chosen.at<1800000){await applyRegionalDeepLink()}else{sessionStorage.removeItem("atlas.region.selection.v1");$("atlas-region-transition").classList.remove("active")}}catch{sessionStorage.removeItem("atlas.region.selection.v1");$("atlas-region-transition").classList.remove("active")}}}catch(e){if(g===connectionGeneration)disconnect("API接続に失敗しました。ENTERから再接続してください。")}}
window.addEventListener("pagehide",()=>{session=null;for(const c of requests.values())c.abort();requests.clear();clearTimeout(expiryTimer)});
window.addEventListener("pageshow",e=>{if(e.persisted&&(connected||starting))disconnect("ENTERから再接続してください。")});

const fields={CT:"CT",MRI:"MRI",US:"超音波"};let category,catRequest,techRequest,rankRequest;
async function fillArea(pref,area){const p=$(pref),a=$(area),v=p.value;a.replaceChildren(new Option("都道府県全体",""));a.disabled=true;if(!v||v==="JP")return;const g=connectionGeneration;const r=await api("/v1/areas?pref="+encodeURIComponent(v));if(g!==connectionGeneration||!connected||p.value!==v)return;for(const x of r.areas)a.add(new Option(x.name,x.code));a.disabled=false}
function clearCategory(){category=null;for(const id of ["v15Total","v15PerCap","v15Largest","v15Unknown"])$(id).textContent="—";for(const id of ["v15Stack","v15Cats","v15LQ","v15Rows"])$(id).replaceChildren()}
const CATEGORY_PALETTE={"A_基本診療料":"#167f83","B_医学管理等":"#5b91bb","C_在宅医療":"#d49b4b","D_検査":"#5a9a69","E_画像診断":"#8979b6","F_投薬":"#bc7963","G_注射":"#3d8eae","H_リハビリテーション":"#7baf8f","I_精神科専門療法料":"#b889ad","J_処置":"#cc976d","K_手術":"#476c9a","K_輸血料":"#bc526a","L_麻酔":"#74878d","M_放射線治療":"#7b61a3","N_病理診断":"#9dae54","O_その他":"#a2a5b3"};
function renderCategory(){if(!category)return;const d=category,rows=[...d.rows],largest=[...rows].sort((a,b)=>b.amount-a.amount)[0];$("v15Total").textContent=short(d.total.amount);$("v15PerCap").textContent=yen(d.total.perCapita);$("v15Largest").textContent=largest.category.replace("_"," ")+" "+pct(largest.share);$("v15Unknown").textContent=num(d.total.suppressed)+"／"+num(d.total.noPoints);$("v15Ctx").textContent=d.name+" · "+num(d.population)+" 人 · 公費"+(d.scope==="include"?"含む":"含まない")+" · "+(d.grain==="pref"?"都道府県別原票":"医療圏別原票");$("v15Audit").textContent="全国平均比 "+idx(d.total.nationalIndex)+" · 公開値のみ";const sorted=[...rows].sort((a,b)=>b.amount-a.amount);$("v15Cats").replaceChildren();$("v15LQ").replaceChildren();$("v15Stack").replaceChildren();$("v15Stack").classList.add("atlas-live-chart");$("v15Stack").setAttribute("aria-label","A〜O区分の参考換算額構成比");for(const x of sorted){if(!(x.share>0))continue;const p=el("button","","atlas-category-segment");p.type="button";p.style.backgroundColor=CATEGORY_PALETTE[x.category]||"#9baab3";p.style.width=(x.share*100)+"%";p.title=x.category.replace("_"," ")+" · "+pct(x.share)+" · "+short(x.amount);p.setAttribute("aria-label",p.title);p.addEventListener("click",()=>procedureOpenCategory(x.category));$("v15Stack").append(p)}for(const x of sorted){const row=el("div","","profile-cat");row.style.setProperty("--category-color",CATEGORY_PALETTE[x.category]||"#9baab3");row.append(el("span","","chip"),el("span",x.category.replace("_"," "),"cat-name"),el("span",short(x.amount),"cat-value"),el("span",pct(x.share),"cat-percent"));row.dataset.procLink=x.category;row.setAttribute("role","button");row.setAttribute("tabindex","0");row.addEventListener("click",()=>procedureOpenCategory(x.category));row.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();procedureOpenCategory(x.category)}});$("v15Cats").append(row)}for(const x of [...rows].sort((a,b)=>(b.lq??-1)-(a.lq??-1))){const row=el("div","","profile-lqrow");const label=el("span","","v15-label"),dot=el("span","","atlas-category-dot");row.style.setProperty("--category-color",CATEGORY_PALETTE[x.category]||"#9baab3");label.append(dot,document.createTextNode(x.category.replace("_"," ")));row.append(label,el("span",pct(x.share)),el("span",pct(x.nationalShare)),el("b",idx(x.lq)));$("v15LQ").append(row)}const order=$("category-sort").value;if(order!=="category")rows.sort((a,b)=>(b[order]??-1)-(a[order]??-1));$("v15Rows").replaceChildren();for(const x of rows){const tr=el("tr","","atlas-category-row");[x.category.replace("_"," "),yen(x.amount),pct(x.share),yen(x.perCapita),idx(x.nationalIndex),idx(x.lq),num(x.suppressed),num(x.noPoints),num(x.missing)].forEach((v,i)=>tr.append(el("td",v,i?"right":"")));$("v15Rows").append(tr)}}
async function loadCategory(){if(!connected||initializing)return;catRequest?.abort();const c=catRequest=new AbortController();clearCategory();$("v15Ctx").textContent="読み込み中…";const code=$("category-area").value||$("category-region").value,grain=code==="JP"?$("category-grain").value:code.length===2?"pref":"secondary";try{const d=await api("/v1/categories/"+code+"?"+new URLSearchParams({scope:$("category-scope").value,grain}),c.signal);if(c.signal.aborted)return;category=d;renderCategory()}catch(e){if(!c.signal.aborted)$("v15Ctx").textContent=e.message}}
function code(p,a){return $(a).value||$(p).value}
async function loadTech(){if(!connected||initializing)return;techRequest?.abort();const c=techRequest=new AbortController(),g=connectionGeneration;modalityData=null;modalityCompare=null;$("modality-detail").hidden=true;$("tech-cards").replaceChildren();$("tech-status").textContent="読み込み中…";try{const selected=[code("pref","area"),code("compare-pref","compare-area")].filter(Boolean);const grain=selected.some(x=>x.length===4)?"secondary":$("tech-grain").value;const scope=$("tech-scope").value;$("tech-grain").disabled=selected.some(x=>x.length===4);const [a,b]=await Promise.all(selected.map((x,i)=>api("/v1/modality?"+new URLSearchParams({region:x,scope,grain,detail:i===0?"1":"0"}),c.signal)));if(c.signal.aborted||!connected||g!==connectionGeneration)return;$("tech-status").textContent=a.name+(b?" ／ "+b.name:"")+" · 2024年度 · "+(scope==="include"?"公費含む":"公費含まない")+" · "+(grain==="pref"?"都道府県別原票":"二次医療圏別原票");for(const m of Object.keys(fields)){const x=el("article","","profile-kpi");const put=(r,label)=>{const v=r.metrics[m];x.append(el("span",label),el("strong",short(v.amount)),el("p","本体 "+short(v.main.amount)+" ／ 専用加算 "+short(v.addon.amount)),el("p","人口1人当たり "+yen(v.perCapita)),el("p","全国平均比 "+idx(v.nationalIndex)+" ／ LQ "+idx(v.lq)),el("small","秘匿 "+num(v.main.suppressed+v.addon.suppressed)+" セル · 点数なし "+num(v.main.noPoints+v.addon.noPoints)+" セル"))};x.append(el("h3",fields[m]));put(a,a.name);if(b){x.append(el("hr"));put(b,b.name);x.append(el("p","差額 "+short(a.metrics[m].amount-b.metrics[m].amount)))}$("tech-cards").append(x)}modalityData=a;modalityCompare=b||null;renderModality()}catch(e){if(!c.signal.aborted&&connected&&g===connectionGeneration)$("tech-status").textContent=e.message}}
async function loadRank(){if(!connected||initializing||compareLoading||location.hash!=="#compare")return;rankRequest?.abort();const c=rankRequest=new AbortController(),g=connectionGeneration;compareData=null;compareClearMap();$("rank-list").replaceChildren();$("rank-status").textContent="読み込み中…";try{const level=$("rank-level").value,pref=level==="prefecture"?"JP":$("rank-pref").value,basis=$("basis").value,category=$("metric").value,cl=$("rank-class").value||"ALL",code=$("rank-code").value||"ALL",scope=$("rank-scope").value;const r=await api("/v1/compare/ranking?"+new URLSearchParams({level,pref,scope,category,class:cl,code,basis}),c.signal);if(c.signal.aborted||g!==connectionGeneration||!connected)return;compareData=r;compareRender(r)}catch(e){if(!c.signal.aborted&&g===connectionGeneration)$("rank-status").textContent=e.message}}
async function activate(g){initializing=true;const r=await api("/v1/prefectures");if(g!==connectionGeneration||!connected)return;if(!Array.isArray(r.prefectures)||r.prefectures.length!==47)throw Error("地域一覧エラー");for(const x of r.prefectures)for(const id of ["category-region","pref","compare-pref","rank-pref"])$(id).add(new Option(x.name,x.code));for(const id of controls)$(id).disabled=["category-area","area","compare-area","rank-pref"].includes(id);$("category-detail").hidden=false;initializing=false;await loadCategory();if(g!==connectionGeneration||!category)throw Error("初期集計エラー");if(location.hash==="#compare")await compareCatalog("ALL","ALL");if(!$("techBoard").hidden)await loadTech();procedureEnable(r.prefectures);$("guidebook-query").disabled=false;$("guidebook-search").disabled=false;specialEnable(r.prefectures);comparePrefs=r.prefectures;if(location.hash==="#procedure")procedureSearch();if(!$("specialBoard").hidden)specialLoad()}
function init(){if(sessionStorage.getItem("atlas.region.selection.v1")){$("atlas-region-transition").classList.add("active");setTimeout(()=>{if(!redirectCallback&&!connected&&!starting)connect()},150)}for(const id of ["v15Total","v15PerCap","v15Largest","v15Unknown","v15Ctx","v15Audit","v15Stack","v15Cats","v15LQ","v15Rows","tech-cards","tech-status","rank-list","rank-status"])placeholders.set(id,[...$(id).childNodes].map(n=>n.cloneNode(true)));$("connect-data").addEventListener("click",connect);$("disconnect-data").addEventListener("click",()=>disconnect("接続を解除しました。"));$("category-region").addEventListener("change",async()=>{if(!connected)return;catRequest?.abort();clearCategory();$("category-grain").disabled=$("category-region").value!=="JP";try{await fillArea("category-region","category-area");loadCategory()}catch(e){if(connected)$("v15Ctx").textContent=e.message}});for(const id of ["category-area","category-scope","category-grain"])$(id).addEventListener("change",loadCategory);$("category-sort").addEventListener("change",renderCategory);for(const [p,a] of [["pref","area"],["compare-pref","compare-area"]]){$(p).addEventListener("change",async()=>{if(!connected)return;techRequest?.abort();try{await fillArea(p,a);loadTech()}catch(e){if(connected)$("tech-status").textContent=e.message}});$(a).addEventListener("change",loadTech)}$("rank-level").addEventListener("change",()=>{$("rank-pref").disabled=!connected||$("rank-level").value==="prefecture";loadRank()});for(const id of ["rank-pref","basis","rank-scope"])$(id).addEventListener("change",loadRank);document.addEventListener("atlas-tech",loadTech);document.addEventListener("atlas-rank",loadRank);document.addEventListener("atlas-profile",()=>{if(!category&&connected)loadCategory()});initNav()}
document.addEventListener("DOMContentLoaded",init);
let procCategory="ALL",procPage=0,procTotal=0,procSelected=null,procSearchRequest=null,procDetailRequest=null,procSearchVersion=0,procAreaVersion=0;
const procControls=["procedure-query","procedure-search","procedure-all","procedure-pref","procedure-area","procedure-grain","procedure-scope","procedure-setting","procedure-addon"];
function procedureReset(){procSearchVersion++;procAreaVersion++;procSearchRequest?.abort();procDetailRequest?.abort();procSelected=null;procPage=procTotal=0;procCategory="ALL";for(const id of procControls)$(id).disabled=true;for(const b of document.querySelectorAll("[data-proc-cat]")){b.disabled=true;b.setAttribute("aria-pressed","false")}$("procedure-prev").disabled=$("procedure-next").disabled=true;$("procedure-pref").replaceChildren(new Option("全国","JP"));$("procedure-area").replaceChildren(new Option("都道府県全体",""));$("procedure-results").replaceChildren();$("procedure-query").value="";$("procedure-help").textContent="「データ接続」後に検索できます。";$("procedure-page").textContent="—";$("procedure-filter").textContent="A〜O 全区分";$("procedure-body").hidden=true;$("procedure-empty").hidden=false;$("procedure-detail-status").textContent="検索結果から項目を選択してください";for(const id of ["procedure-class","procedure-name","procedure-code-label","procedure-context","procedure-audit","procedure-points","procedure-point-state","procedure-count","procedure-amount","procedure-capita","procedure-index","procedure-variants","procedure-rank","procedure-rule-note","procedure-curated","procedure-references","procedure-data-note"])$(id).replaceChildren()}
function procedureEnable(prefs){$("procedure-pref").replaceChildren(new Option("全国","JP"));for(const p of prefs)$("procedure-pref").add(new Option(p.name,p.code));for(const id of procControls)$(id).disabled=id==="procedure-area";for(const b of document.querySelectorAll("[data-proc-cat]"))b.disabled=false;$("procedure-help").textContent="9,275コード｜名称・分類・コード検索"}
function procedureCategory(cat){procCategory=cat;procPage=0;for(const b of document.querySelectorAll("[data-proc-cat]"))b.setAttribute("aria-pressed",String(b.dataset.procCat===cat));$("procedure-filter").textContent=cat==="ALL"?"A〜O 全区分":cat.replace("_"," ");procedureSearch()}
function procedureOpenCategory(cat){if(!connected)return;setView("procedure");$("procedure-query").value="";procedureCategory(cat)}
async function procedureSearch(){if(!connected||initializing)return;const serial=++procSearchVersion;procSearchRequest?.abort();const c=procSearchRequest=new AbortController();$("procedure-results").replaceChildren();$("procedure-help").textContent="検索中…";$("procedure-prev").disabled=$("procedure-next").disabled=true;try{const r=await api("/v1/procedures?"+new URLSearchParams({q:$("procedure-query").value,category:procCategory,page:String(procPage)}),c.signal);if(c.signal.aborted||serial!==procSearchVersion||!connected)return;procTotal=r.total; $("procedure-help").textContent=num(r.total)+" 件の診療行為";$("procedure-page").textContent=r.total?(r.page+1)+" / "+Math.ceil(r.total/r.pageSize):"0 件";$("procedure-prev").disabled=procPage===0;$("procedure-next").disabled=(procPage+1)*r.pageSize>=r.total;for(const x of r.rows){const b=el("button","","atlas-result"+(procSelected===x.code?" selected":""));b.type="button";b.append(el("strong",x.name),el("small",x.code+" · "+(x.classCode||"分類番号未照合")+" · "+(x.points==null?"固定点数なし":num(x.points)+" 点")));b.addEventListener("click",()=>{procSelected=x.code;for(const n of $("procedure-results").children)n.classList.remove("selected");b.classList.add("selected");procedureDetail()});$("procedure-results").append(b)}if(!r.total)$("procedure-results").append(el("p","該当する診療行為がありません。検索条件を変更してください。","atlas-caption"))}catch(e){if(!c.signal.aborted&&serial===procSearchVersion&&connected)$("procedure-help").textContent=e.message}}
function procedureRow(tbody,values){const tr=el("tr");for(const v of values)tr.append(el("td",v));tbody.append(tr)}
const procedureSettingLabel=x=>({inpatient:"入院",outpatient:"外来",unknown:"原票区分なし"}[x]||x);
async function procedureDetail(){if(!connected||!procSelected)return;procDetailRequest?.abort();const c=procDetailRequest=new AbortController(),selected=procSelected,g=connectionGeneration;const region=$("procedure-area").value||$("procedure-pref").value,grain=region==="JP"?$("procedure-grain").value:region.length===2?"pref":"secondary";$("procedure-detail-status").textContent="読み込み中…";$("procedure-body").hidden=true;$("procedure-empty").hidden=false;try{const d=await api("/v1/procedures/"+selected+"?"+new URLSearchParams({scope:$("procedure-scope").value,grain,region,setting:$("procedure-setting").value,addon:$("procedure-addon").value}),c.signal);if(c.signal.aborted||g!==connectionGeneration||!connected||selected!==procSelected)return;const p=d.procedure,s=d.summary;$("procedure-class").textContent=p.category.replace("_"," ")+" · "+(p.classCode||"分類番号未照合");$("procedure-name").textContent=p.name;$("procedure-code-label").textContent="9桁コード "+p.code+" · "+(p.className||"分類見出し未照合");$("procedure-context").textContent=d.regionName+" · "+num(s.population)+" 人 · 公費"+(d.scope==="include"?"含む":"含まない")+" · "+(grain==="pref"?"都道府県別原票":"二次医療圏別原票");$("procedure-audit").textContent="公開 "+num(s.published)+" / 秘匿 "+num(s.suppressed)+" / 欠測 "+num(s.missing)+" / 点数なし "+num(s.noPoints);$("procedure-points").textContent=p.points==null?"—":num(p.points)+" 点";$("procedure-point-state").textContent=p.pointState;$("procedure-count").textContent=num(s.count);$("procedure-amount").textContent=yen(s.amount);$("procedure-capita").textContent=yen(s.perCapita);$("procedure-index").textContent="全国平均比 "+idx(s.nationalIndex);$("procedure-variants").replaceChildren();for(const x of d.variants)procedureRow($("procedure-variants"),[procedureSettingLabel(x.setting),x.addon===1?"加算":"通常",x.points==null?"—":num(x.points),num(x.count),yen(x.amount),num(x.suppressed),num(x.noPoints)]);$("procedure-rank").replaceChildren();d.ranking.forEach((x,i)=>procedureRow($("procedure-rank"),[String(i+1),x.name,num(x.count),yen(x.amount),yen(x.perCapita),idx(x.nationalIndex),num(x.suppressed)]));$("procedure-rule-note").textContent=d.rule.note;$("procedure-curated").replaceChildren();if(d.rule.curated){const v=d.rule.curated,card=el("div","","atlas-curated");card.append(el("strong","主要条件の原典照合（全要件の監査ではありません）"));for(const [key,label] of [["scope","対象"],["eligibility","適用条件"],["frequency","回数・間隔"],["combination","併算定"],["addition","加算"],["facility","施設基準"],["notes","注意事項"]])if(v[key])card.append(el("p",label+"： "+v[key]));$("procedure-curated").append(card)}$("procedure-references").replaceChildren();for(const x of d.rule.references){const det=el("details"),sum=el("summary",x.title+"｜PDF "+x.page+"ページ"),note=el("p",x.verification+" · "+x.file,"atlas-caption");det.append(sum,note,el("strong",x.heading||""),el("pre",x.excerpt||""));$("procedure-references").append(det)}if(!d.rule.references.length)$("procedure-references").append(el("p","見出しの参照先は未照合です。要件が存在しないという意味ではありません。","atlas-caption"));$("procedure-data-note").textContent=d.note+" 全国原票の公開算定回数（地域合算とは別集計）： "+num(d.officialNational.count)+"。";$("procedure-detail-status").textContent=d.sourceRows+" 件の原票行 · 2024年度";$("procedure-empty").hidden=true;$("procedure-body").hidden=false}catch(e){if(!c.signal.aborted&&connected&&g===connectionGeneration)$("procedure-detail-status").textContent=e.message}}
function procedureInit(){for(const b of document.querySelectorAll("[data-proc-cat]"))b.addEventListener("click",()=>procedureCategory(b.dataset.procCat));$("procedure-all").addEventListener("click",()=>procedureCategory("ALL"));$("procedure-search").addEventListener("click",()=>{procPage=0;procedureSearch()});$("procedure-query").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();procPage=0;procedureSearch()}});$("procedure-prev").addEventListener("click",()=>{if(procPage>0){procPage--;procedureSearch()}});$("procedure-next").addEventListener("click",()=>{if((procPage+1)*25<procTotal){procPage++;procedureSearch()}});$("procedure-pref").addEventListener("change",async()=>{if(!connected)return;const g=connectionGeneration,v=++procAreaVersion;procDetailRequest?.abort();$("procedure-grain").disabled=$("procedure-pref").value!=="JP";try{await fillArea("procedure-pref","procedure-area");if(g===connectionGeneration&&v===procAreaVersion)procedureDetail()}catch(e){if(g===connectionGeneration)$("procedure-detail-status").textContent=e.message}});for(const id of ["procedure-area","procedure-grain","procedure-scope","procedure-setting","procedure-addon"])$(id).addEventListener("change",procedureDetail);document.addEventListener("atlas-procedure",()=>{if(connected&&!$("procedure-results").children.length)procedureSearch()})}
document.addEventListener("DOMContentLoaded",procedureInit);


let specialBasis="excess",specialRequest=null,specialVersion=0;
const specialControls=["special-pref","special-area","special-scope","special-category","special-min"];
let specialAreaLoading=false,specialSelectionVersion=0,specialSubmittedKey=null,regionSearchBusy=false,regionSearchSerial=0;
function regionSelection(){
 const pref=$("special-pref").value,area=$("special-area").value,scope=$("special-scope").value;
 if(!/^(0[1-9]|[1-3][0-9]|4[0-7])$/.test(pref)||specialAreaLoading||area&&(!/^\d{4}$/.test(area)||!area.startsWith(pref))||!["include","exclude"].includes(scope))return null;
 const region=area||pref;return {region,scope,grain:area?"secondary":"pref"};
}
function regionSelectionKey(x){return x?x.region+":"+x.scope:null}
function syncRegionSearchButton(){const b=$("region-profile-fetch");if(b){b.disabled=!connected||initializing||regionSearchBusy||!regionSelection();b.textContent=regionSearchBusy?"集計中…":"調べる";b.style.opacity=b.disabled?".55":"1";b.style.cursor=b.disabled?"not-allowed":"pointer";b.setAttribute("aria-busy",String(regionSearchBusy))}}
function invalidateRegionSelection(){
 regionSearchSerial++;regionSearchBusy=false;specialSubmittedKey=null;specialVersion++;specialRequest?.abort();specialRequest=null;regionDashboardController?.reset();
 specialEmpty("地域を選択して「調べる」を押してください。");
 $("special-status").textContent="検索待ち";syncRegionSearchButton();
}
async function runRegionAnalysis(){
 const selected=regionSelection();if(!connected||initializing||regionSearchBusy||!selected||!regionDashboardController){syncRegionSearchButton();return false}
 const serial=++regionSearchSerial;regionSearchBusy=true;specialSubmittedKey=regionSelectionKey(selected);syncRegionSearchButton();
 try{const results=await Promise.allSettled([regionDashboardController.load(selected),specialLoad()]);return serial===regionSearchSerial&&results[0].status==="fulfilled"&&results[0].value===true&&results[1].status==="fulfilled"&&results[1].value===true}finally{if(serial===regionSearchSerial){regionSearchBusy=false;syncRegionSearchButton()}}
}

const specialLabels={excess:"超過参考換算額",lq:"地域特化指数",nationalIndex:"人口当たり全国平均比",amount:"参考換算額"};
const specialMoney=v=>v==null?"—":Math.abs(v)>=1e8?(v/1e8).toLocaleString("ja-JP",{maximumFractionDigits:2})+" 億円":(v/1e4).toLocaleString("ja-JP",{maximumFractionDigits:1})+" 万円";
function specialEmpty(msg){$("special-rows").replaceChildren();const r=el("tr"),td=el("td",msg,"atlas-special-empty");td.colSpan=8;r.append(td);$("special-rows").append(r);for(const id of ["special-total","special-eligible","special-top","special-value"])$(id).textContent="—"}
function specialReset(){regionSearchSerial++;regionSearchBusy=false;specialSelectionVersion++;specialAreaLoading=false;specialSubmittedKey=null;specialVersion++;specialRequest?.abort();specialRequest=null;for(const id of specialControls)$(id).disabled=true;for(const b of document.querySelectorAll("[data-special-mode]"))b.disabled=true;$("special-pref").replaceChildren(new Option("都道府県を選択",""));$("special-area").replaceChildren(new Option("都道府県全体",""));$("special-context").textContent="「データ接続」後に地域を選択してください。";$("special-status").textContent="データ未接続";specialEmpty("認証接続後にランキングを表示します。");syncRegionSearchButton()}
async function applyRegionalDeepLink(){
 const key="atlas.region.selection.v1",raw=sessionStorage.getItem(key);if(!raw||!connected)return;
 try{
  const x=JSON.parse(raw);
  if(!/^(0[1-9]|[1-3][0-9]|4[0-7])$/.test(x.pref)||!Number.isFinite(x.at)||Date.now()-x.at>1800000)throw Error("地域選択の有効期限が切れました");
  setView("profile");setSub("special");
  $("special-pref").value=x.pref;
  specialAreaLoading=true;syncRegionSearchButton();try{await fillArea("special-pref","special-area")}finally{specialAreaLoading=false;syncRegionSearchButton()}
  if(!connected||$("special-pref").value!==x.pref)throw Error("地域選択が中断されました");
  if(["include","exclude"].includes(x.scope))$("special-scope").value=x.scope;
  if(x.area){if(![...$("special-area").options].some(o=>o.value===x.area))throw Error("指定した二次医療圏が見つかりません");$("special-area").value=x.area;}
  await runRegionAnalysis();
 }catch(e){$("special-status").textContent="地域データ取得エラー："+e.message;status(e.message)}
 finally{sessionStorage.removeItem(key);$("atlas-region-transition").classList.remove("active")}
}
function specialEnable(prefs){$("special-pref").replaceChildren(new Option("都道府県を選択",""));for(const p of prefs)$("special-pref").add(new Option(p.name,p.code));for(const id of specialControls)$(id).disabled=id==="special-area";for(const b of document.querySelectorAll("[data-special-mode]"))b.disabled=false;$("special-context").textContent="都道府県を選択してください。";$("special-status").textContent="地域選択待ち";syncRegionSearchButton()}
function specialValue(v,b){return b==="lq"?idx(v)+" 倍":b==="nationalIndex"?idx(v):specialMoney(v)}
async function specialOpenCode(x,d){if(!connected)return;const g=connectionGeneration;procDetailRequest?.abort();procSearchRequest?.abort();procSelected=x.code;procCategory="ALL";procPage=0;$("procedure-query").value=x.code;for(const b of document.querySelectorAll("[data-proc-cat]"))b.setAttribute("aria-pressed","false");$("procedure-filter").textContent="A〜O 全区分";$("procedure-pref").value=d.region.slice(0,2);$("procedure-scope").value=d.scope;$("procedure-setting").value="all";$("procedure-addon").value="all";$("procedure-grain").disabled=true;$("procedure-body").hidden=true;$("procedure-empty").hidden=false;setView("procedure");try{await fillArea("procedure-pref","procedure-area");if(!connected||g!==connectionGeneration||procSelected!==x.code)return;$("procedure-area").value=d.grain==="secondary"?d.region:"";await Promise.all([procedureSearch(),procedureDetail()])}catch(e){if(connected)$("procedure-detail-status").textContent=e.message}}
function specialRender(d){$("special-context").textContent=d.regionName+" · "+num(d.population)+" 人 · "+(d.grain==="pref"?"都道府県別原票":"二次医療圏別原票")+" · 公費"+(d.scope==="include"?"含む":"含まない");$("special-total").textContent=specialMoney(d.regionalTotal);$("special-eligible").textContent=num(d.eligible)+" 件";$("special-top").textContent=d.rows[0]?.name||"—";$("special-value").textContent=d.rows.length?specialValue(d.rows[0][d.basis],d.basis):"—";$("special-status").textContent=specialLabels[d.basis]+"順 · "+num(d.eligible)+" 件中 "+d.rows.length+" 件 · 全区分地域総額と全国原票を基準";$("special-rows").replaceChildren();for(const x of d.rows){const tr=el("tr"),td=el("td","","atlas-special-name"),b=el("button",x.name,"atlas-special-code");b.type="button";b.addEventListener("click",()=>specialOpenCode(x,d));td.append(b,el("small",x.code+" · "+(x.classCode||"分類番号未照合")+" · "+x.category.replace("_"," ")));tr.append(el("td",x.rank),td,el("td",specialMoney(x.amount),"right"),el("td",specialMoney(x.excess),"right "+(x.excess>0?"atlas-special-positive":"atlas-special-negative")),el("td",idx(x.lq)+" 倍","right"),el("td",idx(x.nationalIndex),"right"),el("td",pct(x.share),"right"));const notes=[];if(x.suppressed)notes.push("地域秘匿 "+x.suppressed);if(x.noPoints)notes.push("地域点数なし "+x.noPoints);if(x.missing)notes.push("地域欠測 "+x.missing);if(x.nationalSuppressed)notes.push("全国秘匿あり");if(x.nationalNoPoints)notes.push("全国点数なしあり");tr.append(el("td",notes.join(" / ")||"公開値","atlas-special-note"));$("special-rows").append(tr)}if(!d.rows.length){const tr=el("tr"),td=el("td","条件を満たす診療行為はありません。最低金額や区分を変更してください。","atlas-special-empty");td.colSpan=8;tr.append(td);$("special-rows").append(tr)}}
async function specialLoad(){if(!connected||initializing||$("specialBoard").hidden||!specialSubmittedKey||specialSubmittedKey!==regionSelectionKey(regionSelection()))return;specialRequest?.abort();const pref=$("special-pref").value;if(!pref){specialEmpty("都道府県を選択してください。");return}const c=specialRequest=new AbortController(),v=++specialVersion,g=connectionGeneration,region=$("special-area").value||pref,grain=region.length===2?"pref":"secondary";specialEmpty("ランキングを計算中…");$("special-status").textContent="全コードから計算中…";try{const d=await api("/v1/specialization?"+new URLSearchParams({region,scope:$("special-scope").value,grain,basis:specialBasis,category:$("special-category").value,min:$("special-min").value}),c.signal);if(!c.signal.aborted&&connected&&v===specialVersion&&g===connectionGeneration){if(d.region!==region||d.scope!==$("special-scope").value||d.grain!==grain||!Array.isArray(d.rows))throw Error("参考換算額ランキングの応答条件が一致しません");specialRender(d);return true}return false}catch(e){if(!c.signal.aborted&&connected&&v===specialVersion){specialEmpty("ランキング取得に失敗しました。");$("special-status").textContent=e.message}return false}}
function specialInit(){
 $("special-pref").addEventListener("change",async()=>{
  const v=++specialSelectionVersion;specialAreaLoading=true;invalidateRegionSelection();
  try{await fillArea("special-pref","special-area")}catch(e){if(connected&&v===specialSelectionVersion)$("special-status").textContent=e.message}
  finally{if(v===specialSelectionVersion){specialAreaLoading=false;syncRegionSearchButton()}}
 });
 for(const id of ["special-area","special-scope"])$(id).addEventListener("change",invalidateRegionSelection);
 for(const id of ["special-category","special-min"])$(id).addEventListener("change",specialLoad);
 for(const b of document.querySelectorAll("[data-special-mode]"))b.addEventListener("click",()=>{specialBasis=b.dataset.specialMode;for(const x of document.querySelectorAll("[data-special-mode]")){x.classList.toggle("on",x===b);x.setAttribute("aria-pressed",String(x===b))}specialLoad()});
}
document.addEventListener("DOMContentLoaded",specialInit);

let modalityData=null,modalityCompare=null,activeModality="CT",activeModGroup=null;
const modNames={CT:"CT",MRI:"MRI",US:"超音波",SHARED:"共通・その他"};
function modalityReset(){modalityData=modalityCompare=null;activeModGroup=null;$("modality-detail").hidden=true;for(const id of ["modality-kpis","modality-groups","modality-codes","modality-context","modality-group-title","modality-code-title"])$(id).replaceChildren();$("tech-scope").value="include";$("tech-grain").value="secondary"}
function modKpi(label,value,note){const a=el("article","","profile-kpi");a.append(el("span",label),el("strong",value),el("small",note));return a}
async function modalityOpenCode(x,d){if(!connected)return;const g=connectionGeneration;procDetailRequest?.abort();procSearchRequest?.abort();procSelected=x.code;procCategory="ALL";procPage=0;$("procedure-query").value=x.code;$("procedure-filter").textContent="A〜O 全区分";for(const b of document.querySelectorAll("[data-proc-cat]"))b.setAttribute("aria-pressed","false");$("procedure-pref").value=d.region==="JP"?"JP":d.region.slice(0,2);$("procedure-grain").value=d.region.length===2?"pref":d.grain;$("procedure-grain").disabled=d.region!=="JP";$("procedure-scope").value=d.scope;$("procedure-setting").value="all";$("procedure-addon").value="all";$("procedure-body").hidden=true;$("procedure-empty").hidden=false;setView("procedure");try{await fillArea("procedure-pref","procedure-area");if(!connected||g!==connectionGeneration||procSelected!==x.code)return;$("procedure-area").value=d.region.length===4?d.region:"";await Promise.all([procedureSearch(),procedureDetail()])}catch(e){if(connected)$("procedure-detail-status").textContent=e.message}}
function renderModality(){const d=modalityData;if(!d||!connected)return;$("modality-detail").hidden=false;const groups=d.groups.filter(x=>activeModality==="SHARED"?["shared","other"].includes(x.kind):x.modality===activeModality&&["main","addon"].includes(x.kind));if(!groups.some(g=>g.id===activeModGroup))activeModGroup=groups[0]?.id;const title=modNames[activeModality];$("modality-context").textContent=d.name+" · "+title+" · "+(d.grain==="pref"?"都道府県原票":"医療圏原票")+" · "+(d.scope==="include"?"公費含む":"公費含まない");if(d.region.length===2&&d.grain==="secondary")$("modality-context").textContent+=" ※個別コード詳細は都道府県別原票に切り替わります。";$("modality-kpis").replaceChildren();if(activeModality==="SHARED"){for(const [label,kind] of [["CT/MRI共通診断料等","shared"],["独立項目・帰属保留","other"]]){const amount=groups.filter(x=>x.kind===kind).reduce((s,x)=>s+x.amount,0);$("modality-kpis").append(modKpi(label,short(amount),"3技術の本体＋専用加算には含めない"))}$("modality-kpis").append(modKpi("収録コード",num(groups.reduce((s,x)=>s+x.codeCount,0))+" 件","不明な技術への配賦は行わない"))}else{const v=d.metrics[activeModality];$("modality-kpis").append(modKpi("本体・検査別金額",short(v.main.amount),"本体関連コードの公開値"),modKpi("専用加算",short(v.addon.amount),"他技術へ配賦しない"),modKpi("本体＋専用加算",short(v.amount),"共通診断料・独立項目は除外"))}$("modality-group-title").textContent=activeModality==="SHARED"?"共通診断料・独立項目":"検査内容・専用加算";const max=Math.max(1,...groups.map(x=>x.amount));$("modality-groups").replaceChildren();for(const x of groups){const b=el("button","","atlas-mod-group"+(x.id===activeModGroup?" on":""));b.type="button";b.setAttribute("aria-pressed",String(x.id===activeModGroup));const head=el("div","","atlas-mod-group-head");head.append(el("strong",x.label),el("strong",short(x.amount)));const track=el("div","","atlas-mod-track"),fill=el("span");fill.style.width=(100*x.amount/max)+"%";track.append(fill);b.append(head,el("small",num(x.count)+" 回 · "+x.codeCount+" コード"+(x.suppressed?" · 秘匿 "+num(x.suppressed):"")+(x.noPoints?" · 点数なし "+num(x.noPoints):"")),track);b.addEventListener("click",()=>{activeModGroup=x.id;renderModality()});$("modality-groups").append(b)}const group=groups.find(x=>x.id===activeModGroup);$("modality-code-title").textContent=group?.label||"診療行為コード明細";$("modality-codes").replaceChildren();for(const x of group?.rows||[]){const r=el("div","","atlas-mod-code-row"),left=el("div"),b=el("button",x.name);b.type="button";b.addEventListener("click",()=>modalityOpenCode(x,d));left.append(b,el("small",x.code+" · "+(x.classCode||"分類番号未照合")+" · "+(x.points==null?"固定点数なし":num(x.points)+" 点")),el("small","公開算定 "+num(x.count)+" 回 · 秘匿 "+num(x.suppressed)+" · 点数なし "+num(x.noPoints)+" · 欠測 "+num(x.missing)));r.append(left,el("strong",short(x.amount)));$("modality-codes").append(r)}if(!group?.rows?.length)$("modality-codes").append(el("p","該当する公開算定コードはありません。","atlas-caption"))}
function extraInit(){$("cover-enter-form").addEventListener("submit",e=>{e.preventDefault();connect()});$("cover-cancel").addEventListener("click",()=>disconnect("接続を中止しました。ENTERで再開できます。"));document.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!document.body.classList.contains("atlas-entered")&&!starting&&!connected&&(e.target===document.body||e.target===document.documentElement)){e.preventDefault();connect()}});for(const id of ["tech-scope","tech-grain"])$(id).addEventListener("change",loadTech);for(const b of document.querySelectorAll("[data-modality]"))b.addEventListener("click",()=>{activeModality=b.dataset.modality;activeModGroup=null;for(const x of document.querySelectorAll("[data-modality]")){x.classList.toggle("on",x===b);x.setAttribute("aria-pressed",String(x===b))}renderModality()})}
document.addEventListener("DOMContentLoaded",extraInit);
document.addEventListener("DOMContentLoaded",resumeSession);

let compareData=null,compareCatalogRequest=null,comparePrefs=[],compareCatalogVersion=0,compareLoading=false,compareClassOptions=[],compareCodeOptions=[],compareAreaMode="map",compareBoundarySvg=null,compareBoundaryPromise=null;
const compareColors=["#dcefee","#a7d9d4","#62b9b4","#278e91","#115968"],compareMissing="#e1e7eb";
const compareFmt=(v,b)=>v==null?"—":b==="amount"?short(v):b==="count"?num(v)+" 回":b==="perCapita"?yen(v):b==="lq"?idx(v)+" 倍":idx(v);
const compareLabel={amount:"参考換算額",count:"公開算定回数",perCapita:"人口1人当たり",nationalIndex:"全国平均比",lq:"地域特化指数"};
function compareClearMap(){for(const x of $("compare-map").querySelectorAll("[data-code]")){x.style.fill=compareMissing;x.removeAttribute("aria-label")} $("compare-tiles").replaceChildren();for(const x of $("compare-map-areas").querySelectorAll("path[data-code]")){x.style.fill=compareMissing;x.removeAttribute("aria-label")}$("compare-legend").replaceChildren();$("compare-map-focus").textContent="選択した条件の地域データを表示します。";for(const id of ["compare-national","compare-count","compare-codes","compare-regions"])$(id).textContent="—"}
function compareReset(){compareCatalogVersion++;compareCatalogRequest?.abort();rankRequest?.abort();compareData=null;comparePrefs=[];compareLoading=false;compareClassOptions=[];compareCodeOptions=[];for(const id of ["rank-class-search","rank-code-search"]){$(id).value="";$(id).disabled=true}$("metric").value="ALL";$("rank-class").replaceChildren(new Option("区分全体","ALL"));$("rank-code").replaceChildren(new Option("中分類全体","ALL"));$("rank-class").disabled=$("rank-code").disabled=true;$("rank-list").replaceChildren();$("compare-selection").textContent="全診療報酬";$("rank-status").textContent="認証接続後に表示";$("compare-map").hidden=false;$("compare-tiles").hidden=true;$("compare-map-areas").hidden=true;$("compare-area-mode").hidden=true;$("compare-map-back").hidden=true;compareAreaMode="map";for(const b of document.querySelectorAll("[data-area-map-mode]")){const on=b.dataset.areaMapMode==="map";b.classList.toggle("is-active",on);b.setAttribute("aria-pressed",String(on))}compareClearMap()}
async function compareCatalog(category,cl){if(!connected)return;compareCatalogRequest?.abort();rankRequest?.abort();const c=compareCatalogRequest=new AbortController(),v=++compareCatalogVersion,g=connectionGeneration;compareLoading=true;compareData=null;compareClearMap();$("rank-list").replaceChildren();$("rank-class").disabled=$("rank-code").disabled=true;$("rank-class-search").disabled=$("rank-code-search").disabled=true;$("rank-code-search").value="";$("rank-status").textContent="分類一覧取得中…";try{const d=await api("/v1/compare/catalog?"+new URLSearchParams({category,class:cl}),c.signal);if(c.signal.aborted||v!==compareCatalogVersion||g!==connectionGeneration)return;const cs=$("rank-class"),ps=$("rank-code");cs.replaceChildren();if(category!=="TECH")cs.add(new Option("区分全体","ALL"));for(const x of d.classes)cs.add(new Option(x.code==="UNCLASSIFIED"?x.name+"（"+x.count+"件）":category==="TECH"?x.name:x.code+" "+x.name+"（"+x.count+"件）",x.code));if([...cs.options].some(x=>x.value===cl))cs.value=cl;else if(category==="TECH")cs.value="CT";else cs.value="ALL";cs.disabled=category==="ALL";ps.replaceChildren(new Option("中分類全体","ALL"));for(const x of d.codes)ps.add(new Option(x.code+" "+x.name,x.code));ps.disabled=category==="ALL"||category==="TECH";compareClassOptions=[...cs.options].map(x=>({value:x.value,text:x.textContent}));compareCodeOptions=[...ps.options].map(x=>({value:x.value,text:x.textContent}));$("rank-class-search").disabled=cs.disabled;$("rank-code-search").disabled=ps.disabled;compareFilter("rank-class","rank-class-search",compareClassOptions);compareLoading=false;await loadRank()}catch(e){if(!c.signal.aborted&&g===connectionGeneration){compareLoading=false;$("rank-status").textContent=e.message}}}
function compareFilter(selectId,inputId,options){const s=$(selectId),selected=s.value,query=$(inputId).value.normalize("NFKC").toLowerCase().trim();s.replaceChildren();for(const x of options){if(!query||x.value==="ALL"||x.value===selected||x.text.normalize("NFKC").toLowerCase().includes(query))s.add(new Option(x.text,x.value))}if([...s.options].some(x=>x.value===selected))s.value=selected;else s.selectedIndex=0} 
function compareColor(v,thresholds){if(v==null||!Number.isFinite(v))return compareMissing;let i=thresholds.findIndex(x=>v<=x);if(i<0)i=4;return compareColors[i]}
function compareDetail(x,r){$("compare-map-focus").textContent=x.name+"｜"+compareLabel[r.basis]+" "+compareFmt(x.value,r.basis)+" · "+(x.rank==null?"指標算出不可":x.rank+"位")+" · 秘匿 "+num(x.suppressed)+" / 点数なし "+num(x.noPoints)}
function compareDrill(x){if(!connected)return;if(x.code.length===2){$("rank-level").value="area";$("rank-pref").disabled=false;$("rank-pref").value=x.code;loadRank()}else{if($("rank-code").value!=="ALL"){specialOpenCode({code:$("rank-code").value},{region:x.code,scope:$("rank-scope").value,grain:"secondary"});return}$("category-region").value=x.code.slice(0,2);$("category-scope").value=$("rank-scope").value;setView("profile");setSub("category");const g=connectionGeneration;fillArea("category-region","category-area").then(()=>{if(g===connectionGeneration&&connected){$("category-area").value=x.code;$("category-grain").disabled=true;loadCategory()}}).catch(e=>$("v15Ctx").textContent=e.message)}}
function compareRankTable(){const r=compareData;if(!r)return;const ranked=r.rows.filter(x=>x.rank!==null).sort((a,b)=>a.rank-b.rank),n=$("compare-limit").value==="all"?ranked.length:Number($("compare-limit").value)||10,max=Math.max(1,...ranked.map(x=>x.value));$("rank-list").replaceChildren();for(const x of ranked.slice(0,n)){const tr=el("tr"),name=el("td"),b=el("button",x.name,"atlas-compare-region");b.type="button";b.addEventListener("click",()=>compareDrill(x));name.append(b);const td=el("td"),track=el("div","","atlas-compare-bar"),fill=el("span");fill.style.width=(100*x.value/max)+"%";fill.style.backgroundColor="#278e91";track.append(fill);td.append(track);const audit=[];if(x.suppressed)audit.push("秘匿 "+num(x.suppressed));if(x.noPoints)audit.push("点数なし "+num(x.noPoints));if(x.missing)audit.push("欠測 "+num(x.missing));tr.append(el("td",x.rank),name,td,el("td",compareFmt(x.value,r.basis),"right"),el("td",audit.join(" / ")||"公開値","atlas-compare-audit"));tr.addEventListener("mouseenter",()=>compareDetail(x,r));$("rank-list").append(tr)}if(!ranked.length){const tr=el("tr"),td=el("td","指標を算出できる地域はありません。");td.colSpan=5;tr.append(td);$("rank-list").append(tr)}}
function compareRender(r){$("compare-selection").textContent=r.label+" · "+(r.grain==="pref"?"都道府県別原票":"二次医療圏別原票")+" · "+(r.scope==="include"?"公費含む":"公費含まない");$("rank-status").textContent=num(r.eligible)+" / "+num(r.total)+" 地域 · "+compareLabel[r.basis];$("compare-national").textContent=short(r.nationalAmount);$("compare-count").textContent=num(r.nationalCount)+" 回";$("compare-codes").textContent=num(r.codeCount)+" 件";$("compare-regions").textContent=num(r.eligible)+" / "+num(r.total);
const vals=r.rows.map(x=>x.value).filter(x=>x!==null&&Number.isFinite(x)).sort((a,b)=>a-b),thresholds=Array.from({length:5},(_,i)=>vals.length?vals[Math.max(0,Math.ceil(vals.length*(i+1)/5)-1)]:0);$("compare-legend").replaceChildren();for(let i=0;i<5;i++){const span=el("span"),dot=el("i");dot.style.backgroundColor=compareColors[i];span.append(dot,el("span",i===0?"〜"+compareFmt(thresholds[i],r.basis):compareFmt(thresholds[i-1],r.basis)+"〜"+compareFmt(thresholds[i],r.basis)));$("compare-legend").append(span)}const na=el("span"),dot=el("i");dot.style.backgroundColor=compareMissing;na.append(dot,el("span","算出不可"));$("compare-legend").append(na);
const isPref=r.level==="prefecture";$("compare-map").hidden=!isPref;$("compare-area-mode").hidden=isPref;$("compare-map-back").hidden=isPref;compareApplyAreaMode(r);const byCode=new Map(r.rows.map(x=>[x.code,x]));
for(const node of $("compare-map").querySelectorAll("[data-code]")){const k=node.dataset.code.padStart(2,"0"),x=byCode.get(k);node.style.fill=x?compareColor(x.value,thresholds):compareMissing;if(x)node.setAttribute("aria-label",x.name+" "+compareFmt(x.value,r.basis))}
$("compare-tiles").replaceChildren();if(!isPref){const groups=new Map();for(const x of r.rows){const pref=x.code.slice(0,2);if(!groups.has(pref))groups.set(pref,[]);groups.get(pref).push(x)}for(const [pref,rows] of groups){const section=el("section","","atlas-area-pref"),grid=el("div","","atlas-area-grid");section.append(el("h4",comparePrefs.find(x=>x.code===pref)?.name||pref));for(const x of rows){const b=el("button",x.name,"atlas-area-tile");b.type="button";const color=compareColor(x.value,thresholds);b.style.backgroundColor=color;b.style.color=[compareColors[3],compareColors[4]].includes(color)?"#fff":"#224757";b.append(el("small",compareFmt(x.value,r.basis)));b.addEventListener("mouseenter",()=>compareDetail(x,r));b.addEventListener("focus",()=>compareDetail(x,r));b.addEventListener("click",()=>compareDrill(x));grid.append(b)}section.append(grid);$("compare-tiles").append(section)}}if(!isPref)comparePaintMedicalAreas(r,thresholds);compareRankTable()}
function compareInit(){for(const node of $("compare-map").querySelectorAll("[data-code]")){node.setAttribute("role","button");node.setAttribute("tabindex","0");const get=()=>compareData?.rows.find(x=>x.code===node.dataset.code.padStart(2,"0"));node.addEventListener("mouseenter",()=>{const x=get();if(x)compareDetail(x,compareData)});node.addEventListener("focus",()=>{const x=get();if(x)compareDetail(x,compareData)});const click=()=>{const x=get();if(x)compareDrill(x)};node.addEventListener("click",click);node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();click()}})}$("metric").addEventListener("change",()=>{$("rank-class-search").value="";compareCatalog($("metric").value,"ALL")});$("rank-class-search").addEventListener("input",()=>compareFilter("rank-class","rank-class-search",compareClassOptions));$("rank-code-search").addEventListener("input",()=>compareFilter("rank-code","rank-code-search",compareCodeOptions));$("rank-class").addEventListener("change",()=>compareCatalog($("metric").value,$("rank-class").value));$("rank-code").addEventListener("change",loadRank);$("compare-limit").addEventListener("change",compareRankTable);for(const b of document.querySelectorAll("[data-area-map-mode]"))b.addEventListener("click",()=>{compareAreaMode=b.dataset.areaMapMode;for(const x of document.querySelectorAll("[data-area-map-mode]")){x.classList.toggle("is-active",x===b);x.setAttribute("aria-pressed",String(x===b))}if(compareData?.level==="area"){compareApplyAreaMode(compareData);if(compareAreaMode==="map"){const vals=compareData.rows.map(x=>x.value).filter(x=>x!==null&&Number.isFinite(x)).sort((a,b)=>a-b),thresholds=Array.from({length:5},(_,i)=>vals.length?vals[Math.max(0,Math.ceil(vals.length*(i+1)/5)-1)]:0);comparePaintMedicalAreas(compareData,thresholds)}}});$("compare-map-back").addEventListener("click",()=>{$("rank-level").value="prefecture";$("rank-pref").value="JP";$("rank-pref").disabled=true;loadRank()});}
document.addEventListener("DOMContentLoaded",compareInit);

const ATLAS_BOUNDARY_URL="./assets/medical-areas-330.svg";
function compareApplyAreaMode(r){
 const pref=r.level==="prefecture",map=!pref&&compareAreaMode==="map";
 $("compare-map").hidden=!pref;$("compare-map-areas").hidden=!map;$("compare-tiles").hidden=pref||map;
 $("compare-area-mode").hidden=pref;
 $("compare-map-note").textContent=pref?"都道府県別の概略地図。選択した県の医療圏へ移動。":map?"二次医療圏境界図（2020年度原図）。地域選択で詳細を表示。":"二次医療圏別タイル。地域選択で詳細を表示。";
 $("compare-map-source").textContent=pref?"都道府県の概略図：lalamalink / CC0。":map?"境界出典：国土交通省・国土数値情報 A38-20（2020年度）。2024年度330医療圏にコード照合、秋田県旧8圏域を3圏域に合算。島しょ部等は一部簡略化。2024年の境界精度は未検証。":"二次医療圏の一覧タイル。地理的な位置・面積は表していません。";
}
function compareBindMedicalPath(node){
 const code=node.dataset.code;
 node.setAttribute("role","button");node.setAttribute("tabindex","0");
 const get=()=>compareData?.level==="area"?compareData.rows.find(x=>x.code===code):null;
 const preview=()=>{const x=get();if(x)compareDetail(x,compareData)};
 const click=()=>{const x=get();if(x)compareDrill(x)};
 node.addEventListener("mouseenter",preview);node.addEventListener("focus",preview);
 node.addEventListener("click",click);
 node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();click()}});
}
async function compareLoadMedicalMap(){
 if(compareBoundarySvg)return compareBoundarySvg;
 if(!compareBoundaryPromise)compareBoundaryPromise=(async()=>{
  const res=await fetch(ATLAS_BOUNDARY_URL,{method:"GET",cache:"force-cache",credentials:"same-origin",redirect:"error"});
  if(!res.ok)throw Error("境界データの取得に失敗しました。");
  const src=await res.text(),xml=new DOMParser().parseFromString(src,"image/svg+xml");
  if(xml.documentElement.localName!=="svg"||xml.querySelector("parsererror"))throw Error("境界図の形式が正しくありません。");
  const paths=[...xml.querySelectorAll("path[data-code]")];
  if(paths.length!==330||new Set(paths.map(x=>x.dataset.code)).size!==330)throw Error("境界図の地域数が一致しません。");
  const svg=document.importNode(xml.documentElement,true);
  $("compare-map-areas").replaceChildren(svg);
  compareBoundarySvg=svg;
  for(const path of svg.querySelectorAll("path[data-code]"))compareBindMedicalPath(path);
  return svg
 })().catch(e=>{compareBoundaryPromise=null;throw e});
 return compareBoundaryPromise
}
function compareZoomMedicalMap(svg,pref){
 const rootView=svg.getAttribute("data-original-viewbox")||svg.getAttribute("viewBox");
 if(!svg.hasAttribute("data-original-viewbox"))svg.setAttribute("data-original-viewbox",rootView);
 if(!pref||pref==="JP"){svg.setAttribute("viewBox",rootView);return}
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const n of svg.querySelectorAll('path[data-pref="'+pref+'"]')){
  const b=n.getBBox();
  if(b.width===0&&b.height===0)continue;
  x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+b.width);y1=Math.max(y1,b.y+b.height)
 }
 if(!Number.isFinite(x0)||x1<=x0||y1<=y0){svg.setAttribute("viewBox",rootView);return}
 const pad=Math.max(12,(x1-x0)*.08,(y1-y0)*.08);
 svg.setAttribute("viewBox",[x0-pad,y0-pad,x1-x0+pad*2,y1-y0+pad*2].map(x=>Number(x.toFixed(2))).join(" "))
}
async function comparePaintMedicalAreas(r,thresholds){
 if(!connected||compareAreaMode!=="map")return;
 const gen=connectionGeneration;
 try{
  const svg=await compareLoadMedicalMap();
  if(!connected||gen!==connectionGeneration||compareData!==r||compareAreaMode!=="map"||r.level!=="area")return;
  const data=new Map(r.rows.map(x=>[x.code,x]));
  for(const node of svg.querySelectorAll("path[data-code]")){
   const x=data.get(node.dataset.code);
   node.style.fill=x?compareColor(x.value,thresholds):compareMissing;
   node.setAttribute("tabindex",x?"0":"-1");
   if(x)node.setAttribute("aria-label",x.name+" "+compareLabel[r.basis]+" "+compareFmt(x.value,r.basis));
   else node.removeAttribute("aria-label")
  }
  compareZoomMedicalMap(svg,$("rank-pref").value)
 }catch(e){
  if(connected&&compareData===r&&compareAreaMode==="map"){
   compareAreaMode="tiles";
   for(const b of document.querySelectorAll("[data-area-map-mode]")){const active=b.dataset.areaMapMode==="tiles";b.classList.toggle("is-active",active);b.setAttribute("aria-pressed",String(active))}
   compareApplyAreaMode(r);
   $("compare-map-note").textContent="境界地図の取得に失敗したため、タイル一覧を表示しています。"
  }
 }
}


let gbPage=0,gbTotal=0,gbSelected=null,gbRequest=null,gbDetailRequest=null,gbVersion=0;
function gbNode(tag,value,cls){return el(tag,value,cls)}
function gbLine(label,value){const d=gbNode("div","","profile-kpi");d.append(gbNode("span",label),gbNode("strong",value));return d}
function gbReset(){gbVersion++;gbRequest?.abort();gbDetailRequest?.abort();gbSelected=null;gbPage=gbTotal=0;for(const id of ["guidebook-query","guidebook-search","guidebook-prev","guidebook-next"])$(id).disabled=true;$("guidebook-results").replaceChildren();$("guidebook-page").textContent="—";$("guidebook-status").textContent="データ接続後に検索できます。";$("guidebook-detail-status").textContent="検索結果から項目を選択してください。";$("guidebook-detail").replaceChildren(gbNode("p","診療行為名またはコードを検索してください。","atlas-caption"))}
async function gbSearch(){if(!connected||initializing)return;gbRequest?.abort();const c=gbRequest=new AbortController(),v=++gbVersion;$("guidebook-status").textContent="検索中…";$("guidebook-results").replaceChildren();try{const r=await api("/v1/procedures?"+new URLSearchParams({q:$("guidebook-query").value,category:"ALL",page:String(gbPage)}),c.signal);if(c.signal.aborted||v!==gbVersion||!connected)return;gbTotal=r.total;$("guidebook-status").textContent=num(r.total)+" 件";$("guidebook-page").textContent=r.total?(r.page+1)+" / "+Math.ceil(r.total/r.pageSize):"0 件";$("guidebook-prev").disabled=gbPage===0;$("guidebook-next").disabled=(r.page+1)*r.pageSize>=r.total;for(const x of r.rows){const b=gbNode("button","","atlas-result");b.type="button";b.append(gbNode("strong",x.name),gbNode("small",x.code+" · "+(x.classCode||"分類番号未照合")+" · "+(x.points==null?"点数未照合":num(x.points)+" 点")));b.addEventListener("click",()=>{gbSelected=x.code;for(const n of $("guidebook-results").children)n.classList.toggle("selected",n===b);gbDetail(x.code)});$("guidebook-results").append(b)}if(!r.total)$("guidebook-results").append(gbNode("p","該当する項目はありません。","atlas-caption"))}catch(e){if(!c.signal.aborted&&v===gbVersion)$("guidebook-status").textContent=e.message}}
async function gbDetail(code){if(!connected)return;gbDetailRequest?.abort();const c=gbDetailRequest=new AbortController(),g=connectionGeneration;$("guidebook-detail-status").textContent="読み込み中…";$("guidebook-detail").replaceChildren();try{const d=await api("/v1/procedures/"+encodeURIComponent(code)+"?"+new URLSearchParams({region:"JP",grain:"pref",scope:"include",setting:"all",addon:"all"}),c.signal);if(c.signal.aborted||g!==connectionGeneration||gbSelected!==code)return;const p=d.procedure,s=d.summary,box=$("guidebook-detail");box.append(gbNode("div",p.category.replace("_"," ")+" · "+(p.classCode||"分類未照合"),"app-eyebrow"),gbNode("h2",p.name),gbNode("p","9桁コード "+p.code+" · "+(p.className||"分類見出し未照合"),"atlas-caption"));const k=gbNode("div","","profile-kpis atlas-procedure-kpis");k.append(gbLine("診療報酬点数",p.points==null?"—":num(p.points)+" 点"),gbLine("全国公開算定回数",num(d.officialNational?.count)),gbLine("全国・都道府県別原票の公開算定回数",num(s.count)),gbLine("参考換算額（公表分）",yen(s.amount)));box.append(k);box.append(gbNode("p","全国原票と地域別原票の合計は秘匿条件が異なるため一致しない場合があります。患者数ではありません。","atlas-caption"));box.append(gbNode("h3","算定要件・原典の照合状況"));box.append(gbNode("p",d.rule?.note||"算定要件は未照合です。","atlas-caption"));const curated=d.rule?.curated;if(curated){const labels={scope:"対象",eligibility:"適用条件",frequency:"回数・間隔",combination:"併算定",addition:"加算",facility:"施設基準",notes:"注意事項"};for(const [key,label] of Object.entries(labels))if(curated[key])box.append(gbNode("p",label+"： "+curated[key]))}else box.append(gbNode("p","個別の算定要件は未照合です。要件がないことを意味しません。","atlas-caption"));for(const x of d.rule?.references||[]){const det=gbNode("details"),sum=gbNode("summary",x.title+"｜PDF "+x.page+"ページ");det.append(sum,gbNode("p",(x.verification||"")+" · "+(x.file||""),"atlas-caption"),gbNode("pre",x.excerpt||""));box.append(det)}const a=gbNode("a","地域別の算定状況を詳しく見る");a.href="#procedure";a.addEventListener("click",e=>{e.preventDefault();procSelected=p.code;procPage=0;$("procedure-query").value=p.code;setView("procedure");procedureSearch();procedureDetail()});box.append(a);box.append(gbNode("p","点数・要件は2024年度の収録・照合範囲です。現行算定の判断には最新の告示・通知等を参照してください。","atlas-disclaimer"));$("guidebook-detail-status").textContent="2024年度・公開データ"}catch(e){if(!c.signal.aborted)$("guidebook-detail-status").textContent=e.message}}
function gbInit(){$("guidebook-search").addEventListener("click",()=>{gbPage=0;gbSearch()});$("guidebook-query").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();gbPage=0;gbSearch()}});$("guidebook-prev").addEventListener("click",()=>{if(gbPage>0){gbPage--;gbSearch()}});$("guidebook-next").addEventListener("click",()=>{if((gbPage+1)*25<gbTotal){gbPage++;gbSearch()}});document.addEventListener("atlas-guidebook",()=>{if(connected&&!$("guidebook-results").children.length)gbSearch()})}
document.addEventListener("DOMContentLoaded",gbInit);

"use strict";

// Rendering module: accepts authenticated aggregate response only.
function renderRegionDashboard(root,data,onCode){
 const ns="http://www.w3.org/2000/svg",v=data.visuals,fmt=n=>Number(n).toLocaleString("ja-JP",{maximumFractionDigits:1}),sum=a=>a.reduce((x,y)=>x+y,0),ratio=(n,d)=>d?fmt(n/d*100)+"%":"—";
 root.replaceChildren();
 const el=(tag,t,css)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=t;if(css)x.style.cssText=css;return x};
 const svg=(tag,attrs)=>{const x=document.createElementNS(ns,tag);for(const [k,val] of Object.entries(attrs))x.setAttribute(k,String(val));return x};
 const panel=(title,desc,full=false)=>{const p=el("section",undefined,"min-width:0;padding:20px;border:1px solid #dce6eb;border-radius:12px;background:#fff;overflow:hidden;"+(full?"grid-column:1/-1;":""));p.className="region-chart";p.append(el("h3",title,"font-size:19px;line-height:1.4;margin:0 0 8px;color:#183b50"),el("p",desc,"font-size:13px;line-height:1.7;color:#506a7b;margin:0 0 16px"));root.append(p);return p};
 const chart=(p,w,h,title)=>{const c=svg("svg",{viewBox:"0 0 "+w+" "+h,role:"img","aria-label":title});c.style.cssText="display:block;width:100%;height:auto;max-width:100%;overflow:visible;color:#29495b";p.append(c);return c};
 const label=(c,x,y,t,anchor="start",size=14)=>{const a=svg("text",{x,y,"text-anchor":anchor});a.style.cssText="font-family:system-ui,sans-serif;font-size:"+size+"px;fill:#29495b;stroke:none";a.textContent=t;c.append(a)};
 const line=(c,x1,y1,x2,y2,dash=false)=>c.append(svg("line",{x1,y1,x2,y2,stroke:dash?"#587481":"#dce5eb","stroke-width":dash?1.6:1,...(dash?{"stroke-dasharray":"5 4"}:{})}));
 const note=(p,t)=>p.append(el("p",t,"font-size:13px;color:#405f70;line-height:1.7;margin:14px 0 0"));
 const button=(name,code)=>{const b=el("button",name,"font:inherit;color:#126f76;background:transparent;border:0;padding:0;text-align:left;cursor:pointer;text-decoration:underline;overflow-wrap:anywhere");b.type="button";if(onCode)b.addEventListener("click",()=>onCode(code));return b};
 const nRaw=sum(v.distributions.raw),nPop=sum(v.distributions.population);
 const intro=panel(data.regionName+"｜地域の診療特性","全国の比較可能な地域を基準に、診療報酬コードごとの算定回数と人口1万人当たりの算定回数を比較します。",true);
 const rawAbove=v.categories.reduce((n,r)=>n+r.aboveRaw,0),popAbove=v.categories.reduce((n,r)=>n+r.abovePopulation,0);
 const kpis=el("div",undefined,"display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,205px),1fr));gap:12px");
 const kpi=(title,value,desc)=>{const k=el("div",undefined,"padding:15px;background:#f4f8f9;border:1px solid #dce6eb;border-radius:9px");k.append(el("div",title,"font-size:13px;font-weight:700;color:#506a7b"),el("div",value,"font-size:25px;line-height:1.5;font-weight:700;color:#183b50"),el("div",desc,"font-size:12px;line-height:1.5;color:#506a7b"));kpis.append(k)};
 kpi("選択地域の人口",data.regionPopulation==null?"—":fmt(data.regionPopulation)+" 人","人口補正の分母");
 kpi("比較可能な診療報酬",fmt(nRaw)+" 件","人口補正可能："+fmt(nPop)+" 件");
 kpi("全国平均を上回る割合",ratio(rawAbove,nRaw),fmt(rawAbove)+" / "+fmt(nRaw)+" コード（算定回数）");
 kpi("人口補正で平均を上回る割合",ratio(popAbove,nPop),fmt(popAbove)+" / "+fmt(nPop)+" コード");
 kpi("全国上位10%相当",ratio(v.distributions.raw[0],nRaw),fmt(v.distributions.raw[0])+" コード（算定回数）");
 kpi("人口補正で全国上位10%相当",ratio(v.distributions.population[0],nPop),fmt(v.distributions.population[0])+" コード");
 intro.id="region-summary";intro.append(kpis);
 note(intro,"比較対象：最大 "+fmt(data.areaCount)+" 地域。各割合の分母は比較可能なコード数であり、算定件数全体の割合ではありません。");
 note(intro,"全国平均＝100。100より大きいほど平均より多く、100より小さいほど少ない。非公表・欠測値は除外するため、比較対象地域数はコードごとに異なります。算定回数の平均は比較可能地域の単純平均、人口補正の全国基準は比較可能地域の算定回数合計÷総人口×1万人です。");
 for(const [key,title] of Object.entries({rawHigh:"算定回数｜全国平均より多い TOP30",rawLow:"算定回数｜全国平均より少ない TOP30",populationHigh:"人口1万人当たり｜全国平均より多い TOP30",populationLow:"人口1万人当たり｜全国平均より少ない TOP30"})){
  const rows=data.top[key]||[],high=key.endsWith("High"),pop=key.startsWith("population");
  const p=panel(title,(pop?"人口1万人当たりの算定回数":"算定回数")+"の全国平均比。"+(high?"平均を超えるコードを指数の大きい順":"平均未満のコードを指数の小さい順")+"に表示。");
  if(key==="rawHigh")p.id="region-count-rank";if(!rows.length){note(p,"該当する比較可能なコードがありません。");continue}
  const max=high?Math.max(100,...rows.map(r=>r.index)):100;
  const head=el("div",undefined,"display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:12px;font-size:12px;font-weight:700;color:#506a7b;margin-bottom:8px");head.append(el("span","診療報酬名・全国順位"),el("span","全国平均比"));p.append(head);
  const list=el("div",undefined,"display:grid;gap:12px");
  const row=(r,i)=>{const item=el("div",undefined,"border-bottom:1px solid #e8eef2;padding-bottom:10px;min-width:0");
   const top=el("div",undefined,"display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:12px;align-items:start;font-size:14px;line-height:1.5");
   const name=el("div");name.append(button((i+1)+". "+r.name,r.code),el("div",r.code+" ｜ 全国 "+fmt(r.rank)+"位 / "+fmt(r.comparable??r.eligible)+"地域","font-size:12px;color:#627b8a;margin-top:4px"));
   top.append(name,el("strong",fmt(r.index),"font-size:17px;text-align:right;color:"+(high?"#087e75":"#466da6")));item.append(top);
   const track=el("div",undefined,"height:12px;background:#edf2f5;border-radius:3px;margin-top:7px;position:relative;overflow:hidden");
   const x=Math.min(100,r.index/max*100),base=100/max*100;
   const bar=el("span",undefined,"position:absolute;top:0;bottom:0;left:"+Math.min(x,base)+"%;width:"+Math.abs(x-base)+"%;background:"+(high?"#168e86":"#6588b8"));
   const marker=el("span",undefined,"position:absolute;top:0;bottom:0;left:calc("+base+"% - 1px);width:2px;background:#314e60");track.append(bar,marker);item.append(track);
   return item};
  rows.slice(0,10).forEach((r,i)=>list.append(row(r,i)));p.append(list);note(p,"濃い縦線＝全国平均100。色付きの幅＝平均からの差。各グラフの横軸範囲：0〜"+fmt(max)+"。");
  if(rows.length>10){const detail=el("details",undefined,"margin-top:14px");detail.append(el("summary","11〜"+rows.length+"位を表示","font-size:14px;color:#126f76;cursor:pointer;font-weight:700"));const more=el("div",undefined,"display:grid;gap:12px;margin-top:14px");rows.slice(10).forEach((r,i)=>more.append(row(r,i+10)));detail.append(more);p.append(detail)}
 }
 for(const b of ["raw","population"]){
  const bins=v.distributions[b],total=sum(bins),kind=b==="raw"?"算定回数":"人口1万人当たり";
  const p=panel(kind+"｜全国順位の分布","横軸：比較可能な地域の中での順位を10区分。縦軸：その順位帯に入る診療報酬コード数。左ほど全国で上位。",true);
  if(b==="raw")p.id="region-rank-distribution";if(!total){note(p,"比較可能なコードがありません。");continue}
  const w=880,h=360,c=chart(p,w,h,kind+"の全国順位帯別コード数"),left=86,right=850,top=35,bottom=282,step=(right-left)/10,rawMax=Math.max(...bins,1);
  const unit=Math.pow(10,Math.floor(Math.log10(rawMax/4))),tick=Math.max(1,Math.ceil(rawMax/4/unit)*unit),max=tick*4;
  const y=n=>bottom-n/max*(bottom-top);
  for(let j=0;j<=4;j++){const n=j*tick;line(c,left,y(n),right,y(n));label(c,left-10,y(n)+5,fmt(n),"end",14)}
  label(c,left,18,"コード数（件）","start",15);
  bins.forEach((n,i)=>{const x=left+i*step+9,bh=bottom-y(n);c.append(svg("rect",{x,y:y(n),width:step-18,height:bh,fill:i===0?"#117d81":"#559f9d",rx:3}));label(c,x+(step-18)/2,y(n)-7,fmt(n),"middle",14);label(c,x+(step-18)/2,bottom+22,(i*10)+"–"+((i+1)*10)+"%","middle",12)});
  label(c,left,bottom+46,"全国上位","start",14);label(c,right,bottom+46,"全国下位","end",14);label(c,(left+right)/2,bottom+67,"全国順位の相対位置（%）","middle",15);
  note(p,"全国上位10%相当： "+fmt(bins[0])+" 件（"+ratio(bins[0],total)+"）／ 比較可能な全 "+fmt(total)+" 件。相対順位は（順位−1）÷（比較対象地域数−1）で算出。同順位があるため各帯の件数は均等になりません。");
 }
 const p=panel("算定回数と人口補正｜地域特性の比較","1点＝1診療報酬コード。横軸は算定回数指数、縦軸は人口1万人当たり指数。両方とも全国平均100。",true);
 p.id="region-scatter";const points=v.scatter||[];
 if(points.length){
  const c=chart(p,880,510,"算定回数指数と人口補正指数の散布図"),left=95,right=840,top=40,bottom=435,scale=n=>Math.log1p(Math.max(0,n)),max=Math.max(scale(100),...points.flatMap(r=>[scale(r.raw),scale(r.population)])),x=n=>left+scale(n)/max*(right-left),y=n=>bottom-scale(n)/max*(bottom-top);
  const ticks=[0,1,10,100,1000,10000,100000,1000000].filter(n=>scale(n)<=max);
  for(const n of ticks){line(c,x(n),top,x(n),bottom,n===100);line(c,left,y(n),right,y(n),n===100);label(c,x(n),bottom+22,fmt(n),"middle",13);label(c,left-10,y(n)+5,fmt(n),"end",13)}
  label(c,(left+right)/2,495,"算定回数指数（全国平均100）","middle",15);label(c,left,20,"人口1万人当たり指数（全国平均100）","start",15);
  for(const r of points){const node=svg("circle",{cx:x(r.raw),cy:y(r.population),r:4,fill:r.population>=100?"#168e86":"#6588b8",opacity:.68});const t=svg("title",{});t.textContent=r.name+"｜算定回数 "+fmt(r.raw)+"｜人口補正 "+fmt(r.population);node.append(t);if(onCode){node.setAttribute("tabindex","0");node.setAttribute("role","button");node.setAttribute("aria-label",t.textContent);node.style.cursor="pointer";node.addEventListener("click",()=>onCode(r.code));node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onCode(r.code)}})}c.append(node)}
  note(p,"右上：両指標が平均超過 ／ 左上：人口補正後のみ平均超過 ／ 右下：算定回数のみ平均超過 ／ 左下：両指標が平均未満。破線＝100、軸は log(1＋指数)。緑＝人口補正100以上、青＝100未満。");
  note(p,"表示 "+fmt(points.length)+" / "+fmt(v.scatterTotal)+" コード（抽出表示）。点を選ぶと個別の診療報酬詳細へ移動します。");
 }else note(p,"人口補正が可能なコードがありません。");
 const q=panel("診療報酬区分別｜全国平均を上回るコードの割合","各区分の比較可能なコードのうち、全国平均比が100を超えるコードの割合。算定金額の構成比ではありません。",true);
 const wrap=el("div",undefined,"overflow:auto");const table=el("table",undefined,"width:100%;border-collapse:collapse;font-size:14px;min-width:520px");const th=el("tr");for(const t of ["区分","算定回数：平均超過 / 比較可能","人口補正：平均超過 / 比較可能"])th.append(el("th",t,"text-align:left;padding:12px;background:#eef4f6;border-bottom:1px solid #dce6eb"));table.append(th);
 for(const r of v.categories){const tr=el("tr");tr.append(el("td",r.category,"padding:12px;border-bottom:1px solid #e5edf1"));for(const [n,d,color] of [[r.aboveRaw,r.codes,"#168e86"],[r.abovePopulation,r.populationComparable,"#6588b8"]]){const td=el("td",undefined,"padding:12px;border-bottom:1px solid #e5edf1");td.append(el("strong",ratio(n,d)+"（"+fmt(n)+" / "+fmt(d)+"）","font-size:14px"));const track=el("div",undefined,"height:8px;margin-top:6px;border-radius:3px;background:#edf2f5");if(d)track.append(el("div",undefined,"height:100%;border-radius:3px;background:"+color+";width:"+Math.min(100,n/d*100)+"%"));td.append(track);tr.append(td)}table.append(tr)}
 wrap.append(table);q.append(wrap);
}

function createRegionCodeSearch({root,api,context,onCode,signal}){
 const el=(tag,t,css)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=t;if(css)x.style.cssText=css;return x};
 const fmt=n=>n==null?"—":Number(n).toLocaleString("ja-JP",{maximumFractionDigits:2});
 const section=el("section",undefined,"grid-column:1/-1;min-width:0;padding:20px;border:1px solid #dce6eb;border-radius:12px;background:white");section.id="region-code-search";
 section.append(el("h3","地域別診療報酬検索","font-size:19px;color:#183b50;margin:0 0 8px"),el("p","TOP30以外も検索できます。診療報酬名・区分・9桁コードを指定し、全国平均比・全国順位を確認してください。空欄で全比較可能コードを表示します。","font-size:13px;color:#506a7b;line-height:1.7"));
 const form=el("form",undefined,"display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px;align-items:end");
 const field=(name,control)=>{const l=el("label",undefined,"display:grid;gap:5px;color:#405f70;font-size:13px;font-weight:700");l.append(el("span",name),control);form.append(l)};
 const style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccdbe3;border-radius:6px;font-size:14px;background:#fff;color:#183b50";
 const input=el("input",undefined,style);input.type="search";input.placeholder="例：超音波、D、160…";input.maxLength=40;field("診療報酬名・区分・コード",input);
 const select=(name,choices)=>{const x=el("select",undefined,style);for(const [value,t] of choices){const o=el("option",t);o.value=value;x.append(o)}field(name,x);return x};
 const basis=select("比較指標",[["raw","算定回数"],["population","人口1万人当たり"]]);
 const side=select("絞り込み",[["all","すべて"],["high","全国平均を上回る"],["low","全国平均を下回る"]]);
 const submit=el("button","検索","padding:11px 18px;border:0;border-radius:6px;background:#117d81;color:#fff;font-weight:700;cursor:pointer");submit.type="submit";form.append(submit);section.append(form);
 const status=el("p","検索を実行すると表示します。","font-size:13px;color:#506a7b;margin:14px 0");status.setAttribute("role","status");status.setAttribute("aria-live","polite");section.append(status);
 const wrap=el("div",undefined,"overflow:auto;max-width:100%");section.append(wrap);
 const nav=el("div",undefined,"display:flex;gap:12px;align-items:center;justify-content:center;margin-top:12px");
 const navBtn=t=>{const x=el("button",t,"padding:9px 14px;border:1px solid #ccdbe3;border-radius:6px;background:white;color:#183b50;cursor:pointer");x.type="button";x.disabled=true;return x};
 const prev=navBtn("前へ"),next=navBtn("次へ"),pageText=el("span","—","font-size:13px");nav.append(prev,pageText,next);section.append(nav);root.append(section);
 let page=0,total=0,query=null,request=null,version=0;const size=25;
 function abort(){version++;request?.abort();request=null;prev.disabled=next.disabled=true}
 signal?.addEventListener("abort",abort,{once:true});
 function render(d){
  wrap.replaceChildren();const table=el("table",undefined,"width:100%;min-width:850px;border-collapse:collapse;font-size:14px;line-height:1.5");
  const tr=el("tr");const unit=query.basis==="population"?"回／1万人":"回";
  for(const t of ["診療報酬名・コード","地域の値（"+unit+"）",(query.basis==="population"?"比較対象地域の人口加重平均（":"比較対象地域の単純平均（")+unit+"）","全国平均比（100＝平均）","全国順位","比較対象地域数"])tr.append(el("th",t,"padding:10px;text-align:left;background:#eef4f6;border-bottom:1px solid #dce6eb"));table.append(tr);
  for(const r of d.rows){const row=el("tr"),td=el("td",undefined,"padding:10px;border-bottom:1px solid #e5edf1");
   const b=el("button",r.name,"font:inherit;color:#126f76;background:transparent;border:0;padding:0;text-align:left;cursor:pointer;text-decoration:underline");b.type="button";b.addEventListener("click",()=>onCode(r.code));td.append(b,el("div",r.code+" ｜ "+(r.category||"未分類"),"font-size:12px;color:#607786"));row.append(td);
   for(const x of [fmt(r.value),fmt(r.average),fmt(r.index),fmt(r.rank)+"位",fmt(r.comparable??r.eligible)])row.append(el("td",x,"padding:10px;border-bottom:1px solid #e5edf1;white-space:nowrap"));table.append(row);
  }wrap.append(table);
 }
 async function load(target){
  if(signal?.aborted||!query)return;
  abort();const seq=version,c=request=new AbortController();wrap.replaceChildren();status.textContent="検索中…";pageText.textContent="—";
  const path="/v1/region-profile?"+new URLSearchParams({...context,mode:"list",...query,page:String(target),pageSize:String(size)});
  if(path.length>512){status.textContent="検索語が長すぎます。短くして再検索してください。";return}
  try{const d=await api(path,c.signal);if(c.signal.aborted||seq!==version||signal?.aborted)return;
   if(d.region!==context.region||d.scope!==context.scope||d.basis!==query.basis||d.side!==query.side||d.page!==target||!Array.isArray(d.rows)||!Number.isSafeInteger(d.total)||d.total<0)throw Error("応答が検索条件と一致しません");
   page=target;total=d.total;render(d);status.textContent=total?fmt(total)+"件中 "+fmt(page*size+1)+"〜"+fmt(Math.min(total,(page+1)*size))+"件を表示。指数100からの絶対偏差が大きい順（すべて）、または指定方向の指数順。":"比較可能な該当コードがありません。非公表値や欠測値は含みません。";pageText.textContent=fmt(page+1)+" / "+fmt(Math.max(1,Math.ceil(total/size)));prev.disabled=page===0;next.disabled=(page+1)*size>=total;
  }catch(e){if(!c.signal.aborted&&seq===version){status.textContent="検索エラー："+e.message}}
 }
 form.addEventListener("submit",e=>{e.preventDefault();query={basis:basis.value,side:side.value,q:input.value.trim()};return load(0)});
 prev.addEventListener("click",()=>{if(page>0)return load(page-1)});next.addEventListener("click",()=>{if((page+1)*size<total)return load(page+1)});
 return {section,abort};
}

// A binary treemap preserves area exactly, with deterministic ordering and no external library.
function regionTreemapLayout(rows,w,h){
 const valid=rows.filter(r=>Number.isFinite(r.amount)&&r.amount>0).sort((a,b)=>b.amount-a.amount||a.category.localeCompare(b.category));
 const out=[];function split(items,x,y,width,height){
  if(!items.length)return;
  if(items.length===1){out.push({...items[0],x,y,width,height});return}
  const sum=items.reduce((n,r)=>n+r.amount,0);
  let k=1,part=items[0].amount;
  while(k<items.length-1&&Math.abs(part+items[k].amount-sum/2)<Math.abs(part-sum/2)){part+=items[k++].amount}
  const f=part/sum;
  if(width>=height){const d=width*f;split(items.slice(0,k),x,y,d,height);split(items.slice(k),x+d,y,width-d,height)}
  else{const d=height*f;split(items.slice(0,k),x,y,width,d);split(items.slice(k),x,y+d,width,height-d)}
 }split(valid,0,0,w,h);return out;
}
// LQ radar: fixed log2 scale, explicit clipped values and missing-data gaps.
function regionLqRadius(value){
 if(!Number.isFinite(value)||value<0)return null;
 if(value===0)return 0;
 return Math.max(0,Math.min(1,(Math.log2(value)+2)/4));
}
function renderRegionLqRadar(parent,rows,palette){
 const el=(tag,t,css)=>{const e=document.createElement(tag);if(t!==undefined)e.textContent=t;if(css)e.style.cssText=css;return e};
 const svg=(tag,attrs,t)=>{const e=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(t!==undefined)e.textContent=t;return e};
 const format=v=>Number(v).toLocaleString("ja-JP",{maximumFractionDigits:2});
 const ordered=Object.keys(palette).map(category=>{const r=rows.find(x=>x.category===category);return {category,lq:r&&Number.isFinite(r.nationalShare)&&r.nationalShare>0&&Number.isFinite(r.lq)&&r.lq>=0?r.lq:null}});
 const p=el("section",undefined,"margin-top:24px;padding-top:20px;border-top:1px solid #dce6eb;min-width:0");
 p.append(el("h3","地域特性レーダー｜地域特化指数（LQ）","font-size:19px;color:#183b50;margin:0 0 8px"),el("p","全国の参考換算額構成比を1倍とし、各診療報酬区分が地域内で相対的に大きいか小さいかを比較。破線より外側は全国より構成比が大きい区分です。","font-size:14px;color:#506a7b;line-height:1.7;margin-bottom:14px"));
 if(!ordered.some(r=>r.lq!==null)){p.append(el("p","比較可能なLQがありません。"));parent.append(p);return}
 const wrap=el("div",undefined,"display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,540px),1fr));gap:20px;align-items:start");p.append(wrap);
 const c=svg("svg",{viewBox:"0 0 800 680",role:"img","aria-label":"16区分のLQレーダーチャート。全国構成比を基準とする。"});c.style.cssText="display:block;width:100%;height:auto;max-width:100%;overflow:visible";wrap.append(c);
 const cx=400,cy=340,R=230,N=ordered.length,point=(i,f)=>[cx+R*f*Math.sin(i*2*Math.PI/N),cy-R*f*Math.cos(i*2*Math.PI/N)];
 const path=pts=>pts.map(a=>a.join(",")).join(" ");
 for(const [f,label] of [[.25,"0.5倍"],[.5,"1倍"],[.75,"2倍"],[1,"4倍"]]){
  c.append(svg("polygon",{points:path(ordered.map((_,i)=>point(i,f))),fill:"none",stroke:f===.5?"#526e82":"#dae4e9","stroke-width":f===.5?2.5:1.2,...(f===.5?{"stroke-dasharray":"7 5"}:{})}));
  c.append(svg("text",{x:cx+7,y:cy-R*f-6,fill:"#526e82","font-size":14},label));
 }
 for(let i=0;i<N;i++){const q=point(i,1);c.append(svg("line",{x1:cx,y1:cy,x2:q[0],y2:q[1],stroke:"#dce6eb","stroke-width":1}));}
 const coords=ordered.map((r,i)=>r.lq===null?null:point(i,regionLqRadius(r.lq)));
 if(coords.every(Boolean))c.append(svg("polygon",{points:path(coords),fill:"#168e86","fill-opacity":.16,stroke:"#117d81","stroke-width":3,"stroke-linejoin":"round"}));
 else for(let i=0;i<N;i++){const a=coords[i],b=coords[(i+1)%N];if(a&&b)c.append(svg("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"#117d81","stroke-width":3}));}
 for(let i=0;i<N;i++){
  const r=ordered[i],q=point(i,1.13),x=q[0],y=q[1],anchor=x>cx+40?"start":x<cx-40?"end":"middle";
  const code=r.category==="K_輸血料"?"K 輸血":r.category==="K_手術"?"K 手術":r.category.split("_")[0];
  const t=svg("text",{x,y:y-3,"text-anchor":anchor,fill:"#183b50","font-size":17,"font-weight":700},code);c.append(t);
  c.append(svg("text",{x,y:y+15,"text-anchor":anchor,fill:"#526e82","font-size":13},r.lq===null?"—":format(r.lq)+"倍"));
  if(coords[i]){const a=coords[i],dot=svg("circle",{cx:a[0],cy:a[1],r:5.5,fill:r.lq>1?"#117d81":"#6588b8",stroke:"#fff","stroke-width":1.4});dot.append(svg("title",{},r.category.replace("_"," ")+"："+format(r.lq)+"倍"+(r.lq>4?"（表示上限）":r.lq<.25?"（表示下限）":"")));c.append(dot)}
 }
 const side=el("div",undefined,"min-width:0");wrap.append(side);
 const legend=el("div",undefined,"display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:#405f70;margin:0 0 12px");
 for(const [color,label,dashed] of [["#117d81","選択地域",false],["#526e82","全国基準：1倍",true]]){const x=el("span",undefined,"display:flex;align-items:center;gap:7px");x.append(el("span",undefined,"width:25px;border-top:3px "+(dashed?"dashed ":"solid ")+color),el("span",label));legend.append(x)}side.append(legend);
 const values=el("div",undefined,"display:grid;gap:4px");side.append(values);
 for(const r of ordered){
  const row=el("div",undefined,"display:grid;grid-template-columns:minmax(0,1fr) 94px;gap:10px;align-items:center;padding:8px 10px;border-bottom:1px solid #e5edf1;background:"+(r.lq!==null&&r.lq>1?"#edf7f5":"#fff")+";font-size:14px");
  row.append(el("span",r.category.replace("_"," "),"overflow-wrap:anywhere;color:#183b50"),el("strong",r.lq===null?"—":format(r.lq)+"倍"+(r.lq>4?" ↑":r.lq<.25?" ↓":""),"text-align:right;color:"+(r.lq!==null&&r.lq>1?"#087e75":"#506a7b")));values.append(row)
 }
 p.append(el("p","目盛りは対数（0.25～4倍）で固定。1倍を中心に、半分と2倍が同じ距離になります。範囲外は端に表示し、表では実値を表示します（↑・↓）。0倍は中心、比較不能は—とし線をつなぎません。面積の大小は合計額や総合評価を表しません。","font-size:13px;line-height:1.7;color:#506a7b;margin:14px 0 0"));
 parent.append(p);
}

function renderRegionComposition(panel,d,palette){
 const el=(tag,t,css)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=t;if(css)x.style.cssText=css;return x};
 const fmt=n=>Number(n).toLocaleString("ja-JP",{maximumFractionDigits:2}),money=n=>fmt(n/1e8)+" 億円";
 if(!Array.isArray(d.rows)||!Number.isFinite(d.total?.amount)||d.total.amount<0||d.rows.some(r=>typeof r.category!=="string"||!Number.isFinite(r.amount)||r.amount<0))throw Error("区分別集計の形式が不正です");
 if(new Set(d.rows.map(r=>r.category)).size!==d.rows.length)throw Error("区分が重複しています");
 const rows=[...d.rows].sort((a,b)=>b.amount-a.amount),sum=rows.reduce((n,r)=>n+r.amount,0);
 if(Math.abs(sum-d.total.amount)>Math.max(1,d.total.amount*1e-8))throw Error("区分合計と総額が一致しません");
 panel.replaceChildren();
 panel.append(el("h3","診療報酬の構成｜参考換算額","font-size:19px;color:#183b50;margin:0 0 8px"),el("p","四角形の面積＝地域内の参考換算額の割合。A〜O区分（手術・輸血は分離）を比較します。算定回数の構成比ではありません。","font-size:13px;color:#506a7b;line-height:1.7;margin-bottom:14px"));
 if(!sum){panel.append(el("p","比較可能な参考換算額がありません。"));return}
 const summary=el("div",undefined,"display:flex;flex-wrap:wrap;align-items:baseline;gap:12px;margin:8px 0 14px");
 summary.append(el("strong",money(sum),"font-size:27px;color:#183b50"),el("span","最大区分："+rows[0].category.replace("_"," ")+"（"+fmt(rows[0].amount/sum*100)+"%）","font-size:14px;color:#506a7b"));panel.append(summary);
 const layout=el("div",undefined,"display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:20px;align-items:start");panel.append(layout);
 const map=el("div",undefined,"position:relative;width:100%;aspect-ratio:1.55;background:#f2f6f8;border-radius:8px;overflow:hidden");map.setAttribute("aria-label","参考換算額の区分別構成ツリーマップ");layout.append(map);
 const legend=el("div",undefined,"display:grid;gap:4px");layout.append(legend);
 const selected=el("div",undefined,"padding:13px;background:#f1f7f8;border-radius:8px;margin-top:12px;font-size:14px;color:#183b50;line-height:1.7");selected.setAttribute("aria-live","polite");panel.append(selected);
 const boxes=new Map(),items=new Map();
 function show(r){for(const [k,b] of boxes)b.style.boxShadow=k===r.category?"inset 0 0 0 3px #183b50":"inset 0 0 0 1px #fff";for(const [k,b] of items)b.style.background=k===r.category?"#e7f2f3":"transparent";selected.textContent=r.category.replace("_"," ")+" ｜ "+money(r.amount)+" ｜ 地域内構成比 "+fmt(r.amount/sum*100)+"%"+(Number.isFinite(r.nationalShare)?" ｜ 全国原票の構成比 "+fmt(r.nationalShare*100)+"%":"")+(Number.isFinite(r.lq)?" ｜ 地域特化指数（LQ） "+fmt(r.lq)+"倍":"")}
 for(const r of regionTreemapLayout(rows,100,100/1.55)){
  const b=el("button",undefined,"position:absolute;left:"+r.x+"%;top:"+(r.y*1.55)+"%;width:"+r.width+"%;height:"+(r.height*1.55)+"%;background:"+(palette[r.category]||"#8c9ca7")+";color:#fff;border:0;padding:6px;overflow:hidden;cursor:pointer;text-align:left;box-shadow:inset 0 0 0 1px #fff;display:flex;flex-direction:column;justify-content:center");
  b.type="button";b.title=r.category.replace("_"," ")+"｜"+money(r.amount)+"｜"+fmt(r.amount/sum*100)+"%";b.setAttribute("aria-label",b.title);
  if(r.width>=12&&r.height*1.55>=12){b.append(el("strong",r.width>=23?r.category.replace("_"," "):r.category.split("_")[0],"font-size:clamp(11px,1.2vw,17px);line-height:1.3;overflow-wrap:anywhere;text-shadow:0 1px 3px #0008"),el("span",fmt(r.amount/sum*100)+"%","font-size:clamp(11px,1.2vw,16px);text-shadow:0 1px 3px #0008"))}
  b.addEventListener("click",()=>show(r));b.addEventListener("focus",()=>show(r));boxes.set(r.category,b);map.append(b);
 }
 for(const r of rows){const b=el("button",undefined,"display:grid;grid-template-columns:10px minmax(0,1fr) auto auto;gap:8px;align-items:center;text-align:left;border:0;border-bottom:1px solid #e7edf1;background:transparent;padding:7px 5px;color:#183b50;cursor:pointer;font-size:13px;line-height:1.4");b.type="button";b.append(el("span",undefined,"height:10px;border-radius:2px;background:"+(palette[r.category]||"#8c9ca7")),el("span",r.category.replace("_"," ")),el("strong",money(r.amount)),el("span",fmt(r.amount/sum*100)+"%","min-width:48px;text-align:right"));b.addEventListener("click",()=>show(r));b.addEventListener("focus",()=>show(r));items.set(r.category,b);legend.append(b)}
 show(rows[0]);panel.append(el("p","クリックまたはキーボードで区分を選択すると、参考換算額・構成比・LQを確認できます。公表値に基づく参考換算額であり、実際の医療費・売上高ではありません。秘匿・点数なしのセルは既存の区分別APIの集計条件に従います。","font-size:13px;line-height:1.7;color:#506a7b;margin:12px 0 0"));
 // Compare shares directly rather than implying that a count-based radar is a market-size graph.
 const compare=el("section",undefined,"margin-top:24px;padding-top:20px;border-top:1px solid #dce6eb");
 compare.append(el("h3","地域と全国の診療構成比","font-size:18px;color:#183b50;margin:0 0 8px"),el("p","同じ診療報酬区分の参考換算額構成比を比較。LQ＝地域構成比÷全国構成比。1倍を超える区分は、全国原票より地域内の構成割合が大きいことを示します。","font-size:13px;line-height:1.7;color:#506a7b"));
 const legend2=el("div","■ 地域（緑）　■ 全国原票（青灰）","font-size:13px;color:#506a7b;margin:10px 0");compare.append(legend2);
 const max=Math.max(.01,...rows.map(r=>r.amount/sum),...rows.map(r=>Number.isFinite(r.nationalShare)?r.nationalShare:0));
 for(const r of rows){
  const item=el("div",undefined,"display:grid;grid-template-columns:minmax(100px,180px) minmax(0,1fr) 78px;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #e7edf1");
  item.append(el("div",r.category.replace("_"," "),"font-size:13px;color:#183b50;overflow-wrap:anywhere"));
  const bars=el("div",undefined,"display:grid;gap:5px");
  for(const [v,color,label] of [[r.amount/sum,"#168e86","地域"],[r.nationalShare,"#8197ae","全国"]]){
   const row=el("div",undefined,"display:grid;grid-template-columns:minmax(0,1fr) 62px;gap:6px;align-items:center");
   const track=el("div",undefined,"height:12px;border-radius:2px;background:#f0f4f6;overflow:hidden");if(Number.isFinite(v)&&v>=0)track.append(el("div",undefined,"height:100%;width:"+Math.min(100,v/max*100)+"%;background:"+color));row.append(track,el("span",Number.isFinite(v)?fmt(v*100)+"%":"—","font-size:12px;text-align:right;color:#506a7b"));row.setAttribute("aria-label",label+" "+(Number.isFinite(v)?fmt(v*100)+"%":"未取得"));bars.append(row)
  }
  item.append(bars,el("strong",Number.isFinite(r.lq)?fmt(r.lq)+"倍":"—","font-size:14px;text-align:right;color:"+(r.lq>1?"#087e75":"#506a7b")));compare.append(item);
 }panel.append(compare);
 renderRegionLqRadar(panel,rows,palette);
}

// Compare only matching geographic grain and scope. No additional raw data or credentials.
function regionCompareMetric(row,data,metric){
 if(!row||!Number.isFinite(row.amount)||row.amount<0)return null;
 if(metric==="lq")return Number.isFinite(row.nationalShare)&&row.nationalShare>0&&Number.isFinite(row.lq)&&row.lq>=0?row.lq:null;
 if(metric==="share")return Number.isFinite(data.total?.amount)&&data.total.amount>0?row.amount/data.total.amount*100:null;
 if(metric==="perCapita")return Number.isFinite(data.population)&&data.population>0?row.amount/data.population:null;
 return null;
}
function regionCompareColor(value,metric,max){
 if(value===null)return {bg:"#f0f2f4",fg:"#697c88"};
 if(metric==="lq"){
  const f=value===0?1:Math.min(1,Math.abs(Math.log2(value))/2);
  if(Math.abs(value-1)<1e-10)return {bg:"#fff",fg:"#183b50"};
  const rgb=value>1?[17,125,129]:[74,112,169];
  const k=.15+.85*f;
  return {bg:"rgb("+rgb.map(n=>Math.round(255+(n-255)*k)).join(",")+")",fg:k>.72?"#fff":"#183b50"};
 }
 const f=max>0?Math.min(1,value/max):0,k=.06+.94*f;
 return {bg:"rgb("+[17,125,129].map(n=>Math.round(255+(n-255)*k)).join(",")+")",fg:k>.72?"#fff":"#183b50"};
}
// Approximate shared boundary candidates based on the reviewed, simplified SVG.
function regionBoundaryEdges(path){
 const edges=new Map();
 for(const ring of path.matchAll(/M([^MZ]+)Z/g)){
  const pts=ring[1].split("L").map(x=>x.trim().split(/\s+/).map(n=>Math.round(Number(n)*10)));
  if(pts.some(p=>p.length!==2||p.some(n=>!Number.isFinite(n))))throw Error("境界座標の形式が不正です");
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if(a[0]===b[0]&&a[1]===b[1])continue;const key=[a.join(","),b.join(",")].sort().join("|");edges.set(key,Math.hypot(a[0]-b[0],a[1]-b[1])/10)}
 }
 return edges;
}
function regionBoundaryCandidates(paths,code){
 const own=paths.find(p=>p.code===code);if(!own)throw Error("境界図に選択地域がありません");
 const ref=regionBoundaryEdges(own.d);if(!ref.size)throw Error("選択地域の境界がありません");
 const out=[];
 for(const p of paths){if(p.code===code)continue;let length=0;for(const k of regionBoundaryEdges(p.d).keys())length+=ref.get(k)||0;if(length>=1)out.push({code:p.code,name:p.name,length})}
 return out.sort((a,b)=>b.length-a.length||a.code.localeCompare(b.code));
}
let regionBoundaryCatalogPromise=null;
function getRegionBoundaryCatalog(){
 if(!regionBoundaryCatalogPromise)regionBoundaryCatalogPromise=(async()=>{
  const r=await fetch("./assets/medical-areas-330.svg",{method:"GET",cache:"force-cache",credentials:"same-origin",redirect:"error"});if(!r.ok)throw Error("境界図の取得に失敗しました");
  const xml=new DOMParser().parseFromString(await r.text(),"image/svg+xml");if(xml.documentElement.localName!=="svg"||xml.querySelector("parsererror"))throw Error("境界図の形式が不正です");
  const rows=[...xml.querySelectorAll("path[data-code]")].map(p=>({code:p.getAttribute("data-code"),name:(p.getAttribute("data-name")||p.querySelector("title")?.textContent||p.getAttribute("aria-label")||p.getAttribute("data-code")).trim(),d:p.getAttribute("d")||""}));
  if(rows.length!==330||new Set(rows.map(p=>p.code)).size!==330||rows.some(p=>!/^\d{4}$/.test(p.code)||!p.d.startsWith("M")))throw Error("330医療圏の境界図と一致しません");
  return rows;
 })().catch(e=>{regionBoundaryCatalogPromise=null;throw e});
 return regionBoundaryCatalogPromise;
}

function createRegionPeerComparison({parent,baseData,context,api,signal,palette}){
 const el=(tag,t,css)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=t;if(css)x.style.cssText=css;return x};
 const fmt=(n,d=2)=>Number(n).toLocaleString("ja-JP",{maximumFractionDigits:d});
 const panel=el("section",undefined,"margin-top:24px;padding-top:20px;border-top:1px solid #dce6eb;min-width:0");
 panel.id="region-peer-compare";panel.append(el("h3","地域間比較｜診療報酬区分別ヒートマップ","font-size:20px;color:#183b50;margin:0 0 8px"),el("p","選択地域を基準に最大3地域を追加できます。同じ地理単位・公費条件・2024年度の参考換算額を使用します。","font-size:14px;color:#506a7b;line-height:1.7"));
 const style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #ccdbe3;border-radius:6px;background:#fff;color:#183b50;font-size:14px";
 const form=el("form",undefined,"display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px;align-items:end");
 const field=(name,node)=>{const l=el("label",undefined,"display:grid;gap:6px;font-size:13px;color:#405f70;font-weight:700");l.append(el("span",name),node);form.append(l)};
 const pref=el("select",undefined,style),area=el("select",undefined,style),metric=el("select",undefined,style);
 const option=(value,name)=>{const x=el("option",name);x.value=value;return x};
 pref.append(option("","都道府県を選択"));pref.disabled=true;field("比較する都道府県",pref);
 if(context.grain==="secondary"){area.append(option("","医療圏を選択"));area.disabled=true;field("比較する二次医療圏",area)}
 for(const [v,n] of [["lq","地域特化指数（LQ）"],["share","参考換算額構成比（%）"],["perCapita","人口1人当たり参考換算額（円）"]])metric.append(option(v,n));field("比較指標",metric);
 const add=el("button","比較地域を追加","padding:11px;border:0;border-radius:6px;background:#117d81;color:#fff;font-weight:700;cursor:pointer");add.type="submit";add.disabled=true;form.append(add);panel.append(form);
 const status=el("p","地域一覧を取得中…","font-size:13px;color:#506a7b;margin:12px 0");status.setAttribute("role","status");panel.append(status);
 const legend=el("div",undefined,"display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0;font-size:13px;color:#405f70");panel.append(legend);
 const wrap=el("div",undefined,"overflow:auto;max-width:100%");panel.append(wrap);
 const entries=new Map([[context.region,baseData]]),categories=Object.keys(palette);
 let disposed=false,areaRequest=null,loadRequest=null,areaVersion=0,busy=false;
 let nearButton=null,nearBusy=false;
 const isDead=()=>disposed||signal?.aborted;
 signal?.addEventListener("abort",()=>{disposed=true;areaRequest?.abort();loadRequest?.abort()},{once:true});
 const pick=()=>context.grain==="pref"?pref.value:area.value;
 function update(){add.disabled=isDead()||busy||nearBusy||entries.size>=4||!pick()||entries.has(pick());if(nearButton)nearButton.disabled=isDead()||busy||nearBusy||entries.size>=4}
 function render(){
  wrap.replaceChildren();legend.replaceChildren();const m=metric.value||"lq";
  const all=[...entries.values()];const max=Math.max(0,...all.flatMap(d=>categories.map(k=>regionCompareMetric(d.rows.find(r=>r.category===k),d,m)??0)));
  const samples=m==="lq"?[[.25,"0.25倍以下"],[.5,"0.5倍"],[1,"1倍（全国基準）"],[2,"2倍"],[4,"4倍以上"]]:[[0,"0"],[max/2,fmt(max/2,m==="perCapita"?0:2)],[max,fmt(max,m==="perCapita"?0:2)+(m==="share"?"%":"円")]];
  for(const [v,label] of samples){const color=regionCompareColor(v,m,max);legend.append(el("span",label,"padding:6px 8px;border:1px solid #dce6eb;border-radius:4px;background:"+color.bg+";color:"+color.fg))}
  legend.append(el("span","— 比較不能","padding:6px 8px;background:#f0f2f4;color:#697c88;border-radius:4px"));
  const table=el("table",undefined,"width:100%;min-width:"+Math.max(450,210+entries.size*150)+"px;border-collapse:separate;border-spacing:4px;font-size:14px;table-layout:fixed");
  const head=el("tr");head.append(el("th","診療報酬区分","text-align:left;width:185px;padding:9px;color:#183b50"));
  for(const [code,d] of entries){const th=el("th",undefined,"background:#eef4f6;padding:10px;border-radius:5px;color:#183b50;overflow-wrap:anywhere");th.append(el("div",d.name||code),el("div",code===context.region?"基準地域":"比較地域","font-size:11px;color:#506a7b;margin-top:4px"));
   if(code!==context.region){const b=el("button","削除","font-size:12px;padding:4px 8px;margin-top:5px;border:1px solid #ccdbe3;border-radius:4px;background:white;cursor:pointer");b.type="button";b.addEventListener("click",()=>{entries.delete(code);render();update();status.textContent="比較対象 "+entries.size+" 地域"});th.append(b)}head.append(th)}
  table.append(head);
  const totals=el("tr");totals.append(el("th","参考換算額合計","text-align:left;padding:8px;color:#183b50"));
  for(const d of all)totals.append(el("td",Number.isFinite(d.total?.amount)?fmt(d.total.amount/1e8)+" 億円":"—","padding:9px;text-align:center;font-weight:700;background:#f3f6f8;border-radius:4px"));table.append(totals);
  for(const cat of categories){const tr=el("tr");tr.append(el("th",cat.replace("_"," "),"text-align:left;padding:8px;color:#183b50;overflow-wrap:anywhere"));
   for(const d of all){const value=regionCompareMetric(d.rows.find(r=>r.category===cat),d,m),c=regionCompareColor(value,m,max);
    const label=value===null?"—":fmt(value,m==="perCapita"?0:2)+(m==="lq"?"倍":m==="share"?"%":"円");
    const td=el("td",label,"padding:10px;text-align:center;font-weight:700;border-radius:4px;border:1px solid #e0e7ec;background:"+c.bg+";color:"+c.fg);td.title=(d.name||"地域")+"｜"+cat.replace("_"," ")+"｜"+label;tr.append(td)}table.append(tr)}
  wrap.append(table);
  legend.append(el("span",m==="lq"?"緑：全国より構成比が大きい／青：小さい。色の範囲は0.25～4倍に固定。":"色の濃さは現在の比較表全体で共通の最大値を基準に表示。","flex-basis:100%;line-height:1.6"));
 }
 metric.addEventListener("change",render);
 pref.addEventListener("change",async()=>{
  areaVersion++;areaRequest?.abort();area.replaceChildren(option("","医療圏を選択"));area.disabled=true;update();
  if(context.grain!=="secondary"||!pref.value||isDead())return;
  const v=areaVersion,p=pref.value,c=areaRequest=new AbortController();status.textContent="二次医療圏を取得中…";
  try{const d=await api("/v1/areas?pref="+encodeURIComponent(p),c.signal);if(isDead()||c.signal.aborted||v!==areaVersion)return;
   if(!Array.isArray(d.areas))throw Error("医療圏一覧の形式が不正です");
   for(const r of d.areas)if(/^\d{4}$/.test(r.code)&&r.code.startsWith(p))area.append(option(r.code,r.name));area.disabled=false;status.textContent="比較する医療圏を選択してください。";update();
  }catch(e){if(!isDead()&&!c.signal.aborted&&v===areaVersion)status.textContent="医療圏一覧取得エラー："+e.message}
 });
 area.addEventListener("change",update);
 async function addRegion(code){
  if(isDead()||entries.has(code)||entries.size>=4||!(context.grain==="pref"?/^\d{2}$/:/^\d{4}$/).test(code))return false;
  const c=loadRequest=new AbortController();
  const d=await api("/v1/categories/"+encodeURIComponent(code)+"?"+new URLSearchParams({scope:context.scope,grain:context.grain}),c.signal);
  if(isDead()||c.signal.aborted)return false;
  if(d.scope!==context.scope||d.grain!==context.grain||(d.region!=null&&String(d.region)!==code)||!Array.isArray(d.rows)||!Number.isFinite(d.total?.amount))throw Error("集計条件が一致しません");
  entries.set(code,d);render();return true;
 }
 form.addEventListener("submit",async e=>{
  e.preventDefault();const code=pick();if(isDead()||busy||nearBusy||entries.has(code)||entries.size>=4||!code)return;
  busy=true;update();status.textContent="比較地域を取得中…";
  try{await addRegion(code);if(!isDead())status.textContent="比較対象 "+entries.size+" 地域"+(entries.size===4?"（上限）":"")}
  catch(e){if(!isDead())status.textContent="比較地域取得エラー："+e.message}
  finally{busy=false;update()}
 });
 if(context.grain==="secondary"){
  const near=el("div",undefined,"background:#f4f8f9;border:1px solid #dce6eb;border-radius:8px;padding:14px;margin:12px 0");
  near.append(el("h4","地図上の隣接候補","font-size:15px;color:#183b50;margin:0 0 6px"),el("p","境界を共有する候補から、共有する線の長い順に空き枠（最大3地域）へ追加します。2020年度原図を330医療圏に照合した概略図を使用。交通時間・患者流動に基づく近隣ではありません。","font-size:13px;line-height:1.7;color:#506a7b;margin:0 0 10px"));
  nearButton=el("button","隣接候補を自動追加","padding:10px 14px;border:1px solid #117d81;border-radius:6px;background:white;color:#117d81;font-weight:700;cursor:pointer");nearButton.type="button";near.append(nearButton);
  const nearStatus=el("p","未抽出","font-size:13px;line-height:1.7;color:#405f70;margin:8px 0 0");nearStatus.setAttribute("role","status");near.append(nearStatus);
  panel.insertBefore(near,status);
  nearButton.addEventListener("click",async()=>{
   if(isDead()||busy||nearBusy||entries.size>=4)return;
   nearBusy=true;update();nearStatus.textContent="地図から隣接候補を抽出中…";
   try{
    const candidates=regionBoundaryCandidates(await getRegionBoundaryCatalog(),context.region);if(isDead())return;
    const remaining=candidates.filter(r=>!entries.has(r.code));if(!remaining.length){nearStatus.textContent=candidates.length?"すべての隣接候補は比較表に追加済みです。":"概略地図で共有境界を検出できませんでした。手動で比較地域を追加できます。";return}
    const targets=remaining.slice(0,4-entries.size),added=[],failed=[];
    for(const r of targets){if(isDead())return;nearStatus.textContent=r.name+" の比較データを取得中…";try{if(await addRegion(r.code))added.push(r.name)}catch(e){if(!isDead())failed.push(r.name+"（"+e.message+"）")}}
    if(!isDead()){nearStatus.textContent="隣接候補 "+candidates.length+"地域："+candidates.map(r=>r.name).join("、")+"。追加："+(added.join("、")||"なし")+(failed.length?"。取得失敗："+failed.join("、"):"");status.textContent="比較対象 "+entries.size+" 地域";}
   }catch(e){if(!isDead())nearStatus.textContent="隣接候補の取得エラー："+e.message}
   finally{nearBusy=false;update()}
  });
 }
 panel.append(el("p","構成比・LQ・人口当たり参考換算額は異なる指標です。参考換算額は公表値に基づく推計で、実際の医療費や売上ではありません。欠測をゼロとして補完しません。","font-size:13px;line-height:1.7;color:#506a7b;margin-top:12px"));
 parent.append(panel);render();
 async function init(){
  try{const d=await api("/v1/prefectures",signal);if(isDead())return;if(!Array.isArray(d.prefectures)||d.prefectures.length!==47)throw Error("都道府県一覧の形式が不正です");
   for(const r of d.prefectures)pref.append(option(r.code,r.name));pref.disabled=false;
   pref.value=context.region.slice(0,2);status.textContent="比較地域を選択してください。";if(context.grain==="secondary")pref.dispatchEvent(new Event("change"));update();
  }catch(e){if(!isDead())status.textContent="地域一覧取得エラー："+e.message}
 }
 init();return {panel};
}

function validateRegionHighlights(d,region,scope,grain){
 const fail=()=>{throw Error("地域集計の形式または整合性に問題があります")};
 const count=n=>Number.isSafeInteger(n)&&n>=0,finite=n=>typeof n==="number"&&Number.isFinite(n),sum=x=>x.reduce((a,b)=>a+b,0);
 const max=grain==="pref"?47:330;
 if(!d||d.region!==region||d.scope!==scope||d.areaCount!==max||typeof d.regionName!=="string"||!d.visuals||!d.top)fail();
 const v=d.visuals,raw=v.distributions?.raw,pop=v.distributions?.population;
 if(!Array.isArray(raw)||raw.length!==10||!raw.every(count)||!Array.isArray(pop)||pop.length!==10||!pop.every(count)||!count(v.comparableCodes)||sum(raw)!==v.comparableCodes||sum(pop)>sum(raw)||!Array.isArray(v.categories))fail();
 if(v.categories.some(r=>typeof r.category!=="string"||![r.codes,r.aboveRaw,r.abovePopulation,r.populationComparable].every(count)||r.aboveRaw>r.codes||r.populationComparable>r.codes||r.abovePopulation>r.populationComparable)||new Set(v.categories.map(r=>r.category)).size!==v.categories.length||sum(v.categories.map(r=>r.codes))!==sum(raw)||sum(v.categories.map(r=>r.populationComparable))!==sum(pop))fail();
 for(const k of ["rawHigh","rawLow","populationHigh","populationLow"]){
  const rows=d.top[k],high=k.endsWith("High");if(!Array.isArray(rows)||rows.length>30)fail();
  if(rows.some((r,i)=>!/^\d{9}$/.test(r.code)||typeof r.name!=="string"||!finite(r.index)||(high?r.index<=100:r.index>=100)||!Number.isSafeInteger(r.rank)||!Number.isSafeInteger(r.comparable)||r.rank<1||r.rank>r.comparable||r.comparable>max||r.comparable<2||(i>0&&(high?rows[i-1].index<r.index:rows[i-1].index>r.index))))fail();
 }
 if(!Array.isArray(v.scatter)||v.scatter.length>500||!count(v.scatterTotal)||v.scatterTotal!==sum(pop)||v.scatter.length>v.scatterTotal||v.scatter.some(r=>!/^\d{9}$/.test(r.code)||typeof r.name!=="string"||!finite(r.raw)||!finite(r.population)||r.raw<0||r.population<0))fail();
 return d;
}
function createRegionDashboardController({root,status,api,onCode}){
 let request=null,version=0;
 function reset(){version++;request?.abort();request=null;root.replaceChildren();status.textContent="データ未取得";}
 async function load({region,scope,grain}){
  reset();const v=version,c=request=new AbortController();status.textContent="地域プロファイルを取得中…";
  try{
   const d=await api("/v1/region-profile?"+new URLSearchParams({region,scope,grain,mode:"highlights"}),c.signal);
   if(c.signal.aborted||v!==version)return false;
   validateRegionHighlights(d,region,scope,grain);
   const openCode=code=>onCode({code},{...d,grain});
   renderRegionDashboard(root,d,openCode);
   const search=createRegionCodeSearch({root,api,context:{region,scope,grain},onCode:openCode,signal:c.signal});
   root.insertBefore(search.section,root.children[1]||null);
   const composition=document.createElement("section");composition.className="region-chart";composition.id="region-composition";composition.style.cssText="grid-column:1/-1;min-width:0;padding:20px;border:1px solid #dce6eb;border-radius:12px;background:#fff";composition.textContent="診療報酬構成を取得中…";
   root.insertBefore(composition,root.children[2]||null);
   // Independent request: failure never removes the already loaded count analysis.
   const compositionTask=api("/v1/categories/"+encodeURIComponent(region)+"?"+new URLSearchParams({scope,grain}),c.signal).then(category=>{
    if(c.signal.aborted||v!==version)return;
    if(category.scope!==scope||category.grain!==grain||(category.region!=null&&String(category.region)!==region))throw Error("地域または集計条件が一致しません");
    renderRegionComposition(composition,category,CATEGORY_PALETTE);
    createRegionPeerComparison({parent:composition,baseData:category,context:{region,scope,grain},api,signal:c.signal,palette:CATEGORY_PALETTE});return true;
   }).catch(e=>{if(!c.signal.aborted&&v===version)composition.textContent="参考換算額構成の取得エラー："+e.message;return false});

   const nav=document.createElement("nav");nav.setAttribute("aria-label","地域分析内の移動");nav.style.cssText="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#f1f6f7;border-radius:8px";for(const [id,label] of [["region-summary","概要"],["region-code-search","診療報酬検索"],["region-composition","診療構成・LQ"],["region-peer-compare","地域間比較"],["region-count-rank","TOP30"],["region-rank-distribution","順位分布"],["region-scatter","散布図"],["special-status","参考換算額TOP100"]]){const b=document.createElement("button");b.type="button";b.textContent=label;b.style.cssText="padding:8px 12px;background:white;border:1px solid #ccdbe3;border-radius:6px;font-size:13px;color:#183b50;cursor:pointer";b.addEventListener("click",()=>{const target=$(id);if(target)target.scrollIntoView({behavior:"smooth",block:"start"});else status.textContent="対象の分析は読み込み中か未取得です。"});nav.append(b)}root.insertBefore(nav,root.children[0]||null);
   status.textContent=d.regionName+"｜比較可能 "+d.visuals.comparableCodes.toLocaleString("ja-JP")+" コード";
   const compositionOk=await compositionTask;if(c.signal.aborted||v!==version)return false;if(!compositionOk)status.textContent+=" ｜ 算定回数は取得済み・参考換算額構成は取得失敗";return compositionOk===true;
  }catch(e){if(!c.signal.aborted&&v===version){root.replaceChildren();status.textContent="地域プロファイル取得エラー："+e.message}return false}
 }
 return {load,reset};
}

let regionDashboardController=null;
function initRegionDashboard(){
 const board=$("specialBoard"),anchor=$("special-status")?.closest(".special-board");
 if(!board||!anchor)return;
 const section=document.createElement("section");section.className="profile-panel";
 const heading=document.createElement("h3");heading.textContent="地域診療ダッシュボード";heading.style.cssText="font-size:20px;color:#183b50;margin:0 0 8px";section.id="region-dashboard";
 const status=document.createElement("p");status.setAttribute("role","status");status.textContent="地域を選択して「調べる」を押してください。";status.style.cssText="font-size:14px;color:#506a7b;line-height:1.7";status.setAttribute("aria-live","polite");
 const button=document.createElement("button");button.type="button";button.id="region-profile-fetch";button.className="atlas-connect-secondary";button.textContent="調べる";button.disabled=true;button.style.cssText="display:inline-block;padding:12px 18px;margin:8px 0 16px;background:#117d81;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer";
 const root=document.createElement("div");root.className="region-dashboard-grid";root.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,610px),1fr));gap:20px;align-items:start";
 section.append(heading,status,root);anchor.before(section);$("special-search-actions").append(button);
 regionDashboardController=createRegionDashboardController({root,status,api,onCode:specialOpenCode});
 button.addEventListener("click",runRegionAnalysis);syncRegionSearchButton();
}
document.addEventListener("DOMContentLoaded",()=>{
 // Old preview bookmarks open the same regional dashboard using production only.
 const url=new URL(location.href),legacyPreview=url.searchParams.get("atlas-preview")==="region";
 if(url.searchParams.has("atlas-preview")){url.searchParams.delete("atlas-preview");history.replaceState(null,"",url.pathname+url.search+url.hash)}
 initRegionDashboard();
 if(legacyPreview&&regionDashboardController){setView("profile");setSub("special");}
});
