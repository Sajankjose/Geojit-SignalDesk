import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import preview,{checkedNewsURL} from "../netlify/functions/news-preview.mjs";
const ui=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");

test("Unsupported Yahoo Finance source triggers inline headline fallback rather than misleading Studio login",()=>{
 assert.equal(checkedNewsURL("https://finance.yahoo.com/technology/ai/articles/shares-google-owner-alphabet-sink-204437200.html"),null);
 assert.match(ui,/!canPreviewUrl\(url\)&&\$\("composeHeadline"\)\.value\.trim\(\)\.length<12/);
 assert.match(ui,/showManualLinkHelp\("This source is link-only/);
 assert.match(ui,/\$\("composeFallback"\)\.open=true/);
 assert.match(html,/id="composeLinkHelp"/);
 assert.match(html,/id="composeFallback"/);
});
test("Generate automatically validates inline entered manager key and doesn't require separate Studio visit",()=>{
 assert.match(ui,/if\(\$\("composeManagerKey"\)\.value\.trim\(\)\)\{/);
 assert.match(ui,/const connected=await connectComposerAI\(\)/);
 assert.match(ui,/if\(!connected\)return/);
 assert.match(ui,/updateComposeConnection\(\)/);
 assert.doesNotMatch(ui,/Connect AI in Studio first/);
});
test("Short existing keys work consistently across AI readiness and metadata preview",async()=>{
 const previous=process.env.MANAGER_ACCESS_KEY;
 const originalFetch=globalThis.fetch;
 try{
  process.env.MANAGER_ACCESS_KEY="valid-test-key";
  globalThis.fetch=async()=>new Response('<html><head><meta property="og:title" content="RBI approves new regulation for payment services"><meta name="description" content="Official announcement"></head></html>',{status:200,headers:{"content-type":"text/html"}});
  const base="https://example.com/.netlify/functions/news-preview";
  const good=new Request(base,{method:"POST",headers:{"Content-Type":"application/json","x-manager-key":"valid-test-key"},body:JSON.stringify({url:"https://www.rbi.org.in/example"})});
  const res=await preview(good); assert.equal(res.status,200);
  const data=await res.json();assert.match(data.title,/RBI approves/);
  assert.equal(data.previewOnly,true);
  const denied=await preview(new Request(base,{method:"POST",headers:{"x-manager-key":"wrong","Content-Type":"application/json"},body:JSON.stringify({url:"https://www.rbi.org.in/example"})}));
  assert.equal(denied.status,401);
  assert.match((await denied.json()).error,/Connect.*Create from news/);
  const yahoo=await preview(new Request(base,{method:"POST",headers:{"x-manager-key":"valid-test-key","Content-Type":"application/json"},body:JSON.stringify({url:"https://finance.yahoo.com/news/example"})}));
  assert.equal(yahoo.status,422);
 }finally{
  globalThis.fetch=originalFetch;
  if(previous===undefined)delete process.env.MANAGER_ACCESS_KEY;else process.env.MANAGER_ACCESS_KEY=previous;
 }
});
test("No unlicensed Yahoo scraping and no X auto publishing",()=>{
 assert.doesNotMatch(ui,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/);
 assert.doesNotMatch(readFileSync(new URL("../netlify/functions/news-preview.mjs",import.meta.url),"utf8"),/"yahoo\.com"/);
});
