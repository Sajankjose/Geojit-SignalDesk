import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRSS } from "../netlify/functions/news.mjs";
import { checkPayload } from "../netlify/functions/workspace.mjs";
import { allowed, originOK } from "../netlify/functions/lib/auth.mjs";

test("RSS parser keeps original source attribution, link and date",()=>{
 const xml='<rss><channel><item><title><![CDATA[RBI updates policy framework]]></title><link>https://rbi.org.in/pressrelease</link><description>Monetary policy update</description><pubDate>Fri, 23 Oct 2026 05:25:00 GMT</pubDate></item></channel></rss>';
 const items=parseRSS(xml,{name:"RBI",official:true});
 assert.equal(items.length,1);
 assert.equal(items[0].publisher,"RBI");
 assert.equal(items[0].title,"RBI updates policy framework");
 assert.equal(items[0].url,"https://rbi.org.in/pressrelease");
 assert.equal(items[0].publishedAt,"2026-10-23T05:25:00.000Z");
});

test("Missing/invalid date and untrusted non-http link are discarded",()=>{
 const xml='<rss><item><title>Unknown</title><link>javascript:alert(1)</link><pubDate>bad</pubDate></item></rss>';
 assert.deepEqual(parseRSS(xml,{name:"SEBI",official:true}),[]);
});

test("Manager endpoints reject short/unset keys and wrong key",()=>{
 const old=process.env.MANAGER_ACCESS_KEY;
 try{
  delete process.env.MANAGER_ACCESS_KEY;
  assert.equal(allowed(new Request("https://app.example/.netlify/functions/news",{headers:{"x-manager-key":"abc"}})),false);
  process.env.MANAGER_ACCESS_KEY="this-is-a-test-manager-key-longer-than-24";
  assert.equal(allowed(new Request("https://app.example/.netlify/functions/news",{headers:{"x-manager-key":"incorrect"}})),false);
  assert.equal(allowed(new Request("https://app.example/.netlify/functions/news",{headers:{"x-manager-key":process.env.MANAGER_ACCESS_KEY}})),true);
 }finally{if(old===undefined)delete process.env.MANAGER_ACCESS_KEY;else process.env.MANAGER_ACCESS_KEY=old}
});

test("Cross-origin API requests are rejected",()=>{
 assert.equal(originOK(new Request("https://app.example/.netlify/functions/workspace",{headers:{origin:"https://other.example"}})),false);
 assert.equal(originOK(new Request("https://app.example/.netlify/functions/workspace",{headers:{origin:"https://app.example"}})),true);
});

const valid=()=>({drafts:{a:{status:"Draft",variant:"news",variants:{news:"A factual update",insight:""}}},manual:[],savedStories:{},settings:{disclosure:"Test prefix"},seen:{}});
test("Workspace accepts bounded current-day data, rejects bad shape and source URLs",()=>{
 assert.equal(checkPayload(valid()),true);
 const oversize=valid();oversize.settings.disclosure="x".repeat(301);
 assert.equal(checkPayload(oversize),false);
 const malicious=valid();malicious.manual=[{id:"bad",title:"Bad",publisher:"Bad",url:"javascript:alert(1)",snippet:""}];
 assert.equal(checkPayload(malicious),false);
});

test("There is no X automation or tweet API endpoint",()=>{
 const ui=readFileSync(new URL("../app.js",import.meta.url),"utf8");
 const source=readFileSync(new URL("../netlify/functions/draft.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(ui,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/i);
 assert.doesNotMatch(source,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/i);
 assert.match(ui,/https:\/\/x\.com\/compose\/post/);
});
