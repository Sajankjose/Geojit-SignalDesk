import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import handler,{normaliseMarketaux} from "../netlify/functions/marketaux-news.mjs";

const h=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const now=Date.UTC(2026,9,29,10,30,0);
const examples=[
  {uuid:"ind-1",title:"HDFC Bank revises lending rates after policy statement",description:"Financial publisher meta description",url:"https://www.thehindubusinessline.com/money-and-banking/article.html",published_at:new Date(now-3600_000).toISOString(),source:"thehindubusinessline.com"},
  {uuid:"ind-2",title:"Indian stocks trade mixed as quarterly results emerge",description:"Some market news",url:"https://www.livemint.com/market/stock-market-news/sample.html",published_at:new Date(now-7200_000).toISOString(),source:"livemint.com"},
  {uuid:"ind-3",title:"Bad source in data",description:"Unsafe URL",url:"http://insecure.example/news",published_at:new Date(now).toISOString(),source:"unknown"}
];
const req=(key="test-manager")=>new Request("https://geojitsignaldesk.netlify.app/.netlify/functions/marketaux-news",{headers:{"x-manager-key":key}});
test("Normalize only fresh, valid, trusted HTTPS publisher metadata",()=>{
 const results=normaliseMarketaux(examples,now);
 assert.equal(results.length,2);
 assert.ok(results.every(x=>x.provider==="Marketaux"&&!x.official));
 assert.ok(results.every(x=>x.priority<=76));
 assert.equal(results[0].publisher,"thehindubusinessline.com");
 assert.equal(results[0].id,"marketaux:ind-1");
 assert.ok(results[0].reason.includes("Publisher-reported"));
 assert.equal(results[0].snippet,"Financial publisher meta description");
});
test("Marketaux cannot fetch without a manager key and separate permission",async()=>{
 const oldToken=process.env.MARKETAUX_API_TOKEN,oldGrant=process.env.MARKETAUX_USAGE_APPROVED,oldManager=process.env.MANAGER_ACCESS_KEY;
 const oldFetch=globalThis.fetch;let calls=0;
 try{
  process.env.MANAGER_ACCESS_KEY="test-manager";
  process.env.MARKETAUX_API_TOKEN="private-test-token";
  delete process.env.MARKETAUX_USAGE_APPROVED;
  globalThis.fetch=async()=>{calls++;throw Error("Never fetch when unapproved")};
  const missing=await handler(req("wrong"));assert.equal(missing.status,401);
  const blocked=await handler(req());assert.equal(blocked.status,403);
  const error=await blocked.json();assert.match(error.error,/pending confirmation/);
  assert.equal(calls,0);
  process.env.MARKETAUX_USAGE_APPROVED="true";
  delete process.env.MARKETAUX_API_TOKEN;
  assert.equal((await handler(req())).status,503);
  assert.equal(calls,0);
 }finally{
  globalThis.fetch=oldFetch;
  for(const [k,v] of [["MARKETAUX_API_TOKEN",oldToken],["MARKETAUX_USAGE_APPROVED",oldGrant],["MANAGER_ACCESS_KEY",oldManager]]){
   if(v===undefined)delete process.env[k];else process.env[k]=v;
  }
 }
});
test("Approved request uses India-entity filter and free three-article cap without leaking API token",async()=>{
 const prev=Object.fromEntries(["MARKETAUX_API_TOKEN","MARKETAUX_USAGE_APPROVED","MANAGER_ACCESS_KEY"].map(k=>[k,process.env[k]]));
 const old=globalThis.fetch;let count=0;
 try{
  process.env.MARKETAUX_API_TOKEN="PRIVATE_TEST_MARKETAUX_TOKEN";
  process.env.MARKETAUX_USAGE_APPROVED="true";
  process.env.MANAGER_ACCESS_KEY="test-manager";
  globalThis.fetch=async (url,opts)=>{
   count++;
   const u=new URL(url);
   assert.equal(u.hostname,"api.marketaux.com");
   assert.equal(u.pathname,"/v1/news/all");
   assert.equal(u.searchParams.get("api_token"),"PRIVATE_TEST_MARKETAUX_TOKEN");
   assert.equal(u.searchParams.get("countries"),"in");
   assert.equal(u.searchParams.get("language"),"en");
   assert.equal(u.searchParams.get("limit"),"3");
   assert.equal(opts.redirect,"error");
   return new Response(JSON.stringify({data:[{
    ...examples[0],
    published_at:new Date().toISOString()
   }],meta:{returned:1,limit:3}}),{headers:{"content-type":"application/json"}});
  };
  const response=await handler(req());
  assert.equal(response.status,200);
  const text=await response.text();
  assert.doesNotMatch(text,/PRIVATE_TEST_MARKETAUX_TOKEN/);
  const payload=JSON.parse(text);
  assert.equal(payload.stories.length,1);
  assert.equal(payload.stories[0].provider,"Marketaux");
  const again=await handler(req());
  assert.equal(again.status,200);
  assert.equal(count,1,"Request is server-cached on the same instance");
 }finally{
  globalThis.fetch=old;
  for(const [k,v] of Object.entries(prev)){if(v===undefined)delete process.env[k];else process.env[k]=v}
 }
});
test("Discover shows segregated Indian Markets source; no scheduled Marketaux polling",()=>{
 assert.match(h,/data-source="Marketaux"/);
 for(const id of ["marketauxPanel","marketauxLoad","marketauxStatus","marketauxAuth","marketauxManagerKey","marketauxConnect"])assert.ok(h.includes('id="'+id+'"'),id);
 assert.match(js,/function loadMarketaux\(/);
 assert.match(js,/source==="Marketaux"/);
 assert.match(js,/marketauxLoadedAt<45\*60_000/);
 assert.match(js,/provider==="Marketaux"/);
 assert.match(js,/publisher headline and short description only/);
 assert.doesNotMatch(js,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/);
});
