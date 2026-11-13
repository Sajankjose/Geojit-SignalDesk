import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";

const script=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const first=script.indexOf('const desktopAlertPrefKey=');
const last=script.indexOf('const parseTags=',first);
assert.ok(first>0&&last>first,"Desktop notification and feed-tracking functions are present");

function environment({support=true,permission="default",savedPreference="disabled"}={}){
 const store=new Map([["signaldesk:desktop-alerts-enabled:v1",savedPreference]]);
 const calls={requested:0,notifications:[],focus:0};
 const dom=new Map();
 const $=id=>{
  if(!dom.has(id))dom.set(id,{hidden:false,disabled:false,textContent:"",open:false,
   setAttribute(){},replaceChildren(){},append(){},classList:{toggle(){}}});
  return dom.get(id);
 };
 const NotificationClass=support?class TestNotification{
  constructor(title,details){calls.notifications.push({title,details})}
  close(){}
  static permission=permission;
  static async requestPermission(){calls.requested++;this.permission="granted";return "granted"}
 }:undefined;
 const win={isSecureContext:true,Notification:NotificationClass,focus:()=>calls.focus++};
 const ctx=createContext({window:win,document:{hidden:false},localStorage:{
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value))
 },payload:{stories:[],sources:[],warnings:[]},feedStateKey:"signaldesk:official-feed-tracking:v1",feedState:{known:[],unread:[]},$:id=>$(id),el:(tag,cls,text)=>({tag,cls,text,addEventListener(){},append(){}}),
  append(){},navigate(){},renderStories(){},startDraft(){},Date,Math,JSON,Set,Number,String,Array});
 runInContext(script.slice(first,last),ctx);
 return {ctx,calls,store,$,execute:s=>runInContext(s,ctx)};
}
const story=(id,minutes,priority=90,publisher="RBI")=>({
 id,publisher,title:publisher+" has issued an official policy update "+id,
 publishedAt:new Date(Date.now()-minutes*60_000).toISOString(),
 priority
});

test("Bell still tracks new official updates without asking for OS permission automatically",()=>{
 const e=environment();
 assert.equal(e.calls.requested,0);
 e.execute("registerFeed("+JSON.stringify([story("baseline",10)])+")");
 assert.equal(e.execute("feedState.unread.length"),0);
 e.execute("registerFeed("+JSON.stringify([story("baseline",10),story("new-high",2)])+")");
 assert.equal(e.execute("feedState.unread.length"),1);
 assert.equal(e.calls.notifications.length,0);
 assert.equal(e.calls.requested,0);
});

test("Explicit click opt-in requests permission and sends only fresh high-priority official news",async()=>{
 const e=environment();
 await e.execute("toggleDesktopAlerts()");
 assert.equal(e.calls.requested,1);
 assert.equal(e.execute("desktopAlertsActive()"),true);
 assert.equal(e.store.get("signaldesk:desktop-alerts-enabled:v1"),"enabled");
 assert.equal(e.$("desktopAlertToggle").textContent,"Turn off");
 assert.equal(e.$("desktopAlertTest").hidden,false);
 e.execute("registerFeed("+JSON.stringify([story("first-visit",10)])+")");
 assert.equal(e.calls.notifications.length,0,"No initial historical alert storm");
 const rows=[story("first-visit",10),story("new-policy",1,92,"SEBI"),story("routine",1,45,"RBI")];
 e.execute("registerFeed("+JSON.stringify(rows)+")");
 assert.equal(e.calls.notifications.length,1);
 assert.match(e.calls.notifications[0].title,/SEBI update/);
 assert.match(e.calls.notifications[0].details.body,/official policy update new-policy/);
 e.execute("registerFeed("+JSON.stringify(rows)+")");
 assert.equal(e.calls.notifications.length,1,"Do not repeatedly notify for the same source ID");
 assert.ok(e.store.get("signaldesk:desktop-alerts-shown:v1").includes("new-policy"));
});

test("Never send a desktop notification for 2-day-old headlines or low-ranked news",async()=>{
 const e=environment({permission:"granted"});
 await e.execute("toggleDesktopAlerts()");
 e.execute("registerFeed("+JSON.stringify([story("initial",1)])+")");
 e.execute("registerFeed("+JSON.stringify([story("initial",1),story("old",48,95),story("low",1,30)])+")");
 assert.equal(e.calls.notifications.length,0);
 assert.equal(e.execute("feedState.unread.length"),2,"In-app history may contain more news than browser alerts");
});

test("The user can disable notifications without disabling the in-app bell or feed tracking",async()=>{
 const e=environment({permission:"granted"});
 await e.execute("toggleDesktopAlerts()");
 assert.equal(e.execute("desktopAlertsActive()"),true);
 await e.execute("toggleDesktopAlerts()");
 assert.equal(e.execute("desktopAlertsActive()"),false);
 assert.equal(e.store.get("signaldesk:desktop-alerts-enabled:v1"),"disabled");
 assert.equal(e.$("desktopAlertToggle").textContent,"Enable alerts");
 e.execute("registerFeed("+JSON.stringify([story("baseline",15)])+")");
 e.execute("registerFeed("+JSON.stringify([story("baseline",15),story("new",1)])+")");
 assert.equal(e.calls.notifications.length,0);
 assert.equal(e.execute("feedState.unread.length"),1);
});

test("Test control sends a harmless notification when permission has been granted",async()=>{
 const e=environment({permission:"granted"});
 await e.execute("toggleDesktopAlerts()");
 e.execute("testDesktopAlert()");
 assert.equal(e.calls.notifications.length,1);
 assert.match(e.calls.notifications[0].title,/Test alert/);
 assert.match(e.$("desktopAlertStatus").textContent,/Test sent/);
});

test("Denied or unsupported notification permission still leaves the in-app alerts intact",()=>{
 const unsupported=environment({support:false});
 unsupported.execute("renderDesktopAlertControls()");
 assert.equal(unsupported.$("desktopAlertToggle").disabled,true);
 assert.match(unsupported.$("desktopAlertStatus").textContent,/in-app bell still works/);
 const denied=environment({permission:"denied"});
 denied.execute("renderDesktopAlertControls()");
 assert.equal(denied.$("desktopAlertToggle").disabled,true);
 assert.match(denied.$("desktopAlertStatus").textContent,/site settings/);
});

test("UI clearly says browser must stay open; provider POC is not silently auto-notified",()=>{
 for(const id of ["alertsButton","alertsList","desktopAlertToggle","desktopAlertTest","desktopAlertStatus"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/No alerts after the page is closed/);
 assert.match(script,/if\(!document\.hidden\|\|desktopAlertsActive\(\)\)refresh\(\)/);
 assert.match(script,/s\.publisher==="RBI"\|\|s\.publisher==="SEBI"/);
 assert.doesNotMatch(script,/serviceWorker\.register\(/);
 assert.doesNotMatch(script,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/);
});
