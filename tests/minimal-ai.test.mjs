import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import handler from "../netlify/functions/ai-status.mjs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const ui=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../official-poc.css",import.meta.url),"utf8");

test("Simplified Discover / Studio / Published flow and expandable details",()=>{
 for(const name of ["discover","studio","published"]){
  assert.match(html,new RegExp('data-view="'+name+'"'));
  assert.match(html,new RegExp('id="'+name+'View"'));
 }
 for(const id of ["aiGenerate","aiSetupPanel","editorMessage","sourceVerified","markReady","copyFinal","publishDetails"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.doesNotMatch(html,/id="draftDialog"/);
 assert.match(html,/Generate 2 AI versions/);
 assert.match(css,/\.discover-layout/);
});
test("Real AI generates through server; never holds OpenAI API key in browser",()=>{
 assert.match(ui,/\.netlify\/functions\/draft/);
 assert.match(ui,/\.netlify\/functions\/ai-status/);
 assert.match(ui,/sessionStorage\.setItem\("signaldesk:manager:key"/);
 assert.doesNotMatch(ui,/localStorage\.setItem\([^)]*managerKey/i);
 assert.doesNotMatch(html,/id="openaiKey"/);
});
test("AI feature check requires manager secret, never exposes OpenAI secret",async()=>{
 const savedManager=process.env.MANAGER_ACCESS_KEY,savedOpenAI=process.env.OPENAI_API_KEY;
 try{
  delete process.env.MANAGER_ACCESS_KEY;
  let res=await handler(new Request("https://example.netlify.app/.netlify/functions/ai-status"));
  assert.equal(res.status,503);
  process.env.MANAGER_ACCESS_KEY="A-SECURE-TEST-MANAGER-KEY-12345";
  res=await handler(new Request("https://example.netlify.app/.netlify/functions/ai-status"));
  assert.equal(res.status,401);
  res=await handler(new Request("https://example.netlify.app/.netlify/functions/ai-status",{headers:{"x-manager-key":"WRONG"}}));
  assert.equal(res.status,401);
  delete process.env.OPENAI_API_KEY;
  res=await handler(new Request("https://example.netlify.app/.netlify/functions/ai-status",{headers:{"x-manager-key":process.env.MANAGER_ACCESS_KEY}}));
  assert.equal(res.status,200);
  assert.equal((await res.json()).ready,false);
  process.env.OPENAI_API_KEY="TEST-ONLY-NOT-A-REAL-KEY";
  res=await handler(new Request("https://example.netlify.app/.netlify/functions/ai-status",{headers:{"x-manager-key":process.env.MANAGER_ACCESS_KEY}}));
  const body=await res.json();
  assert.equal(body.ready,true);
  assert.deepEqual(body.variants,["news","insight"]);
  assert.doesNotMatch(JSON.stringify(body),/TEST-ONLY-NOT-A-REAL-KEY/);
 }finally{
  if(savedManager===undefined)delete process.env.MANAGER_ACCESS_KEY;else process.env.MANAGER_ACCESS_KEY=savedManager;
  if(savedOpenAI===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=savedOpenAI;
 }
});
