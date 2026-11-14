import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import handler,{normalizeNews,drishtiNews} from "../netlify/functions/drishti-news.mjs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const url="https://geojitsignaldesk.netlify.app/.netlify/functions/drishti-news";
const now=Date.parse("2026-11-14T09:00:00Z");
const previousEnv={manager:process.env.MANAGER_ACCESS_KEY,key:process.env.DRISHTI_API_KEY};
const reset=()=>{
 if(previousEnv.manager===undefined)delete process.env.MANAGER_ACCESS_KEY;
 else process.env.MANAGER_ACCESS_KEY=previousEnv.manager;
 if(previousEnv.key===undefined)delete process.env.DRISHTI_API_KEY;
 else process.env.DRISHTI_API_KEY=previousEnv.key;
};
const validRecord={
 id:"news-1001",title:"Company announces quarterly financial results with revenue growth",
 summary:"The company provided results for the quarter.",
 link:"https://example.com/financial-results",date:"2026-11-13T12:00:00Z",
 source:"Original publisher",company:"Example Ltd",symbol:"EXAMPLE",sentiment:"neutral"
};
test("Only dated safe, deduplicated news metadata is retained",()=>{
 const list=normalizeNews([
  validRecord,{...validRecord,id:"other"},
  {...validRecord,link:"http://example.com/plaintext"},
  {...validRecord,link:"https://localhost/secrets"},
  {...validRecord,link:"https://example.com/future",date:"2027-01-01T00:00:00Z"},
  {...validRecord,link:"https://example.com/old",date:"2025-01-01T00:00:00Z"},
  {...validRecord,link:"https://example.com/nodate",date:null}
 ],now);
 assert.equal(list.length,1);
 assert.equal(list[0].provider,"Drishti");
 assert.equal(list[0].licensing,"internal_preview_only");
 assert.equal(list[0].publisher,"Original publisher");
 assert.equal(list[0].publishedAt,"2026-11-13T12:00:00.000Z");
 assert.ok(!("apiKey" in list[0]));
});
test("Manager authentication and key configuration block unauthorised or unconfigured access",async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=()=>{throw Error("Upstream must not be contacted")};
 try{
  process.env.MANAGER_ACCESS_KEY="sample-manager";
  process.env.DRISHTI_API_KEY="fake-secret";
  let r=await handler(new Request(url+"?mode=status"));
  assert.equal(r.status,401);
  assert.equal((await r.json()).code,"manager_required");
  r=await handler(new Request(url+"?mode=news",{headers:{"x-manager-key":"wrong"}}));
  assert.equal(r.status,401);
  delete process.env.DRISHTI_API_KEY;
  r=await handler(new Request(url+"?mode=status",{headers:{"x-manager-key":"sample-manager"}}));
  assert.equal(r.status,503);
  assert.equal((await r.json()).code,"not_configured");
 }finally{globalThis.fetch=old;reset()}
});
test("Keyless account status is free and reveals only plan, available credits and News scope",async()=>{
 const old=globalThis.fetch;
 try{
  process.env.MANAGER_ACCESS_KEY="sample-manager";
  process.env.DRISHTI_API_KEY="fake-secret";
  globalThis.fetch=async (provider,opts)=>{
   assert.equal(provider,"https://developers.manasija.in/v1/account");
   assert.equal(opts.headers["X-API-Key"],"fake-secret");
   assert.equal(opts.redirect,"error");
   return new Response(JSON.stringify({data:{
    name:"Private organisation",account_id:"secret-internal-account",
    balance:950,metadata:{subscription_plan_name:"Sandbox"},
    products:[{product:"news",enabled:true}]
   }}),{status:200});
  };
  const r=await handler(new Request(url+"?mode=status",{headers:{"x-manager-key":"sample-manager"}}));
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.newsEnabled,true);
  assert.equal(body.credits,950);
  assert.equal(body.plan,"Sandbox");
  assert.doesNotMatch(JSON.stringify(body),/fake-secret|secret-internal-account|Private organisation/);
 }finally{globalThis.fetch=old;reset()}
});
test("News requires explicit mode=news, one fixed upstream call, and respects 15-minute cache",async()=>{
 const old=globalThis.fetch;
 let calls=0;
 try{
  process.env.MANAGER_ACCESS_KEY="sample-manager";
  process.env.DRISHTI_API_KEY="fake-secret";
  globalThis.fetch=async (provider,opts)=>{
   calls++;
   assert.equal(provider,"https://developers.manasija.in/v1/news?page=1&limit=20");
   assert.equal(opts.headers["X-API-Key"],"fake-secret");
   return new Response(JSON.stringify({data:[{...validRecord,date:new Date(Date.now()-60_000).toISOString()}],has_next:true}),{status:200});
  };
  const req=()=>new Request(url+"?mode=news",{headers:{"x-manager-key":"sample-manager"}});
  const first=await handler(req());const data=await first.json();
  assert.equal(first.status,200);
  assert.equal(data.count,1);
  assert.equal(data.source,"Drishti News API");
  assert.equal(data.hasNext,true);
  assert.equal(calls,1);
  const next=await handler(req());
  assert.equal((await next.json()).cached,true);
  assert.equal(calls,1);
 }finally{globalThis.fetch=old;reset()}
});
test("Provider failures do not expose API key or substitute made-up headlines",async()=>{
 const old=globalThis.fetch;
 try{
  process.env.MANAGER_ACCESS_KEY="sample-manager";
  process.env.DRISHTI_API_KEY="fake-secret";
  globalThis.fetch=async()=>new Response(JSON.stringify({detail:"Invalid API key"}),{status:401});
  const r=await handler(new Request(url+"?mode=status",{headers:{"x-manager-key":"sample-manager"}}));
  const body=await r.json();
  assert.equal(r.status,401);
  assert.equal(body.code,"invalid_key");
  assert.doesNotMatch(JSON.stringify(body),/fake-secret/);
 }finally{globalThis.fetch=old;reset()}
});
test("Drishti is manager-only, not silently merged into public or AI content",()=>{
 assert.match(html,/data-source="Drishti"/);
 for(const id of ["drishtiPanel","drishtiCheck","drishtiLoad","drishtiStatus","drishtiList"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/No automatic AI drafting or X publishing from Drishti content/);
 assert.match(js,/source==="all"\?\[\.\.\.payload.stories,\.\.\.pibStories,\.\.\.mojoStories\]/);
 assert.match(js,/drishtiRequest\("news"\)/);
 assert.match(js,/if\(!managerKey\)throw Error/);
 assert.match(js,/drishtiLoad"\)\.addEventListener\("click"/);
 assert.doesNotMatch(js,/DRISHTI_API_KEY/);
});
