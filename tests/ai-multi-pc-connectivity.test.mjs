import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";
import aiStatus from "../netlify/functions/ai-status.mjs";
const ui=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const a=ui.indexOf("async function checkComposerEndpoint()"),b=ui.indexOf("const getHost=",a);
assert.ok(a>=0&&b>a,"Composer AI diagnostic and connect are present");
const handlers=ui.slice(a,b);
const authStart=ui.indexOf("const safeKey=()=>"),authEnd=ui.indexOf("function persist(){",authStart);
assert.ok(authStart>=0&&authEnd>authStart,"Shared AI connection state helpers are present");
const authentication=ui.slice(authStart,authEnd);
function simulate(fetchImpl){
 const uiElements=new Map();
 const $=id=>{
  if(!uiElements.has(id))uiElements.set(id,{value:"",textContent:"",disabled:false,open:false,hidden:false,dataset:{},focus(){}});
  return uiElements.get(id);
 };
 $("composeManagerKey").value="test-manager-key";
 const messages=[];
 const calls=[];
 const localFetch=async(url,options)=>{calls.push({url,options});return fetchImpl(url,options)};
 const storage=new Map();
 const ctx=createContext({$:id=>$(id),fetch:localFetch,AbortSignal,
  sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  composeNotice:(m,failed)=>messages.push({m,failed}),
  updateComposeConnection(){},String,Error,Date});
 runInContext(authentication+handlers,ctx);
 return {ctx,$,calls,messages,storage,run:expression=>runInContext(expression,ctx)};
}
test("Two independent browsers can simultaneously authenticate; backend has no single-session limit",async()=>{
 const previous={manager:process.env.MANAGER_ACCESS_KEY,api:process.env.OPENAI_API_KEY};
 try{
  process.env.MANAGER_ACCESS_KEY="test-manager-key";
  process.env.OPENAI_API_KEY="test-openai-only-server-side";
  const req=()=>new Request("https://geojitsignaldesk.netlify.app/.netlify/functions/ai-status",{headers:{"x-manager-key":"test-manager-key"}});
  const [first,second]=await Promise.all([aiStatus(req()),aiStatus(req())]);
  assert.equal(first.status,200);
  assert.equal(second.status,200);
  assert.equal((await first.json()).ready,true);
  assert.equal((await second.json()).ready,true);
 }finally{
  if(previous.manager===undefined)delete process.env.MANAGER_ACCESS_KEY;else process.env.MANAGER_ACCESS_KEY=previous.manager;
  if(previous.api===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous.api;
 }
});
test("Anonymous connectivity check treats 401 as healthy endpoint reachability, never sends a manager key",async()=>{
 const e=simulate(async()=>new Response(JSON.stringify({error:"Incorrect manager key"}),{status:401,headers:{"content-type":"application/json"}}));
 await e.run("checkComposerEndpoint()");
 assert.equal(e.calls.length,1);
 assert.equal(e.calls[0].url,"/.netlify/functions/ai-status");
 assert.equal(e.calls[0].options.headers,undefined);
 assert.match(e.$("composeDiagnostic").textContent,/endpoint reachable/i);
 assert.match(e.$("composeDiagnostic").textContent,/HTTP 401/);
});
test("Network block is reported without blaming OpenAI configuration",async()=>{
 const e=simulate(async()=>{throw new TypeError("Failed to fetch")});
 await e.run("connectComposerAI()");
 assert.match(e.messages.at(-1).m,/could not reach the AI endpoint/i);
 assert.equal(e.$("studioAIStatusLabel").textContent,"AI connection issue");
 assert.equal(e.$("composeAIStatusLabel").textContent,"AI connection issue");
 assert.doesNotMatch(e.messages.at(-1).m,/Check Netlify settings/);
 assert.equal(e.$("composeCredentials").open,true);
 assert.equal(e.calls[0].options.headers["x-manager-key"],"test-manager-key");
 await e.run("checkComposerEndpoint()");
 assert.match(e.$("composeDiagnostic").textContent,/could not reach the AI endpoint/i);
 assert.equal(e.calls[1].options.headers,undefined);
});
test("Backend access denial is distinguished from a network error",async()=>{
 const e=simulate(async()=>new Response(JSON.stringify({error:"Incorrect manager key. Check MANAGER_ACCESS_KEY in Netlify."}),{status:401}));
 await e.run("connectComposerAI()");
 assert.match(e.messages.at(-1).m,/Incorrect manager key/);
 assert.doesNotMatch(e.messages.at(-1).m,/could not reach/i);
});
test("A missing Netlify AI function produces actionable diagnostics",async()=>{
 const e=simulate(async()=>new Response(null,{status:404}));
 await e.run("checkComposerEndpoint()");
 assert.match(e.$("composeDiagnostic").textContent,/HTTP 404/);
 assert.match(e.$("composeDiagnostic").textContent,/production deploy/);
});
test("Existing AI backend is safely shared, but each browser must connect separately",()=>{
 assert.match(html,/id="composeCheckEndpoint"/);
 assert.match(html,/id="composeDiagnostic"/);
 assert.match(html,/Each computer connects independently/);
 assert.match(html,/target="_blank"/);
 assert.match(ui,/sessionStorage\.setItem\("signaldesk:manager:key"/);
 assert.doesNotMatch(ui,/localStorage\.setItem\("signaldesk:manager:key"/);
 assert.match(ui,/\$\("composeCheckEndpoint"\)\.addEventListener\("click",checkComposerEndpoint\)/);
 assert.doesNotMatch(ui,/OPENAI_API_KEY\s*=/);
});
