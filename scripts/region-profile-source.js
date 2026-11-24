"use strict";
const {normalizeNdb}=require("./region-profile-api");
const AKITA=Object.freeze({"0501":"0501","0502":"0501","0503":"0501","0504":"0502","0505":"0502","0506":"0503","0507":"0503","0508":"0503"});
function createRegionSource({db,regional,population,crosswalk=AKITA}){
 const canonical=Object.keys(regional).sort().map(code=>({code,name:regional[code].name,population:population.areas[code]?.population}));
 if(canonical.length!==330||canonical.some(a=>!Number.isSafeInteger(a.population)||a.population<=0)||canonical.reduce((s,a)=>s+a.population,0)!==124885175)throw Error("canonical geography mismatch");
 const prefs=db.areas.pref.map(([code,name])=>({code:String(code),name,population:canonical.filter(a=>a.code.startsWith(String(code))).reduce((s,a)=>s+a.population,0)}));
 if(prefs.length!==47||new Set(prefs.map(a=>a.code)).size!==47||prefs.some(a=>a.population<=0))throw Error("prefecture mismatch");
 const index=new Map(canonical.map((a,i)=>[a.code,i])),seen=new Set(),groups=canonical.map(()=>[]);
 db.areas.secondary.forEach(([code],i)=>{code=String(code);if(seen.has(code))throw Error("duplicate source geography");seen.add(code);const dest=crosswalk[code]||code,j=index.get(dest);if(j===undefined||dest.slice(0,2)!==code.slice(0,2))throw Error("unmapped geography");groups[j].push(i)});
 if(groups.some(g=>!g.length)||db.areas.secondary.length!==335)throw Error("incomplete crosswalk");
 const cache=new Map();
 return ({grain,scope})=>{
  const key=grain+":"+scope;if(cache.has(key))return cache.get(key);
  const areas=grain==="pref"?prefs:canonical;
  let source=db;
  if(grain==="secondary"){
   source={areas:{...db.areas,secondary:canonical.map(a=>[a.code,a.name])},rows:db.rows.filter(r=>r[10]==="count"&&r[11]===scope).map(r=>{const out=r.slice();out[17]=groups.map(g=>{const vals=g.map(i=>r[17][i]);return vals.every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0)?vals.reduce((s,v)=>s+v,0):null});return out})};
  }
  const result={areas,procedures:normalizeNdb(source,areas,grain,scope)};cache.set(key,result);return result;
 };
}
module.exports={createRegionSource,AKITA};
