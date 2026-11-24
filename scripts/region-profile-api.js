"use strict";
/**
 * Server-side region profile aggregator. No dataset or secrets are bundled.
 * Integration contract:
 * areas: [{code,name,population}], one consistent geographic grain.
 * procedures: [{code,name,category,counts:{[areaCode]: number|null}}].
 * Null/undefined = suppressed or unavailable, never zero.
 * Call only AFTER authentication and authorization in the private backend.
 */
function profile({areas,procedures,region,scope="include",basis="raw",side="high",q="",page=0,pageSize=50,mode="list"}){
 if(!["raw","population"].includes(basis)||!["high","low","all"].includes(side)||!["list","highlights"].includes(mode))throw Error("invalid filters");
 if(!Array.isArray(areas)||!Array.isArray(procedures)||!/^\d{2,4}$/.test(region))throw Error("invalid input");
 const ownArea=areas.find(a=>a.code===region);
 if(!ownArea||!(ownArea.population>0))throw Error("unknown region");
 page=Math.max(0,Math.min(100000,Number.parseInt(page,10)||0));
 pageSize=Math.max(1,Math.min(100,Number.parseInt(pageSize,10)||50));
 const valid=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0;
 const rows=[];
 for(const p of procedures){
  if(!/^\d{9}$/.test(p.code)||!p.counts||typeof p.counts!=="object")continue;
  const eligible=areas.filter(a=>valid(p.counts[a.code]));
  const popEligible=eligible.filter(a=>Number.isFinite(a.population)&&a.population>0);
  const own=p.counts[region];
  if(!valid(own)||eligible.length<2)continue;
  const sum=eligible.reduce((v,a)=>v+p.counts[a.code],0);
  const pop=popEligible.reduce((v,a)=>v+a.population,0);
  const popSum=popEligible.reduce((v,a)=>v+p.counts[a.code],0);
  if(!(sum>0)||!(pop>0))continue;
  const meanRaw=sum/eligible.length,meanPopulation=popSum/pop*10000;
  const metrics={};
  for(const b of ["raw","population"]){
   const ownValue=b==="raw"?own:own/ownArea.population*10000;
   const mean=b==="raw"?meanRaw:meanPopulation;
   const values=(b==="raw"?eligible:popEligible).map(a=>b==="raw"?p.counts[a.code]:p.counts[a.code]/a.population*10000);
   const greater=values.filter(v=>v>ownValue).length;
   const lesser=values.filter(v=>v<ownValue).length;
   metrics[b]={index:ownValue/mean*100,difference:ownValue-mean,rank:greater+1,worstRank:lesser+1,comparable:values.length,eligible:values.length,value:ownValue,average:mean};
  }
  rows.push({code:p.code,name:p.name,category:p.category||"",count:own,metrics,coverage:eligible.length/areas.length,scope});
 }
 const query=String(q).normalize("NFKC").toLowerCase().trim();
 const matches=rows.filter(r=>(!query||(r.code+" "+r.name+" "+r.category).normalize("NFKC").toLowerCase().includes(query))&&(side==="all"||(side==="high"?r.metrics[basis].index>100:r.metrics[basis].index<100)));
 matches.sort((a,b)=>side==="low"?a.metrics[basis].index-b.metrics[basis].index:side==="high"?b.metrics[basis].index-a.metrics[basis].index:Math.abs(b.metrics[basis].index-100)-Math.abs(a.metrics[basis].index-100));
 const compact=r=>({code:r.code,name:r.name,category:r.category,count:r.count,...r.metrics[basis],coverage:r.coverage});
 if(mode==="highlights"){
  const tops={};for(const b of ["raw","population"])for(const dir of ["high","low"]){
   const selected=rows.filter(r=>dir==="high"?r.metrics[b].index>100:r.metrics[b].index<100);
   selected.sort((a,c)=>dir==="high"?c.metrics[b].index-a.metrics[b].index:a.metrics[b].index-c.metrics[b].index);
   tops[b+dir[0].toUpperCase()+dir.slice(1)]=selected.slice(0,30).map(r=>({code:r.code,name:r.name,category:r.category,count:r.count,...r.metrics[b],coverage:r.coverage}));
  }
  return {region,regionName:ownArea.name,scope,regionPopulation:ownArea.population,areaCount:areas.length,top:tops,notice:"Observed published cells only; national mean is based on comparable areas, not all 330 when suppression occurs."};
 }
 return {region,regionName:ownArea.name,scope,basis,side,page,pageSize,total:matches.length,rows:matches.slice(page*pageSize,(page+1)*pageSize).map(compact),notice:"Missing and suppressed counts excluded; population index uses pooled comparable-area population."};
}
// Adapt the existing private NDB schema without exposing source cells.
function normalizeNdb(db,areas,grain,scope){
 if(!["pref","secondary"].includes(grain)||!["include","exclude"].includes(scope))throw Error("invalid source filters");
 const source=db.areas[grain],key=grain==="pref"?16:17;
 const indices=areas.map(a=>{const matches=[];source.forEach((x,i)=>{if(String(x[0])===a.code)matches.push(i)});if(matches.length!==1)throw Error("unmapped or ambiguous geography: "+a.code);return matches[0]});
 const procedures=new Map();
 for(const r of db.rows){
  if(r[10]!=="count"||r[11]!==scope)continue;
  if(!Array.isArray(r[key])||r[key].length!==source.length)throw Error("invalid source row");
  let p=procedures.get(r[0]);if(!p){p={code:r[0],name:r[1],category:r[2],counts:Object.create(null)};procedures.set(r[0],p)}
  for(let j=0;j<areas.length;j++){
   const code=areas[j].code,v=r[key][indices[j]],prev=p.counts[code];
   // A partially suppressed total must not be treated as a complete count.
   p.counts[code]=prev===null||typeof v!=="number"||!Number.isFinite(v)||v<0?null:(prev??0)+v;
  }
 }
 return [...procedures.values()];
}
module.exports={profile,normalizeNdb};
