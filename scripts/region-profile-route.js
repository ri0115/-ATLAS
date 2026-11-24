"use strict";
const {profile,normalizeNdb}=require("./region-profile-api");
// Mount only behind the existing session authorization middleware.
// source() supplies the private database and canonical geographic mapping.
function createRegionProfileRoute(source,previous){
 return async function(req,res){
  const u=new URL(req.url,"https://localhost");
  if(u.pathname!=="/v1/region-profile")return previous(req,res);
  const send=(status,data)=>{res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","private, no-store");res.end(JSON.stringify(data))};
  if(req.method!=="GET")return send(405,{error:"method not allowed"});
  const region=u.searchParams.get("region")||"",grain=u.searchParams.get("grain")||"",scope=u.searchParams.get("scope")||"include",basis=u.searchParams.get("basis")||"raw",side=u.searchParams.get("side")||"high",mode=u.searchParams.get("mode")||"list",q=u.searchParams.get("q")||"";
  if(!["pref","secondary"].includes(grain)||!(grain==="pref"?/^[0-9]{2}$/:/^[0-9]{4}$/).test(region)||!["include","exclude"].includes(scope)||!["raw","population"].includes(basis)||!["high","low","all"].includes(side)||!["list","highlights"].includes(mode)||q.length>100)return send(400,{error:"invalid filters"});
  try{
   const {db,areas,procedures}=await source({grain,scope});
   if(!areas.some(a=>a.code===region))return send(404,{error:"unknown region"});
   const rows=procedures||normalizeNdb(db,areas,grain,scope);
   return send(200,profile({areas,procedures:rows,region,scope,basis,side,mode,q,page:u.searchParams.get("page"),pageSize:u.searchParams.get("pageSize")}));
  }catch(e){return send(500,{error:"regional profile unavailable"})}
 };
}
module.exports={createRegionProfileRoute};
