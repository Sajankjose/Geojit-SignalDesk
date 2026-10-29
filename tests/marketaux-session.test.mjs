import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import sessionHandler,{marketauxReadiness} from "../netlify/functions/marketaux-session.mjs";
import marketauxHandler from "../netlify/functions/marketaux-news.mjs";
import {COOKIE_NAME,SESSION_SECONDS,makeSessionCookie,sessionValid,managerKeyMatches} from "../netlify/functions/lib/marketaux-auth.mjs";

const SESSION_ENDPOINT="https://geojitsignaldesk.netlify.app/.netlify/functions/marketaux-session";
const NEWS="https://geojitsignaldesk.netlify.app/.netlify/functions/marketaux-news";
const ui=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const saved=()=>Object.fromEntries(["MANAGER_ACCESS_KEY","MARKETAUX_USAGE_APPROVED","MARKETAUX_API_TOKEN"].map(k=>[k,process.env[k]]));
const reset=values=>{for(const [k,v] of Object.entries(values)){if(v===undefined)delete process.env[k];else process.env[k]=v}};
const parseCookie=setCookie=>setCookie.split(";")[0];
test("A signed HttpOnly Secure SameSite cookie expires after seven days and never contains the manager key",()=>{
 const old=saved();try{
  process.env.MANAGER_ACCESS_KEY="long-private-manager-secret-that-should-never-be-in-a-cookie";
  const now=Date.UTC(2026,9,29,10,0,0);
  const setCookie=makeSessionCookie(now);
  assert.match(setCookie,/Max-Age=604800/);
  assert.match(setCookie,/HttpOnly/);
  assert.match(setCookie,/Secure/);
  assert.match(setCookie,/SameSite=Strict/);
  assert.match(setCookie,/Path=\/\.netlify\/functions\//);
  assert.doesNotMatch(setCookie,/long-private-manager-secret/);
  const cookie=parseCookie(setCookie);
  const request=new Request(NEWS,{headers:{cookie}});
  assert.equal(sessionValid(request,now),true);
  assert.equal(sessionValid(request,now+(SESSION_SECONDS-1)*1000),true);
  assert.equal(sessionValid(request,now+SESSION_SECONDS*1000),false);
  const altered=cookie.replace(/[0-9a-f]$/,x=>x==="f"?"0":"f");
  assert.equal(sessionValid(new Request(NEWS,{headers:{cookie:altered}}),now),false);
  process.env.MANAGER_ACCESS_KEY="a-rotated-key";
  assert.equal(sessionValid(request,now),false);
 }finally{reset(old)}
});
test("Session endpoint signs in once, GET recognises browser session, DELETE clears it, bad keys are rejected",async()=>{
 const old=saved();try{
  process.env.MANAGER_ACCESS_KEY="a-test-only-strong-secret-for-session";
  const deny=await sessionHandler(new Request(SESSION_ENDPOINT,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:"wrong"})}));
  assert.equal(deny.status,401);
  const login=await sessionHandler(new Request(SESSION_ENDPOINT,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:process.env.MANAGER_ACCESS_KEY})}));
  assert.equal(login.status,200);
  assert.equal((await login.json()).authenticated,true);
  const cookie=parseCookie(login.headers.get("set-cookie"));
  assert.ok(cookie.startsWith(COOKIE_NAME+"="));
  const status=await sessionHandler(new Request(SESSION_ENDPOINT,{headers:{cookie}}));
  assert.equal(status.status,200);
  assert.equal((await status.json()).authenticated,true);
  const logout=await sessionHandler(new Request(SESSION_ENDPOINT,{method:"DELETE",headers:{cookie}}));
  assert.equal(logout.status,200);
  assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);
  assert.equal((await sessionHandler(new Request(SESSION_ENDPOINT))).status,200);
 }finally{reset(old)}
});
test("A signed cookie authorizes Marketaux metadata but cannot bypass commercial usage permission",async()=>{
 const old=saved();const fetchOld=globalThis.fetch;let called=0;
 try{
  process.env.MANAGER_ACCESS_KEY="test-manager-session-secret";
  process.env.MARKETAUX_API_TOKEN="fake-token";
  delete process.env.MARKETAUX_USAGE_APPROVED;
  globalThis.fetch=async()=>{called++;throw Error("Marketaux must not be called without permission")};
  const cookie=parseCookie(makeSessionCookie());
  const response=await marketauxHandler(new Request(NEWS,{headers:{cookie}}));
  assert.equal(response.status,403);
  assert.match((await response.json()).error,/pending confirmation/);
  assert.equal(called,0);
  const noCookie=await marketauxHandler(new Request(NEWS));
  assert.equal(noCookie.status,401);
  assert.equal(called,0);
 }finally{reset(old);globalThis.fetch=fetchOld}
});
test("Frontend recognises signed-in manager without repeated key and automatically loads selected tab",()=>{
 assert.match(html,/id="marketauxSignedIn"/);
 assert.match(html,/id="marketauxLogout"/);
 assert.match(html,/once every 7 days/);
 assert.match(ui,/fetch\("\/\.netlify\/functions\/marketaux-session"/);
 assert.match(ui,/credentials:"same-origin"/);
 assert.match(ui,/marketauxSession=true/);
 assert.match(ui,/if\(source==="Marketaux"\)activateMarketaux\(\)/);
 assert.match(ui,/if\(connected&&marketauxReady\(\)&&source==="Marketaux"\)await loadMarketaux\(\)/);
 assert.match(ui,/sessionStorage\.removeItem\("signaldesk:manager:key"\)/);
 assert.doesNotMatch(ui,/localStorage\.setItem\([^)]*managerKey/);
 assert.doesNotMatch(ui,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/);
});

test("Readiness reports specific missing approval vs missing token vs ready, without exposing token",async()=>{
 const old=saved();
 try{
  process.env.MANAGER_ACCESS_KEY="a-test-only-strong-secret-for-session";
  process.env.MARKETAUX_API_TOKEN="fake-private-token";
  delete process.env.MARKETAUX_USAGE_APPROVED;
  assert.equal(marketauxReadiness(),"approval_required");
  const cookie=parseCookie(makeSessionCookie());
  let res=await sessionHandler(new Request(SESSION_ENDPOINT,{headers:{cookie}}));
  let body=await res.json();
  assert.equal(body.authenticated,true);
  assert.equal(body.marketauxStatus,"approval_required");
  assert.doesNotMatch(JSON.stringify(body),/fake-private-token/);
  process.env.MARKETAUX_USAGE_APPROVED="true";
  delete process.env.MARKETAUX_API_TOKEN;
  assert.equal(marketauxReadiness(),"token_missing");
  res=await sessionHandler(new Request(SESSION_ENDPOINT,{headers:{cookie}}));
  assert.equal((await res.json()).marketauxStatus,"token_missing");
  process.env.MARKETAUX_API_TOKEN="fake-private-token";
  assert.equal(marketauxReadiness(),"ready");
  res=await sessionHandler(new Request(SESSION_ENDPOINT,{headers:{cookie}}));
  assert.equal((await res.json()).marketauxStatus,"ready");
  res=await sessionHandler(new Request(SESSION_ENDPOINT));
  body=await res.json();
  assert.equal(body.marketauxStatus,"sign_in_required");
 }finally{reset(old)}
});
test("Indian Markets clearly shows permission requirements and does not offer misleading Load button",()=>{
 assert.match(html,/id="marketauxSetup"/);
 assert.match(html,/MARKETAUX_USAGE_APPROVED/);
 assert.match(ui,/marketauxReadiness==="approval_required"/);
 assert.match(ui,/marketauxReadiness==="token_missing"/);
 assert.match(ui,/marketauxReadiness==="ready"/);
 assert.match(ui,/if\(!marketauxReady\(\)\)\{showMarketauxReadiness\(\);return\}/);
 assert.match(ui,/if\(connected&&marketauxReady\(\)&&source==="Marketaux"\)await loadMarketaux\(\)/);
 assert.match(ui,/\$\("marketauxLoad"\)\.disabled=marketauxLoading\|\|marketauxAuthPending\|\|!ready/);
});
