import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";

const ui=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const styles=readFileSync(new URL("../official-poc.css",import.meta.url),"utf8");
const a=ui.indexOf("const safeKey=()=>"),b=ui.indexOf("function persist(){",a);
const studioA=ui.indexOf('$("saveManagerKey").addEventListener(');
const studioB=ui.indexOf('$("aiGenerate").addEventListener(',studioA);
assert.ok(a>=0&&b>a&&studioA>=0&&studioB>studioA);
const auth=ui.slice(a,b),studio=ui.slice(studioA,studioB);

function simulate(fetchImpl,{savedKey=""}={}){
 const elements=new Map(),storage=new Map();
 if(savedKey)storage.set("signaldesk:manager:key",savedKey);
 const messages=[];
 const $=id=>{
  if(!elements.has(id))elements.set(id,{
   id,value:"",textContent:"",hidden:false,disabled:false,dataset:{},open:false,
   listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},
   focus(){}
  });
  return elements.get(id);
 };
 const ctx=createContext({$:id=>$(id),sessionStorage:{
  getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)
 },fetch:fetchImpl,AbortSignal,notify:(message,error)=>messages.push({message,error}),
   String,Date,Number,Error});
 runInContext(auth+studio,ctx);
 const exec=s=>runInContext(s,ctx);
 exec("renderAIConnectionState()");
 return {exec,$,storage,messages};
}
const good=async()=>new Response(JSON.stringify({ready:true,provider:"OpenAI"}),{status:200,headers:{"Content-Type":"application/json"}});
const denial=async()=>new Response(JSON.stringify({error:"Incorrect manager key"}),{status:401,headers:{"Content-Type":"application/json"}});
test("New Studio and Compose panels explicitly say AI not connected without a key",()=>{
 const t=simulate(good);
 assert.equal(t.$("studioAIStatusLabel").textContent,"AI not connected");
 assert.equal(t.$("composeAIStatusLabel").textContent,"AI not connected");
 assert.equal(t.$("composeConnectionState").textContent,"AI not connected");
 assert.equal(t.$("studioAIStatus").dataset.state,"disconnected");
 assert.equal(t.$("studioAIRecheck").hidden,true);
 assert.equal(t.$("studioAIDisconnect").hidden,true);
});
test("Studio verifies key with Netlify, then clearly says AI connected in both views",async()=>{
 let verified=0;
 const t=simulate(async(url,opts)=>{verified++;assert.equal(url,"/.netlify/functions/ai-status");
  assert.equal(opts.headers["x-manager-key"],"test-manager-abc");return good();});
 t.$("managerKey").value="test-manager-abc";
 await t.$("saveManagerKey").listeners.click();
 assert.equal(verified,1);
 assert.equal(t.$("studioAIStatusLabel").textContent,"AI connected");
 assert.equal(t.$("composeAIStatusLabel").textContent,"AI connected");
 assert.equal(t.$("studioAISummaryState").textContent,"AI connected");
 assert.equal(t.$("composeConnectionState").textContent,"AI connected");
 assert.equal(t.$("studioAIStatus").dataset.state,"connected");
 assert.match(t.$("studioAIStatusDetail").textContent,/Verified with Netlify/);
 assert.equal(t.$("managerKey").value,"");
 assert.equal(t.storage.get("signaldesk:manager:key"),"test-manager-abc");
 assert.equal(t.$("studioAIRecheck").hidden,false);
 assert.equal(t.$("studioAIDisconnect").hidden,false);
 assert.equal(t.$("saveManagerKey").textContent,"Change key");
 assert.doesNotMatch(t.$("studioAIStatusDetail").textContent,/test-manager-abc/);
});
test("A saved manager key starts at Checking, never Connected until Netlify verifies",async()=>{
 let release;
 const t=simulate(()=>new Promise(resolve=>{release=resolve}),{savedKey:"prior-manager"});
 assert.equal(t.$("studioAIStatusLabel").textContent,"Checking AI connection…");
 const check=t.exec("verifyAIConnection(managerKey,{remember:false})");
 assert.equal(t.$("composeAIStatus").dataset.state,"checking");
 release(await good());
 assert.equal(await check,true);
 assert.equal(t.$("studioAIStatusLabel").textContent,"AI connected");
});
test("A stale stored key does not masquerade as connected after Netlify denies it",async()=>{
 const t=simulate(denial,{savedKey:"old-manager"});
 assert.equal(await t.exec("verifyAIConnection(managerKey,{remember:false})"),false);
 assert.equal(t.$("studioAIStatusLabel").textContent,"AI connection issue");
 assert.equal(t.$("composeAIStatus").dataset.state,"error");
 assert.match(t.$("studioAIStatusDetail").textContent,/Incorrect manager key/);
 assert.equal(t.storage.has("signaldesk:manager:key"),false);
});
test("A connection network error keeps a visible issue state with recheck option",async()=>{
 const t=simulate(async()=>{throw new TypeError("Failed to fetch")},{savedKey:"existing-key"});
 assert.equal(await t.exec("verifyAIConnection(managerKey,{remember:false})"),false);
 assert.equal(t.$("studioAIStatusLabel").textContent,"AI connection issue");
 assert.match(t.$("studioAIStatusDetail").textContent,/could not reach/);
 assert.equal(t.$("studioAIRecheck").hidden,false);
 assert.equal(t.storage.get("signaldesk:manager:key"),"existing-key");
});
test("Disconnect visibly clears the connected state but preserves draft storage",async()=>{
 const t=simulate(good);
 t.$("managerKey").value="test-key";
 await t.$("saveManagerKey").listeners.click();
 t.$("studioAIDisconnect").listeners.click();
 assert.equal(t.$("studioAIStatusLabel").textContent,"AI not connected");
 assert.equal(t.$("composeAIStatusLabel").textContent,"AI not connected");
 assert.equal(t.storage.has("signaldesk:manager:key"),false);
 assert.equal(t.$("saveManagerKey").textContent,"Connect AI");
});
test("UI status stays visible without expanding settings and uses verified server readiness",()=>{
 for(const id of ["studioAIStatus","studioAIStatusLabel","studioAIStatusDetail",
  "composeAIStatus","composeAIStatusLabel","composeAIStatusDetail","studioAIRecheck",
  "studioAIDisconnect","studioAISummaryState"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/role="status" aria-live="polite"/);
 assert.match(styles,/\.ai-status-line\[data-state="connected"\]/);
 assert.match(styles,/\.ai-status-line\[data-state="error"\]/);
 assert.match(ui,/verifyAIConnection\(managerKey,\{remember:false\}\)/);
 assert.doesNotMatch(ui,/OPENAI_API_KEY\s*=/);
});
