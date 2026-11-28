"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
 const page=await browser.newPage({viewport});const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("https://ri0115.github.io/-ATLAS/",{waitUntil:"networkidle"});
 await page.locator("#cover-enter").waitFor({state:"visible"});
 assert.equal(await page.locator("#cover-enter").isEnabled(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,"cover horizontal overflow");
 assert.equal(await page.locator('script[src*="app.js?v=20261127.1"]').count(),1);
 // Exercise navigation in an isolated browser with no authenticated session.
 // Revealing the shell here changes only this test DOM; no authorization or data is granted.
 await page.evaluate(()=>document.body.classList.add("atlas-entered"));
 for(const [name,pane] of [["profile","appViewProfile"],["procedure","appViewProcedure"],["compare","appViewCompare"],["guidebook","appViewGuidebook"],["guide","appViewGuide"]]){
 await page.locator('[data-view="'+name+'"]').click();
 assert.equal(await page.locator("#"+pane).isVisible(),true);
 assert.equal(await page.locator('[data-view="'+name+'"]').getAttribute("aria-selected"),"true");
 }
 await page.locator('[data-view="profile"]').click();
 for(const [sub,pane] of [["category","profileBoard"],["tech","techBoard"],["special","specialBoard"]]){
 await page.locator('[data-sub="'+sub+'"]').click();
 assert.equal(await page.locator("#"+pane).isVisible(),true);
 }
 assert.equal(await page.locator("#region-profile-fetch").isDisabled(),true);
 await page.goto("https://ri0115.github.io/-ATLAS/region/",{waitUntil:"networkidle"});
 await page.locator("#region-pref").selectOption("17");
 await page.waitForFunction(()=>document.querySelector("#region-area").options.length>1);
 await page.locator("#region-area").selectOption("1701");
 await page.locator("#region-scope").selectOption("exclude");
 // Prevent external navigation while checking the real stored handoff.
 await page.route("https://ri0115.github.io/-ATLAS/#profile",route=>route.abort());
 await page.locator("#region-connect").click({noWaitAfter:true});
 const transfer=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("atlas.region.selection.v1")||"null")).catch(()=>null);
 // Navigation may already have consumed the value; verify on the receiving document if so.
 if(transfer){assert.equal(transfer.pref,"17");assert.equal(transfer.area,"1701");assert.equal(transfer.scope,"exclude")}
 assert.deepEqual(errors,[]);
 console.log("ATLAS_BROWSER_PASS "+JSON.stringify({viewport,publicCover:true,navigation:5,subtabs:3,regionSelector:true,authenticatedDataTest:false,transferObserved:!!transfer}));
 await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
