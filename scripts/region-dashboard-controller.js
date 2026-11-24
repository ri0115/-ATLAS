"use strict";

// Rendering module: accepts authenticated aggregate response only.
function renderRegionDashboard(root,data,onCode){
 const ns="http://www.w3.org/2000/svg",v=data.visuals;
 root.replaceChildren();
 const el=(tag,t)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=t;return x};
 const svg=(tag,attrs)=>{const x=document.createElementNS(ns,tag);for(const [k,val] of Object.entries(attrs))x.setAttribute(k,String(val));return x};
 const panel=(title,w,h)=>{const section=el("section");section.className="region-chart";section.append(el("h3",title));const chart=svg("svg",{viewBox:"0 0 "+w+" "+h,width:"100%",role:"img","aria-label":title});section.append(chart);root.append(section);return chart};
 const label=(chart,x,y,t,anchor="start")=>{const a=svg("text",{x,y,"font-size":11,fill:"currentColor","text-anchor":anchor});a.textContent=t;chart.append(a)};
 const mark=(chart,node,r)=>{const t=svg("title",{});t.textContent=r.name+" / "+r.code;node.append(t);if(onCode){node.setAttribute("tabindex","0");node.setAttribute("role","button");node.addEventListener("click",()=>onCode(r.code));node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onCode(r.code)}})}chart.append(node)};
 for(const [key,title] of Object.entries({rawHigh:"算定回数・上位",rawLow:"算定回数・下位",populationHigh:"人口補正・上位",populationLow:"人口補正・下位"})){
 const rows=(data.top[key]||[]).slice(0,10),c=panel(title,640,Math.max(80,rows.length*27+35)),max=Math.max(100,...rows.map(r=>r.index));const x=n=>260+n/max*310;
 c.append(svg("line",{x1:x(100),x2:x(100),y1:8,y2:rows.length*27+8,stroke:"currentColor","stroke-dasharray":"3 3",opacity:.5}));
 rows.forEach((r,i)=>{const y=12+i*27;label(c,4,y+12,r.name.length>19?r.name.slice(0,19)+"…":r.name);mark(c,svg("rect",{x:Math.min(x(100),x(r.index)),y,width:Math.max(1,Math.abs(x(r.index)-x(100))),height:15,rx:2,fill:r.index>=100?"#168e86":"#6588b8"}),r);label(c,635,y+12,r.index.toFixed(1),"end")});label(c,x(100),rows.length*27+24,"100","middle");
 }
 for(const b of ["raw","population"]){const bins=v.distributions[b],c=panel((b==="raw"?"算定回数":"人口補正")+"・全国順位分布",640,180),max=Math.max(1,...bins);bins.forEach((n,i)=>{const h=n/max*130;c.append(svg("rect",{x:35+i*58,y:145-h,width:45,height:h,fill:"#168e86",rx:2}));label(c,57+i*58,140-h,String(n),"middle")});label(c,35,165,"上位");label(c,615,165,"下位","end")}
 const c=panel("算定回数指数 × 人口補正指数（抽出表示）",640,330),scale=n=>Math.log1p(Math.max(0,n)),max=Math.max(scale(100),...v.scatter.flatMap(r=>[scale(r.raw),scale(r.population)])),x=n=>45+scale(n)/max*570,y=n=>280-scale(n)/max*250;
 c.append(svg("path",{d:"M45 30V280H615",stroke:"currentColor",fill:"none",opacity:.5}));c.append(svg("path",{d:"M"+x(100)+" 30V280 M45 "+y(100)+"H615",stroke:"currentColor","stroke-dasharray":"3 3",opacity:.5}));for(const r of v.scatter)mark(c,svg("circle",{cx:x(r.raw),cy:y(r.population),r:3,fill:"#168e86",opacity:.65}),r);label(c,330,310,"算定回数指数（対数軸）","middle");label(c,48,18,"人口補正指数（対数軸）");label(c,x(100),295,"100","middle");label(c,40,y(100),"100","end");
 const table=el("table"),head=el("tr");for(const t of ["区分","比較可能コード","算定回数指数100超","人口補正指数100超"])head.append(el("th",t));table.append(head);for(const r of v.categories){const tr=el("tr");for(const t of [r.category,r.codes,r.aboveRaw,r.abovePopulation+" / "+r.populationComparable])tr.append(el("td",String(t)));table.append(tr)}root.append(table);
}


function createRegionDashboardController({root,status,api,onCode}){
 let request=null,version=0;
 function reset(){version++;request?.abort();request=null;root.replaceChildren();status.textContent="データ未取得";}
 async function load({region,scope,grain}){
  reset();const v=version,c=request=new AbortController();status.textContent="地域プロファイルを取得中…";
  try{
   const d=await api("/v1/region-profile?"+new URLSearchParams({region,scope,grain,mode:"highlights"}),c.signal);
   if(c.signal.aborted||v!==version)return;
   if(d.region!==region||d.scope!==scope||!d.visuals||!d.top)throw Error("地域データの応答が一致しません");
   renderRegionDashboard(root,d,code=>onCode({code},{...d,grain}));
   status.textContent=d.regionName+"｜比較可能 "+d.visuals.comparableCodes.toLocaleString("ja-JP")+" コード";
  }catch(e){if(!c.signal.aborted&&v===version){root.replaceChildren();status.textContent="地域プロファイル取得エラー："+e.message}}
 }
 return {load,reset};
}
