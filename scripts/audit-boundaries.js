"use strict";
// Audit the exact public boundary asset and the actual browser algorithm, without loading any NDB records.
const fs=require("node:fs"),assert=require("node:assert/strict"),crypto=require("node:crypto"),vm=require("node:vm");
const raw=fs.readFileSync("docs/assets/medical-areas-330.svg");
const blob=crypto.createHash("sha1").update("blob "+raw.length+"\0").update(raw).digest("hex");
assert.equal(blob,"670af173ddbfa3e8c4ef293b09b159b1362dd484","unexpected boundary asset");
const svg=raw.toString("utf8"),paths=[];
for(const match of svg.matchAll(/<path\b[^>]*>/g)){
 const attrs=Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
 if(!attrs["data-code"])continue;
 assert.match(attrs["data-code"],/^\d{4}$/);assert.ok(attrs.d);
 paths.push({code:attrs["data-code"],name:attrs["data-name"]||attrs["aria-label"]||attrs["data-code"],d:attrs.d});
}
assert.equal(paths.length,330);assert.equal(new Set(paths.map(p=>p.code)).size,330);
const app=fs.readFileSync("docs/assets/app.js","utf8");
const start=app.indexOf("function regionBoundaryEdges("),end=app.indexOf("let regionBoundaryCatalogPromise",start);
assert.ok(start>=0&&end>start);
const {regionBoundaryEdges,regionBoundaryCandidates}=vm.runInNewContext(app.slice(start,end)+"\n({regionBoundaryEdges,regionBoundaryCandidates})");
const links=new Map(),edges=new Map();
for(const p of paths){
 const e=regionBoundaryEdges(p.d);assert.ok(e.size,"empty parsed boundary "+p.code);
 for(const [k,v] of e){assert.ok(Number.isFinite(v)&&v>0);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([p.code,v]);}
 links.set(p.code,new Map());
}
for(const e of edges.values())for(let i=0;i<e.length;i++)for(let j=i+1;j<e.length;j++){
 const [a,n]=e[i],[b,m]=e[j];assert.ok(Math.abs(n-m)<1e-9);
 links.get(a).set(b,(links.get(a).get(b)||0)+n);links.get(b).set(a,(links.get(b).get(a)||0)+n);
}
let connected=0,isolated=0,pairs=0,crossPref=0;
for(const p of paths){
 const expected=[...links.get(p.code)].filter(([,v])=>v>=1).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const actual=regionBoundaryCandidates(paths,p.code);
 assert.deepEqual(JSON.parse(JSON.stringify(actual.map(r=>r.code))),expected.map(r=>r[0]),"neighbor mismatch "+p.code);
 if(expected.length)connected++;else isolated++;
 for(const [code] of expected)if(p.code<code){pairs++;if(p.code.slice(0,2)!==code.slice(0,2))crossPref++}
}
const sample=paths.filter(p=>p.code.startsWith("17")).map(p=>({code:p.code,name:p.name,candidates:[...links.get(p.code)].filter(([,v])=>v>=1).sort((a,b)=>b[1]-a[1]).map(([code])=>({code,name:paths.find(p=>p.code===code).name}))}));
console.log(JSON.stringify({assetBlob:blob,regions:paths.length,connected,isolated,pairs,crossPref,sample,status:"passed"}));
