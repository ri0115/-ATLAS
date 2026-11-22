"use strict";
/* Pure ranking engine. No private records or credentials are included here.
   Input rows are supplied by the protected regional aggregation API. */
(function(root){
const finite=x=>typeof x==="number"&&Number.isFinite(x);
function analyze(payload){
 const {regionCode,areas,items}=payload;
 if(!Array.isArray(areas)||!Array.isArray(items)||!regionCode)throw Error("Invalid regional ranking payload");
 const areaMap=new Map(areas.map(a=>[a.code,a]));
 const selected=areaMap.get(regionCode);
 if(!selected||!finite(selected.population)||selected.population<=0)throw Error("Selected region has no valid population");
 const output=[];
 for(const item of items){
  const values=item.areas||{};
  const eligible=areas.filter(a=>finite(a.population)&&a.population>0&&finite(values[a.code])&&values[a.code]>=0);
  const own=values[regionCode];
  if(!finite(own)||own<0||eligible.length<2)continue;
  const total=eligible.reduce((s,a)=>s+values[a.code],0);
  const population=eligible.reduce((s,a)=>s+a.population,0);
  const rawMean=total/eligible.length,perCapMean=total/population*10000;
  const ownPerCap=own/selected.population*10000;
  const metrics={raw:{value:own,average:rawMean},population:{value:ownPerCap,average:perCapMean}};
  for(const [basis,m] of Object.entries(metrics)){
   m.ratio=m.average>0?m.value/m.average:null;
   m.index=m.ratio===null?null:100*m.ratio;
   m.difference=m.value-m.average;
   const sorted=eligible.map(a=>({code:a.code,value:basis==="raw"?values[a.code]:values[a.code]/a.population*10000})).sort((a,b)=>b.value-a.value||a.code.localeCompare(b.code));
   const higher=sorted.filter(a=>a.value>m.value).length;
   const lower=sorted.filter(a=>a.value<m.value).length;
   m.rank=higher+1;m.worstRank=lower+1;m.eligible=sorted.length;
   m.ties=sorted.length-higher-lower;
  }
  output.push({code:item.code,name:item.name,category:item.category||"",count:own,metrics});
 }
 function top(basis,side){
  return output.filter(x=>x.metrics[basis].index!==null&&(side==="high"?x.metrics[basis].index>100:x.metrics[basis].index<100))
   .sort((a,b)=>side==="high"?b.metrics[basis].index-a.metrics[basis].index:a.metrics[basis].index-b.metrics[basis].index).slice(0,30);
 }
 return {regionCode,eligibleItems:output.length,all:output,top:{rawHigh:top("raw","high"),rawLow:top("raw","low"),populationHigh:top("population","high"),populationLow:top("population","low")}};
}
root.AtlasRegionRanking={analyze};
})(typeof window!=="undefined"?window:globalThis);
