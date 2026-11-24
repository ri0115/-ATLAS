"use strict";
function validateRegionProfile(path){
 if(typeof path!=="string"||path.length>512)return false;
 let u;try{u=new URL(path,"https://atlas.invalid")}catch{return false}
 if(u.origin!=="https://atlas.invalid"||u.hash||u.pathname!=="/v1/region-profile")return false;
 const q=u.searchParams,allowed=new Set(["region","scope","grain","mode","basis","side","q","page","pageSize"]);
 for(const k of q.keys())if(!allowed.has(k)||q.getAll(k).length!==1)return false;
 const grain=q.get("grain"),region=q.get("region")||"";
 return ["pref","secondary"].includes(grain)&&(grain==="pref"?/^(0[1-9]|[1-3][0-9]|4[0-7])$/:/^(0[1-9]|[1-3][0-9]|4[0-7])[0-9]{2}$/).test(region)&&["include","exclude"].includes(q.get("scope"))&&["highlights","list"].includes(q.get("mode"))&&(!q.has("basis")||["raw","population"].includes(q.get("basis")))&&(!q.has("side")||["high","low","all"].includes(q.get("side")))&&(!q.has("q")||q.get("q").length<=100)&&(!q.has("page")||/^\d{1,6}$/.test(q.get("page"))&&Number(q.get("page"))<=100000)&&(!q.has("pageSize")||/^\d{1,3}$/.test(q.get("pageSize"))&&Number(q.get("pageSize"))>=1&&Number(q.get("pageSize"))<=100);
}
module.exports={validateRegionProfile};
